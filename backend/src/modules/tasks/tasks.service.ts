import ExcelJS from "exceljs";
import type { Prisma } from "../../../generated/prisma/client.js";
import { prisma } from "../../config/database.js";
import {
  AppError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "../../lib/errors.js";
import { buildPaginationMeta, getPagination } from "../../lib/pagination.js";
import {
  nextRankAfter,
  rankBetween,
  rebalanceRanks,
} from "../../lib/rank.js";
import {
  buildTaskVisibilityWhere,
  hasWorkspaceTaskScope,
} from "../../lib/task-scope.js";
import { formatYmd } from "../../lib/timezone.js";
import { recordActivity } from "../../services/activity.service.js";
import { assertProjectAccessible as loadAccessibleProject } from "../projects/projects.service.js";
import {
  getPublishedProjectWorkflow,
  resolveInitialStageId,
  resolveStageForLegacyStatus,
} from "../../lib/project-workflow.js";
import {
  assertTransitionAllowed,
  legacyStatusForStage,
  resolveStageForStatus,
} from "../../lib/workflow-runtime.js";
import { writeAuditLog } from "../../services/audit.service.js";
import {
  applySuccessorHandoffs,
  assertCompletionAllowed,
  recordTaskStatusTransition,
} from "../../services/task-transitions.service.js";
import { initializeTaskSla, finalizeTaskSlaOnStatusChange } from "../sla/sla.service.js";
import { parseTaskText as parseTaskDraft } from "./parse.service.js";
import {
  buildTaskListWhere,
  buildUnscheduledWhere,
  resolveTaskTimezone,
} from "./task-filters.js";
import type {
  AssigneeMutationInput,
  BoardTasksQuery,
  BulkDeleteInput,
  BulkUpdateInput,
  CalendarTasksQuery,
  CreateTaskInput,
  ExportTasksInput,
  ListTasksQuery,
  MoveTaskInput,
  ParseTaskInput,
  StatusMutationInput,
  TaskActivityQuery,
  TimelineTasksQuery,
  UpdateTaskInput,
  VersionMutationInput,
} from "./tasks.schemas.js";

export const EXPORT_ROW_LIMIT = 5000;
const EXPORT_DEFAULT_COLUMNS = [
  "taskNumber",
  "title",
  "status",
  "priority",
  "project",
  "assignee",
  "dueDate",
] as const;

type Actor = {
  userId: string;
  roleKey: string;
  permissions?: string[];
};
const TASK_INCLUDE = {
  project: { select: { id: true, name: true, visibility: true } },
  parentTask: {
    select: { id: true, taskNumber: true, title: true, status: true, projectId: true },
  },
  subtasks: {
    where: { deletedAt: null },
    orderBy: [{ subtaskPosition: "asc" as const }, { taskNumber: "asc" as const }],
    select: {
      id: true,
      taskNumber: true,
      title: true,
      status: true,
      projectId: true,
      subtaskPosition: true,
    },
  },
  milestone: {
    select: { id: true, name: true, status: true, position: true, dueAt: true },
  },
  workflowStage: {
    select: {
      id: true,
      name: true,
      category: true,
      color: true,
      isInitial: true,
      isTerminal: true,
    },
  },
  assignee: { select: { id: true, fullName: true, email: true } },
  creator: { select: { id: true, fullName: true, email: true } },
  completedBy: { select: { id: true, fullName: true, email: true } },
} satisfies Prisma.TaskInclude;

type TaskWithPeople = Prisma.TaskGetPayload<{ include: typeof TASK_INCLUDE }>;

function mapPerson(person: { id: string; fullName: string; email: string } | null) {
  return person
    ? { id: person.id, fullName: person.fullName, email: person.email }
    : null;
}

function mapTask(task: TaskWithPeople) {
  return {
    id: task.id,
    workspaceId: task.workspaceId,
    taskNumber: task.taskNumber,
    projectId: task.projectId,
    parentTaskId: task.parentTaskId,
    parentTask: task.parentTask,
    subtaskPosition: task.subtaskPosition,
    milestoneId: task.milestoneId,
    milestone: task.milestone
      ? {
          ...task.milestone,
          dueAt: task.milestone.dueAt?.toISOString() ?? null,
        }
      : null,
    subtasks: task.subtasks,
    project: task.project,
    projectName: task.project?.name ?? null,
    title: task.title,
    description: task.description,
    status: task.status,
    workflowStageId: task.workflowStageId,
    workflowStage: task.workflowStage
      ? {
          id: task.workflowStage.id,
          name: task.workflowStage.name,
          category: task.workflowStage.category,
          color: task.workflowStage.color,
          isInitial: task.workflowStage.isInitial,
          isTerminal: task.workflowStage.isTerminal,
        }
      : null,
    priority: task.priority,
    startAt: task.startAt?.toISOString() ?? null,
    dueDate: task.dueDate?.toISOString() ?? null,
    completedAt: task.completedAt?.toISOString() ?? null,
    completedById: task.completedById,
    completedBy: mapPerson(task.completedBy),
    isBlocked: task.isBlocked,
    blockedReason: task.blockedReason,
    dependencyBlocked: task.dependencyBlocked,
    dependencyOverrideReason: task.dependencyOverrideReason,
    dependencyOverriddenById: task.dependencyOverriddenById,
    dependencyOverriddenAt:
      task.dependencyOverriddenAt?.toISOString() ?? null,
    source: task.source,
    createdById: task.createdById,
    creator: mapPerson(task.creator),
    assigneeId: task.assigneeId,
    assignee: mapPerson(task.assignee),
    rank: task.rank,
    version: task.version,
    manualRiskLevel: task.manualRiskLevel,
    riskLevel: task.riskLevel,
    riskScore: task.riskScore,
    riskReasons: Array.isArray(task.riskReasonsJson)
      ? (task.riskReasonsJson as string[])
      : [],
    riskCalculatedAt: task.riskCalculatedAt?.toISOString() ?? null,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
    archivedAt: task.archivedAt?.toISOString() ?? null,
    deletedAt: task.deletedAt?.toISOString() ?? null,
    deleted: task.deletedAt !== null,
  };
}

function sanitizeExportCell(value: string): string {
  if (/^[=+\-@\t\r]/.test(value)) {
    return `'${value}`;
  }
  return value;
}

function formatExportDate(
  value: Date | null,
  timezone: string,
  dateFormat: "iso" | "locale",
): string {
  if (!value) return "";
  if (dateFormat === "locale") {
    return formatYmd(value, timezone);
  }
  return value.toISOString();
}

function isAdmin(actor: Actor) {
  return actor.roleKey === "owner" || actor.roleKey === "admin";
}

function assertCanMutateTask(
  actor: Actor,
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

function assertCanAssign(actor: Actor, assigneeId: string | null) {
  if (
    assigneeId !== null &&
    assigneeId !== actor.userId &&
    !["owner", "admin", "manager"].includes(actor.roleKey)
  ) {
    throw new ForbiddenError("Members may only assign tasks to themselves");
  }
}

async function assertProjectAccessible(
  workspaceId: string,
  projectId: string,
  actor: Actor,
) {
  try {
    return await loadAccessibleProject(workspaceId, projectId, actor);
  } catch (error) {
    if (error instanceof NotFoundError || error instanceof ForbiddenError) {
      throw new ValidationError("projectId must belong to this workspace", {
        field: "projectId",
      });
    }
    throw error;
  }
}

async function assertAssignee(
  workspaceId: string,
  assigneeId: string,
  projectId?: string | null,
) {
  const member = await prisma.workspaceMember.findFirst({
    where: {
      workspaceId,
      userId: assigneeId,
      deletedAt: null,
      status: "ACTIVE",
    },
  });
  if (!member) {
    throw new ValidationError("assigneeId must be an active member of this workspace", {
      field: "assigneeId",
    });
  }
  if (projectId) {
    const project = await prisma.project.findFirst({
      where: { id: projectId, workspaceId, deletedAt: null },
      select: {
        visibility: true,
        members: { where: { userId: assigneeId }, select: { id: true } },
      },
    });
    if (project?.visibility === "PRIVATE" && project.members.length === 0) {
      throw new ValidationError("assigneeId must be a member of the private project", {
        field: "assigneeId",
      });
    }
  }
}

async function getVisibleTask(
  workspaceId: string,
  taskId: string,
  actor: Actor,
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
    include: TASK_INCLUDE,
  });
  if (!task) throw new NotFoundError("Task not found");
  return task;
}

