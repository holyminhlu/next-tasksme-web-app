import type {
  Prisma,
  RecurrenceFrequency,
  RecurrenceOverlapPolicy,
} from "../../../generated/prisma/client.js";
import { prisma } from "../../config/database.js";
import { ConflictError, NotFoundError } from "../../lib/errors.js";
import { computeNextRunAt, previewNextRuns } from "../../lib/recurrence-schedule.js";
import { OPEN_TASK_STATUSES } from "../../lib/task-scope.js";
import { recordActivity } from "../../services/activity.service.js";
import { writeAuditLog } from "../../services/audit.service.js";
import { createTaskFromFactory } from "../../services/task-factory.service.js";
import { upsertAutomationRun } from "../automation/automation-runs.service.js";
import { getVisibleTask, type TaskActor } from "../tasks/task-access.js";

export type RecurrenceInput = {
  frequency: RecurrenceFrequency;
  interval?: number;
  daysOfWeek?: number[];
  dayOfMonth?: number | null;
  timezone: string;
  startAt: string | Date;
  endAt?: string | Date | null;
  overlapPolicy?: RecurrenceOverlapPolicy;
};

function daysOfWeekFromJson(value: Prisma.JsonValue): number[] {
  return Array.isArray(value)
    ? value.filter((item): item is number => typeof item === "number")
    : [];
}

function scheduleOf(recurrence: {
  frequency: RecurrenceFrequency;
  interval: number;
  daysOfWeekJson: Prisma.JsonValue;
  dayOfMonth: number | null;
  timezone: string;
  startAt: Date;
  endAt: Date | null;
}) {
  return {
    frequency: recurrence.frequency,
    interval: recurrence.interval,
    daysOfWeek: daysOfWeekFromJson(recurrence.daysOfWeekJson),
    dayOfMonth: recurrence.dayOfMonth,
    timezone: recurrence.timezone,
    startAt: recurrence.startAt,
    endAt: recurrence.endAt,
  };
}

function mapRecurrence<T extends {
  id: string;
  workspaceId: string;
  templateTaskId: string;
  frequency: RecurrenceFrequency;
  interval: number;
  daysOfWeekJson: Prisma.JsonValue;
  dayOfMonth: number | null;
  timezone: string;
  startAt: Date;
  endAt: Date | null;
  nextRunAt: Date | null;
  lastRunAt: Date | null;
  overlapPolicy: RecurrenceOverlapPolicy;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}>(recurrence: T) {
  return {
    id: recurrence.id,
    workspaceId: recurrence.workspaceId,
    templateTaskId: recurrence.templateTaskId,
    frequency: recurrence.frequency,
    interval: recurrence.interval,
    daysOfWeek: daysOfWeekFromJson(recurrence.daysOfWeekJson),
    dayOfMonth: recurrence.dayOfMonth,
    timezone: recurrence.timezone,
    startAt: recurrence.startAt.toISOString(),
    endAt: recurrence.endAt?.toISOString() ?? null,
    nextRunAt: recurrence.nextRunAt?.toISOString() ?? null,
    lastRunAt: recurrence.lastRunAt?.toISOString() ?? null,
    overlapPolicy: recurrence.overlapPolicy,
    isActive: recurrence.isActive,
    createdAt: recurrence.createdAt.toISOString(),
    updatedAt: recurrence.updatedAt.toISOString(),
  };
}

export class RecurrencesService {
  async get(workspaceId: string, taskId: string, actor: TaskActor) {
    await getVisibleTask(workspaceId, taskId, actor, { includeArchived: true });
    const recurrence = await prisma.taskRecurrence.findFirst({
      where: { workspaceId, templateTaskId: taskId },
      include: { occurrences: { orderBy: { scheduledAt: "desc" }, take: 20 } },
    });
    return recurrence ? mapRecurrence(recurrence) : null;
  }

