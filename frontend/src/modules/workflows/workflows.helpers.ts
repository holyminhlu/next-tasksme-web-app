import type {
  LegacyTaskStatus,
  PublishPreview,
  WorkflowConditionClause,
  WorkflowConditions,
  WorkflowStageCategory,
  WorkflowStageRecord,
  WorkflowTransitionInput,
  WorkflowTransitionRecord,
} from "./workflows.types";

export const WORKFLOW_STAGE_CATEGORIES: WorkflowStageCategory[] = [
  "BACKLOG",
  "NOT_STARTED",
  "IN_PROGRESS",
  "BLOCKED",
  "COMPLETED",
  "CANCELLED",
];

export const TASK_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;

export function categoryToLegacyStatus(
  category: WorkflowStageCategory,
): LegacyTaskStatus {
  switch (category) {
    case "BACKLOG":
    case "NOT_STARTED":
      return "TODO";
    case "IN_PROGRESS":
      return "IN_PROGRESS";
    case "BLOCKED":
      return "BLOCKED";
    case "COMPLETED":
      return "DONE";
    case "CANCELLED":
      return "CANCELLED";
  }
}

export function transitionKey(
  transition: Pick<WorkflowTransitionInput, "fromStageId" | "toStageId">,
): string {
  return `${transition.fromStageId}:${transition.toStageId}`;
}

export function toTransitionInputs(
  transitions: WorkflowTransitionRecord[],
): WorkflowTransitionInput[] {
  return transitions.map(
    ({ fromStageId, toStageId, requiredPermission, conditionsJson }) => ({
      fromStageId,
      toStageId,
      requiredPermission,
      conditionsJson,
    }),
  );
}

export function toggleTransition(
  transitions: WorkflowTransitionInput[],
  fromStageId: string,
  toStageId: string,
): WorkflowTransitionInput[] {
  const key = `${fromStageId}:${toStageId}`;
  if (transitions.some((item) => transitionKey(item) === key)) {
    return transitions.filter((item) => transitionKey(item) !== key);
  }
  return [
    ...transitions,
    { fromStageId, toStageId, requiredPermission: null, conditionsJson: {} },
  ];
}

export function conditionPayload(
  clauses: WorkflowConditionClause[],
): WorkflowConditions {
  return clauses.length === 0 ? {} : { version: 1, all: clauses };
}

export function requiredMappingsComplete(
  preview: PublishPreview | null,
  stageMappings: Record<string, string>,
  legacyMappings: Record<string, string>,
): boolean {
  if (!preview) return false;
  const requiredStages =
    preview.requiredStageMappings ??
    preview.currentStages.filter((stage) => stage.taskCount > 0);
  return (
    requiredStages.every((stage) => Boolean(stageMappings[stage.id])) &&
    preview.legacyStatusCounts
      .filter((item) => item.count > 0)
      .every((item) => Boolean(legacyMappings[item.status]))
  );
}

export function mappingChangesImpact(
  source: Pick<WorkflowStageRecord, "category"> | undefined,
  target: Pick<WorkflowStageRecord, "category"> | undefined,
  sourceStatus?: string,
): boolean {
  if (!target) return false;
  if (source && source.category !== target.category) return true;
  return Boolean(
    sourceStatus && categoryToLegacyStatus(target.category) !== sourceStatus,
  );
}
