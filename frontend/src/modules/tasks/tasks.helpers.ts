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
  CandidateOption,
  DeleteTaskResult,
  ParseTaskResult,
  ProjectMemberSummary,
  ProjectRecord,
  ProjectVisibility,
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
