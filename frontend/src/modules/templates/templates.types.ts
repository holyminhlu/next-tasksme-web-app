export type TemplateStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";
export type TemplateVisibility = "WORKSPACE" | "SYSTEM";
export type ProjectRole =
  | "PROJECT_OWNER"
  | "PROJECT_MANAGER"
  | "PROJECT_MEMBER"
  | "PROJECT_VIEWER";

export type TemplateMemberPlaceholder = {
  key: string;
  name: string;
  projectRole: ProjectRole;
  required: boolean;
};

export type TemplateWorkflowStage = {
  key: string;
  name: string;
  category: "BACKLOG" | "NOT_STARTED" | "IN_PROGRESS" | "BLOCKED" | "COMPLETED" | "CANCELLED";
  color?: string | null;
  position: number;
  isInitial: boolean;
  isTerminal: boolean;
  isActive: boolean;
};

export type TemplateContentV2 = {
  schemaVersion: 2;
  project: {
    description?: string | null;
    status: "PLANNING" | "ACTIVE" | "ON_HOLD";
    priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
    visibility: "WORKSPACE" | "PRIVATE";
    completionPolicy: "WARN_ONLY" | "BLOCK" | "BLOCK_WITH_OVERRIDE";
    managerPlaceholderKey?: string | null;
  };
  memberPlaceholders: TemplateMemberPlaceholder[];
  workflow: {
    name: string;
    stages: TemplateWorkflowStage[];
    transitions: Array<{
      fromKey: string;
      toKey: string;
      requiredPermission?: string | null;
      conditionsJson: Record<string, unknown>;
    }>;
  };
  tags: Array<{ key: string; name: string; color: string }>;
  customFields: Array<{
    key: string;
    name: string;
    fieldType: "TEXT" | "NUMBER" | "BOOLEAN" | "DATE" | "SELECT" | "MULTI_SELECT" | "USER";
    isRequired: boolean;
    options: unknown[];
    defaultValue?: unknown;
    position: number;
    isActive: boolean;
  }>;
  milestones: Array<{
    key: string;
    name: string;
    description?: string | null;
    status: "PLANNED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
    position: number;
    startOffsetDays?: number | null;
    dueOffsetDays?: number | null;
  }>;
  tasks: Array<{
    key: string;
    title: string;
    description?: string | null;
    priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
    stageKey: string;
    parentKey?: string | null;
    subtaskPosition?: number | null;
    milestoneKey?: string | null;
    assigneePlaceholderKey?: string | null;
    startOffsetDays?: number | null;
    dueOffsetDays?: number | null;
    durationDays?: number | null;
    position: number;
    checklist: Array<{ title: string; position: number; isCompleted: boolean }>;
    tagKeys: string[];
    customValues: Record<string, unknown>;
  }>;
  dependencies: Array<{
    predecessorKey: string;
    successorKey: string;
    dependencyType: "FINISH_TO_START";
  }>;
};

export type TemplateRecord = {
  id: string;
  seriesId: string;
  workspaceId: string | null;
  name: string;
  description: string | null;
  industryCode: string | null;
  version: number;
  visibility: TemplateVisibility;
  status: TemplateStatus;
  contentSchemaVersion: number;
  contentHash: string;
  contentJson: TemplateContentV2;
  publishedAt: string | null;
  supersededAt: string | null;
  createdById: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CloneJobRecord = {
  id: string;
  templateId: string;
  projectId: string | null;
  status: "PENDING" | "PROCESSING" | "RETRY_WAIT" | "COMPLETED" | "FAILED" | "DEAD" | "CANCELLED";
  progress: number;
  attempts: number;
  maxAttempts: number;
  nextAttemptAt: string | null;
  errorMessage: string | null;
  resultJson: unknown;
  createdAt: string;
  completedAt: string | null;
};

export type TemplateListFilters = {
  search?: string;
  status?: TemplateStatus;
  visibility?: TemplateVisibility;
  page?: number;
  pageSize?: number;
};

export type TemplateListResult = {
  items: TemplateRecord[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type CloneTemplateInput = {
  projectName: string;
  projectCode?: string;
  startAt?: string;
  idempotencyKey: string;
  memberBindings: Record<string, string>;
};

export type TemplateValidation = {
  valid: true;
  schemaVersion: number;
  contentHash: string;
};
