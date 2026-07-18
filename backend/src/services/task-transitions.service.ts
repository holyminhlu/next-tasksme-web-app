import type {
  Prisma,
  TaskStatus,
} from "../../generated/prisma/client.js";
import { prisma } from "../config/database.js";
import {
  ConflictError,
  ForbiddenError,
  ValidationError,
} from "../lib/errors.js";
import type { TaskActor } from "../modules/tasks/task-access.js";

type Transaction = Prisma.TransactionClient;

export async function recordTaskStatusTransition(
  tx: Transaction,
  input: {
    taskId: string;
    fromStatus: TaskStatus | null;
    toStatus: TaskStatus;
    changedById: string | null;
    changedAt?: Date;
  },
) {
  const changedAt = input.changedAt ?? new Date();
  const previous = await tx.taskStatusHistory.findFirst({
    where: { taskId: input.taskId },
    orderBy: { changedAt: "desc" },
    select: { changedAt: true },
  });
  const durationInPreviousStatus = previous
    ? Math.max(
        0,
        Math.floor(
          (changedAt.getTime() - previous.changedAt.getTime()) / 1000,
        ),
      )
    : null;

  return tx.taskStatusHistory.create({
    data: {
      taskId: input.taskId,
      fromStatus: input.fromStatus,
      toStatus: input.toStatus,
      changedById: input.changedById,
      changedAt,
      durationInPreviousStatus,
    },
  });
}

export async function inspectCompletionDependencies(
  workspaceId: string,
  taskId: string,
) {
  const [workspace, dependencies] = await Promise.all([
    prisma.workspace.findFirst({
      where: { id: workspaceId, deletedAt: null },
      select: { dependencyCompletionPolicy: true },
    }),
    prisma.taskDependency.findMany({
      where: {
        workspaceId,
        successorTaskId: taskId,
        predecessorTask: { deletedAt: null, status: { not: "DONE" } },
      },
      include: {
        predecessorTask: {
          select: {
            id: true,
            taskNumber: true,
            title: true,
            status: true,
          },
        },
      },
    }),
  ]);

  return {
    policy: workspace?.dependencyCompletionPolicy ?? "WARN_ONLY",
    incomplete: dependencies.map((dependency) => dependency.predecessorTask),
  };
}

export async function assertCompletionAllowed(
  workspaceId: string,
  taskId: string,
  actor: TaskActor,
  overrideReason?: string,
) {
  const result = await inspectCompletionDependencies(workspaceId, taskId);
  if (result.incomplete.length === 0 || result.policy === "WARN_ONLY") {
    return {
      ...result,
      overridden: false,
      overrideReason: null as string | null,
    };
  }

  if (result.policy === "BLOCK") {
    throw new ConflictError(
      "Task cannot be completed until all dependencies are done",
    );
  }

  const canOverride = actor.permissions?.includes(
    "task_dependency.override",
  );
  if (!canOverride) {
    throw new ForbiddenError(
      "Dependency override permission is required to complete this task",
    );
  }
  if (!overrideReason?.trim()) {
    throw new ValidationError(
      "An override reason is required to complete this task",
      { field: "dependencyOverrideReason" },
    );
  }

  return {
    ...result,
    overridden: true,
    overrideReason: overrideReason.trim(),
  };
}

export async function applySuccessorHandoffs(
  tx: Transaction,
  input: {
    workspaceId: string;
    predecessorTaskId: string;
    actorId: string;
    now?: Date;
  },
) {
  const now = input.now ?? new Date();
  const dependencies = await tx.taskDependency.findMany({
    where: {
      workspaceId: input.workspaceId,
      predecessorTaskId: input.predecessorTaskId,
    },
    include: {
      successorTask: {
        select: {
          id: true,
          taskNumber: true,
          title: true,
          status: true,
          dependencyBlocked: true,
          assigneeId: true,
          version: true,
          projectId: true,
        },
      },
    },
  });

  const unblocked = [];
  for (const dependency of dependencies) {
    const successor = dependency.successorTask;
    if (!successor.dependencyBlocked || successor.status !== "BLOCKED") {
      continue;
    }

    const incompleteCount = await tx.taskDependency.count({
      where: {
        workspaceId: input.workspaceId,
        successorTaskId: successor.id,
        predecessorTask: {
          deletedAt: null,
          status: { not: "DONE" },
        },
      },
    });
    if (incompleteCount > 0) continue;

    const updated = await tx.task.update({
      where: { id: successor.id },
      data: {
        status: "TODO",
        dependencyBlocked: false,
        isBlocked: false,
        blockedReason: null,
        version: { increment: 1 },
      },
      select: {
        id: true,
        title: true,
        taskNumber: true,
        assigneeId: true,
        projectId: true,
        version: true,
      },
    });
    await recordTaskStatusTransition(tx, {
      taskId: successor.id,
      fromStatus: "BLOCKED",
      toStatus: "TODO",
      changedById: input.actorId,
      changedAt: now,
    });

    if (updated.assigneeId) {
      const preference = await tx.notificationPreference.findUnique({
        where: {
          workspaceId_userId: {
            workspaceId: input.workspaceId,
            userId: updated.assigneeId,
          },
        },
        select: { taskUnblocked: true },
      });
      if (preference?.taskUnblocked ?? true) {
        await tx.notification.upsert({
          where: {
            dedupeKey: `task-unblocked:${updated.id}:${updated.version}`,
          },
          update: {},
          create: {
            workspaceId: input.workspaceId,
            userId: updated.assigneeId,
            taskId: updated.id,
            type: "TASK_UNBLOCKED",
            title: `Task #${updated.taskNumber} is ready`,
            body: `${updated.title} is no longer blocked by dependencies.`,
            dedupeKey: `task-unblocked:${updated.id}:${updated.version}`,
          },
        });
      }
    }
    unblocked.push(updated);
  }

  return unblocked;
}
