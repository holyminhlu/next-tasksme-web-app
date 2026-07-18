import { prisma } from "../../config/database.js";
import { NotFoundError } from "../../lib/errors.js";
import { recordActivity } from "../../services/activity.service.js";
import type { CreateProjectInput } from "./projects.schemas.js";

export class ProjectsService {
  async listProjects(workspaceId: string) {
    const projects = await prisma.project.findMany({
      where: { workspaceId, deletedAt: null },
      orderBy: { updatedAt: "desc" },
    });

    return projects.map((project) => ({
      id: project.id,
      workspaceId: project.workspaceId,
      name: project.name,
      description: project.description,
      status: project.status,
      createdAt: project.createdAt.toISOString(),
      updatedAt: project.updatedAt.toISOString(),
    }));
  }

  async createProject(
    workspaceId: string,
    actorId: string,
    input: CreateProjectInput,
  ) {
    const workspace = await prisma.workspace.findFirst({
      where: { id: workspaceId, deletedAt: null },
    });
    if (!workspace) {
      throw new NotFoundError("Workspace not found");
    }

    const project = await prisma.project.create({
      data: {
        workspaceId,
        name: input.name,
        description: input.description,
        createdById: actorId,
        status: "ACTIVE",
      },
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

    return {
      id: project.id,
      workspaceId: project.workspaceId,
      name: project.name,
      description: project.description,
      status: project.status,
      createdAt: project.createdAt.toISOString(),
      updatedAt: project.updatedAt.toISOString(),
    };
  }
}

export const projectsService = new ProjectsService();
