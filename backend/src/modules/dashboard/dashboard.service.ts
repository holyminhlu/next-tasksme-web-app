import type { Prisma } from "../../../generated/prisma/client.js";
import { prisma } from "../../config/database.js";
import { NotFoundError, ValidationError } from "../../lib/errors.js";
import {
  assertMemberFilterAllowed,
  buildTaskVisibilityWhere,
  hasWorkspaceTaskScope,
  OPEN_TASK_STATUSES,
} from "../../lib/task-scope.js";
import { formatYmd, resolveDashboardRange } from "../../lib/timezone.js";
import { buildActivityVisibilityWhere } from "../../services/activity.service.js";
import type { ActivityQuery, DashboardQuery, MyWorkQuery } from "./dashboard.schemas.js";

type Actor = {
  userId: string;
  roleKey: string;
};

function mapTask(task: {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  dueDate: Date | null;
  completedAt?: Date | null;
  isBlocked: boolean;
  projectId: string | null;
  assigneeId: string | null;
  project?: { name: string } | null;
}) {
  return {
    id: task.id,
    title: task.title,
    description: task.description,
    status: task.status,
    priority: task.priority,
    dueDate: task.dueDate?.toISOString() ?? null,
    completedAt: task.completedAt?.toISOString() ?? null,
    isBlocked: task.isBlocked,
    projectId: task.projectId,
    projectName: task.project?.name ?? null,
    assigneeId: task.assigneeId,
  };
}

/** DONE tasks completed in range; fall back to updatedAt only when completedAt is null. */
function buildCompletedInRangeWhere(
  base: Prisma.TaskWhereInput,
  fromInstant: Date,
  toInstant: Date,
): Prisma.TaskWhereInput {
  return {
    AND: [
      base,
      {
        status: "DONE",
        OR: [
          {
            completedAt: {
              gte: fromInstant,
              lte: toInstant,
            },
          },
          {
            completedAt: null,
            updatedAt: {
              gte: fromInstant,
              lte: toInstant,
            },
          },
        ],
      },
    ],
  };
}

async function getWorkspace(workspaceId: string) {
  const workspace = await prisma.workspace.findFirst({
    where: { id: workspaceId, deletedAt: null },
  });
  if (!workspace) {
    throw new NotFoundError("Workspace not found");
  }
  return workspace;
}

async function assertProjectInWorkspace(
  workspaceId: string,
  projectId: string | undefined,
) {
  if (!projectId) {
    return;
  }
  const project = await prisma.project.findFirst({
    where: { id: projectId, workspaceId, deletedAt: null },
    select: { id: true },
  });
  if (!project) {
    throw new ValidationError("projectId must belong to this workspace", {
      field: "projectId",
    });
  }
}

async function assertMemberInWorkspace(
  workspaceId: string,
  memberId: string | undefined,
) {
  if (!memberId) {
    return;
  }
  const member = await prisma.workspaceMember.findFirst({
    where: {
      workspaceId,
      userId: memberId,
      deletedAt: null,
      status: "ACTIVE",
    },
    select: { id: true },
  });
  if (!member) {
    throw new ValidationError("memberId must belong to this workspace", {
      field: "memberId",
    });
  }
}

async function buildScopedWhere(
  workspaceId: string,
  actor: Actor,
  query: DashboardQuery,
  timezone: string,
) {
  assertMemberFilterAllowed(actor.roleKey, query.memberId, actor.userId);
  await assertProjectInWorkspace(workspaceId, query.projectId);
  await assertMemberInWorkspace(workspaceId, query.memberId);

  return {
    where: buildTaskVisibilityWhere({
      workspaceId,
      userId: actor.userId,
      roleKey: actor.roleKey,
      memberId: query.memberId,
      projectId: query.projectId,
      status: query.status,
    }),
    range: resolveDashboardRange({
      from: query.from,
      to: query.to,
      timezone,
    }),
    workspaceScope: hasWorkspaceTaskScope(actor.roleKey),
  };
}

