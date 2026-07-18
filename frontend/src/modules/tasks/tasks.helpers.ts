import type { BadgeTone } from "@/modules/design-system";
import {
  asBoolean,
  asNonEmptyString,
  asNumber,
  asRecord,
  asStringArray,
  pick,
} from "@/lib/api/coerce";
import type {
  BulkItemResult,
  BulkMutationResult,
  CalendarMode,
  CalendarTasksResult,
  CandidateOption,
  DeleteTaskResult,
  ExportTasksInput,
  ParseTaskResult,
  ProjectMemberSummary,
  ProjectRecord,
  ProjectVisibility,
  SavedViewDisplayOptionsJson,
  SavedViewFiltersJson,
  SavedViewGroupByJson,
  SavedViewRecord,
  SavedViewSortJson,
  SavedViewType,
  SortOrder,
  TaskActivityEvent,
  TaskActivityResult,
  TaskDraft,
  TaskFilterState,
  TaskListFilters,
  TaskListResult,
  TaskListViewPreset,
  TaskPriority,
  TaskRecord,
  TaskSortBy,
  TaskStatus,
  TaskViewMode,
  TaskViewUrlState,
  TimelineGroup,
  TimelineGroupBy,
  TimelineTasksResult,
  TimelineZoom,
} from "./tasks.types";

/**
 * Mirrors backend WORKSPACE_SCOPE_ROLES (backend/src/lib/task-scope.ts):
 * roles that can see and filter across all workspace tasks. Everyone else
 * (member) is limited to tasks they created or are assigned to.
 */
export const WORKSPACE_TASK_SCOPE_ROLES = ["owner", "admin", "manager"];

export function hasWorkspaceTaskScope(
  roleKey: string | null | undefined,
): boolean {
  return roleKey != null && WORKSPACE_TASK_SCOPE_ROLES.includes(roleKey);
}

/**
 * Owners/admins/managers may assign to others. Members have `tasks:assign`
 * but the service only allows self-assign — mirror that in the UI.
 */
export function canAssignToOtherMembers(
  roleKey: string | null | undefined,
): boolean {
  return hasWorkspaceTaskScope(roleKey);
}

/**
 * Mirrors backend assertCanMutateTask: workspace-scope roles may mutate any
 * visible task; members may only mutate tasks they created or are assigned to.
 */
export function canMutateTask(
  roleKey: string | null | undefined,
  userId: string | null | undefined,
  task: Pick<TaskRecord, "assigneeId" | "createdById">,
): boolean {
  if (hasWorkspaceTaskScope(roleKey)) {
    return true;
  }

  if (!userId) {
    return false;
  }

  return task.assigneeId === userId || task.createdById === userId;
}

export function initialsFromName(name: string): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length === 0) {
    return "?";
  }

  if (parts.length === 1) {
    return parts[0]!.slice(0, 2).toUpperCase();
  }

  const first = parts[0]![0] ?? "";
  const last = parts[parts.length - 1]![0] ?? "";
  return `${first}${last}`.toUpperCase();
}

export function isActiveMemberStatus(status: string | null | undefined): boolean {
  if (!status) {
    return true;
  }

  return status.toUpperCase() === "ACTIVE";
}

/**
 * Eligible assignees for a task: ACTIVE workspace members, narrowed to
 * project members when the selected project is PRIVATE.
 */
export function filterEligibleAssignees(
  workspaceMembers: CandidateOption[],
  options: {
    projectVisibility?: ProjectVisibility | null;
    projectMemberIds?: readonly string[] | null;
    projectMembers?: CandidateOption[] | null;
  } = {},
): CandidateOption[] {
  const active = workspaceMembers.filter((member) =>
    isActiveMemberStatus(member.status),
  );

  if (options.projectVisibility !== "PRIVATE") {
    return active;
  }

  if (options.projectMembers && options.projectMembers.length > 0) {
    return options.projectMembers.filter((member) =>
      isActiveMemberStatus(member.status),
    );
  }

  const allowed = new Set(options.projectMemberIds ?? []);
  if (allowed.size === 0) {
    return [];
  }

  return active.filter((member) => allowed.has(member.id));
}

export function projectMembersToCandidates(
  members: ProjectMemberSummary[],
): CandidateOption[] {
  return members
    .filter((member) => isActiveMemberStatus(member.status))
    .map((member) => ({
      id: member.userId,
      name: member.fullName,
      role: member.roleKey,
      status: member.status ?? "ACTIVE",
    }));
}

export function canManagePrivateProjectMembers(options: {
  roleKey: string | null | undefined;
  project: Pick<ProjectRecord, "visibility" | "createdById">;
  userId: string | null | undefined;
}): boolean {
  if (options.project.visibility !== "PRIVATE") {
    return false;
  }

  const privileged =
    options.roleKey === "owner" || options.roleKey === "admin";
  const isCreator =
    options.project.createdById != null &&
    options.project.createdById === options.userId;

  return privileged || isCreator;
}

export function resolveTaskListViewPreset(
  state: Pick<TaskFilterState, "includeArchived" | "includeDeleted">,
): TaskListViewPreset {
  if (state.includeDeleted) {
    return "trash";
  }

  if (state.includeArchived) {
    return "archived";
  }

  return "active";
}

export function taskListViewPresetToFilterPatch(
  preset: TaskListViewPreset,
): Partial<TaskFilterState> {
  switch (preset) {
    case "trash":
      return { includeDeleted: true, includeArchived: false, page: 1 };
    case "archived":
      return { includeArchived: true, includeDeleted: false, page: 1 };
    default:
      return { includeArchived: false, includeDeleted: false, page: 1 };
  }
}

export const TASK_STATUSES: TaskStatus[] = [
  "TODO",
  "IN_PROGRESS",
  "IN_REVIEW",
  "BLOCKED",
  "DONE",
  "CANCELLED",
];

export const TASK_PRIORITIES: TaskPriority[] = [
  "LOW",
  "MEDIUM",
  "HIGH",
  "URGENT",
];

export const TASK_SORT_FIELDS: TaskSortBy[] = [
  "taskNumber",
  "title",
  "status",
  "priority",
  "startAt",
  "dueDate",
  "createdAt",
  "updatedAt",
  "rank",
];

export const TASK_SORT_LABELS: Record<TaskSortBy, string> = {
  taskNumber: "Task #",
  title: "Title",
  status: "Status",
  priority: "Priority",
  startAt: "Start date",
  dueDate: "Deadline",
  createdAt: "Created",
  updatedAt: "Updated",
  rank: "Board order",
};

export const TASK_VIEW_MODES: TaskViewMode[] = [
  "list",
  "board",
  "calendar",
  "timeline",
];

export const TASK_VIEW_MODE_LABELS: Record<TaskViewMode, string> = {
  list: "List",
  board: "Board",
  calendar: "Calendar",
  timeline: "Timeline",
};

export const DEFAULT_TASK_VIEW_URL_STATE: TaskViewUrlState = {
  view: "list",
  calMode: "month",
  tlZoom: "week",
  groupBy: "project",
};

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  TODO: "To do",
  IN_PROGRESS: "In progress",
  IN_REVIEW: "In review",
  BLOCKED: "Blocked",
  DONE: "Done",
  CANCELLED: "Cancelled",
};