function assertDates(startAt: Date | null, dueDate: Date | null) {
  if (startAt && dueDate && dueDate < startAt) {
    throw new ValidationError("dueDate must be greater than or equal to startAt", {
      field: "dueDate",
    });
  }
}

async function assertHierarchyReferences(
  workspaceId: string,
  taskId: string | null,
  projectId: string | null,
  parentTaskId: string | null,
  milestoneId: string | null,
) {
  if (!projectId && (parentTaskId || milestoneId)) {
    throw new ValidationError("Task hierarchy requires a project", {
      field: parentTaskId ? "parentTaskId" : "milestoneId",
    });
  }

  let taskDepth = 1;
  if (parentTaskId) {
    const seen = new Set<string>();
    let currentId: string | null = parentTaskId;
    let depth = 1;
    while (currentId) {
      if (currentId === taskId || seen.has(currentId)) {
        throw new ValidationError("parentTaskId would create a task hierarchy cycle", {
          field: "parentTaskId",
        });
      }
      seen.add(currentId);
      const parent: {
        id: string;
        workspaceId: string;
        projectId: string | null;
        parentTaskId: string | null;
      } | null = await prisma.task.findFirst({
        where: { id: currentId, deletedAt: null },
        select: { id: true, workspaceId: true, projectId: true, parentTaskId: true },
      });
      if (!parent || parent.workspaceId !== workspaceId || parent.projectId !== projectId) {
        throw new ValidationError(
          "parentTaskId must belong to the same workspace and project",
          { field: "parentTaskId" },
        );
      }
      depth += 1;
      if (depth > 5) {
        throw new ValidationError("Task hierarchy cannot exceed 5 levels", {
          field: "parentTaskId",
        });
      }
      currentId = parent.parentTaskId;
    }
    taskDepth = depth;
  }

  if (taskId) {
    const currentTask = await prisma.task.findUnique({
      where: { id: taskId },
      select: { projectId: true },
    });
    if (currentTask?.projectId === projectId) {
      let frontier = [taskId];
      let relativeDepth = 1;
      const descendants = new Set(frontier);
      while (frontier.length > 0) {
        const children = await prisma.task.findMany({
          where: { parentTaskId: { in: frontier }, deletedAt: null },
          select: { id: true },
        });
        frontier = children
          .map((child) => child.id)
          .filter((id) => !descendants.has(id));
        frontier.forEach((id) => descendants.add(id));
        if (frontier.length > 0) relativeDepth += 1;
        if (taskDepth + relativeDepth - 1 > 5) {
          throw new ValidationError("Task hierarchy cannot exceed 5 levels", {
            field: "parentTaskId",
          });
        }
      }
    }
  }

  if (milestoneId) {
    const milestone = await prisma.milestone.findFirst({
      where: { id: milestoneId, workspaceId, projectId: projectId! },
      select: { id: true },
    });
    if (!milestone) {
      throw new ValidationError(
        "milestoneId must belong to the same workspace and project",
        { field: "milestoneId" },
      );
    }
  }
}

async function getNextSubtaskPosition(parentTaskId: string) {
  const aggregate = await prisma.task.aggregate({
    where: { parentTaskId, deletedAt: null },
    _max: { subtaskPosition: true },
  });
  return (aggregate._max.subtaskPosition ?? -1) + 1;
}

function activitySummary(action: string, title: string) {
  const verb: Record<string, string> = {
    "task.created": "Created",
    "task.updated": "Updated",
    "task.status_changed": "Changed status of",
    "task.assigned": "Assigned",
    "task.completed": "Completed",
    "task.archived": "Archived",
    "task.unarchived": "Unarchived",
    "task.deleted": "Deleted",
    "task.restored": "Restored",
    "task.moved": "Moved",
  };
  return `${verb[action] ?? "Updated"} task "${title}"`;
}

async function emitTaskActivity(action: string, task: TaskWithPeople, actor: Actor) {
  await recordActivity({
    workspaceId: task.workspaceId,
    actorId: actor.userId,
    action,
    resourceType: "task",
    resourceId: task.id,
    projectId: task.projectId,
    summary: activitySummary(action, task.title),
    metadata: {
      title: task.title,
      taskNumber: task.taskNumber,
      status: task.status,
      assigneeId: task.assigneeId,
      createdById: task.createdById,
      version: task.version,
    },
  });
}

