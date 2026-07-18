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
  CandidateOption,
  DeleteTaskResult,
  ParseTaskResult,
  ProjectRecord,
  TaskDraft,
  TaskListResult,
  TaskPriority,
  TaskRecord,
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

export const TASK_STATUSES: TaskStatus[] = [
  "TODO",
  "IN_PROGRESS",
  "DONE",
  "CANCELLED",
];

export const TASK_PRIORITIES: TaskPriority[] = [
  "LOW",
  "MEDIUM",
  "HIGH",
  "URGENT",
];

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  TODO: "To do",
  IN_PROGRESS: "In progress",
  DONE: "Done",
  CANCELLED: "Cancelled",
};

export const TASK_STATUS_TONES: Record<TaskStatus, BadgeTone> = {
  TODO: "neutral",
  IN_PROGRESS: "primary",
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

  return {
    id,
    title,
    description: pick(record, ["description"], asNonEmptyString),
    status: normalizeTaskStatus(record.status) ?? "TODO",
    priority: normalizeTaskPriority(record.priority) ?? "MEDIUM",
    dueDate: pick(record, ["dueDate", "due_date", "dueAt"], asNonEmptyString),
    completedAt: pick(
      record,
      ["completedAt", "completed_at"],
      asNonEmptyString,
    ),
    isBlocked: asBoolean(record.isBlocked) ?? false,
    projectId:
      pick(record, ["projectId"], asNonEmptyString) ??
      pick(project, ["id"], asNonEmptyString),
    projectName:
      pick(record, ["projectName"], asNonEmptyString) ??
      pick(project, ["name"], asNonEmptyString),
    assigneeId:
      pick(record, ["assigneeId"], asNonEmptyString) ??
      pick(assignee, ["id", "userId"], asNonEmptyString),
    assigneeName:
      pick(record, ["assigneeName"], asNonEmptyString) ??
      pick(assignee, ["fullName", "name"], asNonEmptyString),
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
  const pagination = asRecord(metaRecord?.pagination);

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

  return {
    id: pick(record, ["id", "taskId"], asNonEmptyString) ?? taskId,
    deleted: asBoolean(record?.deleted) ?? true,
    deletedAt: pick(record, ["deletedAt"], asNonEmptyString),
  };
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

  return {
    id,
    name,
    description: pick(record, ["description"], asNonEmptyString),
    status: pick(record, ["status"], asNonEmptyString) ?? "ACTIVE",
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

  if (!id || (!name && !email)) {
    return null;
  }

  return {
    id,
    name: name && email ? `${name} (${email})` : (name ?? email ?? id),
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
