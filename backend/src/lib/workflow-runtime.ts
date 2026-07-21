import type {
  TaskStatus,
  WorkflowStage,
  WorkflowStageCategory,
  WorkflowTransition,
} from "../../generated/prisma/client.js";
import { ForbiddenError, ValidationError } from "./errors.js";
import {
  evaluateWorkflowConditions,
  type WorkflowConditionContext,
} from "./workflow-conditions.js";
import { taskStatusToCategory } from "./workflow-mapping.js";

const CATEGORY_STATUS_MAP: Record<WorkflowStageCategory, TaskStatus> = {
  BACKLOG: "TODO",
  NOT_STARTED: "TODO",
  IN_PROGRESS: "IN_PROGRESS",
  BLOCKED: "BLOCKED",
  COMPLETED: "DONE",
  CANCELLED: "CANCELLED",
};

const LEGACY_NAME_HINTS: Partial<Record<TaskStatus, string[]>> = {
  TODO: ["todo", "backlog"],
  IN_PROGRESS: ["in progress", "doing"],
  IN_REVIEW: ["review", "quality"],
  BLOCKED: ["blocked"],
  DONE: ["done", "completed"],
  CANCELLED: ["cancelled", "canceled"],
};

export function categoryToLegacyStatus(category: WorkflowStageCategory): TaskStatus {
  return CATEGORY_STATUS_MAP[category];
}

export function legacyStatusForStage(stage: Pick<WorkflowStage, "category" | "name">): TaskStatus {
  const normalized = stage.name.trim().toLowerCase();
  for (const [status, hints] of Object.entries(LEGACY_NAME_HINTS) as Array<
    [TaskStatus, string[]]
  >) {
    if (hints.some((hint) => normalized.includes(hint))) {
      return status;
    }
  }
  const base = categoryToLegacyStatus(stage.category);
  if (base === "IN_PROGRESS" && normalized.includes("review")) {
    return "IN_REVIEW";
  }
  return base;
}

export function resolveStageForStatus(
  stages: WorkflowStage[],
  status: TaskStatus,
): WorkflowStage | null {
  const category = taskStatusToCategory(status);
  const categoryMatches = stages.filter((stage) => stage.category === category);
  const hints = LEGACY_NAME_HINTS[status] ?? [];
  const byHint = stages.find((stage) => {
    const name = stage.name.trim().toLowerCase();
    return hints.some((hint) => name.includes(hint));
  });
  if (byHint) return byHint;
  if (categoryMatches.length === 1) return categoryMatches[0]!;
  if (status === "IN_REVIEW") {
    return (
      stages.find((stage) => stage.name.toLowerCase().includes("review")) ??
      categoryMatches[0] ??
      null
    );
  }
  return categoryMatches[0] ?? null;
}

export function assertTransitionAllowed(params: {
  transitions: WorkflowTransition[];
  fromStageId: string;
  toStageId: string;
  actorPermissions: string[];
  conditionContext: WorkflowConditionContext;
}) {
  const {
    transitions,
    fromStageId,
    toStageId,
    actorPermissions,
    conditionContext,
  } = params;
  if (fromStageId === toStageId) return;

  const transition = transitions.find(
    (item) => item.fromStageId === fromStageId && item.toStageId === toStageId,
  );
  if (!transition) {
    throw new ValidationError("Transition is not allowed by project workflow", {
      field: "targetStageId",
      metadata: { fromStageId, toStageId },
    });
  }
  if (
    transition.requiredPermission &&
    !actorPermissions.includes(transition.requiredPermission)
  ) {
    throw new ForbiddenError("You do not have permission for this workflow transition");
  }
  if (!evaluateWorkflowConditions(transition.conditionsJson, conditionContext)) {
    throw new ValidationError("Workflow transition conditions are not satisfied", {
      field: "targetStageId",
      metadata: { fromStageId, toStageId },
    });
  }
}

export function isTerminalCategory(category: WorkflowStageCategory): boolean {
  return category === "COMPLETED" || category === "CANCELLED";
}

export function isOpenCategory(category: WorkflowStageCategory): boolean {
  return !isTerminalCategory(category);
}

export const OPEN_WORKFLOW_CATEGORIES: WorkflowStageCategory[] = [
  "BACKLOG",
  "NOT_STARTED",
  "IN_PROGRESS",
  "BLOCKED",
];

export const COMPLETED_WORKFLOW_CATEGORIES: WorkflowStageCategory[] = ["COMPLETED"];