async function createAssignmentNotification(
  tx: Prisma.TransactionClient,
  task: { id: string; workspaceId: string; title: string; version: number },
  assigneeId: string | null,
  actorId: string,
) {
  if (!assigneeId || assigneeId === actorId) return;
  const preference = await tx.notificationPreference.findUnique({
    where: { workspaceId_userId: { workspaceId: task.workspaceId, userId: assigneeId } },
  });
  if (preference?.taskAssigned === false) return;
  await tx.notification.upsert({
    where: { dedupeKey: `task-assigned:${task.id}:${assigneeId}:${task.version}` },
    update: {},
    create: {
      workspaceId: task.workspaceId,
      userId: assigneeId,
      taskId: task.id,
      type: "TASK_ASSIGNED",
      title: `Task assigned: ${task.title}`,
      dedupeKey: `task-assigned:${task.id}:${assigneeId}:${task.version}`,
    },
  });
}

export class TasksService {
  private async requireWorkspace(workspaceId: string) {
    const workspace = await prisma.workspace.findFirst({
      where: { id: workspaceId, deletedAt: null },
    });
    if (!workspace) throw new NotFoundError("Workspace not found");
    return workspace;
  }

  private assertDeletedListAllowed(actor: Actor, includeDeleted?: boolean) {
    if (includeDeleted && !isAdmin(actor)) {
      throw new ForbiddenError("Only workspace owners and admins may list deleted tasks");
    }
  }

  async listTasks(workspaceId: string, actor: Actor, query: ListTasksQuery) {
    this.assertDeletedListAllowed(actor, query.includeDeleted);
    const pagination = getPagination(query);
    const workspace = await this.requireWorkspace(workspaceId);
    const where = buildTaskListWhere(
      workspaceId,
      actor,
      query,
      workspace.timezone,
    );
    const orderBy = {
      [query.sortBy]: query.sortOrder,
    } as Prisma.TaskOrderByWithRelationInput;
    const [total, tasks] = await Promise.all([
      prisma.task.count({ where }),
      prisma.task.findMany({
        where,
        skip: pagination.skip,
        take: pagination.take,
        orderBy: [orderBy, { taskNumber: "asc" }],
        include: TASK_INCLUDE,
      }),
    ]);
    return {
      items: tasks.map(mapTask),
      pagination: buildPaginationMeta(query.page, query.pageSize, total),
    };
  }

  async listBoardColumn(
    workspaceId: string,
    actor: Actor,
    query: BoardTasksQuery,
  ) {
    return this.listTasks(workspaceId, actor, {
      ...query,
      status: query.status ? [query.status] : undefined,
      workflowStageId: query.workflowStageId,
      sortBy: query.sortBy ?? "rank",
      sortOrder: query.sortOrder ?? "asc",
    });
  }

  async listCalendar(
    workspaceId: string,
    actor: Actor,
    query: CalendarTasksQuery,
  ) {
    this.assertDeletedListAllowed(actor, query.includeDeleted);
    const workspace = await this.requireWorkspace(workspaceId);
    const timezone = resolveTaskTimezone(query.timezone, workspace.timezone);
    const where = buildTaskListWhere(
      workspaceId,
      actor,
      { ...query, timezone },
      workspace.timezone,
    );
    const unscheduledWhere = buildUnscheduledWhere(workspaceId, actor, query);
    const pagination = getPagination({
      page: query.page,
      pageSize: query.pageSize,
      sortOrder: "asc",
    });
    const [total, tasks, unscheduledCount] = await Promise.all([
      prisma.task.count({ where }),
      prisma.task.findMany({
        where,
        skip: pagination.skip,
        take: pagination.take,
        orderBy: [{ dueDate: "asc" }, { startAt: "asc" }, { taskNumber: "asc" }],
        include: TASK_INCLUDE,
      }),
      prisma.task.count({ where: unscheduledWhere }),
    ]);
    return {
      items: tasks.map(mapTask),
      unscheduledCount,
      timezone,
      from: query.from,
      to: query.to,
      pagination: buildPaginationMeta(query.page, query.pageSize, total),
    };
  }

  async listTimeline(
    workspaceId: string,
    actor: Actor,
    query: TimelineTasksQuery,
  ) {
    this.assertDeletedListAllowed(actor, query.includeDeleted);
    const workspace = await this.requireWorkspace(workspaceId);
    const timezone = resolveTaskTimezone(query.timezone, workspace.timezone);
    const where = buildTaskListWhere(
      workspaceId,
      actor,
      { ...query, timezone },
      workspace.timezone,
    );
    // Timeline requires at least one schedule endpoint.
    where.AND = [
      ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
      {
        OR: [{ startAt: { not: null } }, { dueDate: { not: null } }],
      },
    ];
    const pagination = getPagination({
      page: query.page,
      pageSize: query.pageSize,
      sortOrder: "asc",
    });
    const [total, tasks] = await Promise.all([
      prisma.task.count({ where }),
      prisma.task.findMany({
        where,
        skip: pagination.skip,
        take: pagination.take,
        orderBy: [{ startAt: "asc" }, { dueDate: "asc" }, { taskNumber: "asc" }],
        include: TASK_INCLUDE,
      }),
    ]);
    const groups = new Map<
      string,
      {
        id: string;
        label: string;
        items: ReturnType<typeof mapTask>[];
      }
    >();
    for (const task of tasks) {
      const mapped = mapTask(task);
      const key =
        query.groupBy === "assignee"
          ? (task.assigneeId ?? "unassigned")
          : (task.projectId ?? "no-project");
      const label =
        query.groupBy === "assignee"
          ? (task.assignee?.fullName ?? "Unassigned")
          : (task.project?.name ?? "No project");
      const group = groups.get(key) ?? { id: key, label, items: [] };
      group.items.push(mapped);
      groups.set(key, group);
    }
    return {
      groups: Array.from(groups.values()),
      items: tasks.map(mapTask),
      timezone,
      from: query.from,
      to: query.to,
      groupBy: query.groupBy,
      pagination: buildPaginationMeta(query.page, query.pageSize, total),
    };
  }

  async getTask(workspaceId: string, taskId: string, actor: Actor) {
    return mapTask(await getVisibleTask(workspaceId, taskId, actor));
  }