export const TASK_STATUS_TONES: Record<TaskStatus, BadgeTone> = {
  TODO: "neutral",
  IN_PROGRESS: "primary",
  IN_REVIEW: "primary",
  BLOCKED: "danger",
  DONE: "success",
  CANCELLED: "warning",
};

export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  URGENT: "Urgent",
};

export const TASK_PRIORITY_TONES: Record<TaskPriority, BadgeTone> = {
  LOW: "neutral",
  MEDIUM: "primary",
  HIGH: "warning",
  URGENT: "danger",
};

export const DEFAULT_TASK_FILTER_STATE: TaskFilterState = {
  search: "",
  projectId: null,
  statuses: [],
  priorities: [],
  assigneeId: null,
  createdById: null,
  due: null,
  deadlineFrom: null,
  deadlineTo: null,
  overdue: false,
  unassigned: false,
  includeArchived: false,
  includeDeleted: false,
  tagIds: [],
  sortBy: "createdAt",
  sortOrder: "desc",
  page: 1,
};

export function normalizeTaskStatus(value: unknown): TaskStatus | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toUpperCase().replace(/[\s-]+/g, "_");
  return (TASK_STATUSES as string[]).includes(normalized)
    ? (normalized as TaskStatus)
    : null;
}

export function normalizeTaskPriority(value: unknown): TaskPriority | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toUpperCase();
  return (TASK_PRIORITIES as string[]).includes(normalized)
    ? (normalized as TaskPriority)
    : null;
}

export function normalizeTaskSortBy(value: unknown): TaskSortBy | null {
  if (typeof value !== "string") {
    return null;
  }

  return (TASK_SORT_FIELDS as string[]).includes(value)
    ? (value as TaskSortBy)
    : null;
}

export function normalizeSortOrder(value: unknown): SortOrder | null {
  if (value === "asc" || value === "desc") {
    return value;
  }

  return null;
}

function normalizeProjectVisibility(value: unknown): ProjectVisibility | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toUpperCase();
  return normalized === "WORKSPACE" || normalized === "PRIVATE"
    ? normalized
    : null;
}

function mapPersonName(person: Record<string, unknown> | null): string | null {
  if (!person) {
    return null;
  }

  return (
    pick(person, ["fullName", "name"], asNonEmptyString) ??
    pick(person, ["email"], asNonEmptyString)
  );
}

/**
 * Maps a raw API task into a TaskRecord. Tolerates nested project/assignee
 * objects as well as flattened *_Name fields; returns null when the payload
 * has no usable id or title.
 */
export function mapTask(raw: unknown): TaskRecord | null {
  const record = asRecord(raw);

  if (!record) {
    return null;
  }

  const id = pick(record, ["id", "taskId"], asNonEmptyString);
  const title = pick(record, ["title", "name"], asNonEmptyString);

  if (!id || !title) {
    return null;
  }

  const project = asRecord(record.project);
  const assignee = asRecord(record.assignee);
  const creator = asRecord(record.creator) ?? asRecord(record.createdBy);
  const completedBy = asRecord(record.completedBy);

  return {
    id,
    workspaceId: pick(record, ["workspaceId"], asNonEmptyString),
    taskNumber: pick(record, ["taskNumber", "number"], asNumber),
    title,
    description: pick(record, ["description"], asNonEmptyString),
    status: normalizeTaskStatus(record.status) ?? "TODO",
    priority: normalizeTaskPriority(record.priority) ?? "MEDIUM",
    startAt: pick(record, ["startAt", "start_at"], asNonEmptyString),
    dueDate: pick(record, ["dueDate", "due_date", "dueAt"], asNonEmptyString),
    completedAt: pick(
      record,
      ["completedAt", "completed_at"],
      asNonEmptyString,
    ),
    completedById:
      pick(record, ["completedById"], asNonEmptyString) ??
      pick(completedBy, ["id", "userId"], asNonEmptyString),
    completedByName:
      pick(record, ["completedByName"], asNonEmptyString) ??
      mapPersonName(completedBy),
    isBlocked:
      asBoolean(record.isBlocked) ??
      normalizeTaskStatus(record.status) === "BLOCKED",
    blockedReason: pick(record, ["blockedReason"], asNonEmptyString),
    source: pick(record, ["source"], asNonEmptyString),
    projectId:
      pick(record, ["projectId"], asNonEmptyString) ??
      pick(project, ["id"], asNonEmptyString),
    projectName:
      pick(record, ["projectName"], asNonEmptyString) ??
      pick(project, ["name"], asNonEmptyString),
    projectVisibility:
      normalizeProjectVisibility(record.projectVisibility) ??
      normalizeProjectVisibility(project?.visibility),
    assigneeId:
      pick(record, ["assigneeId"], asNonEmptyString) ??
      pick(assignee, ["id", "userId"], asNonEmptyString),
    assigneeName:
      pick(record, ["assigneeName"], asNonEmptyString) ??
      mapPersonName(assignee),
    assigneeRole:
      pick(record, ["assigneeRole", "assigneeRoleKey"], asNonEmptyString) ??
      pick(assignee, ["role", "roleKey"], asNonEmptyString),
    createdById:
      pick(record, ["createdById", "creatorId"], asNonEmptyString) ??
      pick(creator, ["id", "userId"], asNonEmptyString),
    createdByName:
      pick(record, ["createdByName", "creatorName"], asNonEmptyString) ??
      mapPersonName(creator),
    rank: pick(record, ["rank"], asNonEmptyString),
    version: pick(record, ["version"], asNumber) ?? 1,
    archivedAt: pick(record, ["archivedAt"], asNonEmptyString),
    deletedAt: pick(record, ["deletedAt"], asNonEmptyString),
    createdAt: pick(record, ["createdAt"], asNonEmptyString),
    updatedAt: pick(record, ["updatedAt"], asNonEmptyString),
  };
}

/**
 * Maps a list payload that may be a bare array or an {items,total} object,
 * with the total optionally living in pagination meta.
 */
export function mapTaskList(data: unknown, meta?: unknown): TaskListResult {
  const record = asRecord(data);
  const rawItems = Array.isArray(data)
    ? data
    : (record?.items ?? record?.tasks ?? record?.data);

  const items = (Array.isArray(rawItems) ? rawItems : [])
    .map(mapTask)
    .filter((task): task is TaskRecord => task !== null);

  const metaRecord = asRecord(meta);
  const pagination = asRecord(metaRecord?.pagination) ?? asRecord(record?.pagination);

  const total =
    pick(record, ["total", "totalCount"], asNumber) ??
    pick(pagination, ["total"], asNumber) ??
    pick(metaRecord, ["total"], asNumber) ??
    items.length;

  return { items, total };
}

/**
 * Maps a DELETE task response ({ id, deleted, deletedAt }); tolerates empty
 * bodies by assuming the delete succeeded for the requested task.
 */
export function mapDeleteTaskResult(
  raw: unknown,
  taskId: string,
): DeleteTaskResult {
  const record = asRecord(raw);
  const mapped = mapTask(raw);

  return {
    id: pick(record, ["id", "taskId"], asNonEmptyString) ?? taskId,
    deleted: asBoolean(record?.deleted) ?? true,
    deletedAt:
      pick(record, ["deletedAt"], asNonEmptyString) ??
      mapped?.deletedAt ??
      null,
    version: pick(record, ["version"], asNumber) ?? mapped?.version ?? null,
  };
}

