export type TaskStatus =
  | "TODO"
  | "IN_PROGRESS"
  | "IN_REVIEW"
  | "BLOCKED"
  | "DONE"
  | "CANCELLED";

export type TaskPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

export type TaskSource = "MANUAL" | "AI_QUICK_CAPTURE" | string;

export type ProjectVisibility = "WORKSPACE" | "PRIVATE";

export type TaskSortBy =
  | "taskNumber"
  | "title"
  | "status"
  | "priority"
  | "startAt"
  | "dueDate"
  | "createdAt"
  | "updatedAt";

export type SortOrder = "asc" | "desc";

/** Normalized task shape used across dashboard and task pages. */
export type TaskRecord = {
  id: string;
  workspaceId: string | null;
  taskNumber: number | null;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  startAt: string | null;
  dueDate: string | null;
  completedAt: string | null;
  completedById: string | null;
  completedByName: string | null;
  isBlocked: boolean;
  blockedReason: string | null;
  source: TaskSource | null;
  projectId: string | null;
  projectName: string | null;
  projectVisibility: ProjectVisibility | null;
  assigneeId: string | null;
  assigneeName: string | null;
  assigneeRole: string | null;
  createdById: string | null;
  createdByName: string | null;
  version: number;
  archivedAt: string | null;
  deletedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export type TaskListResult = {
  items: TaskRecord[];
  total: number;
};

export type TaskListFilters = {
  search?: string | null;
  projectId?: string | string[] | null;
  status?: TaskStatus | TaskStatus[] | null;
  priority?: TaskPriority | TaskPriority[] | null;
  assigneeId?: string | null;
  createdById?: string | null;
  /** Phase 4 due presets, resolved server-side against `timezone`. */
  due?: "today" | "upcoming" | "overdue" | null;
  deadlineFrom?: string | null;
  deadlineTo?: string | null;
  overdue?: boolean | null;
  unassigned?: boolean | null;
  includeArchived?: boolean | null;
  includeDeleted?: boolean | null;
  timezone?: string | null;
  page?: number;
  pageSize?: number;
  sortBy?: TaskSortBy | null;
  sortOrder?: SortOrder | null;
};

export type DeleteTaskResult = {
  id: string;
  deleted: boolean;
  deletedAt: string | null;
  version?: number | null;
};

export type CreateTaskInput = {
  title: string;
  description?: string;
  priority?: TaskPriority;
  status?: TaskStatus;
  startAt?: string | null;
  dueDate?: string | null;
  projectId?: string | null;
  assigneeId?: string | null;
  isBlocked?: boolean;
  blockedReason?: string | null;
  confirmedFromQuickCapture?: boolean;
};

export type UpdateTaskInput = {
  version: number;
} & Partial<{
  title: string;
  description: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  startAt: string | null;
  dueDate: string | null;
  projectId: string | null;
  assigneeId: string | null;
  isBlocked: boolean;
  blockedReason: string | null;
}>;

export type VersionMutationInput = {
  version: number;
};

export type StatusMutationInput = VersionMutationInput & {
  status: TaskStatus;
};

export type AssigneeMutationInput = VersionMutationInput & {
  assigneeId: string | null;
};

export type BulkUpdateChanges = Partial<{
  status: TaskStatus;
  priority: TaskPriority;
  assigneeId: string | null;
  projectId: string | null;
  archived: boolean;
}>;

export type BulkUpdateItem = {
  taskId: string;
  version: number;
  changes: BulkUpdateChanges;
};

export type BulkUpdateInput = {
  items: BulkUpdateItem[];
};

export type BulkDeleteItem = {
  taskId: string;
  version: number;
};

export type BulkDeleteInput = {
  items: BulkDeleteItem[];
};

export type BulkItemResult = {
  taskId: string;
  success: boolean;
  task?: TaskRecord | null;
  error?: { code: string; message: string } | null;
};

export type BulkMutationResult = {
  results: BulkItemResult[];
};

export type TaskActivityEvent = {
  id: string;
  action: string | null;
  summary: string;
  actorName: string | null;
  createdAt: string | null;
};

export type TaskActivityResult = {
  items: TaskActivityEvent[];
  total: number;
  page: number;
  totalPages: number;
};

/** Draft produced by POST /tasks/parse (Smart Capture). */
export type TaskDraft = {
  title: string;
  description: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  dueDate: string | null;
  startAt: string | null;
  projectName: string | null;
  assigneeName: string | null;
};

export type CandidateOption = {
  id: string;
  name: string;
  role?: string | null;
  /** When true, option is for a private project the user may not join freely. */
  restricted?: boolean;
  /** Optional status; inactive members should be excluded from pickers. */
  status?: string | null;
};

export type ParseTaskResult = {
  draft: TaskDraft;
  missingFields: string[];
  ambiguities: string[];
  projectCandidates: CandidateOption[];
  assigneeCandidates: CandidateOption[];
};

export type ParseTaskInput = {
  text: string;
  locale: string;
  timezone: string;
  referenceDate: string;
};

export type ProjectMemberSummary = {
  id: string;
  userId: string;
  fullName: string;
  email: string | null;
  roleKey: string | null;
  status: string | null;
};

export type ProjectRecord = {
  id: string;
  name: string;
  description: string | null;
  status: string;
  visibility: ProjectVisibility | null;
  createdById: string | null;
  memberIds: string[];
  members: ProjectMemberSummary[];
  createdAt: string | null;
  updatedAt: string | null;
  /** Optional task counts, when the backend includes them. */
  openTasks: number | null;
  totalTasks: number | null;
};

export type CreateProjectInput = {
  name: string;
  description?: string;
  visibility?: ProjectVisibility;
  memberIds?: string[];
};

export type UpdateProjectInput = {
  name?: string;
  description?: string | null;
  visibility?: ProjectVisibility;
  memberIds?: string[];
};

/** URL / filter-bar state for My Tasks (serializable). */
export type TaskFilterState = {
  search: string;
  projectId: string | null;
  statuses: TaskStatus[];
  priorities: TaskPriority[];
  assigneeId: string | null;
  createdById: string | null;
  due: "today" | "upcoming" | "overdue" | null;
  deadlineFrom: string | null;
  deadlineTo: string | null;
  overdue: boolean;
  unassigned: boolean;
  includeArchived: boolean;
  includeDeleted: boolean;
  sortBy: TaskSortBy;
  sortOrder: SortOrder;
  page: number;
};

/** Discoverable My Tasks list presets (URL-serializable). */
export type TaskListViewPreset = "active" | "archived" | "trash";

