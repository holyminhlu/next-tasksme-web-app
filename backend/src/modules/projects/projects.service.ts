import type {
  Prisma,
  ProjectRole,
  TaskStatus,
} from "../../../generated/prisma/client.js";
import { prisma } from "../../config/database.js";
import {
  assertCanManageProject,
  assertCanManageProjectSettings,
  canViewProject,
  type ProjectAccessActor,
} from "../../lib/project-access.js";
import {
  assessProjectCompletion,
  assertProjectStatusTransition,
  computeProjectHealth,
  computeProjectProgress,
  type ProjectCompletionBlocker,
} from "../../lib/project-lifecycle.js";
import { createDefaultProjectWorkflow } from "../../lib/project-workflow.js";
import { legacyStatusForStage } from "../../lib/workflow-runtime.js";
import {
  assertWorkflowStagesForPublish,
  assertWorkflowTransitions,
} from "../../lib/workflow-validation.js";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "../../lib/errors.js";
import { buildPaginationMeta } from "../../lib/pagination.js";
import { recordActivity } from "../../services/activity.service.js";
import { writeAuditLog } from "../../services/audit.service.js";
import { recordTaskStatusTransition } from "../../services/task-transitions.service.js";
import type {
  AddProjectMemberInput,
  CreateProjectInput,
  EligibleAssigneesQuery,
  ListProjectsQuery,
  ReplaceProjectMembersInput,
  PublishProjectWorkflowInput,
  UpdateProjectInput,
  UpdateProjectMemberInput,
  UpdateProjectVisibilityInput,
} from "./projects.schemas.js";

type Actor = ProjectAccessActor;

const PROJECT_INCLUDE = {
  members: {
    select: {
      userId: true,
      projectRole: true,
      joinedAt: true,
      addedById: true,
    },
  },
  manager: { select: { id: true, fullName: true, email: true } },
  creator: { select: { id: true, fullName: true, email: true } },
} as const;

const MANAGER_ROLES: ProjectRole[] = ["PROJECT_OWNER", "PROJECT_MANAGER"];

function isAdmin(actor: Actor) {
  return actor.roleKey === "owner" || actor.roleKey === "admin";
}

function accessContext(project: {
  visibility: "WORKSPACE" | "PRIVATE";
  createdById: string | null;
  members: Array<{ userId: string; projectRole: ProjectRole }>;
}) {
  return {
    visibility: project.visibility,
    createdById: project.createdById,
    members: project.members,
  };
}

async function assertUniqueCode(
  workspaceId: string,
  code: string | null | undefined,
  excludeProjectId?: string,
) {
  if (!code) return;
  const existing = await prisma.project.findFirst({
    where: {
      workspaceId,
      code,
      deletedAt: null,
      ...(excludeProjectId ? { id: { not: excludeProjectId } } : {}),
    },
    select: { id: true },
  });
  if (existing) {
    throw new ConflictError("Project code already exists in this workspace");
  }
}

async function assertWorkspaceMembers(workspaceId: string, userIds: string[]) {
  if (!userIds.length) return;
  const count = await prisma.workspaceMember.count({
    where: {
      workspaceId,
      userId: { in: userIds },
      status: "ACTIVE",
      deletedAt: null,
    },
  });
  if (count !== userIds.length) {
    throw new ValidationError("All project members must be active workspace members", {
      field: "members",
    });
  }
}

function normalizeMembers(
  actorId: string,
  input: CreateProjectInput,
): Array<{ userId: string; projectRole: ProjectRole }> {
  const map = new Map<string, ProjectRole>();
  map.set(actorId, "PROJECT_OWNER");
  if (input.managerId && input.managerId !== actorId) {
    map.set(input.managerId, "PROJECT_MANAGER");
  }
  for (const member of input.members ?? []) {
    if (member.userId === actorId) continue;
    map.set(member.userId, member.projectRole);
  }
  for (const userId of input.memberIds) {
    if (!map.has(userId)) map.set(userId, "PROJECT_MEMBER");
  }
  return [...map.entries()].map(([userId, projectRole]) => ({ userId, projectRole }));
}

async function syncManagerId(projectId: string) {
  const project = await prisma.project.findUniqueOrThrow({
    where: { id: projectId },
    include: { members: true },
  });
  const managerMember =
    project.members.find((member) => member.projectRole === "PROJECT_MANAGER") ??
    project.members.find((member) => member.projectRole === "PROJECT_OWNER");
  await prisma.project.update({
    where: { id: projectId },
    data: { managerId: managerMember?.userId ?? null },
  });
}

async function projectStats(projectId: string) {
  const now = new Date();
  const [totalTasks, doneTasks, overdueTasks] = await Promise.all([
    prisma.task.count({ where: { projectId, deletedAt: null } }),
    prisma.task.count({
      where: { projectId, deletedAt: null, status: { in: ["DONE", "CANCELLED"] } },
    }),
    prisma.task.count({
      where: {
        projectId,
        deletedAt: null,
        dueDate: { lt: now },
        status: { notIn: ["DONE", "CANCELLED"] },
      },
    }),
  ]);
  const openTasks = totalTasks - doneTasks;
  const progressPercent = computeProjectProgress(totalTasks, doneTasks);
  const health = computeProjectHealth({ totalTasks, doneTasks, overdueTasks });
  return { totalTasks, doneTasks, openTasks, overdueTasks, progressPercent, health };
}

