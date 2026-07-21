import type {
  Prisma,
  TaskStatus,
  WorkflowStageCategory,
} from "../../generated/prisma/client.js";
import { prisma } from "../config/database.js";
import { NotFoundError } from "./errors.js";
import { resolveStageForStatus } from "./workflow-runtime.js";

export type DefaultStageDef = {
  name: string;
  category: WorkflowStageCategory;
  color: string;
  isInitial: boolean;
  isTerminal: boolean;
};

export const DEFAULT_PROJECT_STAGES: DefaultStageDef[] = [
  { name: "Todo", category: "BACKLOG", color: "#94a3b8", isInitial: true, isTerminal: false },
  { name: "In Progress", category: "IN_PROGRESS", color: "#3b82f6", isInitial: false, isTerminal: false },
  { name: "Review", category: "IN_PROGRESS", color: "#8b5cf6", isInitial: false, isTerminal: false },
  { name: "Blocked", category: "BLOCKED", color: "#ef4444", isInitial: false, isTerminal: false },
  { name: "Done", category: "COMPLETED", color: "#22c55e", isInitial: false, isTerminal: true },
  { name: "Cancelled", category: "CANCELLED", color: "#64748b", isInitial: false, isTerminal: true },
];

function defaultTransitions(stageIds: string[]) {
  const [todo, inProgress, review, blocked, done, cancelled] = stageIds;
  const pairs: Array<[string, string]> = [];
  const add = (from?: string, to?: string) => {
    if (from && to) pairs.push([from, to]);
  };
  add(todo, inProgress);
  add(todo, blocked);
  add(todo, cancelled);
  add(inProgress, review);
  add(inProgress, blocked);
  add(inProgress, done);
  add(inProgress, cancelled);
  add(review, inProgress);
  add(review, done);
  add(review, blocked);
  add(blocked, inProgress);
  add(blocked, todo);
  add(done, inProgress);
  add(cancelled, todo);
  return pairs;
}

export async function createDefaultProjectWorkflow(
  tx: Prisma.TransactionClient,
  params: {
    workspaceId: string;
    projectId: string;
    projectName: string;
    actorId: string;
  },
) {
  const workflowName = `${params.projectName} Workflow`;
  const workflow = await tx.workflow.create({
    data: {
      workspaceId: params.workspaceId,
      sourceProjectId: params.projectId,
      name: workflowName,
      version: 1,
      status: "PUBLISHED",
      createdById: params.actorId,
    },
  });

  const stageIds: string[] = [];
  for (let index = 0; index < DEFAULT_PROJECT_STAGES.length; index += 1) {
    const def = DEFAULT_PROJECT_STAGES[index]!;
    const stage = await tx.workflowStage.create({
      data: {
        workflowId: workflow.id,
        name: def.name,
        category: def.category,
        color: def.color,
        position: index,
        isInitial: def.isInitial,
        isTerminal: def.isTerminal,
      },
    });
    stageIds.push(stage.id);
  }

  for (const [fromStageId, toStageId] of defaultTransitions(stageIds)) {
    await tx.workflowTransition.create({
      data: { workflowId: workflow.id, fromStageId, toStageId },
    });
  }

  await tx.projectWorkflow.create({
    data: {
      projectId: params.projectId,
      workflowId: workflow.id,
      workflowVersion: workflow.version,
    },
  });

  return { workflow, stageIds };
}

export async function getPublishedProjectWorkflow(projectId: string) {
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
  if (!applied) return null;
  return applied;
}

export async function resolveInitialStageId(projectId: string): Promise<string | null> {
  const applied = await getPublishedProjectWorkflow(projectId);
  if (!applied) return null;
  const initial = applied.workflow.stages.find((stage) => stage.isInitial);
  return initial?.id ?? applied.workflow.stages[0]?.id ?? null;
}

export async function resolveStageForLegacyStatus(
  projectId: string,
  status: TaskStatus,
): Promise<string | null> {
  const applied = await getPublishedProjectWorkflow(projectId);
  if (!applied) return null;
  const stage = resolveStageForStatus(applied.workflow.stages, status);
  return stage?.id ?? null;
}

export async function ensureProjectWorkflow(projectId: string, workspaceId: string) {
  const existing = await prisma.projectWorkflow.findUnique({ where: { projectId } });
  if (existing) {
    await backfillTaskWorkflowStages(projectId);
    return existing;
  }

  const project = await prisma.project.findFirst({
    where: { id: projectId, workspaceId, deletedAt: null },
  });
  if (!project) throw new NotFoundError("Project not found");

  const applied = await prisma.$transaction(async (tx) => {
    const again = await tx.projectWorkflow.findUnique({ where: { projectId } });
    if (again) return again;
    await createDefaultProjectWorkflow(tx, {
      workspaceId,
      projectId,
      projectName: project.name,
      actorId: project.createdById ?? project.managerId ?? workspaceId,
    });
    return tx.projectWorkflow.findUniqueOrThrow({ where: { projectId } });
  });
  await backfillTaskWorkflowStages(projectId);
  return applied;
}

async function backfillTaskWorkflowStages(projectId: string) {
  const applied = await getPublishedProjectWorkflow(projectId);
  if (!applied) return;
  const tasks = await prisma.task.findMany({
    where: { projectId, workflowStageId: null, deletedAt: null },
    select: { id: true, status: true },
  });
  for (const task of tasks) {
    const stage = resolveStageForStatus(applied.workflow.stages, task.status);
    if (!stage) continue;
    await prisma.task.update({
      where: { id: task.id },
      data: { workflowStageId: stage.id },
    });
  }
}
