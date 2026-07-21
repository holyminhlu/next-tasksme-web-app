import type { Prisma } from "../../../generated/prisma/client.js";
import { prisma } from "../../config/database.js";
import {
  NotFoundError,
  ValidationError,
} from "../../lib/errors.js";
import {
  assertCanManageProjectSettings,
  type ProjectAccessContext,
} from "../../lib/project-access.js";
import {
  assertWorkflowStagesForPublish,
  assertWorkflowTransitions,
} from "../../lib/workflow-validation.js";
import { assertProjectAccessible } from "../projects/projects.service.js";
import type {
  CreateWorkflowStageInput,
  DeleteWorkflowStageInput,
  ReorderWorkflowStagesInput,
  UpdateWorkflowStageInput,
  UpsertWorkflowTransitionsInput,
} from "./workflows.schemas.js";

type Actor = { userId: string; roleKey: string; permissions?: string[] };

function projectContext(project: {
  visibility: "WORKSPACE" | "PRIVATE";
  createdById: string | null;
  members: Array<{ userId: string; projectRole: ProjectAccessContext["members"][number]["projectRole"] }>;
}): ProjectAccessContext {
  return {
    visibility: project.visibility,
    createdById: project.createdById,
    members: project.members,
  };
}

async function requireProjectSettings(
  workspaceId: string,
  projectId: string,
  actor: Actor,
) {
  const project = await assertProjectAccessible(workspaceId, projectId, actor);
  assertCanManageProjectSettings(actor, projectContext(project));
  return project;
}

function mapStage(stage: {
  id: string;
  workflowId: string;
  name: string;
  category: string;
  color: string | null;
  position: number;
  isInitial: boolean;
  isTerminal: boolean;
  isActive: boolean;
}) {
  return {
    id: stage.id,
    workflowId: stage.workflowId,
    name: stage.name,
    category: stage.category,
    color: stage.color,
    position: stage.position,
    isInitial: stage.isInitial,
    isTerminal: stage.isTerminal,
    isActive: stage.isActive,
  };
}

function mapTransition(transition: {
  id: string;
  workflowId: string;
  fromStageId: string;
  toStageId: string;
  requiredPermission: string | null;
  conditionsJson: unknown;
}) {
  return {
    id: transition.id,
    workflowId: transition.workflowId,
    fromStageId: transition.fromStageId,
    toStageId: transition.toStageId,
    requiredPermission: transition.requiredPermission,
    conditionsJson: transition.conditionsJson ?? {},
  };
}

function mapWorkflow(workflow: {
  id: string;
  familyId: string;
  workspaceId: string;
  sourceProjectId: string | null;
  name: string;
  version: number;
  status: string;
  stages?: Array<Parameters<typeof mapStage>[0]>;
  transitions?: Array<Parameters<typeof mapTransition>[0]>;
}) {
  return {
    id: workflow.id,
    familyId: workflow.familyId,
    workspaceId: workflow.workspaceId,
    sourceProjectId: workflow.sourceProjectId,
    name: workflow.name,
    version: workflow.version,
    status: workflow.status,
    stages: workflow.stages?.map(mapStage) ?? [],
    transitions: workflow.transitions?.map(mapTransition) ?? [],
  };
}

async function getDraftWorkflow(workspaceId: string, workflowId: string) {
  const workflow = await prisma.workflow.findFirst({
    where: { id: workflowId, workspaceId, status: "DRAFT" },
    include: {
      stages: { orderBy: { position: "asc" } },
      transitions: true,
    },
  });
  if (!workflow) throw new NotFoundError("Draft workflow not found");
  return workflow;
}

async function assertProjectDraftAccess(
  workspaceId: string,
  projectId: string,
  workflowId: string,
  actor: Actor,
) {
  const project = await requireProjectSettings(workspaceId, projectId, actor);
  const workflow = await getDraftWorkflow(workspaceId, workflowId);
  if (workflow.sourceProjectId !== projectId) {
    throw new ValidationError("Workflow draft does not belong to this project");
  }
  return { project, workflow };
}

