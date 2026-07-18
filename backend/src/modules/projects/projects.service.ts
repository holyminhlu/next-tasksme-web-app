import { prisma } from "../../config/database.js";
import { ForbiddenError, NotFoundError, ValidationError } from "../../lib/errors.js";
import { recordActivity } from "../../services/activity.service.js";
import type {
  CreateProjectInput,
  EligibleAssigneesQuery,
  ReplaceProjectMembersInput,
  UpdateProjectVisibilityInput,
} from "./projects.schemas.js";

type Actor = { userId: string; roleKey: string };

const PROJECT_INCLUDE = {
  members: { select: { userId: true } },
} as const;

function isAdmin(actor: Actor) {
  return actor.roleKey === "owner" || actor.roleKey === "admin";
}

export class ProjectsService {
  private async getAccessibleProject(
    workspaceId: string,
    projectId: string,
    actor: Actor,
  ) {
    const project = await prisma.project.findFirst({
      where: { id: projectId, workspaceId, deletedAt: null },
      include: PROJECT_INCLUDE,
    });
    if (!project) throw new NotFoundError("Project not found");
    if (
      project.visibility === "PRIVATE" &&
      !isAdmin(actor) &&
      !project.members.some((member) => member.userId === actor.userId)
    ) {
      throw new NotFoundError("Project not found");
    }
    return project;
  }

  private assertCanManage(actor: Actor, project: { createdById: string | null }) {
    if (!isAdmin(actor) && project.createdById !== actor.userId) {
      throw new ForbiddenError(
        "Only workspace owners, admins, or the project creator may manage this project",
      );
    }
  }

  private async mapProject(
    workspaceId: string,
    project: {
      id: string;
      workspaceId: string;
      name: string;
      description: string | null;
      status: string;
      visibility: "WORKSPACE" | "PRIVATE";
      createdById: string | null;
      createdAt: Date;
      updatedAt: Date;
      members: { userId: string }[];
    },
  ) {
    const memberIds = project.members.map((member) => member.userId);
    const [creator, memberships] = await Promise.all([
      project.createdById
        ? prisma.user.findUnique({
            where: { id: project.createdById },
            select: { id: true, fullName: true, email: true },
          })
        : null,
      memberIds.length
        ? prisma.workspaceMember.findMany({
            where: { workspaceId, userId: { in: memberIds }, deletedAt: null },
            include: {
              user: { select: { id: true, fullName: true, email: true } },
              role: { select: { key: true, name: true } },
            },
          })
        : [],
    ]);
    return {
      id: project.id,
      workspaceId: project.workspaceId,
      name: project.name,
      description: project.description,
      status: project.status,
      visibility: project.visibility,
      createdById: project.createdById,
      creator,
      memberIds,
      members: memberships.map((membership) => ({
        id: membership.user.id,
        fullName: membership.user.fullName,
        email: membership.user.email,
        role: membership.role.key,
        roleName: membership.role.name,
        status: membership.status,
      })),
      createdAt: project.createdAt.toISOString(),
      updatedAt: project.updatedAt.toISOString(),
    };
  }

  async listProjects(workspaceId: string, actorId: string, roleKey: string) {
    const projects = await prisma.project.findMany({
      where: {
        workspaceId,
        deletedAt: null,
        ...(roleKey === "owner" || roleKey === "admin"
          ? {}
          : {
              OR: [
                { visibility: "WORKSPACE" as const },
                { members: { some: { userId: actorId } } },
              ],
            }),
      },
      orderBy: { updatedAt: "desc" },
      include: PROJECT_INCLUDE,
    });

    return Promise.all(projects.map((project) => this.mapProject(workspaceId, project)));
  }

