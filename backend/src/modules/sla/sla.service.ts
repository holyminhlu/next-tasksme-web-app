import type { Prisma, Task } from "../../../generated/prisma/client.js";
import { prisma } from "../../config/database.js";
import {
  addBusinessMinutes,
  subtractBusinessMinutes,
  type BusinessCalendarInput,
} from "../../lib/business-time.js";
import { ForbiddenError, NotFoundError } from "../../lib/errors.js";

export async function assertSlaEnabled(workspaceId: string): Promise<void> {
  const module = await prisma.workspaceModule.findUnique({
    where: { workspaceId_moduleKey: { workspaceId, moduleKey: "sla" } },
  });
  if (!module?.enabled) throw new ForbiddenError("SLA module is not enabled for this workspace");
}

function conditionsMatch(
  conditions: Prisma.JsonValue,
  task: Pick<Task, "priority" | "status">,
): boolean {
  if (!conditions || typeof conditions !== "object" || Array.isArray(conditions)) return true;
  const object = conditions as Record<string, unknown>;
  const priorities = object.priorities ?? object.priority;
  const statuses = object.statuses ?? object.status;
  if (Array.isArray(priorities) && !priorities.includes(task.priority)) return false;
  if (typeof priorities === "string" && priorities !== task.priority) return false;
  if (Array.isArray(statuses) && !statuses.includes(task.status)) return false;
  if (typeof statuses === "string" && statuses !== task.status) return false;
  return true;
}

function calendarInput(calendar: {
  timezone: string;
  workingHours: Array<{ dayOfWeek: number; startMinute: number; endMinute: number }>;
  holidays: Array<{ date: Date; isWorking: boolean }>;
}): BusinessCalendarInput {
  return calendar;
}

export async function initializeTaskSla(task: Pick<Task, "id" | "workspaceId" | "priority" | "status">) {
  const module = await prisma.workspaceModule.findUnique({
    where: { workspaceId_moduleKey: { workspaceId: task.workspaceId, moduleKey: "sla" } },
  });
  if (!module?.enabled) return [];
  const policies = await prisma.slaPolicy.findMany({
    where: { workspaceId: task.workspaceId, isActive: true, triggerType: "TASK_CREATED" },
    include: {
      businessCalendar: { include: { workingHours: true, holidays: true } },
    },
  });
  const startedAt = new Date();
  const created = [];
  for (const policy of policies) {
    if (!conditionsMatch(policy.applicableConditionsJson, task)) continue;
    const dueAt = policy.businessCalendar
      ? addBusinessMinutes(
          startedAt,
          policy.targetDurationMinutes,
          calendarInput(policy.businessCalendar),
        )
      : new Date(startedAt.getTime() + policy.targetDurationMinutes * 60_000);
    const warningAt =
      policy.warningBeforeMinutes > 0
        ? policy.businessCalendar
          ? subtractBusinessMinutes(
              dueAt,
              policy.warningBeforeMinutes,
              calendarInput(policy.businessCalendar),
            )
          : new Date(dueAt.getTime() - policy.warningBeforeMinutes * 60_000)
        : null;
    created.push(
      await prisma.taskSlaInstance.create({
        data: {
          workspaceId: task.workspaceId,
          taskId: task.id,
          policyId: policy.id,
          startedAt,
          dueAt,
          warningAt,
        },
      }),
    );
  }
  return created;
}

async function notifySla(instanceId: string, kind: "warning" | "breach", now = new Date()) {
  return prisma.$transaction(async (tx) => {
    const instance = await tx.taskSlaInstance.findUnique({
      where: { id: instanceId },
      include: { task: true, policy: true },
    });
    if (!instance || instance.status !== "ACTIVE") return false;
    const field = kind === "warning" ? "warningSentAt" : "breachNotifiedAt";
    if (instance[field]) return false;
    const claimed = await tx.taskSlaInstance.updateMany({
      where: { id: instance.id, status: "ACTIVE", [field]: null },
      data:
        kind === "warning"
          ? { warningSentAt: now }
          : { breachNotifiedAt: now, breachedAt: now, status: "BREACHED" },
    });
    if (claimed.count !== 1) return false;
    const userId = instance.task.assigneeId ?? instance.task.createdById;
    if (!userId) return true;
    const preference = await tx.notificationPreference.findUnique({
      where: { workspaceId_userId: { workspaceId: instance.workspaceId, userId } },
    });
    if (
      (kind === "warning" && preference?.slaWarning === false) ||
      (kind === "breach" && preference?.slaBreached === false)
    ) {
      return true;
    }
    const dedupeKey = `sla-${kind}:${instance.id}`;
    await tx.notification.upsert({
      where: { dedupeKey },
      update: {},
      create: {
        workspaceId: instance.workspaceId,
        userId,
        taskId: instance.taskId,
        type: kind === "warning" ? "SLA_WARNING" : "SLA_BREACHED",
        title:
          kind === "warning"
            ? `SLA warning: ${instance.task.title}`
            : `SLA breached: ${instance.task.title}`,
        body: `Policy: ${instance.policy.name}`,
        dedupeKey,
      },
    });
    return true;
  });
}