export const workflowsService = {
  async getProjectWorkflowState(workspaceId: string, projectId: string, actor: Actor) {
    await assertProjectAccessible(workspaceId, projectId, actor);

    const applied = await prisma.projectWorkflow.findUnique({
      where: { projectId },
      include: {
        workflow: {
          include: {
            stages: { where: { isActive: true }, orderBy: { position: "asc" } },
            transitions: true,
          },
        },
      },
    });

    const draft = await prisma.workflow.findFirst({
      where: { workspaceId, sourceProjectId: projectId, status: "DRAFT" },
      include: {
        stages: { orderBy: { position: "asc" } },
        transitions: true,
      },
      orderBy: { updatedAt: "desc" },
    });

    return {
      published: applied ? mapWorkflow({ ...applied.workflow, stages: applied.workflow.stages, transitions: applied.workflow.transitions }) : null,
      draft: draft ? mapWorkflow(draft) : null,
      appliedVersion: applied?.workflowVersion ?? null,
    };
  },

  async createDraftFromPublished(workspaceId: string, projectId: string, actor: Actor) {
    await requireProjectSettings(workspaceId, projectId, actor);

    const existingDraft = await prisma.workflow.findFirst({
      where: { workspaceId, sourceProjectId: projectId, status: "DRAFT" },
    });
    if (existingDraft) {
      return this.getDraft(workspaceId, projectId, existingDraft.id, actor);
    }

    const applied = await prisma.projectWorkflow.findUnique({
      where: { projectId },
      include: {
        workflow: {
          include: { stages: { orderBy: { position: "asc" } }, transitions: true },
        },
      },
    });
    if (!applied) throw new NotFoundError("Project has no published workflow");

    const draft = await prisma.$transaction(async (tx) => {
      const created = await tx.workflow.create({
        data: {
          workspaceId,
          familyId: applied.workflow.familyId,
          sourceProjectId: projectId,
          name: applied.workflow.name,
          version: 0,
          status: "DRAFT",
          createdById: actor.userId,
        },
      });

      const stageIdMap = new Map<string, string>();
      for (const stage of applied.workflow.stages) {
        const copy = await tx.workflowStage.create({
          data: {
            workflowId: created.id,
            name: stage.name,
            category: stage.category,
            color: stage.color,
            position: stage.position,
            isInitial: stage.isInitial,
            isTerminal: stage.isTerminal,
            isActive: stage.isActive,
          },
        });
        stageIdMap.set(stage.id, copy.id);
      }

      for (const transition of applied.workflow.transitions) {
        const fromStageId = stageIdMap.get(transition.fromStageId);
        const toStageId = stageIdMap.get(transition.toStageId);
        if (!fromStageId || !toStageId) continue;
        await tx.workflowTransition.create({
          data: {
            workflowId: created.id,
            fromStageId,
            toStageId,
            requiredPermission: transition.requiredPermission,
            conditionsJson: (transition.conditionsJson ?? {}) as Prisma.InputJsonValue,
          },
        });
      }

      return created;
    });

    return this.getDraft(workspaceId, projectId, draft.id, actor);
  },

  async getDraft(
    workspaceId: string,
    projectId: string,
    workflowId: string,
    actor: Actor,
  ) {
    const { workflow } = await assertProjectDraftAccess(
      workspaceId,
      projectId,
      workflowId,
      actor,
    );
    return mapWorkflow(workflow);
  },

  async getPublishPreview(workspaceId: string, projectId: string, draftWorkflowId: string, actor: Actor) {
    await assertProjectDraftAccess(workspaceId, projectId, draftWorkflowId, actor);

    const applied = await prisma.projectWorkflow.findUnique({
      where: { projectId },
      include: { workflow: { include: { stages: true } } },
    });

    const tasks = await prisma.task.findMany({
      where: { projectId, deletedAt: null },
      select: { id: true, status: true, workflowStageId: true },
    });

    const stageUsage = new Map<string, number>();
    const legacyUsage = new Map<string, number>();
    for (const task of tasks) {
      if (task.workflowStageId) {
        stageUsage.set(task.workflowStageId, (stageUsage.get(task.workflowStageId) ?? 0) + 1);
      } else {
        legacyUsage.set(task.status, (legacyUsage.get(task.status) ?? 0) + 1);
      }
    }

    return {
      taskCount: tasks.length,
      currentStages: applied?.workflow.stages.map((stage) => ({
        id: stage.id,
        name: stage.name,
        taskCount: stageUsage.get(stage.id) ?? 0,
      })) ?? [],
      legacyStatusCounts: Array.from(legacyUsage.entries()).map(([status, count]) => ({
        status,
        count,
      })),
      requiredStageMappings:
        applied?.workflow.stages
          .filter((stage) => (stageUsage.get(stage.id) ?? 0) > 0)
          .map((stage) => ({
            id: stage.id,
            name: stage.name,
            taskCount: stageUsage.get(stage.id)!,
          })) ?? [],
      requiresMapping: stageUsage.size > 0 || legacyUsage.size > 0,
    };
  },

  async addStage(
    workspaceId: string,
    projectId: string,
    workflowId: string,
    actor: Actor,
    input: CreateWorkflowStageInput,
  ) {
    const { workflow } = await assertProjectDraftAccess(
      workspaceId,
      projectId,
      workflowId,
      actor,
    );

    const maxPosition = workflow.stages.reduce(
      (max, stage) => Math.max(max, stage.position),
      -1,
    );

    const stage = await prisma.$transaction(async (tx) => {
      if (input.isInitial) {
        await tx.workflowStage.updateMany({
          where: { workflowId, isInitial: true },
          data: { isInitial: false },
        });
      }
      return tx.workflowStage.create({
        data: {
          workflowId,
          name: input.name,
          category: input.category,
          color: input.color ?? null,
          position: maxPosition + 1,
          isInitial: input.isInitial ?? false,
          isTerminal: input.isTerminal ?? false,
        },
      });
    });

    return mapStage(stage);
  },

  async updateStage(
    workspaceId: string,
    projectId: string,
    workflowId: string,
    stageId: string,
    actor: Actor,
    input: UpdateWorkflowStageInput,
  ) {
    await assertProjectDraftAccess(workspaceId, projectId, workflowId, actor);
    const existing = await prisma.workflowStage.findFirst({
      where: { id: stageId, workflowId },
    });
    if (!existing) throw new NotFoundError("Workflow stage not found");

    const stage = await prisma.$transaction(async (tx) => {
      if (input.isInitial) {
        await tx.workflowStage.updateMany({
          where: { workflowId, isInitial: true, id: { not: stageId } },
          data: { isInitial: false },
        });
      }
      return tx.workflowStage.update({
        where: { id: stageId },
        data: {
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.category !== undefined ? { category: input.category } : {}),
          ...(input.color !== undefined ? { color: input.color } : {}),
          ...(input.isInitial !== undefined ? { isInitial: input.isInitial } : {}),
          ...(input.isTerminal !== undefined ? { isTerminal: input.isTerminal } : {}),
          ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        },
      });
    });

    return mapStage(stage);
  },

  async deleteStage(
    workspaceId: string,
    projectId: string,
    workflowId: string,
    stageId: string,
    actor: Actor,
    input: DeleteWorkflowStageInput,
  ) {
    void input;
    await assertProjectDraftAccess(workspaceId, projectId, workflowId, actor);
    const stage = await prisma.workflowStage.findFirst({
      where: { id: stageId, workflowId },
    });
    if (!stage) throw new NotFoundError("Workflow stage not found");

    await prisma.$transaction(async (tx) => {
      await tx.workflowTransition.deleteMany({
        where: {
          workflowId,
          OR: [{ fromStageId: stageId }, { toStageId: stageId }],
        },
      });
      await tx.workflowStage.delete({ where: { id: stageId } });
    });
  },

  async reorderStages(
    workspaceId: string,
    projectId: string,
    workflowId: string,
    actor: Actor,
    input: ReorderWorkflowStagesInput,
  ) {
    const { workflow } = await assertProjectDraftAccess(
      workspaceId,
      projectId,
      workflowId,
      actor,
    );
    const stageIds = new Set(workflow.stages.map((stage) => stage.id));
    if (input.stageIds.length !== stageIds.size) {
      throw new ValidationError("Stage reorder list must include all stages exactly once");
    }
    for (const id of input.stageIds) {
      if (!stageIds.has(id)) {
        throw new ValidationError("Unknown stage in reorder list", { metadata: { stageId: id } });
      }
    }

    await prisma.$transaction(
      input.stageIds.map((id, position) =>
        prisma.workflowStage.update({ where: { id }, data: { position } }),
      ),
    );

    return this.getDraft(workspaceId, projectId, workflowId, actor);
  },

  async upsertTransitions(
    workspaceId: string,
    projectId: string,
    workflowId: string,
    actor: Actor,
    input: UpsertWorkflowTransitionsInput,
  ) {
    const { workflow } = await assertProjectDraftAccess(
      workspaceId,
      projectId,
      workflowId,
      actor,
    );

    const stageDrafts = workflow.stages.map((stage) => ({
      id: stage.id,
      name: stage.name,
      category: stage.category,
      isInitial: stage.isInitial,
      isTerminal: stage.isTerminal,
    }));
    assertWorkflowTransitions(stageDrafts, input.transitions);

    await prisma.$transaction(async (tx) => {
      await tx.workflowTransition.deleteMany({ where: { workflowId } });
      for (const transition of input.transitions) {
        await tx.workflowTransition.create({
          data: {
            workflowId,
            fromStageId: transition.fromStageId,
            toStageId: transition.toStageId,
            requiredPermission: transition.requiredPermission ?? null,
            conditionsJson: (transition.conditionsJson ?? {}) as Prisma.InputJsonValue,
          },
        });
      }
    });

    return this.getDraft(workspaceId, projectId, workflowId, actor);
  },

  async validateDraft(
    workspaceId: string,
    projectId: string,
    workflowId: string,
    actor: Actor,
  ) {
    const { workflow } = await assertProjectDraftAccess(
      workspaceId,
      projectId,
      workflowId,
      actor,
    );
    const stageDrafts = workflow.stages.map((stage) => ({
      id: stage.id,
      name: stage.name,
      category: stage.category,
      isInitial: stage.isInitial,
      isTerminal: stage.isTerminal,
    }));
    assertWorkflowStagesForPublish(stageDrafts);
    assertWorkflowTransitions(
      stageDrafts,
      workflow.transitions.map((item) => ({
        fromStageId: item.fromStageId,
        toStageId: item.toStageId,
        conditionsJson: item.conditionsJson,
      })),
    );
    return { valid: true };
  },
};
