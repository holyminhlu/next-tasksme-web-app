import type { Prisma, RiskLevel } from "../../../generated/prisma/client.js";
import { prisma } from "../../config/database.js";
import { NotFoundError } from "../../lib/errors.js";
import { calculateTaskRisk } from "../../lib/risk-calculator.js";
import { getVisibleTask, type TaskActor } from "../tasks/task-access.js";

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
