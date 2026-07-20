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
  TASK_DEPENDENCY_CREATED: "task.dependency_created",
  TASK_DEPENDENCY_DELETED: "task.dependency_deleted",
  TASK_DEPENDENCY_OVERRIDDEN: "task.dependency_overridden",
  TASK_UNBLOCKED: "task.unblocked",
  TIME_LOG_CREATED: "task.time_log_created",
  TIME_LOG_UPDATED: "task.time_log_updated",
  TIME_LOG_DELETED: "task.time_log_deleted",
  TIMER_STARTED: "task.timer_started",
  TIMER_STOPPED: "task.timer_stopped",
  RECURRENCE_CREATED: "recurrence.created",
  RECURRENCE_UPDATED: "recurrence.updated",
  RECURRENCE_PAUSED: "recurrence.paused",
  RECURRENCE_RESUMED: "recurrence.resumed",
  RISK_RECALCULATED: "task.risk_recalculated",
  SLA_PAUSED: "task.sla_paused",
  SLA_RESUMED: "task.sla_resumed",
  AUTOMATION_RETRIED: "automation.retried",
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