export async function processDueSlaNotifications(limit: number, now = new Date()) {
  const rows = await prisma.$queryRaw<Array<{ id: string; kind: "warning" | "breach" }>>`
    (
      SELECT "id", 'warning'::text AS kind FROM "task_sla_instances"
      WHERE "status" = 'ACTIVE' AND "warningSentAt" IS NULL AND "warningAt" <= ${now}
      ORDER BY "warningAt" LIMIT ${limit}
    )
    UNION ALL
    (
      SELECT "id", 'breach'::text AS kind FROM "task_sla_instances"
      WHERE "status" = 'ACTIVE' AND "breachNotifiedAt" IS NULL AND "dueAt" <= ${now}
      ORDER BY "dueAt" LIMIT ${limit}
    )
  `;
  return Promise.all(rows.map((row) => notifySla(row.id, row.kind, now)));
}

export class SlaService {
  async listPolicies(workspaceId: string) {
    await assertSlaEnabled(workspaceId);
    return prisma.slaPolicy.findMany({ where: { workspaceId }, orderBy: { createdAt: "asc" } });
  }

  async createPolicy(
    workspaceId: string,
    userId: string,
    input: {
      name: string;
      targetDurationMinutes: number;
      warningBeforeMinutes: number;
      applicableConditions?: Prisma.InputJsonValue;
      businessCalendarId?: string | null;
      isActive?: boolean;
    },
  ) {
    await assertSlaEnabled(workspaceId);
    return prisma.slaPolicy.create({
      data: {
        workspaceId,
        createdById: userId,
        name: input.name,
        targetDurationMinutes: input.targetDurationMinutes,
        warningBeforeMinutes: input.warningBeforeMinutes,
        applicableConditionsJson: input.applicableConditions ?? {},
        businessCalendarId: input.businessCalendarId,
        isActive: input.isActive ?? true,
      },
    });
  }

  async updatePolicy(workspaceId: string, id: string, input: Prisma.SlaPolicyUpdateInput) {
    await assertSlaEnabled(workspaceId);
    const policy = await prisma.slaPolicy.findFirst({ where: { id, workspaceId } });
    if (!policy) throw new NotFoundError("SLA policy not found");
    return prisma.slaPolicy.update({ where: { id }, data: input });
  }

  async deletePolicy(workspaceId: string, id: string) {
    await assertSlaEnabled(workspaceId);
    const result = await prisma.slaPolicy.deleteMany({ where: { id, workspaceId } });
    if (!result.count) throw new NotFoundError("SLA policy not found");
    return { deleted: true };
  }

  async taskInstances(workspaceId: string, taskId: string) {
    await assertSlaEnabled(workspaceId);
    const rows = await prisma.taskSlaInstance.findMany({
      where: { workspaceId, taskId },
      include: { policy: true },
      orderBy: { createdAt: "desc" },
    });
    const now = Date.now();
    return rows.map((row) => ({
      id: row.id,
      taskId: row.taskId,
      policyId: row.policyId,
      policyName: row.policy.name,
      startedAt: row.startedAt.toISOString(),
      dueAt: row.dueAt.toISOString(),
      warningAt: row.warningAt?.toISOString() ?? null,
      status: row.status,
      pausedAt: row.pausedAt?.toISOString() ?? null,
      totalPausedSeconds: row.totalPausedSeconds,
      warningSentAt: row.warningSentAt?.toISOString() ?? null,
      breachedAt: row.breachedAt?.toISOString() ?? null,
      remainingSeconds:
        row.status === "ACTIVE" || row.status === "PAUSED"
          ? Math.round((row.dueAt.getTime() - now) / 1000)
          : null,
    }));
  }

  async pause(workspaceId: string, id: string) {
    await assertSlaEnabled(workspaceId);
    const result = await prisma.taskSlaInstance.updateMany({
      where: { id, workspaceId, status: "ACTIVE" },
      data: { status: "PAUSED", pausedAt: new Date() },
    });
    if (!result.count) throw new NotFoundError("Active SLA instance not found");
    return prisma.taskSlaInstance.findUniqueOrThrow({ where: { id } });
  }

  async resume(workspaceId: string, id: string) {
    await assertSlaEnabled(workspaceId);
    const instance = await prisma.taskSlaInstance.findFirst({
      where: { id, workspaceId, status: "PAUSED", pausedAt: { not: null } },
    });
    if (!instance || !instance.pausedAt) throw new NotFoundError("Paused SLA instance not found");
    const pausedSeconds = Math.max(0, Math.floor((Date.now() - instance.pausedAt.getTime()) / 1000));
    return prisma.taskSlaInstance.update({
      where: { id },
      data: {
        status: "ACTIVE",
        pausedAt: null,
        totalPausedSeconds: { increment: pausedSeconds },
        dueAt: new Date(instance.dueAt.getTime() + pausedSeconds * 1000),
        warningAt: instance.warningAt
          ? new Date(instance.warningAt.getTime() + pausedSeconds * 1000)
          : null,
      },
    });
  }
}

export const slaService = new SlaService();