  async createTask(workspaceId: string, actor: Actor, input: CreateTaskInput) {
    const project = input.projectId
      ? await assertProjectAccessible(workspaceId, input.projectId, actor)
      : null;
    const parentTaskId = input.parentTaskId ?? null;
    const milestoneId = input.milestoneId ?? null;
    await assertHierarchyReferences(
      workspaceId,
      null,
      project?.id ?? null,
      parentTaskId,
      milestoneId,
    );
    if (!parentTaskId && input.subtaskPosition != null) {
      throw new ValidationError("subtaskPosition requires parentTaskId", {
        field: "subtaskPosition",
      });
    }
    const subtaskPosition = parentTaskId
      ? (input.subtaskPosition ?? (await getNextSubtaskPosition(parentTaskId)))
      : null;
    const assigneeId = input.assigneeId === undefined ? actor.userId : input.assigneeId;
    assertCanAssign(actor, assigneeId);
    if (assigneeId) await assertAssignee(workspaceId, assigneeId, project?.id);
    const startAt = input.startAt ? new Date(input.startAt) : null;
    const dueDate = input.dueDate ? new Date(input.dueDate) : null;
    assertDates(startAt, dueDate);
    const status =
      input.status === "BLOCKED" || input.isBlocked
        ? "BLOCKED"
        : (input.status ?? "TODO");
    const workflowStageId = input.projectId
      ? (await resolveStageForLegacyStatus(input.projectId, status)) ??
        (await resolveInitialStageId(input.projectId))
      : null;
    const now = new Date();
    const task = await prisma.$transaction(async (tx) => {
      const counter = await tx.workspaceTaskCounter.upsert({
        where: { workspaceId },
        create: { workspaceId, nextNumber: 2 },
        update: { nextNumber: { increment: 1 } },
      });
      const lastInColumn = await tx.task.findFirst({
        where: {
          workspaceId,
          ...(workflowStageId
            ? { workflowStageId }
            : { status, projectId: input.projectId ?? null }),
          projectId: input.projectId ?? null,
          deletedAt: null,
        },
        orderBy: [{ rank: "desc" }, { taskNumber: "desc" }],
        select: { rank: true },
      });
      const created = await tx.task.create({
        data: {
          workspaceId,
          taskNumber: counter.nextNumber - 1,
          title: input.title,
          description: input.description,
          priority: input.priority ?? "MEDIUM",
          status,
          workflowStageId,
          rank: nextRankAfter(lastInColumn?.rank),
          startAt,
          dueDate,
          completedAt: status === "DONE" ? now : null,
          completedById: status === "DONE" ? actor.userId : null,
          projectId: input.projectId ?? null,
          parentTaskId,
          subtaskPosition,
          milestoneId,
          assigneeId,
          createdById: actor.userId,
          isBlocked: status === "BLOCKED",
          blockedReason: status === "BLOCKED" ? (input.blockedReason ?? null) : null,
          source: input.confirmedFromQuickCapture ? "AI_QUICK_CAPTURE" : "MANUAL",
          riskRecalculateAt: now,
        },
        include: TASK_INCLUDE,
      });
      await recordTaskStatusTransition(tx, {
        taskId: created.id,
        fromStatus: null,
        toStatus: created.status,
        changedById: actor.userId,
        changedAt: now,
      });
      await createAssignmentNotification(tx, created, assigneeId, actor.userId);
      return created;
    });
    await emitTaskActivity("task.created", task, actor);
    await initializeTaskSla(task);
    return mapTask(task);
  }

  private async resolveNeighborRank(
    workspaceId: string,
    actor: Actor,
    neighborId: string | null | undefined,
    column: { targetStatus?: MoveTaskInput["targetStatus"]; targetStageId?: string | null },
    projectId: string | null,
  ) {
    if (!neighborId) return null;
    const neighbor = await getVisibleTask(workspaceId, neighborId, actor, {
      includeArchived: true,
    });
    if (column.targetStageId) {
      if (neighbor.workflowStageId !== column.targetStageId) {
        throw new ValidationError("Neighbor task must be in the target workflow stage", {
          field: "beforeTaskId",
        });
      }
    } else if (column.targetStatus && neighbor.status !== column.targetStatus) {
      throw new ValidationError("Neighbor task must be in the target status", {
        field: "beforeTaskId",
      });
    }
    if ((neighbor.projectId ?? null) !== (projectId ?? null)) {
      throw new ValidationError("Neighbor task must share the same project board", {
        field: "beforeTaskId",
      });
    }
    return neighbor.rank;
  }

  private async rebalanceColumn(
    tx: Prisma.TransactionClient,
    workspaceId: string,
    projectId: string | null,
    column: { targetStatus?: MoveTaskInput["targetStatus"]; targetStageId?: string | null },
  ) {
    const rows = await tx.task.findMany({
      where: {
        workspaceId,
        projectId,
        ...(column.targetStageId
          ? { workflowStageId: column.targetStageId }
          : { status: column.targetStatus }),
        deletedAt: null,
      },
      orderBy: [{ rank: "asc" }, { taskNumber: "asc" }],
      select: { id: true },
    });
    const ranks = rebalanceRanks(rows.length);
    for (let index = 0; index < rows.length; index += 1) {
      await tx.task.update({
        where: { id: rows[index]!.id },
        data: { rank: ranks[index]! },
      });
    }
    return ranks;
  }

