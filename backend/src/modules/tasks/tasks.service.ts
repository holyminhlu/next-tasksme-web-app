import type { Prisma } from "../../../generated/prisma/client.js";
import { prisma } from "../../config/database.js";
import { ForbiddenError, NotFoundError, ValidationError } from "../../lib/errors.js";
import {
  buildPaginationMeta,
  getPagination,
} from "../../lib/pagination.js";
import { buildTaskVisibilityWhere, hasWorkspaceTaskScope } from "../../lib/task-scope.js";
import { resolveDashboardRange } from "../../lib/timezone.js";
import { recordActivity } from "../../services/activity.service.js";
import { parseTaskText as parseTaskDraft } from "./parse.service.js";
import type {
  CreateTaskInput,
  ListTasksQuery,
  ParseTaskInput,
  UpdateTaskInput,
} from "./tasks.schemas.js";

type Actor = {
  userId: string;
  roleKey: string;
};

function mapTask(task: {
  id: string;
  workspaceId: string;
  projectId: string | null;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  dueDate: Date | null;
  completedAt: Date | null;
  isBlocked: boolean;
  blockedReason: string | null;
  source: string;
  createdById: string | null;
  assigneeId: string | null;
  createdAt: Date;
  updatedAt: Date;
  project?: { id: string; name: string } | null;
}) {
  return {
    id: task.id,
    workspaceId: task.workspaceId,
    projectId: task.projectId,
    projectName: task.project?.name ?? null,
    title: task.title,
    description: task.description,
    status: task.status,
    priority: task.priority,
    dueDate: task.dueDate?.toISOString() ?? null,
    completedAt: task.completedAt?.toISOString() ?? null,
    isBlocked: task.isBlocked,
    blockedReason: task.blockedReason,
    source: task.source,
    createdById: task.createdById,
    assigneeId: task.assigneeId,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
  };
}

function assertCanMutateTask(
  actor: Actor,
  task: { assigneeId: string | null; createdById: string | null },
  action: "update" | "delete",
) {
  if (
    !hasWorkspaceTaskScope(actor.roleKey) &&
    task.assigneeId !== actor.userId &&
    task.createdById !== actor.userId
  ) {
    throw new ForbiddenError(
      action === "delete"
        ? "You cannot delete this task"
        : "You cannot update this task",
    );
  }
}

async function assertProjectInWorkspace(workspaceId: string, projectId: string) {
  const project = await prisma.project.findFirst({
    where: { id: projectId, workspaceId, deletedAt: null },
  });
  if (!project) {
    throw new ValidationError("projectId must belong to this workspace", {
      field: "projectId",
    });
  }
  return project;
}

async function assertAssigneeInWorkspace(
  workspaceId: string,
  assigneeId: string,
) {
  const member = await prisma.workspaceMember.findFirst({
    where: {
      workspaceId,
      userId: assigneeId,
      deletedAt: null,
      status: "ACTIVE",
    },
    include: { user: true },
  });
  if (!member) {
    throw new ValidationError(
      "assigneeId must be an active member of this workspace",
      { field: "assigneeId" },
    );
  }
  return member.user;
}

async function getVisibleTask(
  workspaceId: string,
  taskId: string,
  actor: Actor,
) {
  const task = await prisma.task.findFirst({
    where: {
      id: taskId,
      workspaceId,
      deletedAt: null,
      ...buildTaskVisibilityWhere({
        workspaceId,
        userId: actor.userId,
        roleKey: actor.roleKey,
      }),
    },
    include: { project: { select: { id: true, name: true } } },
  });
  if (!task) {
    throw new NotFoundError("Task not found");
  }
  return task;
}

export class TasksService {
  async listTasks(workspaceId: string, actor: Actor, query: ListTasksQuery) {
    const pagination = getPagination(query);
    const workspace = await prisma.workspace.findFirst({
      where: { id: workspaceId, deletedAt: null },
    });
    const timezone = query.timezone ?? workspace?.timezone ?? "UTC";
    const range = resolveDashboardRange({ timezone });

    const where: Prisma.TaskWhereInput = buildTaskVisibilityWhere({
      workspaceId,
      userId: actor.userId,
      roleKey: actor.roleKey,
      projectId: query.projectId,
      assigneeId: query.assigneeId,
      status: query.status,
    });

    if (query.due === "today") {
      where.status = { in: ["TODO", "IN_PROGRESS"] };
      where.dueDate = { gte: range.todayStart, lte: range.todayEnd };
    } else if (query.due === "overdue") {
      where.status = { in: ["TODO", "IN_PROGRESS"] };
      where.dueDate = { lt: range.todayStart, not: null };
    } else if (query.due === "upcoming") {
      where.status = { in: ["TODO", "IN_PROGRESS"] };
      where.dueDate = { gt: range.todayEnd };
    }

    const [total, tasks] = await Promise.all([
      prisma.task.count({ where }),
      prisma.task.findMany({
        where,
        skip: pagination.skip,
        take: pagination.take,
        orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
        include: { project: { select: { id: true, name: true } } },
      }),
    ]);

    return {
      items: tasks.map(mapTask),
      pagination: buildPaginationMeta(
        pagination.page,
        pagination.pageSize,
        total,
      ),
    };
  }

