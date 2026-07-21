import type { Prisma } from "../../../generated/prisma/client.js";
import {
  buildTaskVisibilityWhere,
  OPEN_TASK_STATUSES,
} from "../../lib/task-scope.js";
import {
  isValidIanaTimeZone,
  resolveDashboardRange,
} from "../../lib/timezone.js";
import { ValidationError } from "../../lib/errors.js";

export type TaskFilterActor = { userId: string; roleKey: string };

export type TaskFilterInput = {
  projectId?: string[];
  assigneeId?: string;
  createdById?: string;
  status?: Array<
    "TODO" | "IN_PROGRESS" | "IN_REVIEW" | "BLOCKED" | "DONE" | "CANCELLED"
  >;
  workflowStageId?: string;
  priority?: Array<"LOW" | "MEDIUM" | "HIGH" | "URGENT">;
  due?: "today" | "upcoming" | "overdue";
  deadlineFrom?: string;
  deadlineTo?: string;
  overdue?: boolean;
  unassigned?: boolean;
  includeArchived?: boolean;
  includeDeleted?: boolean;
  search?: string;
  timezone?: string;
  /** Inclusive calendar YMD range for calendar/timeline overlap. */
  from?: string;
  to?: string;
  selectedIds?: string[];
  tagIds?: string[];
};

export function resolveTaskTimezone(
  requested: string | undefined,
  workspaceTimezone: string,
): string {
  const timezone = requested ?? workspaceTimezone ?? "UTC";
  if (!isValidIanaTimeZone(timezone)) {
    throw new ValidationError("timezone must be a valid IANA time zone", {
      field: "timezone",
    });
  }
  return timezone;
}

/**
 * Shared visibility + list filter contract for list/board/calendar/timeline/export.
 */
export function buildTaskListWhere(
  workspaceId: string,
  actor: TaskFilterActor,
  query: TaskFilterInput,
  workspaceTimezone: string,
): Prisma.TaskWhereInput {
  const timezone = resolveTaskTimezone(query.timezone, workspaceTimezone);
  const range = resolveDashboardRange({
    from: query.from,
    to: query.to,
    timezone,
  });

  const where: Prisma.TaskWhereInput = {
    ...buildTaskVisibilityWhere({
      workspaceId,
      userId: actor.userId,
      roleKey: actor.roleKey,
      status: query.status,
      includeArchived: query.includeArchived,
      includeDeleted: query.includeDeleted,
    }),
    ...(query.projectId?.length ? { projectId: { in: query.projectId } } : {}),
    ...(query.priority?.length ? { priority: { in: query.priority } } : {}),
    ...(query.assigneeId ? { assigneeId: query.assigneeId } : {}),
    ...(query.createdById ? { createdById: query.createdById } : {}),
    ...(query.workflowStageId ? { workflowStageId: query.workflowStageId } : {}),
    ...(query.unassigned ? { assigneeId: null } : {}),
    ...(query.selectedIds?.length ? { id: { in: query.selectedIds } } : {}),
    ...(query.tagIds?.length
      ? {
          taskTags: {
            some: {
              tagId: { in: query.tagIds },
              tag: { workspaceId },
            },
          },
        }
      : {}),
  };

  if (query.search) {
    const taskNumber = /^\d+$/.test(query.search) ? Number(query.search) : null;
    where.AND = [
      ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
      {
        OR: [
          { title: { contains: query.search, mode: "insensitive" } },
          ...(taskNumber ? [{ taskNumber }] : []),
        ],
      },
    ];
  }

  if (query.from || query.to) {
    // Overlap: task interval intersects [fromInstant, toInstant].
    // Treat missing start as due-only; missing due as start-only open-ended.
    where.AND = [
      ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
      {
        OR: [
          {
            AND: [
              { startAt: { not: null } },
              { dueDate: { not: null } },
              { startAt: { lte: range.toInstant } },
              { dueDate: { gte: range.fromInstant } },
            ],
          },
          {
            AND: [
              { startAt: null },
              { dueDate: { not: null } },
              { dueDate: { gte: range.fromInstant, lte: range.toInstant } },
            ],
          },
          {
            AND: [
              { dueDate: null },
              { startAt: { not: null } },
              { startAt: { gte: range.fromInstant, lte: range.toInstant } },
            ],
          },
        ],
      },
    ];
    return where;
  }

  if (query.deadlineFrom || query.deadlineTo) {
    where.dueDate = {
      ...(query.deadlineFrom ? { gte: new Date(query.deadlineFrom) } : {}),
      ...(query.deadlineTo ? { lte: new Date(query.deadlineTo) } : {}),
    };
  } else if (query.due === "today") {
    where.status = { in: [...OPEN_TASK_STATUSES] };
    where.dueDate = { gte: range.todayStart, lte: range.todayEnd };
  } else if (query.due === "overdue" || query.overdue) {
    where.status = { in: [...OPEN_TASK_STATUSES] };
    where.dueDate = { lt: range.todayStart, not: null };
  } else if (query.due === "upcoming") {
    where.status = { in: [...OPEN_TASK_STATUSES] };
    where.dueDate = { gt: range.todayEnd };
  }

  return where;
}

export function buildUnscheduledWhere(
  workspaceId: string,
  actor: TaskFilterActor,
  query: TaskFilterInput,
): Prisma.TaskWhereInput {
  return {
    ...buildTaskVisibilityWhere({
      workspaceId,
      userId: actor.userId,
      roleKey: actor.roleKey,
      status: query.status,
      includeArchived: query.includeArchived,
      includeDeleted: query.includeDeleted,
    }),
    ...(query.projectId?.length ? { projectId: { in: query.projectId } } : {}),
    ...(query.priority?.length ? { priority: { in: query.priority } } : {}),
    ...(query.assigneeId ? { assigneeId: query.assigneeId } : {}),
    ...(query.createdById ? { createdById: query.createdById } : {}),
    ...(query.unassigned ? { assigneeId: null } : {}),
    startAt: null,
    dueDate: null,
  };
}
