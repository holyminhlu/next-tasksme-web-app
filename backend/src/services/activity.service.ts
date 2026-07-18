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
  TASK_STATUS_CHANGED: "task.status_changed",
  TASK_ASSIGNED: "task.assigned",
  TASK_COMPLETED: "task.completed",
  TASK_ARCHIVED: "task.archived",
  TASK_UNARCHIVED: "task.unarchived",
  TASK_DELETED: "task.deleted",
  TASK_RESTORED: "task.restored",
  TASK_MOVED: "task.moved",
  CHECKLIST_ITEM_CREATED: "task.checklist_item_created",
  CHECKLIST_ITEM_UPDATED: "task.checklist_item_updated",
  CHECKLIST_ITEM_COMPLETED: "task.checklist_item_completed",
  CHECKLIST_ITEM_DELETED: "task.checklist_item_deleted",
  TASK_TAGS_UPDATED: "task.tags_updated",
  TAG_CREATED: "tag.created",
  TAG_DELETED: "tag.deleted",
  CUSTOM_FIELD_CONFIGURED: "custom_field.configured",
  CUSTOM_FIELD_VALUE_UPDATED: "task.custom_field_value_updated",
  COMMENT_CREATED: "task.comment_created",
  COMMENT_UPDATED: "task.comment_updated",
  COMMENT_DELETED: "task.comment_deleted",
  ATTACHMENT_UPLOADED: "task.attachment_uploaded",
  ATTACHMENT_DELETED: "task.attachment_deleted",
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
