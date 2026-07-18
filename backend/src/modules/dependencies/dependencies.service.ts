import { prisma } from "../../config/database.js";
import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from "../../lib/errors.js";
import {
  ACTIVITY_ACTIONS,
  recordActivity,
} from "../../services/activity.service.js";
import { recordTaskStatusTransition } from "../../services/task-transitions.service.js";
import {
  assertCanMutateTask,
  getVisibleTask,
  type TaskActor,
} from "../tasks/task-access.js";
import type { CreateDependencyInput } from "./dependencies.schemas.js";

const RELATED_TASK_SELECT = {
  id: true,
  taskNumber: true,
  title: true,
  status: true,
  assigneeId: true,
  dueDate: true,
  assignee: { select: { fullName: true } },
} as const;

function mapTask(task: {
  id: string;
  taskNumber: number;
  title: string;
  status: string;
  assigneeId: string | null;
  dueDate: Date | null;
  assignee: { fullName: string } | null;
}) {
  return {
    id: task.id,
    taskNumber: task.taskNumber,
    title: task.title,
    status: task.status,
    assigneeId: task.assigneeId,
    assigneeName: task.assignee?.fullName ?? null,
    dueDate: task.dueDate?.toISOString() ?? null,
  };
}

async function wouldCreateCycle(
  workspaceId: string,
  predecessorTaskId: string,
  successorTaskId: string,
) {
  const edges = await prisma.taskDependency.findMany({
    where: { workspaceId },
    select: { predecessorTaskId: true, successorTaskId: true },
  });
  const outgoing = new Map<string, string[]>();
  for (const edge of edges) {
    const targets = outgoing.get(edge.predecessorTaskId) ?? [];
    targets.push(edge.successorTaskId);
    outgoing.set(edge.predecessorTaskId, targets);
  }

  const queue = [successorTaskId];
  const seen = new Set<string>();
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current === predecessorTaskId) return true;
    if (seen.has(current)) continue;
    seen.add(current);
    queue.push(...(outgoing.get(current) ?? []));
  }
  return false;
}

export class DependenciesService {
  async list(workspaceId: string, taskId: string, actor: TaskActor) {
    await getVisibleTask(workspaceId, taskId, actor, {
      includeArchived: true,
    });
    const [workspace, waitingOn, blocking] = await Promise.all([
      prisma.workspace.findUnique({
        where: { id: workspaceId },
        select: { dependencyCompletionPolicy: true },
      }),
      prisma.taskDependency.findMany({
        where: { workspaceId, successorTaskId: taskId },
        orderBy: { createdAt: "asc" },
        include: { predecessorTask: { select: RELATED_TASK_SELECT } },
      }),
      prisma.taskDependency.findMany({
        where: { workspaceId, predecessorTaskId: taskId },
        orderBy: { createdAt: "asc" },
        include: { successorTask: { select: RELATED_TASK_SELECT } },
      }),
    ]);

    return {
      policy: workspace?.dependencyCompletionPolicy ?? "WARN_ONLY",
      waitingOn: waitingOn.map((dependency) => ({
        id: dependency.id,
        dependencyType: dependency.dependencyType,
        task: mapTask(dependency.predecessorTask),
      })),
      blocking: blocking.map((dependency) => ({
        id: dependency.id,
        dependencyType: dependency.dependencyType,
        task: mapTask(dependency.successorTask),
      })),
      hasIncompletePredecessors: waitingOn.some(
        (dependency) => dependency.predecessorTask.status !== "DONE",
      ),
    };
  }

