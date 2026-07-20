import type { Prisma, RiskLevel } from "../../../generated/prisma/client.js";
import { prisma } from "../../config/database.js";
import { NotFoundError } from "../../lib/errors.js";
import { calculateTaskRisk } from "../../lib/risk-calculator.js";
import { writeAuditLog } from "../../services/audit.service.js";
import { getVisibleTask, type TaskActor } from "../tasks/task-access.js";

const RISK_RANK: Record<RiskLevel, number> = {
  LOW: 0,
  MEDIUM: 1,
  HIGH: 2,
  CRITICAL: 3,
};

async function notifyRiskEscalation(
  task: {
    id: string;
    workspaceId: string;
    title: string;
    assigneeId: string | null;
    createdById: string | null;
  },
  previousLevel: RiskLevel | null,
  nextLevel: RiskLevel,
) {
  if (!previousLevel || RISK_RANK[nextLevel] <= RISK_RANK[previousLevel]) return;
  const userId = task.assigneeId ?? task.createdById;
  if (!userId) return;
  const preference = await prisma.notificationPreference.findUnique({
    where: { workspaceId_userId: { workspaceId: task.workspaceId, userId } },
  });
  if (preference?.riskEscalated === false) return;
  const dedupeKey = `risk-escalated:${task.id}:${nextLevel}`;
  await prisma.notification.upsert({
    where: { dedupeKey },
    update: {},
    create: {
      workspaceId: task.workspaceId,
      userId,
      taskId: task.id,
      type: "RISK_ESCALATED",
      title: `Risk escalated to ${nextLevel}: ${task.title}`,
      body: `Risk increased from ${previousLevel} to ${nextLevel}.`,
      dedupeKey,
    },
  });
}

export async function recalculateTaskRisk(taskId: string, now = new Date()) {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: {
      predecessorDependencies: {
        include: {
          predecessorTask: { select: { status: true, dueDate: true } },
        },
      },
      workspace: {
        include: {
          riskRules: { where: { isActive: true }, orderBy: { updatedAt: "desc" }, take: 1 },
        },
      },
    },
  });
  if (!task) throw new NotFoundError("Task not found");
  const rule = task.workspace.riskRules[0];
  const result = calculateTaskRisk(
    {
      dueDate: task.dueDate,
      status: task.status,
      isBlocked: task.isBlocked,
      updatedAt: task.updatedAt,
      assigneeId: task.assigneeId,
      dependencies: task.predecessorDependencies.map((dependency) => dependency.predecessorTask),
    },
    { weights: rule?.weightsJson, thresholds: rule?.thresholdsJson },
    now,
  );
  const level = task.manualRiskLevel ?? result.level;
  const previousLevel = task.riskLevel;
  await prisma.$transaction([
    prisma.task.update({
      where: { id: task.id },
      data: {
        riskLevel: level,
        riskScore: result.score,
        riskReasonsJson: result.reasons,
        riskCalculatedAt: result.calculatedAt,
        riskRecalculateAt: null,
      },
    }),
    prisma.taskRiskSnapshot.create({
      data: {
        taskId: task.id,
        riskLevel: level,
        riskScore: result.score,
        riskReasons: result.reasons,
        calculatedAt: result.calculatedAt,
      },
    }),
  ]);
  await notifyRiskEscalation(
    {
      id: task.id,
      workspaceId: task.workspaceId,
      title: task.title,
      assigneeId: task.assigneeId,
      createdById: task.createdById,
    },
    previousLevel,
    level,
  );
  return { ...result, level, manualRiskLevel: task.manualRiskLevel };
}

export async function recalculateDueTaskRisks(limit: number, now = new Date()) {
  const ids = await prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "tasks"
      WHERE "riskRecalculateAt" <= ${now}
        AND "deletedAt" IS NULL
      ORDER BY "riskRecalculateAt"
      FOR UPDATE SKIP LOCKED
      LIMIT ${limit}
    `;
    if (rows.length) {
      await tx.task.updateMany({
        where: { id: { in: rows.map((row) => row.id) } },
        data: { riskRecalculateAt: new Date(now.getTime() + 60_000) },
      });
    }
    return rows.map((row) => row.id);
  });
  return Promise.all(ids.map((id) => recalculateTaskRisk(id, now)));
}

export class RiskService {
  async get(workspaceId: string, taskId: string, actor: TaskActor) {
    await getVisibleTask(workspaceId, taskId, actor, { includeArchived: true });
    const task = await prisma.task.findUniqueOrThrow({ where: { id: taskId } });
    if (!task.riskCalculatedAt) {
      const calculated = await recalculateTaskRisk(taskId);
      return {
        taskId,
        manualRiskLevel: calculated.manualRiskLevel,
        riskLevel: calculated.level,
        riskScore: calculated.score,
        riskReasons: calculated.reasons,
        calculatedAt: calculated.calculatedAt.toISOString(),
      };
    }
    return {
      taskId,
      manualRiskLevel: task.manualRiskLevel,
      riskLevel: task.riskLevel,
      riskScore: task.riskScore,
      riskReasons: Array.isArray(task.riskReasonsJson)
        ? (task.riskReasonsJson as string[])
        : [],
      calculatedAt: task.riskCalculatedAt.toISOString(),
    };
  }

  async setManual(
    workspaceId: string,
    taskId: string,
    actor: TaskActor,
    manualRiskLevel: RiskLevel | null,
  ) {
    await getVisibleTask(workspaceId, taskId, actor, { includeArchived: true });
    await prisma.task.update({
      where: { id: taskId },
      data: { manualRiskLevel, riskRecalculateAt: new Date() },
    });
    const calculated = await recalculateTaskRisk(taskId);
    return {
      taskId,
      manualRiskLevel: calculated.manualRiskLevel,
      riskLevel: calculated.level,
      riskScore: calculated.score,
      riskReasons: calculated.reasons,
      calculatedAt: calculated.calculatedAt.toISOString(),
    };
  }

  async getRule(workspaceId: string) {
    const rule = await prisma.riskRule.findFirst({
      where: { workspaceId, isActive: true },
      orderBy: { updatedAt: "desc" },
    });
    if (!rule) return null;
    return {
      id: rule.id,
      workspaceId: rule.workspaceId,
      name: rule.name,
      weights: rule.weightsJson,
      thresholds: rule.thresholdsJson,
      isActive: rule.isActive,
    };
  }

  async upsertRule(
    workspaceId: string,
    userId: string,
    input: { name?: string; weights: Prisma.InputJsonValue; thresholds: Prisma.InputJsonValue },
  ) {
    const name = input.name ?? "Default";
    const rule = await prisma.riskRule.upsert({
      where: { workspaceId_name: { workspaceId, name } },
      update: {
        weightsJson: input.weights,
        thresholdsJson: input.thresholds,
        updatedById: userId,
        isActive: true,
      },
      create: {
        workspaceId,
        name,
        weightsJson: input.weights,
        thresholdsJson: input.thresholds,
        updatedById: userId,
      },
    });
    await prisma.task.updateMany({
      where: { workspaceId, deletedAt: null },
      data: { riskRecalculateAt: new Date() },
    });
    await writeAuditLog({
      action: "risk_rule.upserted",
      userId,
      workspaceId,
      entityType: "risk_rule",
      entityId: rule.id,
      metadata: { name: rule.name },
    });
    return {
      id: rule.id,
      workspaceId: rule.workspaceId,
      name: rule.name,
      weights: rule.weightsJson,
      thresholds: rule.thresholdsJson,
      isActive: rule.isActive,
    };
  }
}

export const riskService = new RiskService();
