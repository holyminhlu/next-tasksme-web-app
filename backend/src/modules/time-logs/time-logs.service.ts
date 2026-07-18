import { prisma } from "../../config/database.js";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "../../lib/errors.js";
import {
  ACTIVITY_ACTIONS,
  recordActivity,
} from "../../services/activity.service.js";
import { getVisibleTask, type TaskActor } from "../tasks/task-access.js";
import type {
  CreateManualTimeLogInput,
  ListTimeLogsQuery,
  StartTimerInput,
  StopTimerInput,
  UpdateTimeLogInput,
} from "./time-logs.schemas.js";

const TIME_LOG_INCLUDE = {
  user: { select: { id: true, fullName: true, email: true } },
  task: { select: { id: true, taskNumber: true, title: true } },
} as const;

function mapTimeLog(log: {
  id: string;
  workspaceId: string;
  taskId: string;
  userId: string;
  startedAt: Date;
  endedAt: Date | null;
  durationSeconds: number | null;
  description: string | null;
  source: string;
  createdAt: Date;
  updatedAt: Date;
  user: { id: string; fullName: string; email: string };
  task: { id: string; taskNumber: number; title: string };
}) {
  return {
    ...log,
    startedAt: log.startedAt.toISOString(),
    endedAt: log.endedAt?.toISOString() ?? null,
    createdAt: log.createdAt.toISOString(),
    updatedAt: log.updatedAt.toISOString(),
    userName: log.user.fullName,
    userEmail: log.user.email,
    taskNumber: log.task.taskNumber,
    taskTitle: log.task.title,
  };
}

async function assertNoOverlap(
  workspaceId: string,
  userId: string,
  startedAt: Date,
  endedAt: Date,
  excludeId?: string,
) {
  const overlap = await prisma.timeLog.findFirst({
    where: {
      workspaceId,
      userId,
      ...(excludeId ? { id: { not: excludeId } } : {}),
      startedAt: { lt: endedAt },
      OR: [{ endedAt: null }, { endedAt: { gt: startedAt } }],
    },
    select: { id: true },
  });
  if (overlap) {
    throw new ConflictError("Time log overlaps an existing time entry");
  }
}

function canManageLog(actor: TaskActor, ownerId: string) {
  return (
    ownerId === actor.userId ||
    Boolean(actor.permissions?.includes("time_log.manage_all"))
  );
}

export class TimeLogsService {
  async list(
    workspaceId: string,
    taskId: string,
    actor: TaskActor,
    query: ListTimeLogsQuery,
  ) {
    await getVisibleTask(workspaceId, taskId, actor, {
      includeArchived: true,
    });
    const team = query.scope === "team";
    if (team && !actor.permissions?.includes("time_log.view_all")) {
      throw new ForbiddenError("Permission to view team time logs is required");
    }
    const where = {
      workspaceId,
      taskId,
      ...(team ? {} : { userId: actor.userId }),
    };
    const logs = await prisma.timeLog.findMany({
      where,
      include: TIME_LOG_INCLUDE,
      orderBy: { startedAt: "desc" },
    });
    const ownSeconds = logs
      .filter((log) => log.userId === actor.userId)
      .reduce((sum, log) => sum + (log.durationSeconds ?? 0), 0);
    const totalSeconds = logs.reduce(
      (sum, log) => sum + (log.durationSeconds ?? 0),
      0,
    );
    return {
      items: logs.map(mapTimeLog),
      scope: query.scope,
      ownSeconds,
      totalSeconds,
    };
  }

  async running(workspaceId: string, actor: TaskActor) {
    const log = await prisma.timeLog.findFirst({
      where: { workspaceId, userId: actor.userId, endedAt: null },
      include: TIME_LOG_INCLUDE,
    });
    return log ? mapTimeLog(log) : null;
  }

  async start(
    workspaceId: string,
    taskId: string,
    actor: TaskActor,
    input: StartTimerInput,
  ) {
    const task = await getVisibleTask(workspaceId, taskId, actor);
    const existing = await prisma.timeLog.findFirst({
      where: { workspaceId, userId: actor.userId, endedAt: null },
      include: TIME_LOG_INCLUDE,
    });
    if (existing) {
      throw new ConflictError(
        `A timer is already running for task #${existing.task.taskNumber}`,
      );
    }
    const log = await prisma.timeLog.create({
      data: {
        workspaceId,
        taskId,
        userId: actor.userId,
        startedAt: new Date(),
        description: input.description ?? null,
        source: "TIMER",
      },
      include: TIME_LOG_INCLUDE,
    });
    await recordActivity({
      workspaceId,
      actorId: actor.userId,
      action: ACTIVITY_ACTIONS.TIMER_STARTED,
      resourceType: "task",
      resourceId: taskId,
      projectId: task.projectId,
      summary: `Started timer on task #${task.taskNumber}`,
      metadata: { timeLogId: log.id },
    });
    return mapTimeLog(log);
  }