function mapProjectMemberSummary(raw: unknown): ProjectMemberSummary | null {
  const record = asRecord(raw);

  if (!record) {
    return null;
  }

  const user = asRecord(record.user);
  const role = asRecord(record.role) ?? asRecord(user?.role);
  const userId =
    pick(record, ["userId"], asNonEmptyString) ??
    pick(user, ["id", "userId"], asNonEmptyString);
  const fullName =
    pick(record, ["fullName", "name"], asNonEmptyString) ??
    pick(user, ["fullName", "name"], asNonEmptyString);
  const email =
    pick(record, ["email"], asNonEmptyString) ??
    pick(user, ["email"], asNonEmptyString);

  if (!userId || !fullName) {
    return null;
  }

  const status =
    pick(record, ["status", "memberStatus"], asNonEmptyString) ??
    pick(user, ["status"], asNonEmptyString);

  return {
    id:
      pick(record, ["id", "membershipId"], asNonEmptyString) ??
      `${userId}`,
    userId,
    fullName,
    email,
    roleKey:
      pick(record, ["roleKey", "role"], asNonEmptyString) ??
      pick(role, ["key", "name"], asNonEmptyString),
    status,
  };
}

export function mapProjectMemberList(data: unknown): ProjectMemberSummary[] {
  const record = asRecord(data);
  const rawItems = Array.isArray(data)
    ? data
    : (record?.items ?? record?.members ?? record?.data);

  return (Array.isArray(rawItems) ? rawItems : [])
    .map(mapProjectMemberSummary)
    .filter((member): member is ProjectMemberSummary => member !== null)
    .filter((member) => {
      const status = member.status?.toUpperCase();
      return !status || status === "ACTIVE";
    });
}

export function mapProject(raw: unknown): ProjectRecord | null {
  const record = asRecord(raw);

  if (!record) {
    return null;
  }

  const id = pick(record, ["id", "projectId"], asNonEmptyString);
  const name = pick(record, ["name", "projectName"], asNonEmptyString);

  if (!id || !name) {
    return null;
  }

  const counts = asRecord(record._count) ?? asRecord(record.counts);
  const members = mapProjectMemberList(
    record.members ?? record.memberSummaries ?? [],
  );
  const memberIdsFromField = Array.isArray(record.memberIds)
    ? record.memberIds.filter((value): value is string => typeof value === "string")
    : [];
  const memberIds =
    memberIdsFromField.length > 0
      ? memberIdsFromField
      : members.map((member) => member.userId);

  return {
    id,
    name,
    description: pick(record, ["description"], asNonEmptyString),
    status: pick(record, ["status"], asNonEmptyString) ?? "ACTIVE",
    visibility: normalizeProjectVisibility(record.visibility),
    createdById: pick(record, ["createdById", "creatorId"], asNonEmptyString),
    memberIds,
    members,
    createdAt: pick(record, ["createdAt"], asNonEmptyString),
    updatedAt: pick(record, ["updatedAt"], asNonEmptyString),
    openTasks:
      pick(record, ["openTasks", "openTaskCount"], asNumber) ??
      pick(counts, ["openTasks"], asNumber),
    totalTasks:
      pick(record, ["totalTasks", "taskCount"], asNumber) ??
      pick(counts, ["tasks", "totalTasks"], asNumber),
  };
}

export function mapProjectList(data: unknown): ProjectRecord[] {
  const record = asRecord(data);
  const rawItems = Array.isArray(data)
    ? data
    : (record?.items ?? record?.projects ?? record?.data);

  return (Array.isArray(rawItems) ? rawItems : [])
    .map(mapProject)
    .filter((project): project is ProjectRecord => project !== null);
}

function mapCandidate(raw: unknown): CandidateOption | null {
  const record = asRecord(raw);

  if (!record) {
    return null;
  }

  const id = pick(record, ["id", "userId", "memberId"], asNonEmptyString);
  const name = pick(record, ["name", "fullName"], asNonEmptyString);
  const email = pick(record, ["email"], asNonEmptyString);
  const role = pick(record, ["role", "roleKey"], asNonEmptyString);
  const roleRecord = asRecord(record.role);

  if (!id || (!name && !email)) {
    return null;
  }

  return {
    id,
    name: name && email ? `${name} (${email})` : (name ?? email ?? id),
    role: role ?? pick(roleRecord, ["key", "name"], asNonEmptyString),
    restricted: asBoolean(record.restricted) ?? undefined,
  };
}

export function mapCandidates(raw: unknown): CandidateOption[] {
  return (Array.isArray(raw) ? raw : [])
    .map(mapCandidate)
    .filter((candidate): candidate is CandidateOption => candidate !== null);
}

/** Maps a POST /tasks/parse payload; returns null if no usable draft title. */
export function mapParseResult(data: unknown): ParseTaskResult | null {
  const record = asRecord(data);
  const draftRecord = asRecord(record?.draft) ?? record;
  const title = pick(draftRecord, ["title"], asNonEmptyString);

  if (!title) {
    return null;
  }

  const draft: TaskDraft = {
    title,
    description: pick(draftRecord, ["description"], asNonEmptyString),
    priority: normalizeTaskPriority(draftRecord?.priority) ?? "MEDIUM",
    status: normalizeTaskStatus(draftRecord?.status) ?? "TODO",
    dueDate: pick(draftRecord, ["dueDate", "due_date"], asNonEmptyString),
    startAt: pick(draftRecord, ["startAt", "start_at"], asNonEmptyString),
    projectName: pick(draftRecord, ["projectName"], asNonEmptyString),
    assigneeName: pick(draftRecord, ["assigneeName"], asNonEmptyString),
  };

  return {
    draft,
    missingFields: asStringArray(record?.missingFields),
    ambiguities: asStringArray(record?.ambiguities),
    projectCandidates: mapCandidates(record?.projectCandidates),
    assigneeCandidates: mapCandidates(record?.assigneeCandidates),
  };
}

export function mapTaskActivityEvent(raw: unknown): TaskActivityEvent | null {
  const record = asRecord(raw);

  if (!record) {
    return null;
  }

  const id = pick(record, ["id"], asNonEmptyString);
  const actor = asRecord(record.actor);
  const summary =
    pick(record, ["summary", "message"], asNonEmptyString) ??
    pick(record, ["action"], asNonEmptyString);

  if (!id || !summary) {
    return null;
  }

  return {
    id,
    action: pick(record, ["action"], asNonEmptyString),
    summary,
    actorName:
      pick(record, ["actorName"], asNonEmptyString) ??
      mapPersonName(actor),
    createdAt: pick(record, ["createdAt"], asNonEmptyString),
  };
}