async function completionBlockers(projectId: string): Promise<ProjectCompletionBlocker[]> {
  const blockers: ProjectCompletionBlocker[] = [];
  const openTasks = await prisma.task.count({
    where: {
      projectId,
      deletedAt: null,
      status: { notIn: ["DONE", "CANCELLED"] },
    },
  });
  if (openTasks > 0) {
    blockers.push({
      code: "OPEN_TASKS",
      count: openTasks,
      message: `${openTasks} task(s) are not completed or cancelled`,
    });
  }
  const runningTimers = await prisma.timeLog.count({
    where: {
      endedAt: null,
      task: { projectId, deletedAt: null },
    },
  });
  if (runningTimers > 0) {
    blockers.push({
      code: "RUNNING_TIMERS",
      count: runningTimers,
      message: `${runningTimers} time log(s) are still running`,
    });
  }
  const blockedDependencies = await prisma.task.count({
    where: {
      projectId,
      deletedAt: null,
      dependencyBlocked: true,
      status: { notIn: ["DONE", "CANCELLED"] },
    },
  });
  if (blockedDependencies > 0) {
    blockers.push({
      code: "BLOCKED_DEPENDENCIES",
      count: blockedDependencies,
      message: `${blockedDependencies} task(s) are blocked by dependencies`,
    });
  }
  return blockers;
}

