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
  | "updatedAt"
  | "rank";

export type SortOrder = "asc" | "desc";

/** My Tasks visualization mode (URL `view=`). */
export type TaskViewMode = "list" | "board" | "calendar" | "timeline";

export type CalendarMode = "month" | "week";

export type TimelineZoom = "day" | "week" | "month";

export type TimelineGroupBy = "project" | "assignee";

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
  /** Lexorank string used by board ordering. */
  rank: string | null;
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

/** URL display state for My Tasks views (serializable, F5-safe). */
export type TaskViewUrlState = {
  view: TaskViewMode;
  calMode: CalendarMode;
  tlZoom: TimelineZoom;
  groupBy: TimelineGroupBy;
};

export type MoveTaskInput = {
  targetStatus: TaskStatus;
  beforeTaskId?: string | null;
  afterTaskId?: string | null;
  version: number;
};

export type CalendarTasksResult = {
  items: TaskRecord[];
  total: number;
  unscheduledCount: number;
  timezone: string | null;
  from: string | null;
  to: string | null;
};

export type TimelineGroup = {
  id: string;
  label: string;
  items: TaskRecord[];
};

export type TimelineTasksResult = {
  groups: TimelineGroup[];
  total: number;
  timezone: string | null;
  from: string | null;
  to: string | null;
  groupBy: TimelineGroupBy;
};

export type SavedViewType = "LIST" | "BOARD" | "CALENDAR" | "TIMELINE";

export type SavedViewFiltersJson = {
  search?: string;
  projectId?: string | null;
  statuses?: TaskStatus[];
  priorities?: TaskPriority[];
  assigneeId?: string | null;
  createdById?: string | null;
  due?: "today" | "upcoming" | "overdue" | null;
  deadlineFrom?: string | null;
  deadlineTo?: string | null;
  overdue?: boolean;
  unassigned?: boolean;
  includeArchived?: boolean;
  includeDeleted?: boolean;
};

export type SavedViewSortJson = {
  sortBy?: TaskSortBy;
  sortOrder?: SortOrder;
};

export type SavedViewGroupByJson = {
  groupBy?: TimelineGroupBy | "none";
};

export type SavedViewDisplayOptionsJson = {
  view?: TaskViewMode;
  calMode?: CalendarMode;
  tlZoom?: TimelineZoom;
  dense?: boolean;
};

export type SavedViewRecord = {
  id: string;
  workspaceId: string;
  ownerUserId: string;
  name: string;
  resourceType: string;
  viewType: SavedViewType;
  visibility: string;
  filtersJson: SavedViewFiltersJson;
  sortJson: SavedViewSortJson;
  groupByJson: SavedViewGroupByJson;
  columnsJson: string[];
  displayOptionsJson: SavedViewDisplayOptionsJson;
  configVersion: number;
  isDefault: boolean;
  createdAt: string | null;
  updatedAt: string | null;
};

export type CreateSavedViewInput = {
  name: string;
  viewType?: SavedViewType;
  filtersJson?: SavedViewFiltersJson;
  sortJson?: SavedViewSortJson;
  groupByJson?: SavedViewGroupByJson;
  columnsJson?: string[];
  displayOptionsJson?: SavedViewDisplayOptionsJson;
  isDefault?: boolean;
};

export type UpdateSavedViewInput = Partial<CreateSavedViewInput>;

export type ExportColumn =
  | "taskNumber"
  | "title"
  | "status"
  | "priority"
  | "project"
  | "assignee"
  | "creator"
  | "startAt"
  | "dueDate"
  | "completedAt"
  | "createdAt"
  | "updatedAt";

export type ExportTasksInput = {
  format: "csv" | "xlsx";
  scope?: "filters" | "selected";
  selectedIds?: string[];
  columns?: ExportColumn[];
  timezone?: string;
  dateFormat?: "iso" | "locale";
  filters?: {
    projectId?: string[];
    assigneeId?: string;
    createdById?: string;
    status?: TaskStatus[];
    priority?: TaskPriority[];
    due?: "today" | "upcoming" | "overdue";
    deadlineFrom?: string;
    deadlineTo?: string;
    overdue?: boolean;
    unassigned?: boolean;
    includeArchived?: boolean;
    includeDeleted?: boolean;
    search?: string;
  };
};

export type ExportFileResult = {
  blob: Blob;
  filename: string;
  contentType: string;
  rowCount: number | null;
};

/** Soft cap mirrored from backend EXPORT_ROW_LIMIT. */
export const EXPORT_ROW_LIMIT = 5000;