export function mapTaskActivityList(
  data: unknown,
  meta?: unknown,
): TaskActivityResult {
  const record = asRecord(data);
  const rawItems = Array.isArray(data)
    ? data
    : (record?.items ?? record?.events ?? record?.data);

  const items = (Array.isArray(rawItems) ? rawItems : [])
    .map(mapTaskActivityEvent)
    .filter((event): event is TaskActivityEvent => event !== null);

  const metaRecord = asRecord(meta);
  const pagination =
    asRecord(metaRecord?.pagination) ?? asRecord(record?.pagination);

  return {
    items,
    total:
      pick(pagination, ["total"], asNumber) ??
      pick(record, ["total"], asNumber) ??
      items.length,
    page:
      pick(pagination, ["page"], asNumber) ??
      pick(record, ["page"], asNumber) ??
      1,
    totalPages:
      pick(pagination, ["totalPages"], asNumber) ??
      pick(record, ["totalPages"], asNumber) ??
      1,
  };
}

function mapBulkItemResult(raw: unknown): BulkItemResult | null {
  const record = asRecord(raw);

  if (!record) {
    return null;
  }

  const taskId = pick(record, ["taskId", "id"], asNonEmptyString);

  if (!taskId) {
    return null;
  }

  const error = asRecord(record.error);
  const success = asBoolean(record.success) ?? !error;

  return {
    taskId,
    success,
    task: mapTask(record.task),
    error: error
      ? {
          code: pick(error, ["code"], asNonEmptyString) ?? "UNKNOWN",
          message:
            pick(error, ["message"], asNonEmptyString) ?? "Request failed",
        }
      : null,
  };
}

export function mapBulkMutationResult(data: unknown): BulkMutationResult {
  const record = asRecord(data);
  const rawItems = Array.isArray(data)
    ? data
    : (record?.results ?? record?.items ?? record?.data);

  const results = (Array.isArray(rawItems) ? rawItems : [])
    .map(mapBulkItemResult)
    .filter((item): item is BulkItemResult => item !== null);

  return { results };
}

export function isConflictError(code: string | null | undefined): boolean {
  return code === "CONFLICT" || code === "VERSION_CONFLICT";
}

/** Validates due >= start when both are set. */
export function validateTaskDates(
  startAt: string | null | undefined,
  dueDate: string | null | undefined,
): string | null {
  if (!startAt || !dueDate) {
    return null;
  }

  const start = new Date(startAt);
  const due = new Date(dueDate);

  if (Number.isNaN(start.getTime()) || Number.isNaN(due.getTime())) {
    return null;
  }

  if (due.getTime() < start.getTime()) {
    return "Deadline must be on or after the start date.";
  }

  return null;
}

/** Warns when a due date is before today (open tasks). */
export function pastDueWarning(
  dueDate: string | null | undefined,
  now: Date = new Date(),
): string | null {
  if (!dueDate) {
    return null;
  }

  const due = parseDate(dueDate);

  if (!due) {
    return null;
  }

  if (startOfDay(due).getTime() < startOfDay(now).getTime()) {
    return "This deadline is in the past.";
  }

  return null;
}