export class ProjectsService {
  private async getProjectRecord(
    workspaceId: string,
    projectId: string,
    options: { includeDeleted?: boolean } = {},
  ) {
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        workspaceId,
        ...(options.includeDeleted ? {} : { deletedAt: null }),
      },
      include: PROJECT_INCLUDE,
    });
    if (!project) throw new NotFoundError("Project not found");
    return project;
  }

  private async getAccessibleProject(
    workspaceId: string,
    projectId: string,
    actor: Actor,
    options: { includeDeleted?: boolean } = {},
  ) {
    const project = await this.getProjectRecord(workspaceId, projectId, options);
    if (!canViewProject(actor, accessContext(project))) {
      throw new NotFoundError("Project not found");
    }
    return project;
  }

  private async mapProject(
    workspaceId: string,
    project: Awaited<ReturnType<typeof this.getProjectRecord>>,
    withStats = false,
  ) {
    const memberIds = project.members.map((member) => member.userId);
    const memberships = memberIds.length
      ? await prisma.workspaceMember.findMany({
          where: { workspaceId, userId: { in: memberIds }, deletedAt: null },
          include: {
            user: { select: { id: true, fullName: true, email: true } },
            role: { select: { key: true, name: true } },
          },
        })
      : [];
    const membershipByUser = new Map(memberships.map((item) => [item.userId, item]));
    const stats = withStats ? await projectStats(project.id) : null;
    return {
      id: project.id,
      workspaceId: project.workspaceId,
      name: project.name,
      code: project.code,
      description: project.description,
      status: project.status,
      priority: project.priority,
      visibility: project.visibility,
      managerId: project.managerId,
      manager: project.manager,
      startAt: project.startAt?.toISOString() ?? null,
      endAt: project.endAt?.toISOString() ?? null,
      completionPolicy: project.completionPolicy,
      completedAt: project.completedAt?.toISOString() ?? null,
      archivedAt: project.archivedAt?.toISOString() ?? null,
      deletedAt: project.deletedAt?.toISOString() ?? null,
      createdById: project.createdById,
      creator: project.creator,
      memberIds,
      members: project.members.map((member) => {
        const membership = membershipByUser.get(member.userId);
        return {
          userId: member.userId,
          projectRole: member.projectRole,
          joinedAt: member.joinedAt.toISOString(),
          addedById: member.addedById,
          id: membership?.user.id ?? member.userId,
          fullName: membership?.user.fullName ?? null,
          email: membership?.user.email ?? null,
          role: membership?.role.key ?? null,
          roleName: membership?.role.name ?? null,
          status: membership?.status ?? null,
        };
      }),
      stats,
      totalTasks: stats?.totalTasks ?? null,
      openTasks: stats?.openTasks ?? null,
      overdueTasks: stats?.overdueTasks ?? null,
      progressPercent: stats?.progressPercent ?? null,
      health: stats?.health ?? null,
      createdAt: project.createdAt.toISOString(),
      updatedAt: project.updatedAt.toISOString(),
    };
  }

  async listProjects(workspaceId: string, actor: Actor, query: ListProjectsQuery) {
    const visibilityFilter = isAdmin(actor)
      ? {}
      : {
          OR: [
            { visibility: "WORKSPACE" as const },
            { members: { some: { userId: actor.userId } } },
          ],
        };

    const where: Prisma.ProjectWhereInput = {
      workspaceId,
      ...visibilityFilter,
      ...(query.includeDeleted ? {} : { deletedAt: null }),
      ...(query.deletedOnly ? { deletedAt: { not: null } } : {}),
      ...(query.archivedOnly
        ? { status: "ARCHIVED" }
        : query.includeArchived
          ? {}
          : { status: { not: "ARCHIVED" } }),
      ...(query.status?.length ? { status: { in: query.status } } : {}),
      ...(query.managerId ? { managerId: query.managerId } : {}),
      ...(query.memberId ? { members: { some: { userId: query.memberId } } } : {}),
      ...(query.startFrom || query.startTo
        ? {
            startAt: {
              ...(query.startFrom ? { gte: new Date(query.startFrom) } : {}),
              ...(query.startTo ? { lte: new Date(query.startTo) } : {}),
            },
          }
        : {}),
      ...(query.endFrom || query.endTo
        ? {
            endAt: {
              ...(query.endFrom ? { gte: new Date(query.endFrom) } : {}),
              ...(query.endTo ? { lte: new Date(query.endTo) } : {}),
            },
          }
        : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: "insensitive" } },
              { code: { contains: query.search, mode: "insensitive" } },
              { description: { contains: query.search, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const orderBy: Prisma.ProjectOrderByWithRelationInput =
      query.sortBy === "name"
        ? { name: query.sortOrder }
        : query.sortBy === "status"
          ? { status: query.sortOrder }
          : query.sortBy === "startAt"
            ? { startAt: query.sortOrder }
            : query.sortBy === "endAt"
              ? { endAt: query.sortOrder }
              : query.sortBy === "priority"
                ? { priority: query.sortOrder }
                : { updatedAt: query.sortOrder };

    const [total, projects] = await Promise.all([
      prisma.project.count({ where }),
      prisma.project.findMany({
        where,
        orderBy,
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: PROJECT_INCLUDE,
      }),
    ]);

    const items = await Promise.all(
      projects.map((project) => this.mapProject(workspaceId, project, true)),
    );

    return {
      items,
      pagination: buildPaginationMeta(query.page, query.pageSize, total),
    };
  }

  async createProject(workspaceId: string, actorId: string, actor: Actor, input: CreateProjectInput) {
    const workspace = await prisma.workspace.findFirst({
      where: { id: workspaceId, deletedAt: null },
    });
    if (!workspace) throw new NotFoundError("Workspace not found");

    await assertUniqueCode(workspaceId, input.code);
    const visibility =
      input.visibility ?? (workspace.type === "PERSONAL" ? "PRIVATE" : "WORKSPACE");
    const members = normalizeMembers(actorId, input);
    await assertWorkspaceMembers(
      workspaceId,
      members.map((member) => member.userId),
    );

    const managerId =
      input.managerId ??
      members.find((member) => MANAGER_ROLES.includes(member.projectRole))?.userId ??
      actorId;

    const project = await prisma.$transaction(async (tx) => {
      const created = await tx.project.create({
        data: {
          workspaceId,
          name: input.name,
          code: input.code,
          description: input.description,
          status: input.status,
          priority: input.priority,
          visibility,
          managerId,
          startAt: input.startAt ? new Date(input.startAt) : null,
          endAt: input.endAt ? new Date(input.endAt) : null,
          completionPolicy: input.completionPolicy,
          createdById: actorId,
          members: {
            create: members.map((member) => ({
              workspaceId,
              userId: member.userId,
              projectRole: member.projectRole,
              addedById: actorId,
            })),
          },
        },
        include: PROJECT_INCLUDE,
      });

      await createDefaultProjectWorkflow(tx, {
        workspaceId,
        projectId: created.id,
        projectName: created.name,
        actorId,
      });

      return created;
    });

    await recordActivity({
      workspaceId,
      actorId,
      action: "project.created",
      resourceType: "project",
      resourceId: project.id,
      projectId: project.id,
      summary: `Created project "${project.name}"`,
      metadata: { name: project.name, status: project.status, code: project.code },
    });
    await writeAuditLog({
      action: "project.created",
      userId: actorId,
      workspaceId,
      entityType: "project",
      entityId: project.id,
    });

    return this.mapProject(workspaceId, project, true);
  }

  async getProject(workspaceId: string, projectId: string, actor: Actor) {
    return this.mapProject(
      workspaceId,
      await this.getAccessibleProject(workspaceId, projectId, actor),
      true,
    );
  }

  async updateProject(
    workspaceId: string,
    projectId: string,
    actor: Actor,
    input: UpdateProjectInput,
  ) {
    const project = await this.getAccessibleProject(workspaceId, projectId, actor);
    assertCanManageProjectSettings(actor, accessContext(project));

    if (input.code !== undefined) {
      await assertUniqueCode(workspaceId, input.code, projectId);
    }

    const nextStatus = input.status ?? project.status;
    if (input.status && input.status !== project.status) {
      assertProjectStatusTransition(project.status, input.status);
      if (input.status === "COMPLETED") {
        const blockers = await completionBlockers(projectId);
        const assessment = assessProjectCompletion(project.completionPolicy, blockers);
        if (!assessment.canComplete) {
          if (assessment.requiresOverride) {
            if (!input.completionOverrideReason) {
              throw new ValidationError("Completion override reason is required", {
                field: "completionOverrideReason",
                metadata: { blockers },
              });
            }
          } else {
            throw new ValidationError("Project cannot be completed yet", {
              field: "status",
              metadata: { blockers },
            });
          }
        }
      }
    }

    const now = new Date();
    const updated = await prisma.project.update({
      where: { id: projectId },
      data: {
        name: input.name,
        code: input.code,
        description: input.description,
        status: nextStatus,
        priority: input.priority,
        visibility: input.visibility,
        startAt: input.startAt === undefined ? undefined : input.startAt ? new Date(input.startAt) : null,
        endAt: input.endAt === undefined ? undefined : input.endAt ? new Date(input.endAt) : null,
        completionPolicy: input.completionPolicy,
        managerId: input.managerId,
        completedAt:
          nextStatus === "COMPLETED" && project.status !== "COMPLETED" ? now : undefined,
        archivedAt:
          nextStatus === "ARCHIVED" && project.status !== "ARCHIVED"
            ? now
            : nextStatus !== "ARCHIVED" && project.status === "ARCHIVED"
              ? null
              : undefined,
      },
      include: PROJECT_INCLUDE,
    });

    if (input.managerId !== undefined) {
      await syncManagerId(projectId);
    }

    if (input.status && input.status !== project.status) {
      await recordActivity({
        workspaceId,
        actorId: actor.userId,
        action: "project.status_changed",
        resourceType: "project",
        resourceId: projectId,
        projectId,
        summary: `Project status changed to ${input.status}`,
        metadata: {
          fromStatus: project.status,
          toStatus: input.status,
          overrideReason: input.completionOverrideReason ?? null,
        },
      });
      await writeAuditLog({
        action: "project.status_changed",
        userId: actor.userId,
        workspaceId,
        entityType: "project",
        entityId: projectId,
        metadata: { fromStatus: project.status, toStatus: input.status },
      });
      const notifyUserId = updated.managerId ?? updated.createdById;
      if (notifyUserId) {
        const preference = await prisma.notificationPreference.findUnique({
          where: {
            workspaceId_userId: { workspaceId, userId: notifyUserId },
          },
        });
        const projectStatusChanged =
          preference && "projectStatusChanged" in preference
            ? (preference as { projectStatusChanged?: boolean }).projectStatusChanged
            : undefined;
        if (projectStatusChanged !== false) {
          await prisma.notification.create({
            data: {
              workspaceId,
              userId: notifyUserId,
              type: "PROJECT_STATUS_CHANGED",
              title: `Project status updated: ${updated.name}`,
              body: `${project.status} → ${input.status}`,
              dedupeKey: `project-status:${projectId}:${input.status}:${now.toISOString()}`,
            },
          });
        }
      }
    } else {
      await recordActivity({
        workspaceId,
        actorId: actor.userId,
        action: "project.updated",
        resourceType: "project",
        resourceId: projectId,
        projectId,
        summary: `Updated project "${updated.name}"`,
      });
    }

    return this.mapProject(workspaceId, updated, true);
  }

  async lifecycle(
    workspaceId: string,
    projectId: string,
    actor: Actor,
    action: "archive" | "unarchive" | "delete" | "restore",
  ) {
    const includeDeleted = action === "restore";
    const project = await this.getAccessibleProject(workspaceId, projectId, actor, {
      includeDeleted,
    });
    if (action === "restore" && !isAdmin(actor)) {
      throw new ForbiddenError("Only workspace owners and admins may restore projects");
    }
    assertCanManageProjectSettings(actor, accessContext(project));

    const now = new Date();
    const updated = await prisma.project.update({
      where: { id: projectId },
      data: {
        ...(action === "archive"
          ? { status: "ARCHIVED", archivedAt: now }
          : action === "unarchive"
            ? { status: "ACTIVE", archivedAt: null }
            : action === "delete"
              ? { deletedAt: now }
              : { deletedAt: null }),
      },
      include: PROJECT_INCLUDE,
    });

    const actionKey =
      action === "archive"
        ? "project.archived"
        : action === "unarchive"
          ? "project.unarchived"
          : action === "delete"
            ? "project.deleted"
            : "project.restored";

    await recordActivity({
      workspaceId,
      actorId: actor.userId,
      action: actionKey,
      resourceType: "project",
      resourceId: projectId,
      projectId,
      summary: `${action} project "${updated.name}"`,
    });
    await writeAuditLog({
      action: actionKey,
      userId: actor.userId,
      workspaceId,
      entityType: "project",
      entityId: projectId,
    });

    return this.mapProject(workspaceId, updated, true);
  }

  async listMembers(workspaceId: string, projectId: string, actor: Actor) {
    const project = await this.getAccessibleProject(workspaceId, projectId, actor);
    return (await this.mapProject(workspaceId, project)).members;
  }

  async addMember(
    workspaceId: string,
    projectId: string,
    actor: Actor,
    input: AddProjectMemberInput,
  ) {
    const project = await this.getAccessibleProject(workspaceId, projectId, actor);
    assertCanManageProject(actor, accessContext(project));
    await assertWorkspaceMembers(workspaceId, [input.userId]);
    const updated = await prisma.project.update({
      where: { id: projectId },
      data: {
        members: {
          upsert: {
            where: { projectId_userId: { projectId, userId: input.userId } },
            update: { projectRole: input.projectRole },
            create: {
              workspaceId,
              userId: input.userId,
              projectRole: input.projectRole,
              addedById: actor.userId,
            },
          },
        },
      },
      include: PROJECT_INCLUDE,
    });
    await syncManagerId(projectId);
    return this.mapProject(workspaceId, updated, true);
  }

  async updateMemberRole(
    workspaceId: string,
    projectId: string,
    memberUserId: string,
    actor: Actor,
    input: UpdateProjectMemberInput,
  ) {
    const project = await this.getAccessibleProject(workspaceId, projectId, actor);
    assertCanManageProject(actor, accessContext(project));
    const existing = project.members.find((member) => member.userId === memberUserId);
    if (!existing) throw new NotFoundError("Project member not found");
    if (
      existing.projectRole === "PROJECT_MANAGER" &&
      input.projectRole !== "PROJECT_MANAGER" &&
      project.members.filter((member) => member.projectRole === "PROJECT_MANAGER").length === 1 &&
      !project.members.some(
        (member) =>
          member.userId !== memberUserId && member.projectRole === "PROJECT_OWNER",
      )
    ) {
      throw new ValidationError("Cannot remove the last project manager", {
        field: "projectRole",
      });
    }
    await prisma.projectMember.update({
      where: { projectId_userId: { projectId, userId: memberUserId } },
      data: { projectRole: input.projectRole },
    });
    await syncManagerId(projectId);
    return this.getProject(workspaceId, projectId, actor);
  }

  async removeMember(
    workspaceId: string,
    projectId: string,
    memberUserId: string,
    actor: Actor,
  ) {
    const project = await this.getAccessibleProject(workspaceId, projectId, actor);
    assertCanManageProject(actor, accessContext(project));
    const member = project.members.find((item) => item.userId === memberUserId);
    if (!member) throw new NotFoundError("Project member not found");
    if (member.projectRole === "PROJECT_OWNER") {
      throw new ValidationError("Project owner cannot be removed", { field: "userId" });
    }
    if (
      member.projectRole === "PROJECT_MANAGER" &&
      project.members.filter((item) => MANAGER_ROLES.includes(item.projectRole)).length === 1
    ) {
      throw new ValidationError("Cannot remove the last project manager", { field: "userId" });
    }
    await prisma.projectMember.delete({
      where: { projectId_userId: { projectId, userId: memberUserId } },
    });
    await syncManagerId(projectId);
    return this.getProject(workspaceId, projectId, actor);
  }

  async replaceMembers(
    workspaceId: string,
    projectId: string,
    actor: Actor,
    input: ReplaceProjectMembersInput,
  ) {
    const project = await this.getAccessibleProject(workspaceId, projectId, actor);
    assertCanManageProject(actor, accessContext(project));
    const members =
      input.members ??
      (input.memberIds ?? []).map((userId) => ({
        userId,
        projectRole: "PROJECT_MEMBER" as const,
      }));
    if (
      input.memberIds &&
      project.visibility === "PRIVATE" &&
      project.createdById &&
      !input.memberIds.includes(project.createdById)
    ) {
      throw new ValidationError("The private project creator cannot be removed", {
        field: "memberIds",
      });
    }
    if (!members.some((member) => member.projectRole === "PROJECT_OWNER")) {
      const ownerId = project.createdById ?? actor.userId;
      if (!members.some((member) => member.userId === ownerId)) {
        members.push({ userId: ownerId, projectRole: "PROJECT_OWNER" });
      } else {
        for (const member of members) {
          if (member.userId === ownerId) member.projectRole = "PROJECT_OWNER";
        }
      }
    }
    const managerCount = members.filter((member) => member.projectRole === "PROJECT_MANAGER").length;
    const ownerCount = members.filter((member) => member.projectRole === "PROJECT_OWNER").length;
    if (managerCount === 0 && ownerCount === 0) {
      throw new ValidationError("At least one project manager or owner is required", {
        field: "members",
      });
    }
    await assertWorkspaceMembers(
      workspaceId,
      members.map((member) => member.userId),
    );
    const updated = await prisma.$transaction(async (tx) => {
      await tx.projectMember.deleteMany({ where: { workspaceId, projectId } });
      await tx.projectMember.createMany({
        data: members.map((member) => ({
          workspaceId,
          projectId,
          userId: member.userId,
          projectRole: member.projectRole,
          addedById: actor.userId,
        })),
      });
      return tx.project.findUniqueOrThrow({ where: { id: projectId }, include: PROJECT_INCLUDE });
    });
    await syncManagerId(projectId);
    return this.mapProject(workspaceId, updated, true);
  }

  async updateVisibility(
    workspaceId: string,
    projectId: string,
    actor: Actor,
    input: UpdateProjectVisibilityInput,
  ) {
    const project = await this.getAccessibleProject(workspaceId, projectId, actor);
    assertCanManageProjectSettings(actor, accessContext(project));
    const updated = await prisma.$transaction(async (tx) => {
      if (input.visibility === "PRIVATE") {
        const ownerId = project.createdById ?? actor.userId;
        await tx.projectMember.upsert({
          where: { projectId_userId: { projectId, userId: ownerId } },
          update: { workspaceId, projectRole: "PROJECT_OWNER" },
          create: {
            workspaceId,
            projectId,
            userId: ownerId,
            projectRole: "PROJECT_OWNER",
            addedById: actor.userId,
          },
        });
      }
      return tx.project.update({
        where: { id: projectId },
        data: { visibility: input.visibility },
        include: PROJECT_INCLUDE,
      });
    });
    return this.mapProject(workspaceId, updated, true);
  }

  async publishWorkflow(
    workspaceId: string,
    projectId: string,
    actor: Actor,
    input: PublishProjectWorkflowInput,
  ) {
    const project = await this.getAccessibleProject(workspaceId, projectId, actor);
    assertCanManageProjectSettings(actor, accessContext(project));

    return prisma.$transaction(async (tx) => {
      const currentApplied = await tx.projectWorkflow.findUnique({
        where: { projectId },
        include: {
          workflow: {
            include: {
              stages: true,
            },
          },
        },
      });
      if (!currentApplied) {
        throw new ValidationError("Project has no applied workflow");
      }

      const draft = await tx.workflow.findFirst({
        where: {
          id: input.draftWorkflowId,
          workspaceId,
          sourceProjectId: projectId,
          familyId: currentApplied.workflow.familyId,
          status: "DRAFT",
        },
        include: {
          stages: { orderBy: { position: "asc" } },
          transitions: true,
        },
      });
      if (!draft) throw new NotFoundError("Draft workflow not found");
      const consumed = await tx.workflow.updateMany({
        where: { id: draft.id, status: "DRAFT" },
        data: { status: "ARCHIVED" },
      });
      if (consumed.count !== 1) {
        throw new ConflictError("Workflow draft has already been published");
      }

      // 1-3) Validate draft, initial/terminal stages, transitions.
      assertWorkflowStagesForPublish(
        draft.stages.map((stage) => ({
          id: stage.id,
          name: stage.name,
          category: stage.category,
          isInitial: stage.isInitial,
          isTerminal: stage.isTerminal,
        })),
      );
      assertWorkflowTransitions(
        draft.stages.map((stage) => ({
          id: stage.id,
          name: stage.name,
          category: stage.category,
          isInitial: stage.isInitial,
          isTerminal: stage.isTerminal,
        })),
        draft.transitions.map((transition) => ({
          fromStageId: transition.fromStageId,
          toStageId: transition.toStageId,
          conditionsJson: transition.conditionsJson,
        })),
      );

      // 4-5) Compare old/new and require mapping for changed/removed stages.
      const tasksInProject = await tx.task.findMany({
        where: { projectId, deletedAt: null },
        select: {
          id: true,
          status: true,
          workflowStageId: true,
          isBlocked: true,
          blockedReason: true,
          dependencyBlocked: true,
          completedAt: true,
          completedById: true,
          version: true,
        },
      });

      const mappings = new Map(
        input.stageMappings.map((item) => [item.fromStageId, item.toStageId]),
      );
      const legacyMappings = new Map(
        input.legacyStatusMappings.map((item) => [item.fromStatus, item.toStageId]),
      );
      const newStageIds = new Set(draft.stages.map((stage) => stage.id));
      const activeNewStageIds = new Set(
        draft.stages.filter((stage) => stage.isActive).map((stage) => stage.id),
      );
      const currentStageIds = new Set(
        currentApplied.workflow.stages.map((stage) => stage.id),
      );
      if (mappings.size !== input.stageMappings.length) {
        throw new ValidationError("Duplicate source stage mapping", {
          field: "stageMappings",
        });
      }
      if (legacyMappings.size !== input.legacyStatusMappings.length) {
        throw new ValidationError("Duplicate legacy status mapping", {
          field: "legacyStatusMappings",
        });
      }
      for (const mapping of input.stageMappings) {
        if (!currentStageIds.has(mapping.fromStageId)) {
          throw new ValidationError(
            "Stage mapping source is not in the currently applied workflow",
            { field: "stageMappings", metadata: mapping },
          );
        }
        if (!activeNewStageIds.has(mapping.toStageId)) {
          throw new ValidationError("Stage mapping target is not active in draft workflow", {
            field: "stageMappings",
            metadata: mapping,
          });
        }
      }
      for (const mapping of input.legacyStatusMappings) {
        if (!activeNewStageIds.has(mapping.toStageId)) {
          throw new ValidationError("Legacy status mapping target is not active in draft workflow", {
            field: "legacyStatusMappings",
            metadata: mapping,
          });
        }
      }

      if (tasksInProject.length > 0) {
        const oldStageIdsInUse = new Set(
          tasksInProject
            .map((task) => task.workflowStageId)
            .filter((stageId): stageId is string => stageId != null),
        );
        for (const oldStageId of oldStageIdsInUse) {
          const targetStageId = mappings.get(oldStageId);
          if (!targetStageId) {
            throw new ValidationError(
              "Missing stage mapping for tasks in existing workflow stage",
              {
                field: "stageMappings",
                metadata: { fromStageId: oldStageId },
              },
            );
          }
          if (!newStageIds.has(targetStageId)) {
            throw new ValidationError("Stage mapping target is not in draft workflow", {
              field: "stageMappings",
              metadata: { fromStageId: oldStageId, toStageId: targetStageId },
            });
          }
        }

        const nullStageStatuses = new Set(
          tasksInProject
            .filter((task) => task.workflowStageId == null)
            .map((task) => task.status),
        );
        if (nullStageStatuses.size > 0) {
          for (const status of nullStageStatuses) {
            const mapped = legacyMappings.get(status);
            if (!mapped) {
              throw new ValidationError(
                "Missing legacy status mapping for tasks without workflow stage",
                { field: "legacyStatusMappings", metadata: { fromStatus: status } },
              );
            }
            if (!newStageIds.has(mapped)) {
              throw new ValidationError("Legacy status mapping target is not in draft workflow", {
                field: "legacyStatusMappings",
                metadata: { fromStatus: status, toStageId: mapped },
              });
            }
          }
        }
      }

      // 6) Create new PUBLISHED version snapshot.
      const latestVersion = await tx.workflow.aggregate({
        where: { familyId: draft.familyId },
        _max: { version: true },
      });
      const nextVersion = (latestVersion._max.version ?? 0) + 1;

      const published = await tx.workflow.create({
        data: {
          familyId: draft.familyId,
          workspaceId,
          sourceProjectId: projectId,
          name: draft.name,
          version: nextVersion,
          status: "PUBLISHED",
          createdById: actor.userId,
        },
      });

      const stageIdMap = new Map<string, string>();
      for (const stage of draft.stages) {
        const created = await tx.workflowStage.create({
          data: {
            workflowId: published.id,
            name: stage.name,
            category: stage.category,
            color: stage.color,
            position: stage.position,
            isInitial: stage.isInitial,
            isTerminal: stage.isTerminal,
            isActive: stage.isActive,
          },
        });
        stageIdMap.set(stage.id, created.id);
      }

      for (const transition of draft.transitions) {
        const fromStageId = stageIdMap.get(transition.fromStageId);
        const toStageId = stageIdMap.get(transition.toStageId);
        if (!fromStageId || !toStageId) {
          throw new ValidationError("Cannot publish workflow due to invalid transition mapping");
        }
        await tx.workflowTransition.create({
          data: {
            workflowId: published.id,
            fromStageId,
            toStageId,
            requiredPermission: transition.requiredPermission,
            conditionsJson:
              (transition.conditionsJson ?? {}) as Prisma.InputJsonValue,
          },
        });
      }

      // 7) Move tasks to new stages by explicit stage mappings or legacy status mapping.
      let movedTasks = 0;
      const publishedByDraftStageId = new Map<string, string>();
      for (const draftStage of draft.stages) {
        const mapped = stageIdMap.get(draftStage.id);
        if (mapped) publishedByDraftStageId.set(draftStage.id, mapped);
      }

      const oldToPublishedStage = new Map<string, string>();
      for (const [fromStageId, draftTargetId] of mappings) {
        const publishedStageId = publishedByDraftStageId.get(draftTargetId);
        if (!publishedStageId) {
          throw new ValidationError("Stage mapping target cannot be resolved in published workflow", {
            field: "stageMappings",
            metadata: { fromStageId, toDraftStageId: draftTargetId },
          });
        }
        oldToPublishedStage.set(fromStageId, publishedStageId);
      }

      const legacyToPublished = new Map<TaskStatus, string>();
      for (const [status, draftTargetId] of legacyMappings) {
        const publishedStageId = publishedByDraftStageId.get(draftTargetId);
        if (!publishedStageId) {
          throw new ValidationError("Legacy status mapping target cannot be resolved in published workflow", {
            field: "legacyStatusMappings",
            metadata: { fromStatus: status, toDraftStageId: draftTargetId },
          });
        }
        legacyToPublished.set(status as TaskStatus, publishedStageId);
      }

      const publishedStagesById = new Map(
        draft.stages.map((stage) => [
          stageIdMap.get(stage.id)!,
          { ...stage, id: stageIdMap.get(stage.id)! },
        ]),
      );
      const changedAt = new Date();
      for (const task of tasksInProject) {
        const toStageId = task.workflowStageId
          ? oldToPublishedStage.get(task.workflowStageId)
          : legacyToPublished.get(task.status);
        if (!toStageId) {
          throw new ValidationError("Task stage mapping could not be resolved", {
            field: task.workflowStageId ? "stageMappings" : "legacyStatusMappings",
            metadata: { taskId: task.id },
          });
        }
        const targetStage = publishedStagesById.get(toStageId);
        if (!targetStage) {
          throw new ValidationError("Published target stage could not be resolved");
        }
        const nextStatus = legacyStatusForStage(targetStage);
        const enteringDone = nextStatus === "DONE" && task.status !== "DONE";
        const leavingDone = nextStatus !== "DONE" && task.status === "DONE";
        const updated = await tx.task.updateMany({
          where: { id: task.id, projectId, version: task.version, deletedAt: null },
          data: {
            workflowStageId: toStageId,
            status: nextStatus,
            isBlocked: nextStatus === "BLOCKED",
            blockedReason: nextStatus === "BLOCKED" ? task.blockedReason : null,
            dependencyBlocked:
              nextStatus === "BLOCKED" ? task.dependencyBlocked : false,
            completedAt: enteringDone
              ? changedAt
              : leavingDone
                ? null
                : task.completedAt,
            completedById: enteringDone
              ? actor.userId
              : leavingDone
                ? null
                : task.completedById,
            version: { increment: 1 },
          },
        });
        if (updated.count !== 1) {
          throw new ConflictError("Task changed while workflow was publishing");
        }
        movedTasks += 1;
        if (nextStatus !== task.status) {
          await recordTaskStatusTransition(tx, {
            taskId: task.id,
            fromStatus: task.status,
            toStatus: nextStatus,
            changedById: actor.userId,
            changedAt,
          });
        }
      }

      // 8) Switch project workflow pointer.
      await tx.projectWorkflow.upsert({
        where: { projectId },
        create: {
          projectId,
          workflowId: published.id,
          workflowVersion: published.version,
        },
        update: {
          workflowId: published.id,
          workflowVersion: published.version,
          appliedAt: new Date(),
        },
      });

      // 9) Audit + activity in same transaction.
      await tx.auditLog.create({
        data: {
          action: "project.workflow_published",
          userId: actor.userId,
          workspaceId,
          entityType: "project",
          entityId: projectId,
          metadata: {
            previousWorkflowId: currentApplied?.workflowId ?? null,
            publishedWorkflowId: published.id,
            publishedVersion: published.version,
            movedTasks,
            stageMappings: input.stageMappings,
            legacyStatusMappings: input.legacyStatusMappings,
          },
        },
      });
      await tx.activityEvent.create({
        data: {
          workspaceId,
          actorId: actor.userId,
          action: "project.workflow_published",
          resourceType: "project",
          resourceId: projectId,
          projectId,
          summary: `Published workflow v${published.version} for project "${project.name}"`,
          metadata: {
            workflowId: published.id,
            movedTasks,
          },
        },
      });

      // 10) Commit is implicit by transaction success.
      return {
        workflowId: published.id,
        workflowVersion: published.version,
        movedTasks,
      };
    });
  }

  async eligibleAssignees(
    workspaceId: string,
    projectId: string,
    actor: Actor,
    query: EligibleAssigneesQuery,
  ) {
    const project = await this.getAccessibleProject(workspaceId, projectId, actor);
    const memberIds =
      project.visibility === "PRIVATE"
        ? project.members.map((member) => member.userId)
        : undefined;
    const memberships = await prisma.workspaceMember.findMany({
      where: {
        workspaceId,
        status: "ACTIVE",
        deletedAt: null,
        ...(memberIds ? { userId: { in: memberIds } } : {}),
        ...(query.search
          ? {
              user: {
                OR: [
                  { fullName: { contains: query.search, mode: "insensitive" } },
                  { email: { contains: query.search, mode: "insensitive" } },
                ],
              },
            }
          : {}),
      },
      include: {
        user: { select: { id: true, fullName: true, email: true } },
        role: { select: { key: true, name: true } },
      },
      orderBy: { user: { fullName: "asc" } },
      take: 100,
    });
    return memberships.map((membership) => ({
      id: membership.user.id,
      fullName: membership.user.fullName,
      email: membership.user.email,
      role: membership.role.key,
      roleName: membership.role.name,
      status: membership.status,
    }));
  }
}

export const projectsService = new ProjectsService();

export async function assertProjectAccessible(
  workspaceId: string,
  projectId: string,
  actor: Actor,
) {
  const project = await prisma.project.findFirst({
    where: { id: projectId, workspaceId, deletedAt: null, status: { not: "ARCHIVED" } },
    include: { members: { select: { userId: true, projectRole: true } } },
  });
    if (!project) throw new NotFoundError("Project not found");
    if (!canViewProject(actor, accessContext(project))) {
      throw new NotFoundError("Project not found");
    }
    return project;
}