  async stop(
    workspaceId: string,
    taskId: string,
    actor: TaskActor,
    input: StopTimerInput,
  ) {
    const task = await getVisibleTask(workspaceId, taskId, actor, {
      includeArchived: true,
    });
    const running = await prisma.timeLog.findFirst({
      where: {
        workspaceId,
        taskId,
        userId: actor.userId,
        endedAt: null,
      },
    });
    if (!running) throw new NotFoundError("No running timer for this task");
    const endedAt = new Date();
    const durationSeconds = Math.max(
      0,
      Math.floor((endedAt.getTime() - running.startedAt.getTime()) / 1000),
    );
    const log = await prisma.timeLog.update({
      where: { id: running.id },
      data: {
        endedAt,
        durationSeconds,
        description:
          input.description === undefined
            ? running.description
            : input.description,
      },
      include: TIME_LOG_INCLUDE,
    });
    await recordActivity({
      workspaceId,
      actorId: actor.userId,
      action: ACTIVITY_ACTIONS.TIMER_STOPPED,
      resourceType: "task",
      resourceId: taskId,
      projectId: task.projectId,
      summary: `Stopped timer on task #${task.taskNumber}`,
      metadata: { timeLogId: log.id, durationSeconds },
    });
    return mapTimeLog(log);
  }

  async createManual(
    workspaceId: string,
    taskId: string,
    actor: TaskActor,
    input: CreateManualTimeLogInput,
  ) {
    const task = await getVisibleTask(workspaceId, taskId, actor, {
      includeArchived: true,
    });
    const startedAt = new Date(input.startedAt);
    const endedAt = new Date(input.endedAt);
    if (endedAt < startedAt) {
      throw new ValidationError("endedAt must be on or after startedAt");
    }
    await assertNoOverlap(
      workspaceId,
      actor.userId,
      startedAt,
      endedAt,
    );
    const durationSeconds = Math.floor(
      (endedAt.getTime() - startedAt.getTime()) / 1000,
    );
    const log = await prisma.timeLog.create({
      data: {
        workspaceId,
        taskId,
        userId: actor.userId,
        startedAt,
        endedAt,
        durationSeconds,
        description: input.description ?? null,
        source: "MANUAL",
      },
      include: TIME_LOG_INCLUDE,
    });
    await recordActivity({
      workspaceId,
      actorId: actor.userId,
      action: ACTIVITY_ACTIONS.TIME_LOG_CREATED,
      resourceType: "task",
      resourceId: taskId,
      projectId: task.projectId,
      summary: `Added ${durationSeconds}s time log to task #${task.taskNumber}`,
      metadata: { timeLogId: log.id, durationSeconds },
    });
    return mapTimeLog(log);
  }

  async update(
    workspaceId: string,
    taskId: string,
    timeLogId: string,
    actor: TaskActor,
    input: UpdateTimeLogInput,
  ) {
    await getVisibleTask(workspaceId, taskId, actor, {
      includeArchived: true,
    });
    const existing = await prisma.timeLog.findFirst({
      where: { id: timeLogId, workspaceId, taskId },
      include: TIME_LOG_INCLUDE,
    });
    if (!existing) throw new NotFoundError("Time log not found");
    if (!canManageLog(actor, existing.userId)) {
      throw new ForbiddenError("You cannot update this time log");
    }
    if (!existing.endedAt) {
      throw new ValidationError("Stop the timer before editing this time log");
    }
    const startedAt = input.startedAt
      ? new Date(input.startedAt)
      : existing.startedAt;
    const endedAt = input.endedAt ? new Date(input.endedAt) : existing.endedAt;
    if (endedAt < startedAt) {
      throw new ValidationError("endedAt must be on or after startedAt");
    }
    await assertNoOverlap(
      workspaceId,
      existing.userId,
      startedAt,
      endedAt,
      existing.id,
    );
    const durationSeconds = Math.floor(
      (endedAt.getTime() - startedAt.getTime()) / 1000,
    );
    const updated = await prisma.timeLog.update({
      where: { id: existing.id },
      data: {
        startedAt,
        endedAt,
        durationSeconds,
        description: input.description,
      },
      include: TIME_LOG_INCLUDE,
    });
    return mapTimeLog(updated);
  }

  async remove(
    workspaceId: string,
    taskId: string,
    timeLogId: string,
    actor: TaskActor,
  ) {
    const task = await getVisibleTask(workspaceId, taskId, actor, {
      includeArchived: true,
    });
    const existing = await prisma.timeLog.findFirst({
      where: { id: timeLogId, workspaceId, taskId },
    });
    if (!existing) throw new NotFoundError("Time log not found");
    if (!canManageLog(actor, existing.userId)) {
      throw new ForbiddenError("You cannot delete this time log");
    }
    await prisma.timeLog.delete({ where: { id: existing.id } });
    await recordActivity({
      workspaceId,
      actorId: actor.userId,
      action: ACTIVITY_ACTIONS.TIME_LOG_DELETED,
      resourceType: "task",
      resourceId: taskId,
      projectId: task.projectId,
      summary: `Deleted a time log from task #${task.taskNumber}`,
      metadata: { timeLogId },
    });
    return { id: timeLogId };
  }
}

export const timeLogsService = new TimeLogsService();
