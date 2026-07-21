export type WorkflowStageCategory =
  | "BACKLOG"
  | "NOT_STARTED"
  | "IN_PROGRESS"
  | "BLOCKED"
  | "COMPLETED"
  | "CANCELLED";

export type WorkflowStageRecord = {
  id: string;
  workflowId: string;
  name: string;
  category: WorkflowStageCategory;
  color: string | null;
  position: number;
  isInitial: boolean;
  isTerminal: boolean;
  isActive: boolean;
};

export type TaskPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

export type WorkflowConditionClause =
  | { field: "task.assigneeId"; operator: "isSet" | "isNotSet" }
  | { field: "task.priority"; operator: "eq"; value: TaskPriority }
  | { field: "task.priority"; operator: "in"; value: TaskPriority[] }
  | {
      field:
        | "task.isBlocked"
        | "task.checklistComplete"
        | "task.dependenciesComplete";
      operator: "eq";
      value: boolean;
    };

export type WorkflowConditions =
  | Record<string, never>
  | { version: 1; all: WorkflowConditionClause[] };

export type WorkflowTransitionRecord = {
  id: string;
  workflowId: string;
  fromStageId: string;
  toStageId: string;
  requiredPermission: string | null;
  conditionsJson: WorkflowConditions;
};

export type WorkflowRecord = {
  id: string;
  familyId: string;
  workspaceId: string;
  sourceProjectId: string | null;
  name: string;
  version: number;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  stages: WorkflowStageRecord[];
  transitions: WorkflowTransitionRecord[];
};

export type ProjectWorkflowState = {
  published: WorkflowRecord | null;
  draft: WorkflowRecord | null;
  appliedVersion: number | null;
};

export type PublishWorkflowInput = {
  draftWorkflowId: string;
  stageMappings: Array<{ fromStageId: string; toStageId: string }>;
  legacyStatusMappings: Array<{
    fromStatus: string;
    toStageId: string;
  }>;
};

export type PublishPreview = {
  taskCount: number;
  currentStages: Array<{
    id: string;
    name: string;
    taskCount: number;
    category?: WorkflowStageCategory;
    status?: LegacyTaskStatus;
  }>;
  requiredStageMappings: Array<{ id: string; name: string; taskCount: number }>;
  legacyStatusCounts: Array<{ status: string; count: number }>;
  requiresMapping: boolean;
};

export type LegacyTaskStatus =
  | "TODO"
  | "IN_PROGRESS"
  | "IN_REVIEW"
  | "BLOCKED"
  | "DONE"
  | "CANCELLED";

export type CreateWorkflowStageInput = {
  name: string;
  category: WorkflowStageCategory;
  color?: string;
  isInitial?: boolean;
  isTerminal?: boolean;
};

export type UpdateWorkflowStageInput = Partial<
  Pick<
    WorkflowStageRecord,
    "name" | "category" | "isInitial" | "isTerminal" | "isActive"
  >
> & { color?: string | null };

export type WorkflowTransitionInput = Pick<
  WorkflowTransitionRecord,
  "fromStageId" | "toStageId" | "requiredPermission" | "conditionsJson"
>;

export type WorkflowValidationIssue = {
  message: string;
  field?: string;
  path?: Array<string | number>;
};

export type WorkflowValidationResult =
  | { valid: true; issues: [] }
  | { valid: false; issues: WorkflowValidationIssue[] };