  async create(
    workspaceId: string,
    taskId: string,
    actor: TaskActor,
    input: CreateDependencyInput,
  ) {
    if (taskId === input.relatedTaskId) {
      throw new ValidationError("A task cannot depend on itself", {
        field: "relatedTaskId",
      });
    }

    const [baseTask, relatedTask] = await Promise.all([
      getVisibleTask(workspaceId, taskId, actor, { includeArchived: true }),
      getVisibleTask(workspaceId, input.relatedTaskId, actor, {
        includeArchived: true,
      }),
    ]);
    assertCanMutateTask(actor, baseTask, "manage dependencies for");
    assertCanMutateTask(actor, relatedTask, "manage dependencies for");

    const predecessorTaskId =
      input.direction === "WAITING_ON" ? input.relatedTaskId : taskId;
    const successorTaskId =
      input.direction === "WAITING_ON" ? taskId : input.relatedTaskId;
    const existing = await prisma.taskDependency.findUnique({
      where: {
        predecessorTaskId_successorTaskId_dependencyType: {
          predecessorTaskId,
          successorTaskId,
          dependencyType: input.dependencyType,
        },
      },
    });
    if (existing) throw new ConflictError("Dependency already exists");
    if (
      await wouldCreateCycle(
        workspaceId,
        predecessorTaskId,
        successorTaskId,
      )
    ) {
      throw new ConflictError("Dependency would create a cycle");
    }

    const predecessor =
      predecessorTaskId === baseTask.id ? baseTask : relatedTask;
    const successor =
      successorTaskId === baseTask.id ? baseTask : relatedTask;
    const dependency = await prisma.$transaction(async (tx) => {
      const created = await tx.taskDependency.create({
        data: {
          workspaceId,
          predecessorTaskId,
          successorTaskId,
          dependencyType: input.dependencyType,
          createdById: actor.userId,
        },
      });
      if (
        predecessor.status !== "DONE" &&
        successor.status !== "DONE" &&
        successor.status !== "BLOCKED"
      ) {
        await tx.task.update({
          where: { id: successor.id },
          data: {
            status: "BLOCKED",
            dependencyBlocked: true,
            isBlocked: true,
            blockedReason: `Waiting on task #${predecessor.taskNumber}`,
            version: { increment: 1 },
          },
        });
        await recordTaskStatusTransition(tx, {
          taskId: successor.id,
          fromStatus: successor.status,
          toStatus: "BLOCKED",
          changedById: actor.userId,
        });
      }
      return created;
    });

    await recordActivity({
      workspaceId,
      actorId: actor.userId,
      action: ACTIVITY_ACTIONS.TASK_DEPENDENCY_CREATED,
      resourceType: "task",
      resourceId: successorTaskId,
      projectId: successor.projectId,
      summary: `Added task dependency #${predecessor.taskNumber} → #${successor.taskNumber}`,
      metadata: { dependencyId: dependency.id, predecessorTaskId, successorTaskId },
    });
    return this.list(workspaceId, taskId, actor);
  }

  async remove(
    workspaceId: string,
    taskId: string,
    dependencyId: string,
    actor: TaskActor,
  ) {
    const baseTask = await getVisibleTask(workspaceId, taskId, actor, {
      includeArchived: true,
    });
    assertCanMutateTask(actor, baseTask, "manage dependencies for");
    const dependency = await prisma.taskDependency.findFirst({
      where: {
        id: dependencyId,
        workspaceId,
        OR: [{ predecessorTaskId: taskId }, { successorTaskId: taskId }],
      },
      include: {
        predecessorTask: true,
        successorTask: true,
      },
    });
    if (!dependency) throw new NotFoundError("Dependency not found");
    await getVisibleTask(
      workspaceId,
      dependency.predecessorTaskId === taskId
        ? dependency.successorTaskId
        : dependency.predecessorTaskId,
      actor,
      { includeArchived: true },
    );

    await prisma.$transaction(async (tx) => {
      await tx.taskDependency.delete({ where: { id: dependency.id } });
      const incomplete = await tx.taskDependency.count({
        where: {
          workspaceId,
          successorTaskId: dependency.successorTaskId,
          predecessorTask: { deletedAt: null, status: { not: "DONE" } },
        },
      });
      if (
        incomplete === 0 &&
        dependency.successorTask.dependencyBlocked &&
        dependency.successorTask.status === "BLOCKED"
      ) {
        await tx.task.update({
          where: { id: dependency.successorTaskId },
          data: {
            status: "TODO",
            dependencyBlocked: false,
            isBlocked: false,
            blockedReason: null,
            version: { increment: 1 },
          },
        });
        await recordTaskStatusTransition(tx, {
          taskId: dependency.successorTaskId,
          fromStatus: "BLOCKED",
          toStatus: "TODO",
          changedById: actor.userId,
        });
      }
    });

    await recordActivity({
      workspaceId,
      actorId: actor.userId,
      action: ACTIVITY_ACTIONS.TASK_DEPENDENCY_DELETED,
      resourceType: "task",
      resourceId: dependency.successorTaskId,
      projectId: dependency.successorTask.projectId,
      summary: `Removed task dependency #${dependency.predecessorTask.taskNumber} → #${dependency.successorTask.taskNumber}`,
      metadata: { dependencyId },
    });
    return this.list(workspaceId, taskId, actor);
  }
}

export const dependenciesService = new DependenciesService();