export class DashboardService {
  async getSummary(workspaceId: string, actor: Actor, query: DashboardQuery) {
    const workspace = await getWorkspace(workspaceId);
    const timezone = query.timezone ?? workspace.timezone;
    const { where, range, workspaceScope } = await buildScopedWhere(
      workspaceId,
      actor,
      query,
      timezone,
    );

    const openWhere: Prisma.TaskWhereInput = {
      ...where,
      status: { in: [...OPEN_TASK_STATUSES] },
    };
    const dueTodayWhere: Prisma.TaskWhereInput = {
      ...openWhere,
      dueDate: { gte: range.todayStart, lte: range.todayEnd },
    };
    const overdueWhere: Prisma.TaskWhereInput = {
      ...openWhere,
      dueDate: { lt: range.todayStart, not: null },
    };
    const completedWhere = buildCompletedInRangeWhere(
      where,
      range.fromInstant,
      range.toInstant,
    );
    const blockedWhere: Prisma.TaskWhereInput = {
      ...openWhere,
      isBlocked: true,
    };
    const unassignedWhere: Prisma.TaskWhereInput = {
      ...openWhere,
      assigneeId: null,
    };

    const [
      openTasks,
      dueToday,
      overdue,
      completed,
      activeProjects,
      blockedTasks,
      unassignedTasks,
    ] = await Promise.all([
      prisma.task.count({ where: openWhere }),
      prisma.task.count({ where: dueTodayWhere }),
      prisma.task.count({ where: overdueWhere }),
      prisma.task.count({ where: completedWhere }),
      prisma.project.count({
        where: {
          workspaceId,
          deletedAt: null,
          status: "ACTIVE",
          ...(actor.roleKey === "owner" || actor.roleKey === "admin"
            ? {}
            : {
                OR: [
                  { visibility: "WORKSPACE" as const },
                  { members: { some: { userId: actor.userId } } },
                ],
              }),
        },
      }),
      workspaceScope ? prisma.task.count({ where: blockedWhere }) : Promise.resolve(null),
      workspaceScope
        ? prisma.task.count({ where: unassignedWhere })
        : Promise.resolve(null),
    ]);

    return {
      scope: {
        workspaceId,
        from: range.from,
        to: range.to,
        timezone,
        workspaceScope,
      },
      stats: {
        openTasks,
        dueToday,
        overdue,
        completed,
        activeProjects,
        ...(workspaceScope
          ? {
              blockedTasks: blockedTasks ?? 0,
              unassignedTasks: unassignedTasks ?? 0,
            }
          : {}),
      },
      generatedAt: new Date().toISOString(),
    };
  }

  async getMyWork(workspaceId: string, actor: Actor, query: MyWorkQuery) {
    const workspace = await getWorkspace(workspaceId);
    const timezone = query.timezone ?? workspace.timezone;
    const { range } = await buildScopedWhere(workspaceId, actor, query, timezone);

    const baseWhere: Prisma.TaskWhereInput = {
      workspaceId,
      deletedAt: null,
      archivedAt: null,
      assigneeId: actor.userId,
      ...(query.projectId ? { projectId: query.projectId } : {}),
    };

    let where: Prisma.TaskWhereInput = baseWhere;
    let orderBy: Prisma.TaskOrderByWithRelationInput[] = [
      { dueDate: "asc" },
      { updatedAt: "desc" },
    ];

    if (query.tab === "today") {
      where = {
        ...baseWhere,
        status: { in: [...OPEN_TASK_STATUSES] },
        dueDate: { gte: range.todayStart, lte: range.todayEnd },
      };
    } else if (query.tab === "upcoming") {
      where = {
        ...baseWhere,
        status: { in: [...OPEN_TASK_STATUSES] },
        dueDate: { gt: range.todayEnd },
      };
    } else if (query.tab === "overdue") {
      where = {
        ...baseWhere,
        status: { in: [...OPEN_TASK_STATUSES] },
        dueDate: { lt: range.todayStart, not: null },
      };
    } else if (query.tab === "in-progress") {
      where = {
        ...baseWhere,
        status: "IN_PROGRESS",
      };
    } else if (query.tab === "completed") {
      where = buildCompletedInRangeWhere(baseWhere, range.fromInstant, range.toInstant);
      orderBy = [{ completedAt: "desc" }, { updatedAt: "desc" }];
    }

    const [total, items] = await Promise.all([
      prisma.task.count({ where }),
      prisma.task.findMany({
        where,
        take: query.limit,
        orderBy,
        include: { project: { select: { name: true } } },
      }),
    ]);

    return {
      tab: query.tab,
      items: items.map(mapTask),
      total,
    };
  }