  private async resolveMoveTarget(
    workspaceId: string,
    existing: {
      id: string;
      projectId: string | null;
      workflowStageId: string | null;
      status: MoveTaskInput["targetStatus"];
      assigneeId: string | null;
      priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
      isBlocked: boolean;
    },
    input: MoveTaskInput,
    actor: Actor,
  ) {
    const conditionContext = async () => {
      const [incompleteChecklistItems, incompleteDependencies] = await Promise.all([
        prisma.checklistItem.count({
          where: { taskId: existing.id, isCompleted: false },
        }),
        prisma.taskDependency.count({
          where: {
            workspaceId,
            successorTaskId: existing.id,
            predecessorTask: { deletedAt: null, status: { not: "DONE" } },
          },
        }),
      ]);
      return {
        task: {
          assigneeId: existing.assigneeId,
          priority: existing.priority,
          isBlocked: existing.isBlocked,
          checklistComplete: incompleteChecklistItems === 0,
          dependenciesComplete: incompleteDependencies === 0,
        },
      };
    };

    if (!existing.projectId) {
      if (input.targetStageId) {
        throw new ValidationError("Projectless tasks cannot use workflow stages", {
          field: "targetStageId",
        });
      }
      const targetStatus = input.targetStatus!;
      return {
        targetStageId: null,
        targetStatus,
        enteringDone: targetStatus === "DONE" && existing.status !== "DONE",
        reopening: targetStatus !== "DONE" && existing.status === "DONE",
      };
    }

    const applied = await getPublishedProjectWorkflow(existing.projectId);
    if (!applied) {
      throw new ValidationError("Project has no applied workflow", {
        field: input.targetStageId ? "targetStageId" : "targetStatus",
      });
    }
    if (
      !existing.workflowStageId ||
      !applied.workflow.stages.some((stage) => stage.id === existing.workflowStageId)
    ) {
      throw new ValidationError("Task is not assigned to the applied project workflow", {
        field: "workflowStageId",
      });
    }

    if (input.targetStageId) {
      const stage = applied.workflow.stages.find(
        (item) => item.id === input.targetStageId && item.isActive,
      );
      if (!stage) {
        throw new ValidationError("Target stage is not active in the applied project workflow", {
          field: "targetStageId",
        });
      }
      assertTransitionAllowed({
        transitions: applied.workflow.transitions,
        fromStageId: existing.workflowStageId,
        toStageId: stage.id,
        actorPermissions: actor.permissions ?? [],
        conditionContext: await conditionContext(),
      });
      const targetStatus = legacyStatusForStage(stage);
      return {
        targetStageId: stage.id,
        targetStatus,
        enteringDone: targetStatus === "DONE" && existing.status !== "DONE",
        reopening: targetStatus !== "DONE" && existing.status === "DONE",
      };
    }

    const targetStatus = input.targetStatus!;
    const targetStage = resolveStageForStatus(applied.workflow.stages, targetStatus);
    if (!targetStage || !targetStage.isActive) {
      throw new ValidationError("Status has no active stage in the applied project workflow", {
        field: "targetStatus",
      });
    }
    assertTransitionAllowed({
      transitions: applied.workflow.transitions,
      fromStageId: existing.workflowStageId,
      toStageId: targetStage.id,
      actorPermissions: actor.permissions ?? [],
      conditionContext: await conditionContext(),
    });
    const resolvedStatus = legacyStatusForStage(targetStage);
    return {
      targetStageId: targetStage.id,
      targetStatus: resolvedStatus,
      enteringDone: resolvedStatus === "DONE" && existing.status !== "DONE",
      reopening: resolvedStatus !== "DONE" && existing.status === "DONE",
    };
  }

  async moveTask(
    workspaceId: string,
    taskId: string,
    actor: Actor,
    input: MoveTaskInput,
  ) {
    const existing = await getVisibleTask(workspaceId, taskId, actor, {
      includeArchived: true,
    });
    assertCanMutateTask(actor, existing, "move");

    const target = await this.resolveMoveTarget(workspaceId, existing, input, actor);
    const column = {
      targetStatus: target.targetStatus,
      targetStageId: target.targetStageId,
    };

    const beforeRank = await this.resolveNeighborRank(
      workspaceId,
      actor,
      input.beforeTaskId,
      column,
      existing.projectId,
    );
    const afterRank = await this.resolveNeighborRank(
      workspaceId,
      actor,
      input.afterTaskId,
      column,
      existing.projectId,
    );

    const statusChanged = target.targetStatus !== existing.status;
    const completionDecision = target.enteringDone
      ? await assertCompletionAllowed(
          workspaceId,
          taskId,
          actor,
          input.dependencyOverrideReason,
        )
      : null;
    const transitionAt = new Date();

    const transactionResult = await prisma.$transaction(async (tx) => {
      let nextRank = rankBetween(beforeRank, afterRank);
      if (!nextRank) {
        await this.rebalanceColumn(tx, workspaceId, existing.projectId, column);
        const refreshedBefore = input.beforeTaskId
          ? await tx.task.findUnique({
              where: { id: input.beforeTaskId },
              select: { rank: true },
            })
          : null;
        const refreshedAfter = input.afterTaskId
          ? await tx.task.findUnique({
              where: { id: input.afterTaskId },
              select: { rank: true },
            })
          : null;
        nextRank =
          rankBetween(refreshedBefore?.rank, refreshedAfter?.rank) ??
          nextRankAfter(refreshedBefore?.rank);
      }

      const result = await tx.task.updateMany({
        where: { id: existing.id, version: input.version },
        data: {
          status: target.targetStatus,
          workflowStageId: target.targetStageId,
          rank: nextRank,
          isBlocked: target.targetStatus === "BLOCKED",
          blockedReason:
            target.targetStatus === "BLOCKED" ? existing.blockedReason : null,
          dependencyBlocked:
            target.enteringDone || target.targetStatus !== "BLOCKED"
              ? false
              : existing.dependencyBlocked,
          completedAt: target.enteringDone ? new Date() : target.reopening ? null : undefined,
          completedById: target.enteringDone
            ? actor.userId
            : target.reopening
              ? null
              : undefined,
          dependencyOverrideReason: target.enteringDone
            ? completionDecision?.overrideReason
            : target.reopening
              ? null
              : undefined,
          dependencyOverriddenById: target.enteringDone
            ? completionDecision?.overridden
              ? actor.userId
              : null
            : target.reopening
              ? null
              : undefined,
          dependencyOverriddenAt: target.enteringDone
            ? completionDecision?.overridden
              ? transitionAt
              : null
            : target.reopening
              ? null
              : undefined,
          version: { increment: 1 },
        },
      });
      if (result.count !== 1) throw new ConflictError("Task version is stale");
      const updatedTask = await tx.task.findUniqueOrThrow({
        where: { id: existing.id },
        include: TASK_INCLUDE,
      });
      if (statusChanged) {
        await recordTaskStatusTransition(tx, {
          taskId: existing.id,
          fromStatus: existing.status,
          toStatus: target.targetStatus,
          changedById: actor.userId,
          changedAt: transitionAt,
        });
      }
      const unblocked = target.enteringDone
        ? await applySuccessorHandoffs(tx, {
            workspaceId,
            predecessorTaskId: existing.id,
            actorId: actor.userId,
            now: transitionAt,
          })
        : [];
      return { task: updatedTask, unblocked };
    });
    const { task, unblocked } = transactionResult;

    await emitTaskActivity(
      target.enteringDone
        ? "task.completed"
        : statusChanged
          ? "task.status_changed"
          : "task.moved",
      task,
      actor,
    );
    if (completionDecision?.overridden) {
      await recordActivity({
        workspaceId,
        actorId: actor.userId,
        action: "task.dependency_overridden",
        resourceType: "task",
        resourceId: task.id,
        projectId: task.projectId,
        summary: `Dependency completion policy overridden for task #${task.taskNumber}`,
        metadata: {
          reason: completionDecision.overrideReason,
          incompleteTaskIds: completionDecision.incomplete.map((item) => item.id),
        },
        sensitive: true,
      });
      await writeAuditLog({
        action: "task.dependency_completion_overridden",
        userId: actor.userId,
        workspaceId,
        entityType: "task",
        entityId: task.id,
        metadata: {
          reason: completionDecision.overrideReason,
          incompleteTaskIds: completionDecision.incomplete.map((item) => item.id),
        },
      });
    }
    for (const successor of unblocked) {
      await recordActivity({
        workspaceId,
        actorId: actor.userId,
        action: "task.unblocked",
        resourceType: "task",
        resourceId: successor.id,
        projectId: successor.projectId,
        summary: `Task #${successor.taskNumber} unblocked after dependencies completed`,
      });
    }
    return mapTask(task);
  }

