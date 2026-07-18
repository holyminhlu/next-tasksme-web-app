import type { Prisma } from "../../generated/prisma/client.js";
import type { SystemRoleKey } from "../modules/auth/permissions.js";
import { ForbiddenError } from "./errors.js";

export const WORKSPACE_SCOPE_ROLES: SystemRoleKey[] = ["owner", "admin", "manager"];

export function hasWorkspaceTaskScope(roleKey: string): boolean {
  return WORKSPACE_SCOPE_ROLES.includes(roleKey as SystemRoleKey);
}

export function assertMemberFilterAllowed(
  roleKey: string,
  memberId: string | undefined,
  _currentUserId: string,
) {
  if (!memberId) {
    return;
  }

  if (!hasWorkspaceTaskScope(roleKey)) {
    throw new ForbiddenError(
      "memberId filter requires workspace-scoped dashboard access",
    );
  }
}

type ScopeInput = {
  workspaceId: string;
  userId: string;
  roleKey: string;
  memberId?: string;
  assigneeId?: string;
  projectId?: string;
  status?: string[];
  includeArchived?: boolean;
  includeDeleted?: boolean;
};

export function buildTaskVisibilityWhere(input: ScopeInput): Prisma.TaskWhereInput {
  const base: Prisma.TaskWhereInput = {
    workspaceId: input.workspaceId,
    ...(input.includeDeleted ? {} : { deletedAt: null }),
    ...(input.includeArchived ? {} : { archivedAt: null }),
    ...(input.projectId ? { projectId: input.projectId } : {}),
    ...(input.status?.length ? { status: { in: input.status as never[] } } : {}),
  };

  const privateProjectScope: Prisma.TaskWhereInput =
    input.roleKey === "owner" || input.roleKey === "admin"
      ? {}
      : {
          OR: [
            { projectId: null },
            { project: { visibility: "WORKSPACE" } },
            { project: { members: { some: { userId: input.userId } } } },
          ],
        };

  if (hasWorkspaceTaskScope(input.roleKey)) {
    if (input.memberId) {
      return {
        ...base,
        AND: [
          privateProjectScope,
          {
            OR: [{ assigneeId: input.memberId }, { createdById: input.memberId }],
          },
        ],
      };
    }

    if (input.assigneeId) {
      return { ...base, AND: [privateProjectScope, { assigneeId: input.assigneeId }] };
    }

    return { ...base, AND: [privateProjectScope] };
  }

  return {
    ...base,
    AND: [
      privateProjectScope,
      {
        OR: [{ assigneeId: input.userId }, { createdById: input.userId }],
      },
    ],
  };
}

export const OPEN_TASK_STATUSES = [
  "TODO",
  "IN_PROGRESS",
  "IN_REVIEW",
  "BLOCKED",
] as const;

export function isOpenTask(status: string): boolean {
  return OPEN_TASK_STATUSES.includes(status as (typeof OPEN_TASK_STATUSES)[number]);
}
