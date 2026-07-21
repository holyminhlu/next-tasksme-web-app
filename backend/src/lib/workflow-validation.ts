import type { WorkflowStageCategory } from "../../generated/prisma/client.js";
import { ValidationError } from "./errors.js";
import { validateWorkflowConditions } from "./workflow-conditions.js";

export type WorkflowStageDraft = {
  id?: string;
  name: string;
  category: WorkflowStageCategory;
  isInitial: boolean;
  isTerminal: boolean;
};

export type WorkflowTransitionDraft = {
  fromStageId: string;
  toStageId: string;
  conditionsJson?: unknown;
};

export function assertWorkflowStagesForPublish(stages: WorkflowStageDraft[]): void {
  const initialStages = stages.filter((s) => s.isInitial);
  const terminalStages = stages.filter((s) => s.isTerminal);

  if (stages.length === 0) {
    throw new ValidationError("Workflow must have at least one stage", {
      field: "stages",
    });
  }

  if (initialStages.length !== 1) {
    throw new ValidationError("Workflow must have exactly 1 initial stage", {
      field: "stages.isInitial",
      metadata: { initialStageCount: initialStages.length },
    });
  }

  if (terminalStages.length < 1) {
    throw new ValidationError("Workflow must have at least 1 terminal stage", {
      field: "stages.isTerminal",
    });
  }

  const normalizedNames = stages.map((s) => s.name.trim()).filter(Boolean);
  const duplicates = normalizedNames.filter(
    (name, i) => normalizedNames.indexOf(name) !== i,
  );
  if (duplicates.length > 0) {
    throw new ValidationError("Stage names must be unique within workflow", {
      field: "stages.name",
      metadata: { duplicates: [...new Set(duplicates)] },
    });
  }
}

export function assertWorkflowStageDeletionMapping(params: {
  stageName: string;
  tasksCount: number;
  moveToStageIds: string[];
}): void {
  const { tasksCount, moveToStageIds, stageName } = params;

  if (tasksCount === 0) return;
  if (moveToStageIds.length === 0) {
    throw new ValidationError(
      `Stage "${stageName}" cannot be deleted while it still contains tasks. ` +
        "Move tasks to another stage first.",
      { field: "moveToStageIds" },
    );
  }
}

export function assertWorkflowTransitions(
  stages: WorkflowStageDraft[],
  transitions: WorkflowTransitionDraft[],
): void {
  const stageIds = new Set(stages.map((stage) => stage.id).filter(Boolean) as string[]);
  const seen = new Set<string>();
  for (const transition of transitions) {
    const conditions = validateWorkflowConditions(transition.conditionsJson ?? {});
    if (!conditions.success) {
      throw new ValidationError("Workflow transition conditions are invalid", {
        field: "transitions.conditionsJson",
        metadata: {
          fromStageId: transition.fromStageId,
          toStageId: transition.toStageId,
          issues: conditions.error.issues,
        },
      });
    }
    if (transition.fromStageId === transition.toStageId) {
      throw new ValidationError("Workflow transition cannot point to the same stage", {
        field: "transitions",
        metadata: transition,
      });
    }
    if (!stageIds.has(transition.fromStageId) || !stageIds.has(transition.toStageId)) {
      throw new ValidationError("Workflow transition references an unknown stage", {
        field: "transitions",
        metadata: transition,
      });
    }
    const key = `${transition.fromStageId}:${transition.toStageId}`;
    if (seen.has(key)) {
      throw new ValidationError("Duplicate workflow transition is not allowed", {
        field: "transitions",
        metadata: transition,
      });
    }
    seen.add(key);
  }
}