  async createProject(workspaceId: string, actorId: string, input: CreateProjectInput) {
    const workspace = await prisma.workspace.findFirst({
      where: { id: workspaceId, deletedAt: null },
    });
    if (!workspace) {
      throw new NotFoundError("Workspace not found");
    }

    const memberIds = [...new Set([actorId, ...input.memberIds])];
    if (input.visibility === "PRIVATE") {
      const count = await prisma.workspaceMember.count({
        where: {
          workspaceId,
          userId: { in: memberIds },
          status: "ACTIVE",
          deletedAt: null,
        },
      });
      if (count !== memberIds.length) {
        throw new ValidationError(
          "Private project members must be active workspace members",
          { field: "memberIds" },
        );
      }
    }

    const project = await prisma.project.create({
      data: {
        workspaceId,
        name: input.name,
        description: input.description,
        createdById: actorId,
        status: "ACTIVE",
        visibility: input.visibility,
        members:
          input.visibility === "PRIVATE"
            ? {
                create: memberIds.map((userId) => ({ workspaceId, userId })),
              }
            : undefined,
      },
      include: PROJECT_INCLUDE,
    });

    await recordActivity({
      workspaceId,
      actorId,
      action: "project.created",
      resourceType: "project",
      resourceId: project.id,
      projectId: project.id,
      summary: `Created project "${project.name}"`,
      metadata: { name: project.name, status: project.status },
    });

    return this.mapProject(workspaceId, project);
  }

  async getProject(workspaceId: string, projectId: string, actor: Actor) {
    return this.mapProject(
      workspaceId,
      await this.getAccessibleProject(workspaceId, projectId, actor),
    );
  }

  async listMembers(workspaceId: string, projectId: string, actor: Actor) {
    const project = await this.getAccessibleProject(workspaceId, projectId, actor);
    return (await this.mapProject(workspaceId, project)).members;
  }

  async replaceMembers(
    workspaceId: string,
    projectId: string,
    actor: Actor,
    input: ReplaceProjectMembersInput,
  ) {
    const project = await this.getAccessibleProject(workspaceId, projectId, actor);
    this.assertCanManage(actor, project);
    const memberIds = [...new Set(input.memberIds)];
    if (
      project.visibility === "PRIVATE" &&
      project.createdById &&
      !memberIds.includes(project.createdById)
    ) {
      throw new ValidationError("The private project creator cannot be removed", {
        field: "memberIds",
      });
    }
    const activeCount = await prisma.workspaceMember.count({
      where: {
        workspaceId,
        userId: { in: memberIds },
        status: "ACTIVE",
        deletedAt: null,
      },
    });
    if (activeCount !== memberIds.length) {
      throw new ValidationError("All project members must be active workspace members", {
        field: "memberIds",
      });
    }
    const updated = await prisma.$transaction(async (tx) => {
      await tx.projectMember.deleteMany({ where: { workspaceId, projectId } });
      if (memberIds.length) {
        await tx.projectMember.createMany({
          data: memberIds.map((userId) => ({ workspaceId, projectId, userId })),
        });
      }
      return tx.project.findUniqueOrThrow({
        where: { id: projectId },
        include: PROJECT_INCLUDE,
      });
    });
    return this.mapProject(workspaceId, updated);
  }

  async updateVisibility(
    workspaceId: string,
    projectId: string,
    actor: Actor,
    input: UpdateProjectVisibilityInput,
  ) {
    const project = await this.getAccessibleProject(workspaceId, projectId, actor);
    this.assertCanManage(actor, project);
    const updated = await prisma.$transaction(async (tx) => {
      if (input.visibility === "PRIVATE" && project.createdById) {
        const creator = await tx.workspaceMember.findFirst({
          where: {
            workspaceId,
            userId: project.createdById,
            status: "ACTIVE",
            deletedAt: null,
          },
        });
        if (!creator) {
          throw new ValidationError("Project creator must be an active workspace member");
        }
        await tx.projectMember.upsert({
          where: {
            projectId_userId: { projectId, userId: project.createdById },
          },
          update: { workspaceId },
          create: { workspaceId, projectId, userId: project.createdById },
        });
      }
      return tx.project.update({
        where: { id: projectId },
        data: { visibility: input.visibility },
        include: PROJECT_INCLUDE,
      });
    });
    return this.mapProject(workspaceId, updated);
  }

  async eligibleAssignees(
    workspaceId: string,
    projectId: string,
    actor: Actor,
    query: EligibleAssigneesQuery,
  ) {
    const project = await this.getAccessibleProject(workspaceId, projectId, actor);
    const memberships = await prisma.workspaceMember.findMany({
      where: {
        workspaceId,
        status: "ACTIVE",
        deletedAt: null,
        ...(project.visibility === "PRIVATE"
          ? { userId: { in: project.members.map((member) => member.userId) } }
          : {}),
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