  async getCharts(workspaceId: string, actor: Actor, query: DashboardQuery) {
    const workspace = await getWorkspace(workspaceId);
    const timezone = query.timezone ?? workspace.timezone;
    const { where, range, workspaceScope } = await buildScopedWhere(
      workspaceId,
      actor,
      query,
      timezone,
    );

    if (!workspaceScope) {
      return { available: false as const };
    }

    const statusGroups = await prisma.task.groupBy({
      by: ["status"],
      where,
      _count: { _all: true },
    });

    const overdueByProjectRaw = await prisma.task.groupBy({
      by: ["projectId"],
      where: {
        ...where,
        status: { in: [...OPEN_TASK_STATUSES] },
        dueDate: { lt: range.todayStart, not: null },
      },
      _count: { _all: true },
    });

    const projectIds = overdueByProjectRaw
      .map((item) => item.projectId)
      .filter((id): id is string => Boolean(id));
    const projects = projectIds.length
      ? await prisma.project.findMany({
          where: { id: { in: projectIds } },
          select: { id: true, name: true },
        })
      : [];
    const projectNameById = new Map(projects.map((p) => [p.id, p.name]));

    const completedTasks = await prisma.task.findMany({
      where: buildCompletedInRangeWhere(where, range.fromInstant, range.toInstant),
      select: { completedAt: true, updatedAt: true },
    });

    const completionTrendMap = new Map<string, number>();
    for (const task of completedTasks) {
      const instant = task.completedAt ?? task.updatedAt;
      const key = formatYmd(instant, timezone);
      completionTrendMap.set(key, (completionTrendMap.get(key) ?? 0) + 1);
    }

    const openTasks = await prisma.task.findMany({
      where: {
        ...where,
        status: { in: [...OPEN_TASK_STATUSES] },
      },
      select: {
        assigneeId: true,
        dueDate: true,
      },
    });

    const workload = new Map<string, { openTasks: number; overdueTasks: number }>();
    for (const task of openTasks) {
      if (!task.assigneeId) {
        continue;
      }
      const current = workload.get(task.assigneeId) ?? {
        openTasks: 0,
        overdueTasks: 0,
      };
      current.openTasks += 1;
      if (task.dueDate && task.dueDate < range.todayStart) {
        current.overdueTasks += 1;
      }
      workload.set(task.assigneeId, current);
    }

    const memberIds = [...workload.keys()];
    const members = memberIds.length
      ? await prisma.workspaceMember.findMany({
          where: { workspaceId, userId: { in: memberIds } },
          include: { user: { select: { fullName: true } } },
        })
      : [];

    return {
      available: true as const,
      tasksByStatus: statusGroups.map((item) => ({
        status: item.status,
        count: item._count._all,
      })),
      completionTrend: [...completionTrendMap.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, count]) => ({ date, count })),
      overdueByProject: overdueByProjectRaw.map((item) => ({
        projectId: item.projectId,
        projectName: item.projectId
          ? (projectNameById.get(item.projectId) ?? "Unassigned project")
          : "No project",
        count: item._count._all,
      })),
      teamWorkload: members.map((member) => ({
        memberId: member.userId,
        memberName: member.user.fullName,
        openTasks: workload.get(member.userId)?.openTasks ?? 0,
        overdueTasks: workload.get(member.userId)?.overdueTasks ?? 0,
      })),
    };
  }

  async getActivity(workspaceId: string, actor: Actor, query: ActivityQuery) {
    const where = buildActivityVisibilityWhere(
      workspaceId,
      actor.userId,
      actor.roleKey,
      query.projectId,
    );
    if (actor.roleKey !== "owner" && actor.roleKey !== "admin") {
      const visibleProjects = await prisma.project.findMany({
        where: {
          workspaceId,
          deletedAt: null,
          OR: [
            { visibility: "WORKSPACE" },
            { members: { some: { userId: actor.userId } } },
          ],
        },
        select: { id: true },
      });
      where.AND = [
        ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
        {
          OR: [
            { projectId: null },
            { projectId: { in: visibleProjects.map((project) => project.id) } },
          ],
        },
      ];
    }

    const page = query.page ?? 1;
    const pageSize = query.limit ?? query.pageSize ?? 20;
    const skip = (page - 1) * pageSize;

    const [total, events] = await Promise.all([
      prisma.activityEvent.count({ where }),
      prisma.activityEvent.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
        include: {
          actor: { select: { id: true, fullName: true, email: true } },
        },
      }),
    ]);

    return {
      items: events.map((event) => ({
        id: event.id,
        action: event.action,
        resourceType: event.resourceType,
        resourceId: event.resourceId,
        projectId: event.projectId,
        summary: event.summary,
        actor: event.actor
          ? {
              id: event.actor.id,
              fullName: event.actor.fullName,
              email: event.actor.email,
            }
          : null,
        createdAt: event.createdAt.toISOString(),
      })),
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
    };
  }
}

export const dashboardService = new DashboardService();