  async exportTasks(
    workspaceId: string,
    actor: Actor,
    input: ExportTasksInput,
    audit: { ipAddress?: string | null; userAgent?: string | null; requestId?: string | null },
  ) {
    this.assertDeletedListAllowed(actor, input.filters?.includeDeleted);
    if (input.scope === "selected" && !input.selectedIds?.length) {
      throw new ValidationError("selectedIds are required for selected scope", {
        field: "selectedIds",
      });
    }
    const workspace = await this.requireWorkspace(workspaceId);
    const timezone = resolveTaskTimezone(input.timezone, workspace.timezone);
    const where = buildTaskListWhere(
      workspaceId,
      actor,
      {
        ...input.filters,
        selectedIds: input.scope === "selected" ? input.selectedIds : undefined,
        timezone,
      },
      workspace.timezone,
    );
    const total = await prisma.task.count({ where });
    if (total > EXPORT_ROW_LIMIT) {
      throw new ValidationError(
        `Export exceeds the ${EXPORT_ROW_LIMIT} row limit. Narrow filters and try again.`,
        { field: "filters", limit: EXPORT_ROW_LIMIT, total },
      );
    }
    const tasks = await prisma.task.findMany({
      where,
      take: EXPORT_ROW_LIMIT,
      orderBy: [{ taskNumber: "asc" }],
      include: TASK_INCLUDE,
    });
    const columns = input.columns?.length
      ? input.columns
      : [...EXPORT_DEFAULT_COLUMNS];
    const headers = columns.map((column) => column);
    const rows = tasks.map((task) =>
      columns.map((column) => {
        switch (column) {
          case "taskNumber":
            return String(task.taskNumber);
          case "title":
            return sanitizeExportCell(task.title);
          case "status":
            return task.status;
          case "priority":
            return task.priority;
          case "project":
            return sanitizeExportCell(task.project?.name ?? "");
          case "assignee":
            return sanitizeExportCell(task.assignee?.fullName ?? "");
          case "creator":
            return sanitizeExportCell(task.creator?.fullName ?? "");
          case "startAt":
            return formatExportDate(task.startAt, timezone, input.dateFormat);
          case "dueDate":
            return formatExportDate(task.dueDate, timezone, input.dateFormat);
          case "completedAt":
            return formatExportDate(task.completedAt, timezone, input.dateFormat);
          case "createdAt":
            return formatExportDate(task.createdAt, timezone, input.dateFormat);
          case "updatedAt":
            return formatExportDate(task.updatedAt, timezone, input.dateFormat);
          default:
            return "";
        }
      }),
    );

    await writeAuditLog({
      action: "tasks.exported",
      userId: actor.userId,
      workspaceId,
      entityType: "task_export",
      metadata: {
        format: input.format,
        scope: input.scope,
        rowCount: tasks.length,
        columns,
        timezone,
      },
      ipAddress: audit.ipAddress,
      userAgent: audit.userAgent,
      requestId: audit.requestId,
    });

    if (input.format === "csv") {
      const escape = (value: string) => {
        if (/[",\n\r]/.test(value)) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      };
      const csv = [headers, ...rows]
        .map((line) => line.map((cell) => escape(cell)).join(","))
        .join("\n");
      return {
        format: "csv" as const,
        filename: `tasks-export-${formatYmd(new Date(), timezone)}.csv`,
        contentType: "text/csv; charset=utf-8",
        body: Buffer.from(`\uFEFF${csv}`, "utf8"),
        rowCount: tasks.length,
      };
    }

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Tasks");
    sheet.addRow(headers);
    for (const row of rows) {
      sheet.addRow(row);
    }
    const body = Buffer.from(await workbook.xlsx.writeBuffer());
    return {
      format: "xlsx" as const,
      filename: `tasks-export-${formatYmd(new Date(), timezone)}.xlsx`,
      contentType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      body,
      rowCount: tasks.length,
    };
  }

  async updateTask(
    workspaceId: string,
    taskId: string,
    actor: Actor,
    input: UpdateTaskInput,
  ) {
    const existing = await getVisibleTask(workspaceId, taskId, actor, {
      includeArchived: true,
    });
    assertCanMutateTask(actor, existing);
    if (input.assigneeId !== undefined) assertCanAssign(actor, input.assigneeId);
    const nextProjectId =
      input.projectId === undefined ? existing.projectId : input.projectId;
    if (nextProjectId) await assertProjectAccessible(workspaceId, nextProjectId, actor);
    const projectChanged =
      input.projectId !== undefined && input.projectId !== existing.projectId;
    const nextParentTaskId =
      input.parentTaskId === undefined
        ? projectChanged
          ? null
          : existing.parentTaskId
        : input.parentTaskId;
    const nextMilestoneId =
      input.milestoneId === undefined
        ? projectChanged
          ? null
          : existing.milestoneId
        : input.milestoneId;
    await assertHierarchyReferences(
      workspaceId,
      existing.id,
      nextProjectId,
      nextParentTaskId,
      nextMilestoneId,
    );
    if (!nextParentTaskId && input.subtaskPosition != null) {
      throw new ValidationError("subtaskPosition requires parentTaskId", {
        field: "subtaskPosition",
      });
    }
    const parentChanged = nextParentTaskId !== existing.parentTaskId;
    const nextSubtaskPosition = nextParentTaskId
      ? input.subtaskPosition != null
        ? input.subtaskPosition
        : parentChanged || existing.subtaskPosition === null
          ? await getNextSubtaskPosition(nextParentTaskId)
          : existing.subtaskPosition
      : null;
    const nextAssigneeId =
      input.assigneeId === undefined ? existing.assigneeId : input.assigneeId;
    if (nextAssigneeId) {
      await assertAssignee(workspaceId, nextAssigneeId, nextProjectId);
    }
    const startAt =
      input.startAt === undefined
        ? existing.startAt
        : input.startAt
          ? new Date(input.startAt)
          : null;
    const dueDate =
      input.dueDate === undefined
        ? existing.dueDate
        : input.dueDate
          ? new Date(input.dueDate)
          : null;
    assertDates(startAt, dueDate);
    let nextStatus = input.status ?? existing.status;
    if (input.isBlocked === true) nextStatus = "BLOCKED";
    if (input.isBlocked === false && nextStatus === "BLOCKED") nextStatus = "TODO";
    let nextWorkflowStageId = existing.workflowStageId;
    if (nextStatus !== existing.status) {
      const resolved = await this.resolveMoveTarget(
        workspaceId,
        existing,
        { targetStatus: nextStatus, version: input.version },
        actor,
      );
      nextStatus = resolved.targetStatus;
      nextWorkflowStageId = resolved.targetStageId;
    }
    if (projectChanged) {
      if (!nextProjectId) {
        nextWorkflowStageId = null;
      } else {
        const targetWorkflow = await getPublishedProjectWorkflow(nextProjectId);
        const targetStage = targetWorkflow
          ? resolveStageForStatus(targetWorkflow.workflow.stages, nextStatus)
          : null;
        if (!targetStage || !targetStage.isActive) {
          throw new ValidationError(
            "Task status cannot be mapped to an active stage in the target project workflow",
            { field: "projectId" },
          );
        }
        nextWorkflowStageId = targetStage.id;
        nextStatus = legacyStatusForStage(targetStage);
      }
    }
    if (!nextProjectId) nextWorkflowStageId = null;
    const enteringDone = nextStatus === "DONE" && existing.status !== "DONE";
    const reopening = nextStatus !== "DONE" && existing.status === "DONE";
    const assignmentChanged =
      input.assigneeId !== undefined && input.assigneeId !== existing.assigneeId;
    const statusChanged = nextStatus !== existing.status;
    const completionDecision = enteringDone
      ? await assertCompletionAllowed(
          workspaceId,
          taskId,
          actor,
          input.dependencyOverrideReason,
        )
      : null;
    const transitionAt = new Date();

    const transactionResult = await prisma.$transaction(async (tx) => {
      if (projectChanged) {
        await tx.task.updateMany({
          where: { parentTaskId: existing.id },
          data: { parentTaskId: null, subtaskPosition: null },
        });
      }
      const result = await tx.task.updateMany({
        where: { id: existing.id, version: input.version },
        data: {
          title: input.title,
          description: input.description,
          priority: input.priority,
          status: nextStatus,
          workflowStageId: nextWorkflowStageId,
          startAt: input.startAt === undefined ? undefined : startAt,
          dueDate: input.dueDate === undefined ? undefined : dueDate,
          projectId: input.projectId,
          parentTaskId:
            input.parentTaskId !== undefined || projectChanged
              ? nextParentTaskId
              : undefined,
          subtaskPosition:
            input.parentTaskId !== undefined ||
            input.subtaskPosition !== undefined ||
            projectChanged
              ? nextSubtaskPosition
              : undefined,
          milestoneId:
            input.milestoneId !== undefined || projectChanged
              ? nextMilestoneId
              : undefined,
          assigneeId: input.assigneeId,
          isBlocked: nextStatus === "BLOCKED",
          blockedReason: nextStatus === "BLOCKED" ? input.blockedReason : null,
          dependencyBlocked:
            enteringDone || nextStatus !== "BLOCKED"
              ? false
              : existing.dependencyBlocked,
          completedAt: enteringDone ? new Date() : reopening ? null : undefined,
          completedById: enteringDone ? actor.userId : reopening ? null : undefined,
          dependencyOverrideReason: enteringDone
            ? completionDecision?.overrideReason
            : reopening
              ? null
              : undefined,
          dependencyOverriddenById: enteringDone
            ? completionDecision?.overridden
              ? actor.userId
              : null
            : reopening
              ? null
              : undefined,
          dependencyOverriddenAt: enteringDone
            ? completionDecision?.overridden
              ? transitionAt
              : null
            : reopening
              ? null
              : undefined,
          version: { increment: 1 },
        },
      });
      if (result.count !== 1) throw new ConflictError("Task version is stale");
      const updated = await tx.task.findUniqueOrThrow({
        where: { id: existing.id },
        include: TASK_INCLUDE,
      });
      if (assignmentChanged) {
        await createAssignmentNotification(tx, updated, updated.assigneeId, actor.userId);
      }
      if (statusChanged) {
        await recordTaskStatusTransition(tx, {
          taskId: existing.id,
          fromStatus: existing.status,
          toStatus: nextStatus,
          changedById: actor.userId,
          changedAt: transitionAt,
        });
      }
      const unblocked = enteringDone
        ? await applySuccessorHandoffs(tx, {
            workspaceId,
            predecessorTaskId: existing.id,
            actorId: actor.userId,
            now: transitionAt,
          })
        : [];
      return { task: updated, unblocked };
    });
    const { task, unblocked } = transactionResult;
    if (statusChanged && (nextStatus === "DONE" || nextStatus === "CANCELLED")) {
      await finalizeTaskSlaOnStatusChange(task.id, nextStatus, transitionAt);
    }
    const action = enteringDone
      ? "task.completed"
      : assignmentChanged
        ? "task.assigned"
        : statusChanged
          ? "task.status_changed"
          : "task.updated";
    await emitTaskActivity(action, task, actor);
    if (completionDecision?.overridden) {
      await recordActivity({
        workspaceId,
        actorId: actor.userId,
        action: "task.dependency_overridden",
        resourceType: "task",
        resourceId: task.id,
        projectId: task.projectId,
        summary: `Dependency completion policy overridden for task #${task.taskNumber}`,
        metadata: {
          reason: completionDecision.overrideReason,
          incompleteTaskIds: completionDecision.incomplete.map((item) => item.id),
        },
        sensitive: true,
      });
      await writeAuditLog({
        action: "task.dependency_completion_overridden",
        userId: actor.userId,
        workspaceId,
        entityType: "task",
        entityId: task.id,
        metadata: {
          reason: completionDecision.overrideReason,
          incompleteTaskIds: completionDecision.incomplete.map((item) => item.id),
        },
      });
    }
    for (const successor of unblocked) {
      await recordActivity({
        workspaceId,
        actorId: actor.userId,
        action: "task.unblocked",
        resourceType: "task",
        resourceId: successor.id,
        projectId: successor.projectId,
        summary: `Task #${successor.taskNumber} unblocked after dependencies completed`,
      });
    }
    return mapTask(task);
  }

  async changeStatus(
    workspaceId: string,
    taskId: string,
    actor: Actor,
    input: StatusMutationInput,
  ) {
    return this.updateTask(workspaceId, taskId, actor, input);
  }

  async changeAssignee(
    workspaceId: string,
    taskId: string,
    actor: Actor,
    input: AssigneeMutationInput,
  ) {
    return this.updateTask(workspaceId, taskId, actor, input);
  }

  private async lifecycle(
    workspaceId: string,
    taskId: string,
    actor: Actor,
    version: number,
    action: "archive" | "unarchive" | "delete" | "restore",
  ) {
    if (action === "restore" && !isAdmin(actor)) {
      throw new ForbiddenError("Only workspace owners and admins may restore tasks");
    }
    const existing = await getVisibleTask(workspaceId, taskId, actor, {
      includeDeleted: action === "restore",
      includeArchived: true,
    });
    assertCanMutateTask(actor, existing, action);
    const data: Prisma.TaskUpdateManyMutationInput = {
      version: { increment: 1 },
      ...(action === "archive" ? { archivedAt: new Date() } : {}),
      ...(action === "unarchive" ? { archivedAt: null } : {}),
      ...(action === "delete" ? { deletedAt: new Date() } : {}),
      ...(action === "restore" ? { deletedAt: null } : {}),
    };
    const updated = await prisma.task.updateMany({
      where: { id: existing.id, version },
      data,
    });
    if (updated.count !== 1) throw new ConflictError("Task version is stale");
    const task = await prisma.task.findUniqueOrThrow({
      where: { id: existing.id },
      include: TASK_INCLUDE,
    });
    const event = {
      archive: "task.archived",
      unarchive: "task.unarchived",
      delete: "task.deleted",
      restore: "task.restored",
    }[action];
    await emitTaskActivity(event, task, actor);
    return mapTask(task);
  }

  archiveTask(
    workspaceId: string,
    taskId: string,
    actor: Actor,
    input: VersionMutationInput,
  ) {
    return this.lifecycle(workspaceId, taskId, actor, input.version, "archive");
  }
  unarchiveTask(
    workspaceId: string,
    taskId: string,
    actor: Actor,
    input: VersionMutationInput,
  ) {
    return this.lifecycle(workspaceId, taskId, actor, input.version, "unarchive");
  }
  deleteTask(workspaceId: string, taskId: string, actor: Actor, version: number) {
    return this.lifecycle(workspaceId, taskId, actor, version, "delete");
  }
  restoreTask(
    workspaceId: string,
    taskId: string,
    actor: Actor,
    input: VersionMutationInput,
  ) {
    return this.lifecycle(workspaceId, taskId, actor, input.version, "restore");
  }

  async getTaskActivity(
    workspaceId: string,
    taskId: string,
    actor: Actor,
    query: TaskActivityQuery,
  ) {
    await getVisibleTask(workspaceId, taskId, actor, {
      includeArchived: true,
      includeDeleted: isAdmin(actor),
    });
    const where = { workspaceId, resourceType: "task", resourceId: taskId };
    const skip = (query.page - 1) * query.pageSize;
    const [total, events] = await Promise.all([
      prisma.activityEvent.count({ where }),
      prisma.activityEvent.findMany({
        where,
        skip,
        take: query.pageSize,
        orderBy: { createdAt: "desc" },
        include: { actor: { select: { id: true, fullName: true, email: true } } },
      }),
    ]);
    return {
      items: events.map((event) => ({
        ...event,
        createdAt: event.createdAt.toISOString(),
      })),
      pagination: buildPaginationMeta(query.page, query.pageSize, total),
    };
  }

  async bulkUpdate(workspaceId: string, actor: Actor, input: BulkUpdateInput) {
    const results = [];
    for (const item of input.items) {
      try {
        const hasFieldUpdates = [
          item.changes.status,
          item.changes.priority,
          item.changes.assigneeId,
          item.changes.projectId,
        ].some((value) => value !== undefined);
        let task = null;
        if (hasFieldUpdates) {
          task = await this.updateTask(workspaceId, item.taskId, actor, {
            version: item.version,
            status: item.changes.status,
            priority: item.changes.priority,
            assigneeId: item.changes.assigneeId,
            projectId: item.changes.projectId,
            dependencyOverrideReason: item.changes.dependencyOverrideReason,
          });
        }
        if (item.changes.archived !== undefined) {
          const lifecycleInput = {
            version: task?.version ?? item.version,
          };
          task = item.changes.archived
            ? await this.archiveTask(workspaceId, item.taskId, actor, lifecycleInput)
            : await this.unarchiveTask(workspaceId, item.taskId, actor, lifecycleInput);
        }
        results.push({ taskId: item.taskId, success: true, task });
      } catch (error) {
        const appError = error instanceof AppError ? error : null;
        results.push({
          taskId: item.taskId,
          success: false,
          error: {
            code: appError?.code ?? "INTERNAL_ERROR",
            message: error instanceof Error ? error.message : "Unknown error",
          },
        });
      }
    }
    return { results };
  }

  async bulkDelete(workspaceId: string, actor: Actor, input: BulkDeleteInput) {
    const results = [];
    for (const item of input.items) {
      try {
        const task = await this.deleteTask(workspaceId, item.taskId, actor, item.version);
        results.push({ taskId: item.taskId, success: true, task });
      } catch (error) {
        const appError = error instanceof AppError ? error : null;
        results.push({
          taskId: item.taskId,
          success: false,
          error: {
            code: appError?.code ?? "INTERNAL_ERROR",
            message: error instanceof Error ? error.message : "Unknown error",
          },
        });
      }
    }
    return { results };
  }

  async parseTask(workspaceId: string, _actor: Actor, input: ParseTaskInput) {
    const workspace = await prisma.workspace.findFirst({
      where: { id: workspaceId, deletedAt: null },
    });
    if (!workspace) throw new NotFoundError("Workspace not found");
    return parseTaskDraft(workspaceId, input, {
      timezone: workspace.timezone,
      locale: workspace.locale,
    });
  }
}

export const tasksService = new TasksService();
