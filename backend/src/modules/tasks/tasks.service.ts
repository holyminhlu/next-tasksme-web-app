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
  buildTaskVisibilityWhere,
  hasWorkspaceTaskScope,
  OPEN_TASK_STATUSES,
} from "../../lib/task-scope.js";
import { resolveDashboardRange } from "../../lib/timezone.js";
import { recordActivity } from "../../services/activity.service.js";
import { parseTaskText as parseTaskDraft } from "./parse.service.js";
import type {
  AssigneeMutationInput,
  BulkDeleteInput,
  BulkUpdateInput,
  CreateTaskInput,
  ListTasksQuery,
  ParseTaskInput,
  StatusMutationInput,
  TaskActivityQuery,
  UpdateTaskInput,
  VersionMutationInput,
} from "./tasks.schemas.js";

type Actor = { userId: string; roleKey: string };
const TASK_INCLUDE = {
  project: { select: { id: true, name: true, visibility: true } },
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
    project: task.project,
    projectName: task.project?.name ?? null,
    title: task.title,
    description: task.description,
    status: task.status,
    priority: task.priority,
    startAt: task.startAt?.toISOString() ?? null,
    dueDate: task.dueDate?.toISOString() ?? null,
    completedAt: task.completedAt?.toISOString() ?? null,
    completedById: task.completedById,
    completedBy: mapPerson(task.completedBy),
    isBlocked: task.isBlocked,
    blockedReason: task.blockedReason,
    source: task.source,
    createdById: task.createdById,
    creator: mapPerson(task.creator),
    assigneeId: task.assigneeId,
    assignee: mapPerson(task.assignee),
    version: task.version,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
    archivedAt: task.archivedAt?.toISOString() ?? null,
    deletedAt: task.deletedAt?.toISOString() ?? null,
    deleted: task.deletedAt !== null,
  };
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
  const project = await prisma.project.findFirst({
    where: { id: projectId, workspaceId, deletedAt: null },
    include: { members: { select: { userId: true } } },
  });
  if (!project) {
    throw new ValidationError("projectId must belong to this workspace", {
      field: "projectId",
    });
  }
  if (
    project.visibility === "PRIVATE" &&
    !isAdmin(actor) &&
    !project.members.some((member) => member.userId === actor.userId)
  ) {
    throw new ForbiddenError("You are not a member of this private project");
  }
  return project;
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
  async listTasks(workspaceId: string, actor: Actor, query: ListTasksQuery) {
    if (query.includeDeleted && !isAdmin(actor)) {
      throw new ForbiddenError("Only workspace owners and admins may list deleted tasks");
    }
    const pagination = getPagination(query);
    const workspace = await prisma.workspace.findFirst({
      where: { id: workspaceId, deletedAt: null },
    });
    if (!workspace) throw new NotFoundError("Workspace not found");
    const range = resolveDashboardRange({
      timezone: query.timezone ?? workspace.timezone,
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
      ...(query.unassigned ? { assigneeId: null } : {}),
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
      where.dueDate = { lt: new Date(), not: null };
    } else if (query.due === "upcoming") {
      where.status = { in: [...OPEN_TASK_STATUSES] };
      where.dueDate = { gt: range.todayEnd };
    }
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

  async getTask(workspaceId: string, taskId: string, actor: Actor) {
    return mapTask(await getVisibleTask(workspaceId, taskId, actor));
  }

  async createTask(workspaceId: string, actor: Actor, input: CreateTaskInput) {
    const project = input.projectId
      ? await assertProjectAccessible(workspaceId, input.projectId, actor)
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
    const now = new Date();
    const task = await prisma.$transaction(async (tx) => {
      const counter = await tx.workspaceTaskCounter.upsert({
        where: { workspaceId },
        create: { workspaceId, nextNumber: 2 },
        update: { nextNumber: { increment: 1 } },
      });
      const created = await tx.task.create({
        data: {
          workspaceId,
          taskNumber: counter.nextNumber - 1,
          title: input.title,
          description: input.description,
          priority: input.priority ?? "MEDIUM",
          status,
          startAt,
          dueDate,
          completedAt: status === "DONE" ? now : null,
          completedById: status === "DONE" ? actor.userId : null,
          projectId: input.projectId ?? null,
          assigneeId,
          createdById: actor.userId,
          isBlocked: status === "BLOCKED",
          blockedReason: status === "BLOCKED" ? (input.blockedReason ?? null) : null,
          source: input.confirmedFromQuickCapture ? "AI_QUICK_CAPTURE" : "MANUAL",
        },
        include: TASK_INCLUDE,
      });
      await createAssignmentNotification(tx, created, assigneeId, actor.userId);
      return created;
    });
    await emitTaskActivity("task.created", task, actor);
    return mapTask(task);
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
    const enteringDone = nextStatus === "DONE" && existing.status !== "DONE";
    const reopening = nextStatus !== "DONE" && existing.status === "DONE";
    const assignmentChanged =
      input.assigneeId !== undefined && input.assigneeId !== existing.assigneeId;
    const statusChanged = nextStatus !== existing.status;

    const task = await prisma.$transaction(async (tx) => {
      const result = await tx.task.updateMany({
        where: { id: existing.id, version: input.version },
        data: {
          title: input.title,
          description: input.description,
          priority: input.priority,
          status: nextStatus,
          startAt: input.startAt === undefined ? undefined : startAt,
          dueDate: input.dueDate === undefined ? undefined : dueDate,
          projectId: input.projectId,
          assigneeId: input.assigneeId,
          isBlocked: nextStatus === "BLOCKED",
          blockedReason: nextStatus === "BLOCKED" ? input.blockedReason : null,
          completedAt: enteringDone ? new Date() : reopening ? null : undefined,
          completedById: enteringDone ? actor.userId : reopening ? null : undefined,
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
      return updated;
    });
    const action = enteringDone
      ? "task.completed"
      : assignmentChanged
        ? "task.assigned"
        : statusChanged
          ? "task.status_changed"
          : "task.updated";
    await emitTaskActivity(action, task, actor);
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
