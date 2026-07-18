import { prisma } from "../../config/database.js";
import { ForbiddenError, NotFoundError } from "../../lib/errors.js";
import { buildTaskVisibilityWhere, hasWorkspaceTaskScope } from "../../lib/task-scope.js";
import type { SystemRoleKey } from "../auth/permissions.js";

export type TaskActor = {
  userId: string;
  roleKey: SystemRoleKey | string;
  permissions?: string[];
};

export function assertCanMutateTask(
  actor: TaskActor,
  task: { assigneeId: string | null; createdById: string | null },
  action = "update",
) {
  if (
    !hasWorkspaceTaskScope(actor.roleKey) &&
    task.assigneeId !== actor.userId &&
    task.createdById !== actor.userId
  ) {
    throw new ForbiddenError(`You cannot ${action} this task`);
  }
}

export async function getVisibleTask(
  workspaceId: string,
  taskId: string,
  actor: TaskActor,
  options: { includeDeleted?: boolean; includeArchived?: boolean } = {},
) {
  const task = await prisma.task.findFirst({
    where: {
      id: taskId,
      ...buildTaskVisibilityWhere({
        workspaceId,
        userId: actor.userId,
        roleKey: actor.roleKey,
        includeDeleted: options.includeDeleted,
        includeArchived: options.includeArchived,
      }),
    },
    select: {
      id: true,
      workspaceId: true,
      projectId: true,
      title: true,
      taskNumber: true,
      status: true,
      assigneeId: true,
      createdById: true,
      deletedAt: true,
      archivedAt: true,
      version: true,
    },
  });

  if (!task) {
    throw new NotFoundError("Task not found");
  }

  return task;
}

export function actorFromRequest(req: {
  user?: { id: string };
  tenant?: { roleKey: string; permissions: string[] };
}): TaskActor {
  if (!req.user || !req.tenant) {
    throw new ForbiddenError("Missing tenant context");
  }

  return {
    userId: req.user.id,
    roleKey: req.tenant.roleKey,
    permissions: req.tenant.permissions,
  };
}
