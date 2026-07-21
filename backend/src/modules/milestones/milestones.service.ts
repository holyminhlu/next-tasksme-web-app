import { prisma } from "../../config/database.js";
import {
  assertCanManageProject,
  assertCanViewProject,
  type ProjectAccessActor,
} from "../../lib/project-access.js";
import { NotFoundError, ValidationError } from "../../lib/errors.js";
import type {
  CreateMilestoneInput,
  ReorderMilestonesInput,
  UpdateMilestoneInput,
} from "./milestones.schemas.js";

const PROJECT_ACCESS_SELECT = {
  visibility: true,
  createdById: true,
  members: { select: { userId: true, projectRole: true } },
} as const;

const MILESTONE_INCLUDE = {
  createdBy: { select: { id: true, fullName: true, email: true } },
  _count: { select: { tasks: true } },
} as const;

function mapMilestone(milestone: {
  id: string;
  workspaceId: string;
  projectId: string;
  name: string;
  description: string | null;
  status: "PLANNED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
  position: number;
  startAt: Date | null;
  dueAt: Date | null;
  completedAt: Date | null;
  createdById: string | null;
  createdAt: Date;
  updatedAt: Date;
  createdBy: { id: string; fullName: string; email: string } | null;
  _count: { tasks: number };
}) {
  return {
    ...milestone,
    startAt: milestone.startAt?.toISOString() ?? null,
    dueAt: milestone.dueAt?.toISOString() ?? null,
    completedAt: milestone.completedAt?.toISOString() ?? null,
    createdAt: milestone.createdAt.toISOString(),
    updatedAt: milestone.updatedAt.toISOString(),
    taskCount: milestone._count.tasks,
    _count: undefined,
  };
}

async function requireProject(
  workspaceId: string,
  projectId: string,
  actor: ProjectAccessActor,
  manage: boolean,
) {
  const project = await prisma.project.findFirst({
    where: { id: projectId, workspaceId, deletedAt: null },
    select: PROJECT_ACCESS_SELECT,
  });
  if (!project) throw new NotFoundError("Project not found");
  if (manage) assertCanManageProject(actor, project);
  else assertCanViewProject(actor, project);
  return project;
}

function assertDates(startAt: Date | null, dueAt: Date | null) {
  if (startAt && dueAt && dueAt < startAt) {
    throw new ValidationError("dueAt must be greater than or equal to startAt", {
      field: "dueAt",
    });
  }
}

async function requireMilestone(
  workspaceId: string,
  projectId: string,
  milestoneId: string,
) {
  const milestone = await prisma.milestone.findFirst({
    where: { id: milestoneId, workspaceId, projectId },
    include: MILESTONE_INCLUDE,
  });
  if (!milestone) throw new NotFoundError("Milestone not found");
  return milestone;
}

export class MilestonesService {
  async list(
    workspaceId: string,
    projectId: string,
    actor: ProjectAccessActor,
  ) {
    await requireProject(workspaceId, projectId, actor, false);
    const milestones = await prisma.milestone.findMany({
      where: { workspaceId, projectId },
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
      include: MILESTONE_INCLUDE,
    });
    return milestones.map(mapMilestone);
  }

  async get(
    workspaceId: string,
    projectId: string,
    milestoneId: string,
    actor: ProjectAccessActor,
  ) {
    await requireProject(workspaceId, projectId, actor, false);
    return mapMilestone(await requireMilestone(workspaceId, projectId, milestoneId));
  }

  async create(
    workspaceId: string,
    projectId: string,
    actor: ProjectAccessActor,
    input: CreateMilestoneInput,
  ) {
    await requireProject(workspaceId, projectId, actor, true);
    const startAt = input.startAt ? new Date(input.startAt) : null;
    const dueAt = input.dueAt ? new Date(input.dueAt) : null;
    assertDates(startAt, dueAt);
    const status = input.status ?? "PLANNED";
    const position =
      input.position ??
      ((await prisma.milestone.aggregate({
        where: { workspaceId, projectId },
        _max: { position: true },
      }))._max.position ?? -1) + 1;
    const milestone = await prisma.milestone.create({
      data: {
        workspaceId,
        projectId,
        name: input.name,
        description: input.description,
        status,
        position,
        startAt,
        dueAt,
        completedAt: status === "COMPLETED" ? new Date() : null,
        createdById: actor.userId,
      },
      include: MILESTONE_INCLUDE,
    });
    return mapMilestone(milestone);
  }

  async update(
    workspaceId: string,
    projectId: string,
    milestoneId: string,
    actor: ProjectAccessActor,
    input: UpdateMilestoneInput,
  ) {
    await requireProject(workspaceId, projectId, actor, true);
    const existing = await requireMilestone(workspaceId, projectId, milestoneId);
    const startAt =
      input.startAt === undefined
        ? existing.startAt
        : input.startAt
          ? new Date(input.startAt)
          : null;
    const dueAt =
      input.dueAt === undefined
        ? existing.dueAt
        : input.dueAt
          ? new Date(input.dueAt)
          : null;
    assertDates(startAt, dueAt);
    const status = input.status ?? existing.status;
    const milestone = await prisma.milestone.update({
      where: { id: existing.id },
      data: {
        name: input.name,
        description: input.description,
        status: input.status,
        position: input.position,
        startAt: input.startAt === undefined ? undefined : startAt,
        dueAt: input.dueAt === undefined ? undefined : dueAt,
        completedAt:
          status === "COMPLETED"
            ? existing.completedAt ?? new Date()
            : existing.status === "COMPLETED"
              ? null
              : undefined,
      },
      include: MILESTONE_INCLUDE,
    });
    return mapMilestone(milestone);
  }

  async delete(
    workspaceId: string,
    projectId: string,
    milestoneId: string,
    actor: ProjectAccessActor,
  ) {
    await requireProject(workspaceId, projectId, actor, true);
    const existing = await requireMilestone(workspaceId, projectId, milestoneId);
    await prisma.milestone.delete({ where: { id: existing.id } });
  }

  async reorder(
    workspaceId: string,
    projectId: string,
    actor: ProjectAccessActor,
    input: ReorderMilestonesInput,
  ) {
    await requireProject(workspaceId, projectId, actor, true);
    const count = await prisma.milestone.count({
      where: {
        workspaceId,
        projectId,
        id: { in: input.milestoneIds },
      },
    });
    if (count !== input.milestoneIds.length) {
      throw new ValidationError("All milestoneIds must belong to this project", {
        field: "milestoneIds",
      });
    }
    await prisma.$transaction(
      input.milestoneIds.map((id, position) =>
        prisma.milestone.update({ where: { id }, data: { position } }),
      ),
    );
    return this.list(workspaceId, projectId, actor);
  }
}

export const milestonesService = new MilestonesService();