  async getTask(workspaceId: string, taskId: string, actor: Actor) {
    const task = await getVisibleTask(workspaceId, taskId, actor);
    return mapTask(task);
  }

  async createTask(workspaceId: string, actor: Actor, input: CreateTaskInput) {
    if (input.projectId) {
      await assertProjectInWorkspace(workspaceId, input.projectId);
    }
    if (input.assigneeId) {
      await assertAssigneeInWorkspace(workspaceId, input.assigneeId);
    }

    const status = input.status ?? "TODO";
    const task = await prisma.task.create({
      data: {
        workspaceId,
        title: input.title,
        description: input.description,
        priority: input.priority ?? "MEDIUM",
        status,
        dueDate: input.dueDate ? new Date(input.dueDate) : null,
        completedAt: status === "DONE" ? new Date() : null,
        projectId: input.projectId ?? null,
        assigneeId:
          input.assigneeId === undefined ? actor.userId : input.assigneeId,
        createdById: actor.userId,
        isBlocked: input.isBlocked ?? false,
        blockedReason: input.blockedReason ?? null,
        source: input.confirmedFromQuickCapture ? "AI_QUICK_CAPTURE" : "MANUAL",
      },
      include: { project: { select: { id: true, name: true } } },
    });

    await recordActivity({
      workspaceId,
      actorId: actor.userId,
      action: "task.created",
      resourceType: "task",
      resourceId: task.id,
      projectId: task.projectId,
      summary: `Created task "${task.title}"`,
      metadata: {
        title: task.title,
        status: task.status,
        assigneeId: task.assigneeId,
        createdById: task.createdById,
        source: task.source,
      },
    });

    return mapTask(task);
  }

  async updateTask(
    workspaceId: string,
    taskId: string,
    actor: Actor,
    input: UpdateTaskInput,
  ) {
    const existing = await getVisibleTask(workspaceId, taskId, actor);
    assertCanMutateTask(actor, existing, "update");

    if (input.projectId) {
      await assertProjectInWorkspace(workspaceId, input.projectId);
    }
    if (input.assigneeId) {
      await assertAssigneeInWorkspace(workspaceId, input.assigneeId);
    }

    const nextStatus = input.status ?? existing.status;
    let completedAt: Date | null | undefined = undefined;
    if (input.status !== undefined) {
      if (nextStatus === "DONE" && existing.status !== "DONE") {
        completedAt = new Date();
      } else if (nextStatus !== "DONE" && existing.status === "DONE") {
        completedAt = null;
      }
    }

    const task = await prisma.task.update({
      where: { id: existing.id },
      data: {
        title: input.title,
        description: input.description,
        priority: input.priority,
        status: input.status,
        completedAt,
        dueDate:
          input.dueDate === undefined
            ? undefined
            : input.dueDate
              ? new Date(input.dueDate)
              : null,
        projectId: input.projectId,
        assigneeId: input.assigneeId,
        isBlocked: input.isBlocked,
        blockedReason: input.blockedReason,
      },
      include: { project: { select: { id: true, name: true } } },
    });

    const action =
      input.status === "DONE" && existing.status !== "DONE"
        ? "task.completed"
        : "task.updated";

    await recordActivity({
      workspaceId,
      actorId: actor.userId,
      action,
      resourceType: "task",
      resourceId: task.id,
      projectId: task.projectId,
      summary:
        action === "task.completed"
          ? `Completed task "${task.title}"`
          : `Updated task "${task.title}"`,
      metadata: {
        title: task.title,
        status: task.status,
        assigneeId: task.assigneeId,
        createdById: task.createdById,
      },
    });

    return mapTask(task);
  }

  async deleteTask(workspaceId: string, taskId: string, actor: Actor) {
    const existing = await getVisibleTask(workspaceId, taskId, actor);
    assertCanMutateTask(actor, existing, "delete");

    const deletedAt = new Date();
    const task = await prisma.task.update({
      where: { id: existing.id },
      data: { deletedAt },
    });

    await recordActivity({
      workspaceId,
      actorId: actor.userId,
      action: "task.deleted",
      resourceType: "task",
      resourceId: task.id,
      projectId: task.projectId,
      summary: `Deleted task "${task.title}"`,
      metadata: {
        title: task.title,
        status: task.status,
        assigneeId: task.assigneeId,
        createdById: task.createdById,
      },
      sensitive: false,
    });

    return {
      id: task.id,
      deleted: true,
      deletedAt: deletedAt.toISOString(),
    };
  }

  async parseTask(workspaceId: string, _actor: Actor, input: ParseTaskInput) {
    const workspace = await prisma.workspace.findFirst({
      where: { id: workspaceId, deletedAt: null },
    });
    if (!workspace) {
      throw new NotFoundError("Workspace not found");
    }

    return parseTaskDraft(workspaceId, input, {
      timezone: workspace.timezone,
      locale: workspace.locale,
    });
  }
}

export const tasksService = new TasksService();
