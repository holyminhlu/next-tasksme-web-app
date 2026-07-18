import type { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../config/database.js";

type RecordActivityInput = {
  workspaceId: string;
  actorId?: string | null;
  action: string;
  resourceType: string;
  resourceId: string;
  projectId?: string | null;
  summary: string;
  metadata?: Prisma.InputJsonValue;
  visibility?: "WORKSPACE" | "ACTOR_ONLY";
  sensitive?: boolean;
};

export const ACTIVITY_ACTIONS = {
  TASK_CREATED: "task.created",
  TASK_UPDATED: "task.updated",
  TASK_COMPLETED: "task.completed",
  TASK_DELETED: "task.deleted",
  PROJECT_CREATED: "project.created",
} as const;

export async function recordActivity(input: RecordActivityInput) {
  return prisma.activityEvent.create({
    data: {
      workspaceId: input.workspaceId,
      actorId: input.actorId ?? null,
      action: input.action,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      projectId: input.projectId ?? null,
      summary: input.summary,
      metadata: input.metadata,
      visibility: input.visibility ?? "WORKSPACE",
      sensitive: input.sensitive ?? false,
    },
  });
}

export const emitActivityEvent = recordActivity;

export function taskActivityMetadata(task: {
  title: string;
  status: string;
  assigneeId: string | null;
  createdById: string | null;
  source?: string;
}) {
  return {
    title: task.title,
    status: task.status,
    assigneeId: task.assigneeId,
    createdById: task.createdById,
    source: task.source,
  };
}

export function buildActivityVisibilityWhere(
  workspaceId: string,
  userId: string,
  roleKey: string,
  projectId?: string,
): Prisma.ActivityEventWhereInput {
  const base: Prisma.ActivityEventWhereInput = {
    workspaceId,
    sensitive: false,
    ...(projectId ? { projectId } : {}),
  };

  const actorOnlyVisible: Prisma.ActivityEventWhereInput = {
    visibility: "ACTOR_ONLY",
    actorId: userId,
  };

  if (roleKey === "owner" || roleKey === "admin" || roleKey === "manager") {
    return {
      ...base,
      OR: [{ visibility: "WORKSPACE" }, actorOnlyVisible],
    };
  }

  return {
    ...base,
    OR: [
      actorOnlyVisible,
      {
        AND: [
          { visibility: "WORKSPACE" },
          {
            OR: [
              { actorId: userId },
              {
                metadata: {
                  path: ["assigneeId"],
                  equals: userId,
                },
              },
              {
                metadata: {
                  path: ["createdById"],
                  equals: userId,
                },
              },
            ],
          },
        ],
      },
    ],
  };
}