  async upsert(workspaceId: string, taskId: string, actor: TaskActor, input: RecurrenceInput) {
    await getVisibleTask(workspaceId, taskId, actor, { includeArchived: true });
    const startAt = new Date(input.startAt);
    const endAt = input.endAt ? new Date(input.endAt) : null;
    const schedule = {
      frequency: input.frequency,
      interval: input.interval ?? 1,
      daysOfWeek: input.daysOfWeek ?? [],
      dayOfMonth: input.dayOfMonth,
      timezone: input.timezone,
      startAt,
      endAt,
    };
    const nextRunAt = computeNextRunAt(schedule, new Date());
    const existing = await prisma.taskRecurrence.findFirst({
      where: { workspaceId, templateTaskId: taskId },
    });
    const data = {
      frequency: input.frequency,
      interval: input.interval ?? 1,
      daysOfWeekJson: (input.daysOfWeek ?? []) as Prisma.InputJsonValue,
      dayOfMonth: input.dayOfMonth,
      timezone: input.timezone,
      startAt,
      endAt,
      overlapPolicy: input.overlapPolicy ?? "SKIP_IF_OPEN",
      nextRunAt,
      isActive: true,
    };
    const recurrence = existing
      ? await prisma.taskRecurrence.update({ where: { id: existing.id }, data })
      : await prisma.taskRecurrence.create({
          data: {
            workspaceId,
            templateTaskId: taskId,
            createdById: actor.userId,
            ...data,
          },
        });
    await recordActivity({
      workspaceId,
      actorId: actor.userId,
      action: existing ? "recurrence.updated" : "recurrence.created",
      resourceType: "task",
      resourceId: taskId,
      summary: `${existing ? "Updated" : "Created"} task recurrence`,
      metadata: { recurrenceId: recurrence.id, nextRunAt: recurrence.nextRunAt?.toISOString() },
    });
    await writeAuditLog({
      action: existing ? "task_recurrence.updated" : "task_recurrence.created",
      userId: actor.userId,
      workspaceId,
      entityType: "task_recurrence",
      entityId: recurrence.id,
      metadata: { templateTaskId: taskId },
    });
    return mapRecurrence(recurrence);
  }

  async remove(workspaceId: string, taskId: string, actor: TaskActor) {
    await getVisibleTask(workspaceId, taskId, actor, { includeArchived: true });
    const recurrence = await prisma.taskRecurrence.findFirst({
      where: { workspaceId, templateTaskId: taskId },
    });
    if (!recurrence) throw new NotFoundError("Task recurrence not found");
    await prisma.taskRecurrence.delete({ where: { id: recurrence.id } });
    await writeAuditLog({
      action: "task_recurrence.deleted",
      userId: actor.userId,
      workspaceId,
      entityType: "task_recurrence",
      entityId: recurrence.id,
      metadata: { templateTaskId: taskId },
    });
    return { ok: true as const };
  }

  async preview(input: RecurrenceInput, count = 10) {
    return {
      nextRuns: previewNextRuns(
        {
          ...input,
          interval: input.interval ?? 1,
          daysOfWeek: input.daysOfWeek ?? [],
        },
        count,
      ).map((date) => date.toISOString()),
    };
  }

  async pause(workspaceId: string, taskId: string, actor: TaskActor) {
    await getVisibleTask(workspaceId, taskId, actor, { includeArchived: true });
    const recurrence = await prisma.taskRecurrence.findFirst({
      where: { workspaceId, templateTaskId: taskId },
    });
    if (!recurrence) throw new NotFoundError("Task recurrence not found");
    const updated = await prisma.taskRecurrence.update({
      where: { id: recurrence.id },
      data: { isActive: false, nextRunAt: null },
    });
    await writeAuditLog({
      action: "task_recurrence.paused",
      userId: actor.userId,
      workspaceId,
      entityType: "task_recurrence",
      entityId: recurrence.id,
      metadata: { templateTaskId: taskId },
    });
    return mapRecurrence(updated);
  }

  async resume(workspaceId: string, taskId: string, actor: TaskActor) {
    await getVisibleTask(workspaceId, taskId, actor, { includeArchived: true });
    const recurrence = await prisma.taskRecurrence.findFirst({
      where: { workspaceId, templateTaskId: taskId },
    });
    if (!recurrence) throw new NotFoundError("Task recurrence not found");
    const updated = await prisma.taskRecurrence.update({
      where: { id: recurrence.id },
      data: {
        isActive: true,
        nextRunAt: computeNextRunAt(scheduleOf(recurrence), new Date()),
      },
    });
    await writeAuditLog({
      action: "task_recurrence.resumed",
      userId: actor.userId,
      workspaceId,
      entityType: "task_recurrence",
      entityId: recurrence.id,
      metadata: { templateTaskId: taskId },
    });
    return mapRecurrence(updated);
  }
}