function parseMultiParam(
  params: URLSearchParams,
  key: string,
): string[] {
  const all = params.getAll(key);
  if (all.length > 0) {
    return all.flatMap((value) => value.split(",")).map((v) => v.trim()).filter(Boolean);
  }

  const single = params.get(key);
  if (!single) {
    return [];
  }

  return single
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function parseDueParam(
  value: string | null,
): TaskFilterState["due"] {
  return value === "today" || value === "upcoming" || value === "overdue"
    ? value
    : null;
}

function parseBooleanParam(value: string | null): boolean {
  return value === "1" || value === "true" || value === "yes";
}

/** Parses My Tasks URL search params into filter state. */
export function parseTaskFilterState(
  params: URLSearchParams,
): TaskFilterState {
  const statuses = parseMultiParam(params, "status")
    .map(normalizeTaskStatus)
    .filter((status): status is TaskStatus => status !== null);

  const priorities = parseMultiParam(params, "priority")
    .map(normalizeTaskPriority)
    .filter((priority): priority is TaskPriority => priority !== null);

  return {
    search: params.get("q") ?? "",
    projectId: params.get("projectId"),
    statuses,
    priorities,
    assigneeId: params.get("assigneeId"),
    createdById: params.get("createdById") ?? params.get("creatorId"),
    due: parseDueParam(params.get("due")),
    deadlineFrom: params.get("deadlineFrom"),
    deadlineTo: params.get("deadlineTo"),
    overdue: parseBooleanParam(params.get("overdue")),
    unassigned: parseBooleanParam(params.get("unassigned")),
    includeArchived: parseBooleanParam(
      params.get("includeArchived") ?? params.get("archived"),
    ),
    includeDeleted: parseBooleanParam(
      params.get("includeDeleted") ?? params.get("deleted"),
    ),
    tagIds: parseMultiParam(params, "tagId"),
    sortBy: normalizeTaskSortBy(params.get("sortBy")) ?? "createdAt",
    sortOrder: normalizeSortOrder(params.get("sortOrder")) ?? "desc",
    page: Math.max(1, Number(params.get("page")) || 1),
  };
}

/**
 * Serializes filter state to URL search params (null = clear). Only includes
 * non-default values so Phase 4 drill-down links stay short.
 */
export function serializeTaskFilterState(
  state: Partial<TaskFilterState>,
  current?: URLSearchParams,
): URLSearchParams {
  const next = new URLSearchParams(current?.toString() ?? "");

  const setOrDelete = (key: string, value: string | null | undefined) => {
    if (value === null || value === undefined || value === "") {
      next.delete(key);
    } else {
      next.set(key, value);
    }
  };

  if ("search" in state) {
    setOrDelete("q", state.search?.trim() || null);
  }

  if ("projectId" in state) {
    setOrDelete("projectId", state.projectId);
  }

  if ("statuses" in state) {
    next.delete("status");
    for (const status of state.statuses ?? []) {
      next.append("status", status);
    }
  }

  if ("priorities" in state) {
    next.delete("priority");
    for (const priority of state.priorities ?? []) {
      next.append("priority", priority);
    }
  }

  if ("assigneeId" in state) {
    setOrDelete("assigneeId", state.assigneeId);
  }

  if ("createdById" in state) {
    next.delete("creatorId");
    setOrDelete("createdById", state.createdById);
  }

  if ("due" in state) {
    setOrDelete("due", state.due);
  }

  if ("deadlineFrom" in state) {
    setOrDelete("deadlineFrom", state.deadlineFrom);
  }

  if ("deadlineTo" in state) {
    setOrDelete("deadlineTo", state.deadlineTo);
  }

  if ("overdue" in state) {
    setOrDelete("overdue", state.overdue ? "true" : null);
  }

  if ("unassigned" in state) {
    setOrDelete("unassigned", state.unassigned ? "true" : null);
  }

  if ("includeArchived" in state) {
    next.delete("archived");
    setOrDelete("includeArchived", state.includeArchived ? "true" : null);
  }

  if ("includeDeleted" in state) {
    next.delete("deleted");
    setOrDelete("includeDeleted", state.includeDeleted ? "true" : null);
  }

  if ("tagIds" in state) {
    next.delete("tagId");
    for (const tagId of state.tagIds ?? []) {
      next.append("tagId", tagId);
    }
  }

  if ("sortBy" in state) {
    setOrDelete(
      "sortBy",
      state.sortBy && state.sortBy !== "createdAt" ? state.sortBy : null,
    );
  }

  if ("sortOrder" in state) {
    setOrDelete(
      "sortOrder",
      state.sortOrder && state.sortOrder !== "desc" ? state.sortOrder : null,
    );
  }

  if ("page" in state) {
    setOrDelete(
      "page",
      state.page && state.page > 1 ? String(state.page) : null,
    );
  }

  return next;
}

export function normalizeTaskViewMode(value: unknown): TaskViewMode | null {
  if (typeof value !== "string") {
    return null;
  }

  return (TASK_VIEW_MODES as string[]).includes(value)
    ? (value as TaskViewMode)
    : null;
}

export function normalizeCalendarMode(value: unknown): CalendarMode | null {
  return value === "month" || value === "week" ? value : null;
}

export function normalizeTimelineZoom(value: unknown): TimelineZoom | null {
  return value === "day" || value === "week" || value === "month" ? value : null;
}

export function normalizeTimelineGroupBy(
  value: unknown,
): TimelineGroupBy | null {
  return value === "project" || value === "assignee" ? value : null;
}

/** Parses My Tasks view URL params (view / calMode / tlZoom / groupBy). */
export function parseTaskViewUrlState(
  params: URLSearchParams,
): TaskViewUrlState {
  return {
    view: normalizeTaskViewMode(params.get("view")) ?? "list",
    calMode: normalizeCalendarMode(params.get("calMode")) ?? "month",
    tlZoom: normalizeTimelineZoom(params.get("tlZoom")) ?? "week",
    groupBy: normalizeTimelineGroupBy(params.get("groupBy")) ?? "project",
  };
}

/**
 * Serializes view display state into URL search params. Only non-default
 * values are written so list view URLs stay short.
 */
export function serializeTaskViewUrlState(
  state: Partial<TaskViewUrlState>,
  current?: URLSearchParams,
): URLSearchParams {
  const next = new URLSearchParams(current?.toString() ?? "");

  const setOrDelete = (key: string, value: string | null | undefined) => {
    if (value === null || value === undefined || value === "") {
      next.delete(key);
    } else {
      next.set(key, value);
    }
  };

  if ("view" in state) {
    setOrDelete(
      "view",
      state.view && state.view !== "list" ? state.view : null,
    );
  }

  if ("calMode" in state) {
    setOrDelete(
      "calMode",
      state.calMode && state.calMode !== "month" ? state.calMode : null,
    );
  }

  if ("tlZoom" in state) {
    setOrDelete(
      "tlZoom",
      state.tlZoom && state.tlZoom !== "week" ? state.tlZoom : null,
    );
  }

  if ("groupBy" in state) {
    setOrDelete(
      "groupBy",
      state.groupBy && state.groupBy !== "project" ? state.groupBy : null,
    );
  }

  return next;
}

/** Merges filter + view URL state into a single query string. */
export function serializeTaskPageUrlState(
  filters: Partial<TaskFilterState>,
  view: Partial<TaskViewUrlState>,
  current?: URLSearchParams,
): URLSearchParams {
  return serializeTaskViewUrlState(
    view,
    serializeTaskFilterState(filters, current),
  );
}

function normalizeSavedViewType(value: unknown): SavedViewType {
  if (
    value === "LIST" ||
    value === "BOARD" ||
    value === "CALENDAR" ||
    value === "TIMELINE"
  ) {
    return value;
  }

  return "LIST";
}

function asFiltersJson(raw: unknown): SavedViewFiltersJson {
  const record = asRecord(raw);
  if (!record) {
    return {};
  }

  const statuses = Array.isArray(record.statuses)
    ? record.statuses
        .map(normalizeTaskStatus)
        .filter((status): status is TaskStatus => status !== null)
    : undefined;
  const priorities = Array.isArray(record.priorities)
    ? record.priorities
        .map(normalizeTaskPriority)
        .filter((priority): priority is TaskPriority => priority !== null)
    : undefined;

  return {
    search: pick(record, ["search"], asNonEmptyString) ?? undefined,
    projectId: pick(record, ["projectId"], asNonEmptyString) ?? null,
    statuses,
    priorities,
    assigneeId: pick(record, ["assigneeId"], asNonEmptyString) ?? null,
    createdById: pick(record, ["createdById"], asNonEmptyString) ?? null,
    due: parseDueParam(
      typeof record.due === "string" ? record.due : null,
    ),
    deadlineFrom: pick(record, ["deadlineFrom"], asNonEmptyString) ?? null,
    deadlineTo: pick(record, ["deadlineTo"], asNonEmptyString) ?? null,
    overdue: asBoolean(record.overdue) ?? undefined,
    unassigned: asBoolean(record.unassigned) ?? undefined,
    includeArchived: asBoolean(record.includeArchived) ?? undefined,
    includeDeleted: asBoolean(record.includeDeleted) ?? undefined,
  };
}

function asSortJson(raw: unknown): SavedViewSortJson {
  const record = asRecord(raw);
  if (!record) {
    return {};
  }

  return {
    sortBy: normalizeTaskSortBy(record.sortBy) ?? undefined,
    sortOrder: normalizeSortOrder(record.sortOrder) ?? undefined,
  };
}

function asGroupByJson(raw: unknown): SavedViewGroupByJson {
  const record = asRecord(raw);
  if (!record) {
    return {};
  }

  if (record.groupBy === "none") {
    return { groupBy: "none" };
  }

  const groupBy = normalizeTimelineGroupBy(record.groupBy);
  return groupBy ? { groupBy } : {};
}

function asDisplayOptionsJson(raw: unknown): SavedViewDisplayOptionsJson {
  const record = asRecord(raw);
  if (!record) {
    return {};
  }

  return {
    view: normalizeTaskViewMode(record.view) ?? undefined,
    calMode: normalizeCalendarMode(record.calMode) ?? undefined,
    tlZoom: normalizeTimelineZoom(record.tlZoom) ?? undefined,
    dense: asBoolean(record.dense) ?? undefined,
  };
}

export function mapSavedView(raw: unknown): SavedViewRecord | null {
  const record = asRecord(raw);
  if (!record) {
    return null;
  }

  const id = pick(record, ["id"], asNonEmptyString);
  const workspaceId = pick(record, ["workspaceId"], asNonEmptyString);
  const ownerUserId = pick(record, ["ownerUserId"], asNonEmptyString);
  const name = pick(record, ["name"], asNonEmptyString);

  if (!id || !workspaceId || !ownerUserId || !name) {
    return null;
  }

  const columnsRaw = record.columnsJson;
  const columnsJson = Array.isArray(columnsRaw)
    ? columnsRaw.filter((value): value is string => typeof value === "string")
    : [];

  return {
    id,
    workspaceId,
    ownerUserId,
    name,
    resourceType: pick(record, ["resourceType"], asNonEmptyString) ?? "TASK",
    viewType: normalizeSavedViewType(record.viewType),
    visibility: pick(record, ["visibility"], asNonEmptyString) ?? "PRIVATE",
    filtersJson: asFiltersJson(record.filtersJson),
    sortJson: asSortJson(record.sortJson),
    groupByJson: asGroupByJson(record.groupByJson),
    columnsJson,
    displayOptionsJson: asDisplayOptionsJson(record.displayOptionsJson),
    configVersion: pick(record, ["configVersion"], asNumber) ?? 1,
    isDefault: asBoolean(record.isDefault) ?? false,
    createdAt: pick(record, ["createdAt"], asNonEmptyString),
    updatedAt: pick(record, ["updatedAt"], asNonEmptyString),
  };
}

export function mapSavedViewList(data: unknown): SavedViewRecord[] {
  const record = asRecord(data);
  const rawItems = Array.isArray(data)
    ? data
    : (record?.items ?? record?.views ?? record?.data);

  return (Array.isArray(rawItems) ? rawItems : [])
    .map(mapSavedView)
    .filter((view): view is SavedViewRecord => view !== null);
}

export function mapCalendarTasksResult(
  data: unknown,
  meta?: unknown,
): CalendarTasksResult {
  const list = mapTaskList(data, meta);
  const metaRecord = asRecord(meta);

  return {
    items: list.items,
    total: list.total,
    unscheduledCount:
      pick(metaRecord, ["unscheduledCount"], asNumber) ?? 0,
    timezone: pick(metaRecord, ["timezone"], asNonEmptyString),
    from: pick(metaRecord, ["from"], asNonEmptyString),
    to: pick(metaRecord, ["to"], asNonEmptyString),
  };
}

function mapTimelineGroup(raw: unknown): TimelineGroup | null {
  const record = asRecord(raw);
  if (!record) {
    return null;
  }

  const id = pick(record, ["id"], asNonEmptyString);
  const label = pick(record, ["label", "name"], asNonEmptyString);
  if (!id || !label) {
    return null;
  }

  const items = mapTaskList(record.items ?? record.tasks ?? []).items;
  return { id, label, items };
}

export function mapTimelineTasksResult(
  data: unknown,
  meta?: unknown,
): TimelineTasksResult {
  const record = asRecord(data);
  const metaRecord = asRecord(meta);
  const rawGroups = Array.isArray(data)
    ? data
    : (record?.groups ?? record?.items ?? record?.data);

  const groups = (Array.isArray(rawGroups) ? rawGroups : [])
    .map(mapTimelineGroup)
    .filter((group): group is TimelineGroup => group !== null);

  const pagination =
    asRecord(metaRecord?.pagination) ?? asRecord(record?.pagination);

  return {
    groups,
    total:
      pick(pagination, ["total"], asNumber) ??
      pick(metaRecord, ["total"], asNumber) ??
      groups.reduce((sum, group) => sum + group.items.length, 0),
    timezone: pick(metaRecord, ["timezone"], asNonEmptyString),
    from: pick(metaRecord, ["from"], asNonEmptyString),
    to: pick(metaRecord, ["to"], asNonEmptyString),
    groupBy:
      normalizeTimelineGroupBy(metaRecord?.groupBy) ??
      normalizeTimelineGroupBy(record?.groupBy) ??
      "project",
  };
}

/** Builds filter + view patches from a saved view for URL apply. */
export function savedViewToPageState(view: SavedViewRecord): {
  filters: Partial<TaskFilterState>;
  view: Partial<TaskViewUrlState>;
} {
  const filtersJson = view.filtersJson;
  const display = view.displayOptionsJson;
  const sort = view.sortJson;
  const group = view.groupByJson;

  const viewFromType = ((): TaskViewMode | undefined => {
    switch (view.viewType) {
      case "BOARD":
        return "board";
      case "CALENDAR":
        return "calendar";
      case "TIMELINE":
        return "timeline";
      default:
        return "list";
    }
  })();

  return {
    filters: {
      search: filtersJson.search ?? "",
      projectId: filtersJson.projectId ?? null,
      statuses: filtersJson.statuses ?? [],
      priorities: filtersJson.priorities ?? [],
      assigneeId: filtersJson.assigneeId ?? null,
      createdById: filtersJson.createdById ?? null,
      due: filtersJson.due ?? null,
      deadlineFrom: filtersJson.deadlineFrom ?? null,
      deadlineTo: filtersJson.deadlineTo ?? null,
      overdue: filtersJson.overdue ?? false,
      unassigned: filtersJson.unassigned ?? false,
      includeArchived: filtersJson.includeArchived ?? false,
      includeDeleted: filtersJson.includeDeleted ?? false,
      sortBy: sort.sortBy ?? "createdAt",
      sortOrder: sort.sortOrder ?? "desc",
      page: 1,
    },
    view: {
      view: display.view ?? viewFromType ?? "list",
      calMode: display.calMode ?? "month",
      tlZoom: display.tlZoom ?? "week",
      groupBy:
        group.groupBy && group.groupBy !== "none" ? group.groupBy : "project",
    },
  };
}

/** Snapshot current page state into a create/update saved-view payload. */
export function pageStateToSavedViewInput(
  filters: TaskFilterState,
  view: TaskViewUrlState,
  columns: string[] = [],
): {
  viewType: SavedViewType;
  filtersJson: SavedViewFiltersJson;
  sortJson: SavedViewSortJson;
  groupByJson: SavedViewGroupByJson;
  columnsJson: string[];
  displayOptionsJson: SavedViewDisplayOptionsJson;
} {
  const viewTypeMap: Record<TaskViewMode, SavedViewType> = {
    list: "LIST",
    board: "BOARD",
    calendar: "CALENDAR",
    timeline: "TIMELINE",
  };

  return {
    viewType: viewTypeMap[view.view],
    filtersJson: {
      search: filters.search || undefined,
      projectId: filters.projectId,
      statuses: filters.statuses.length ? filters.statuses : undefined,
      priorities: filters.priorities.length ? filters.priorities : undefined,
      assigneeId: filters.assigneeId,
      createdById: filters.createdById,
      due: filters.due,
      deadlineFrom: filters.deadlineFrom,
      deadlineTo: filters.deadlineTo,
      overdue: filters.overdue || undefined,
      unassigned: filters.unassigned || undefined,
      includeArchived: filters.includeArchived || undefined,
      includeDeleted: filters.includeDeleted || undefined,
    },
    sortJson: {
      sortBy: filters.sortBy,
      sortOrder: filters.sortOrder,
    },
    groupByJson: {
      groupBy: view.view === "timeline" ? view.groupBy : "none",
    },
    columnsJson: columns,
    displayOptionsJson: {
      view: view.view,
      calMode: view.calMode,
      tlZoom: view.tlZoom,
    },
  };
}

/**
 * Given a column sorted by rank asc, compute neighbor ids for a move that
 * places `activeId` at the position of `overId` (or at the end when null).
 */
export function resolveBoardMoveNeighbors(
  columnItems: readonly TaskRecord[],
  activeId: string,
  overId: string | null,
): { beforeTaskId: string | null; afterTaskId: string | null } {
  const withoutActive = columnItems.filter((task) => task.id !== activeId);
  let insertIndex = withoutActive.length;

  if (overId) {
    const overIndex = withoutActive.findIndex((task) => task.id === overId);
    if (overIndex >= 0) {
      insertIndex = overIndex;
    }
  }

  const before = withoutActive[insertIndex - 1] ?? null;
  const after = withoutActive[insertIndex] ?? null;

  return {
    beforeTaskId: before?.id ?? null,
    afterTaskId: after?.id ?? null,
  };
}

/** Optimistic reorder: move active into target column at over position. */
export function applyOptimisticBoardMove(
  columns: Record<TaskStatus, TaskRecord[]>,
  activeId: string,
  targetStatus: TaskStatus,
  overId: string | null,
): Record<TaskStatus, TaskRecord[]> {
  let moved: TaskRecord | null = null;
  const next: Record<TaskStatus, TaskRecord[]> = { ...columns };

  for (const status of TASK_STATUSES) {
    const index = next[status].findIndex((task) => task.id === activeId);
    if (index >= 0) {
      moved = { ...next[status][index]!, status: targetStatus };
      next[status] = [
        ...next[status].slice(0, index),
        ...next[status].slice(index + 1),
      ];
      break;
    }
  }

  if (!moved) {
    return columns;
  }

  const target = [...(next[targetStatus] ?? [])];
  let insertIndex = target.length;
  if (overId) {
    const overIndex = target.findIndex((task) => task.id === overId);
    if (overIndex >= 0) {
      insertIndex = overIndex;
    }
  }
  target.splice(insertIndex, 0, moved);
  next[targetStatus] = target;
  return next;
}

/** Inclusive YYYY-MM-DD range for the visible calendar month grid (Sun–Sat). */
export function calendarMonthRange(
  anchor: Date,
): { from: string; to: string; weeks: Date[][] } {
  const year = anchor.getFullYear();
  const month = anchor.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const start = new Date(firstOfMonth);
  start.setDate(firstOfMonth.getDate() - firstOfMonth.getDay());

  const weeks: Date[][] = [];
  const cursor = new Date(start);
  for (let week = 0; week < 6; week += 1) {
    const days: Date[] = [];
    for (let day = 0; day < 7; day += 1) {
      days.push(new Date(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
    weeks.push(days);
  }

  const last = weeks[weeks.length - 1]![6]!;
  return {
    from: toLocalDateString(start),
    to: toLocalDateString(last),
    weeks,
  };
}

/** Inclusive YYYY-MM-DD range for a Sunday-start week containing `anchor`. */
export function calendarWeekRange(
  anchor: Date,
): { from: string; to: string; days: Date[] } {
  const start = new Date(anchor);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - start.getDay());

  const days: Date[] = [];
  for (let i = 0; i < 7; i += 1) {
    const day = new Date(start);
    day.setDate(start.getDate() + i);
    days.push(day);
  }

  return {
    from: toLocalDateString(days[0]!),
    to: toLocalDateString(days[6]!),
    days,
  };
}

/** Timeline window around `anchor` for the given zoom level. */
export function timelineRangeForZoom(
  anchor: Date,
  zoom: TimelineZoom,
): { from: string; to: string; days: Date[] } {
  const start = new Date(anchor);
  start.setHours(0, 0, 0, 0);
  let dayCount = 14;

  if (zoom === "day") {
    start.setDate(start.getDate() - 3);
    dayCount = 14;
  } else if (zoom === "week") {
    start.setDate(start.getDate() - start.getDay() - 7);
    dayCount = 42;
  } else {
    start.setDate(1);
    start.setMonth(start.getMonth() - 1);
    dayCount = 92;
  }

  const days: Date[] = [];
  for (let i = 0; i < dayCount; i += 1) {
    const day = new Date(start);
    day.setDate(start.getDate() + i);
    days.push(day);
  }

  return {
    from: toLocalDateString(days[0]!),
    to: toLocalDateString(days[days.length - 1]!),
    days,
  };
}

/**
 * Whether a task overlaps a calendar day (local YYYY-MM-DD), using start→due
 * when both exist, otherwise the single available date.
 */
export function taskOverlapsDay(
  task: Pick<TaskRecord, "startAt" | "dueDate">,
  dayYmd: string,
): boolean {
  const startYmd = task.startAt ? toDateInputValue(task.startAt) : null;
  const dueYmd = task.dueDate ? toDateInputValue(task.dueDate) : null;

  if (!startYmd && !dueYmd) {
    return false;
  }

  const from = startYmd ?? dueYmd!;
  const to = dueYmd ?? startYmd!;
  return from <= dayYmd && dayYmd <= to;
}

/** Converts URL filter state into export filter body fields. */
export function taskFilterStateToExportFilters(
  state: TaskFilterState,
): NonNullable<ExportTasksInput["filters"]> {
  return {
    search: state.search || undefined,
    projectId: state.projectId ? [state.projectId] : undefined,
    status: state.statuses.length ? state.statuses : undefined,
    priority: state.priorities.length ? state.priorities : undefined,
    assigneeId: state.assigneeId ?? undefined,
    createdById: state.createdById ?? undefined,
    due: state.due ?? undefined,
    deadlineFrom: state.deadlineFrom
      ? dateInputToIso(state.deadlineFrom) ?? undefined
      : undefined,
    deadlineTo: state.deadlineTo
      ? dateInputToIso(state.deadlineTo) ?? undefined
      : undefined,
    overdue: state.overdue || undefined,
    unassigned: state.unassigned || undefined,
    includeArchived: state.includeArchived || undefined,
    includeDeleted: state.includeDeleted || undefined,
  };
}

/** Converts URL filter state into list API filters. */
export function taskFilterStateToListFilters(
  state: TaskFilterState,
  options: {
    /** Default assignee when no assignee/unassigned filter is set. */
    defaultAssigneeId?: string | null;
    timezone?: string | null;
    pageSize?: number;
  } = {},
): TaskListFilters {
  const hasExplicitAssignee = Boolean(state.assigneeId) || state.unassigned;

  return {
    search: state.search || null,
    projectId: state.projectId,
    status: state.statuses.length === 1 ? state.statuses[0] : state.statuses.length > 1 ? state.statuses : null,
    priority:
      state.priorities.length === 1
        ? state.priorities[0]
        : state.priorities.length > 1
          ? state.priorities
          : null,
    assigneeId: state.unassigned
      ? null
      : (state.assigneeId ??
        (!hasExplicitAssignee ? (options.defaultAssigneeId ?? null) : null)),
    createdById: state.createdById,
    due: state.due,
    deadlineFrom: state.deadlineFrom
      ? dateInputToIso(state.deadlineFrom)
      : null,
    deadlineTo: state.deadlineTo ? dateInputToIso(state.deadlineTo) : null,
    overdue: state.overdue || null,
    unassigned: state.unassigned || null,
    includeArchived: state.includeArchived || null,
    includeDeleted: state.includeDeleted || null,
    tagIds: state.tagIds.length ? state.tagIds : null,
    timezone:
      state.due || state.overdue || state.deadlineFrom || state.deadlineTo
        ? (options.timezone ?? null)
        : null,
    page: state.page,
    pageSize: options.pageSize,
    sortBy: state.sortBy,
    sortOrder: state.sortOrder,
  };
}

export function taskFilterHasActiveFilters(state: TaskFilterState): boolean {
  return Boolean(
    state.search ||
      state.projectId ||
      state.statuses.length ||
      state.priorities.length ||
      state.assigneeId ||
      state.createdById ||
      state.tagIds.length ||
      state.due ||
      state.deadlineFrom ||
      state.deadlineTo ||
      state.overdue ||
      state.unassigned ||
      state.includeArchived ||
      state.includeDeleted,
  );
}

export type ActiveFilterChip = {
  key: string;
  label: string;
};

export function describeActiveFilterChips(
  state: TaskFilterState,
  labels: {
    projectName?: string | null;
    assigneeName?: string | null;
    creatorName?: string | null;
  } = {},
): ActiveFilterChip[] {
  const chips: ActiveFilterChip[] = [];

  if (state.search) {
    chips.push({ key: "search", label: `Search: ${state.search}` });
  }

  for (const status of state.statuses) {
    chips.push({
      key: `status:${status}`,
      label: `Status: ${TASK_STATUS_LABELS[status]}`,
    });
  }

  for (const priority of state.priorities) {
    chips.push({
      key: `priority:${priority}`,
      label: `Priority: ${TASK_PRIORITY_LABELS[priority]}`,
    });
  }

  if (state.projectId) {
    chips.push({
      key: "projectId",
      label: `Project: ${labels.projectName ?? "Selected"}`,
    });
  }

  if (state.assigneeId) {
    chips.push({
      key: "assigneeId",
      label: `Assignee: ${labels.assigneeName ?? "Selected"}`,
    });
  }

  if (state.createdById) {
    chips.push({
      key: "createdById",
      label: `Creator: ${labels.creatorName ?? "Selected"}`,
    });
  }

  if (state.due) {
    chips.push({
      key: "due",
      label:
        state.due === "today"
          ? "Due today"
          : state.due === "upcoming"
            ? "Upcoming"
            : "Overdue",
    });
  }

  if (state.deadlineFrom || state.deadlineTo) {
    chips.push({
      key: "deadline",
      label: `Deadline: ${state.deadlineFrom ?? "…"} → ${state.deadlineTo ?? "…"}`,
    });
  }

  if (state.overdue) {
    chips.push({ key: "overdue", label: "Overdue only" });
  }

  if (state.unassigned) {
    chips.push({ key: "unassigned", label: "Unassigned" });
  }

  if (state.includeArchived) {
    chips.push({ key: "includeArchived", label: "Include archived" });
  }

  if (state.includeDeleted) {
    chips.push({ key: "includeDeleted", label: "Include deleted" });
  }

  return chips;
}

/** Clears one chip key back into filter-state patches. */
export function clearFilterChip(
  key: string,
): Partial<TaskFilterState> {
  if (key === "search") {
    return { search: "" };
  }

  if (key.startsWith("status:")) {
    const status = normalizeTaskStatus(key.slice("status:".length));
    return status
      ? {
          statuses: [],
          // caller merges by removing this status
        }
      : {};
  }

  if (key.startsWith("priority:")) {
    return { priorities: [] };
  }

  switch (key) {
    case "projectId":
      return { projectId: null };
    case "assigneeId":
      return { assigneeId: null };
    case "createdById":
      return { createdById: null };
    case "due":
      return { due: null };
    case "deadline":
      return { deadlineFrom: null, deadlineTo: null };
    case "overdue":
      return { overdue: false };
    case "unassigned":
      return { unassigned: false };
    case "includeArchived":
      return { includeArchived: false };
    case "includeDeleted":
      return { includeDeleted: false };
    default:
      return {};
  }
}

export function removeFilterChip(
  state: TaskFilterState,
  key: string,
): TaskFilterState {
  if (key.startsWith("status:")) {
    const status = normalizeTaskStatus(key.slice("status:".length));
    return {
      ...state,
      statuses: status
        ? state.statuses.filter((entry) => entry !== status)
        : state.statuses,
      page: 1,
    };
  }

  if (key.startsWith("priority:")) {
    const priority = normalizeTaskPriority(key.slice("priority:".length));
    return {
      ...state,
      priorities: priority
        ? state.priorities.filter((entry) => entry !== priority)
        : state.priorities,
      page: 1,
    };
  }

  return {
    ...state,
    ...clearFilterChip(key),
    page: 1,
  };
}

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

function parseDate(value: string | null): Date | null {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** Absolute, localized date (e.g. "Mon, Jul 20, 2026"). */
export function formatAbsoluteDate(
  value: string | null,
  locale?: string,
  timeZone?: string,
): string | null {
  const date = parseDate(value);

  if (!date) {
    return null;
  }

  try {
    return new Intl.DateTimeFormat(locale ?? undefined, {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
      timeZone,
    }).format(date);
  } catch {
    return date.toDateString();
  }
}

/** Absolute, localized date and time (e.g. "Jul 20, 2026, 2:15 PM"). */
export function formatAbsoluteDateTime(
  value: string | null,
  locale?: string,
  timeZone?: string,
): string | null {
  const date = parseDate(value);

  if (!date) {
    return null;
  }

  try {
    return new Intl.DateTimeFormat(locale ?? undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZone,
    }).format(date);
  } catch {
    return date.toLocaleString();
  }
}

function startOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

/** Whole-day difference between the due date and "now" (negative = overdue). */
export function daysUntilDue(dueDate: string | null, now: Date): number | null {
  const due = parseDate(dueDate);

  if (!due) {
    return null;
  }

  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round(
    (startOfDay(due).getTime() - startOfDay(now).getTime()) / msPerDay,
  );
}

export function isTaskOverdue(
  task: Pick<TaskRecord, "status" | "dueDate">,
  now: Date,
): boolean {
  if (task.status === "DONE" || task.status === "CANCELLED") {
    return false;
  }

  const days = daysUntilDue(task.dueDate, now);
  return days !== null && days < 0;
}

export type DueDescriptor = {
  label: string;
  tone: BadgeTone;
};

/** Human summary of the due date relative to now, for badges. */
export function describeDueDate(
  task: Pick<TaskRecord, "status" | "dueDate">,
  now: Date,
): DueDescriptor | null {
  const days = daysUntilDue(task.dueDate, now);

  if (days === null) {
    return null;
  }

  if (task.status === "DONE" || task.status === "CANCELLED") {
    return { label: "Closed", tone: "neutral" };
  }

  if (days < 0) {
    const count = Math.abs(days);
    return {
      label: `Overdue by ${count} day${count === 1 ? "" : "s"}`,
      tone: "danger",
    };
  }

  if (days === 0) {
    return { label: "Due today", tone: "warning" };
  }

  if (days === 1) {
    return { label: "Due tomorrow", tone: "primary" };
  }

  return { label: `Due in ${days} days`, tone: "neutral" };
}

/** Local date in YYYY-MM-DD form, used as Smart Capture referenceDate. */
export function toLocalDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Converts an ISO datetime to the YYYY-MM-DD value used by date inputs. */
export function toDateInputValue(value: string | null): string {
  const date = parseDate(value);
  return date ? toLocalDateString(date) : "";
}

/** Converts a date-input value (YYYY-MM-DD) to ISO; "" and garbage → null. */
export function dateInputToIso(value: string): string | null {
  if (!value) {
    return null;
  }

  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

/** Formats task number for display (e.g. #42). */
export function formatTaskNumber(taskNumber: number | null): string | null {
  if (taskNumber === null || Number.isNaN(taskNumber)) {
    return null;
  }

  return `#${taskNumber}`;
}