export async function generateDueOccurrences(recurrenceId: string, now = new Date()) {
  const recurrence = await prisma.taskRecurrence.findUnique({
    where: { id: recurrenceId },
    include: { templateTask: true },
  });
  if (!recurrence || !recurrence.isActive || !recurrence.nextRunAt || recurrence.nextRunAt > now) {
    return null;
  }
  const scheduledAt = recurrence.nextRunAt;
  const reserved = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`recurrence:${recurrenceId}`}))`;
    const existing = await tx.recurringTaskOccurrence.findUnique({
      where: { recurrenceId_scheduledAt: { recurrenceId, scheduledAt } },
    });
    if (existing) return { occurrence: existing, duplicate: true };
    return {
      occurrence: await tx.recurringTaskOccurrence.create({
        data: { recurrenceId, scheduledAt, status: "PENDING" },
      }),
      duplicate: false,
    };
  });
  if (reserved.duplicate) return reserved.occurrence;

  const nextRunAt = computeNextRunAt(scheduleOf(recurrence), scheduledAt);
  const run = await upsertAutomationRun({
    workspaceId: recurrence.workspaceId,
    taskId: recurrence.templateTaskId,
    jobType: "RECURRENCE_GENERATE",
    idempotencyKey: `recurrence:${recurrence.id}:${scheduledAt.toISOString()}`,
    payload: { recurrenceId, scheduledAt: scheduledAt.toISOString() },
  });
  const openCount =
    recurrence.overlapPolicy === "SKIP_IF_OPEN"
      ? await prisma.recurringTaskOccurrence.count({
          where: {
            recurrenceId,
            status: "CREATED",
            generatedTask: { status: { in: [...OPEN_TASK_STATUSES] }, deletedAt: null },
          },
        })
      : 0;
  if (openCount > 0) {
    const occurrence = await prisma.recurringTaskOccurrence.update({
      where: { id: reserved.occurrence.id },
      data: { status: "SKIPPED", errorMessage: "An earlier occurrence is still open" },
    });
    await prisma.taskRecurrence.update({
      where: { id: recurrence.id },
      data: { lastRunAt: scheduledAt, nextRunAt },
    });
    await prisma.automationRun.update({
      where: { id: run.id },
      data: { status: "SKIPPED", completedAt: new Date(), resultJson: { reason: "open_occurrence" } },
    });
    const notifyUserId =
      recurrence.templateTask.assigneeId ??
      recurrence.createdById ??
      recurrence.templateTask.createdById;
    if (notifyUserId) {
      const preference = await prisma.notificationPreference.findUnique({
        where: {
          workspaceId_userId: { workspaceId: recurrence.workspaceId, userId: notifyUserId },
        },
      });
      if (preference?.recurrenceSkipped !== false) {
        await prisma.notification.upsert({
          where: { dedupeKey: `recurrence-skipped:${occurrence.id}:${notifyUserId}` },
          update: {},
          create: {
            workspaceId: recurrence.workspaceId,
            userId: notifyUserId,
            taskId: recurrence.templateTaskId,
            type: "RECURRENCE_SKIPPED",
            title: `Recurring task skipped: ${recurrence.templateTask.title}`,
            body: "An earlier occurrence is still open.",
            dedupeKey: `recurrence-skipped:${occurrence.id}:${notifyUserId}`,
          },
        });
      }
    }
    return occurrence;
  }

  try {
    const result = await createTaskFromFactory({
      workspaceId: recurrence.workspaceId,
      title: recurrence.templateTask.title,
      description: recurrence.templateTask.description,
      status: recurrence.templateTask.status === "DONE" ? "TODO" : recurrence.templateTask.status,
      priority: recurrence.templateTask.priority,
      projectId: recurrence.templateTask.projectId,
      assigneeId: recurrence.templateTask.assigneeId,
      createdById: recurrence.createdById ?? recurrence.templateTask.createdById,
      startAt: null,
      dueDate: null,
    });
    const occurrence = await prisma.$transaction(async (tx) => {
      const updated = await tx.recurringTaskOccurrence.update({
        where: { id: reserved.occurrence.id },
        data: { status: "CREATED", generatedTaskId: result.task.id },
      });
      await tx.taskRecurrence.update({
        where: { id: recurrence.id },
        data: { lastRunAt: scheduledAt, nextRunAt },
      });
      await tx.automationRun.update({
        where: { id: run.id },
        data: {
          status: "SUCCEEDED",
          attempts: { increment: 1 },
          completedAt: new Date(),
          resultJson: { taskId: result.task.id, warnings: result.warnings },
        },
      });
      return updated;
    });
    if (recurrence.overlapPolicy === "CREATE_AND_NOTIFY" && result.task.assigneeId) {
      await prisma.notification.upsert({
        where: { dedupeKey: `recurrence-created:${occurrence.id}:${result.task.assigneeId}` },
        update: {},
        create: {
          workspaceId: recurrence.workspaceId,
          userId: result.task.assigneeId,
          taskId: result.task.id,
          type: "RECURRENCE_CREATED",
          title: `Recurring task created: ${result.task.title}`,
          dedupeKey: `recurrence-created:${occurrence.id}:${result.task.assigneeId}`,
        },
      });
    }
    return occurrence;
  } catch (error) {
    await prisma.recurringTaskOccurrence.update({
      where: { id: reserved.occurrence.id },
      data: { status: "FAILED", errorMessage: error instanceof Error ? error.message : String(error) },
    });
    await prisma.automationRun.update({
      where: { id: run.id },
      data: { status: "FAILED", errorMessage: error instanceof Error ? error.message : String(error) },
    });
    throw error;
  }
}

export const recurrencesService = new RecurrencesService();
