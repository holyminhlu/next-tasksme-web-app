import {
  asNonEmptyString,
  asNumber,
  asRecord,
  pick,
} from "@/lib/api/coerce";
import { buildQueryString } from "@/lib/api/query";
import {
  normalizeTaskStatus,
  toLocalDateString,
  type TaskStatus,
} from "@/modules/tasks";
import type {
  ActivityEventRecord,
  ActivityListResult,
  CategoryCount,
  DashboardCharts,
  DashboardFilters,
  DashboardStats,
  DashboardSummary,
  DateRangePresetKey,
  MemberWorkload,
  ProjectCount,
  StatusCount,
  TrendPoint,
  WorkflowStageCategory,
} from "./dashboard.types";

// ---------------------------------------------------------------------------
// Date range presets
// ---------------------------------------------------------------------------

export const DATE_RANGE_PRESETS: Array<{
  key: DateRangePresetKey;
  label: string;
}> = [
  { key: "today", label: "Today" },
  { key: "last7", label: "Last 7 days" },
  { key: "last30", label: "Last 30 days" },
  { key: "thisMonth", label: "This month" },
  { key: "all", label: "All time" },
];

/** Inclusive from/to (YYYY-MM-DD) for a preset; nulls mean unbounded. */
export function dateRangeForPreset(
  preset: DateRangePresetKey,
  now: Date,
): { from: string | null; to: string | null } {
  const to = toLocalDateString(now);

  switch (preset) {
    case "today":
      return { from: to, to };
    case "last7": {
      const from = new Date(now);
      from.setDate(from.getDate() - 6);
      return { from: toLocalDateString(from), to };
    }
    case "last30": {
      const from = new Date(now);
      from.setDate(from.getDate() - 29);
      return { from: toLocalDateString(from), to };
    }
    case "thisMonth": {
      const from = new Date(now.getFullYear(), now.getMonth(), 1);
      return { from: toLocalDateString(from), to };
    }
    case "all":
      return { from: null, to: null };
  }
}

/** Time-of-day greeting for the dashboard header. */
export function greetingForHour(hour: number): string {
  if (hour < 5) {
    return "Working late";
  }

  if (hour < 12) {
    return "Good morning";
  }

  if (hour < 17) {
    return "Good afternoon";
  }

  return "Good evening";
}

// ---------------------------------------------------------------------------
// Drill-down links
// ---------------------------------------------------------------------------

/** Builds the /my-tasks href for stat / chart drill-downs. */
export function myTasksHref(params: {
  status?: TaskStatus | null;
  due?: "today" | "overdue" | null;
  projectId?: string | null;
}): string {
  return `/my-tasks${buildQueryString({
    status: params.status,
    due: params.due,
    projectId: params.projectId,
  })}`;
}

// ---------------------------------------------------------------------------
// Response mapping (defensive against contract drift)
// ---------------------------------------------------------------------------

export function mapSummary(data: unknown, meta?: unknown): DashboardSummary {
  const record = asRecord(data);
  const scope = asRecord(record?.scope);
  const stats = asRecord(record?.stats) ?? record;
  const metaRecord = asRecord(meta);

  const mappedStats: DashboardStats = {
    openTasks: pick(stats, ["openTasks", "open"], asNumber) ?? 0,
    dueToday: pick(stats, ["dueToday"], asNumber) ?? 0,
    overdue: pick(stats, ["overdue", "overdueTasks"], asNumber) ?? 0,
    completed: pick(stats, ["completed", "completedTasks"], asNumber) ?? 0,
    activeProjects: pick(stats, ["activeProjects"], asNumber) ?? 0,
    unassignedTasks: pick(stats, ["unassignedTasks"], asNumber),
    blockedTasks: pick(stats, ["blockedTasks"], asNumber),
  };

  return {
    scope: {
      workspaceId: pick(scope, ["workspaceId"], asNonEmptyString),
      from: pick(scope, ["from"], asNonEmptyString),
      to: pick(scope, ["to"], asNonEmptyString),
      timezone: pick(scope, ["timezone"], asNonEmptyString),
      workspaceScope: pick(scope, ["workspaceScope", "scope"], asNonEmptyString),
    },
    stats: mappedStats,
    generatedAt:
      pick(metaRecord, ["generatedAt"], asNonEmptyString) ??
      pick(record, ["generatedAt"], asNonEmptyString),
  };
}

function mapStatusCount(raw: unknown): StatusCount | null {
  const record = asRecord(raw);
  const status = normalizeTaskStatus(record?.status);
  const count = pick(record, ["count", "total"], asNumber);

  if (!status || count === null) {
    return null;
  }

  return { status, count };
}

const WORKFLOW_STAGE_CATEGORIES: WorkflowStageCategory[] = [
  "BACKLOG",
  "NOT_STARTED",
  "IN_PROGRESS",
  "BLOCKED",
  "COMPLETED",
  "CANCELLED",
];

function mapCategoryCount(raw: unknown): CategoryCount | null {
  const record = asRecord(raw);
  const category =
    typeof record?.category === "string" &&
    (WORKFLOW_STAGE_CATEGORIES as string[]).includes(record.category)
      ? (record.category as WorkflowStageCategory)
      : null;
  const count = pick(record, ["count", "total"], asNumber);

  if (!category || count === null) {
    return null;
  }

  return { category, count };
}

function mapTrendPoint(raw: unknown): TrendPoint | null {
  const record = asRecord(raw);
  const date = pick(record, ["date", "day"], asNonEmptyString);
  const count = pick(record, ["count", "total"], asNumber);

  if (!date || count === null) {
    return null;
  }

  return { date, count };
}

function mapProjectCount(raw: unknown): ProjectCount | null {
  const record = asRecord(raw);
  const projectId = pick(record, ["projectId", "id"], asNonEmptyString);
  const count = pick(record, ["count", "total"], asNumber);

  if (count === null) {
    return null;
  }

  return {
    projectId: projectId ?? "unknown",
    projectName:
      pick(record, ["projectName", "name"], asNonEmptyString) ??
      "Unknown project",
    count,
  };
}

function mapMemberWorkload(raw: unknown): MemberWorkload | null {
  const record = asRecord(raw);
  const memberId = pick(record, ["memberId", "id", "userId"], asNonEmptyString);

  if (!memberId) {
    return null;
  }

  return {
    memberId,
    memberName:
      pick(record, ["memberName", "fullName", "name"], asNonEmptyString) ??
      "Unknown member",
    openTasks: pick(record, ["openTasks", "open"], asNumber) ?? 0,
    overdueTasks: pick(record, ["overdueTasks", "overdue"], asNumber) ?? 0,
  };
}

function mapList<T>(raw: unknown, mapItem: (item: unknown) => T | null): T[] {
  return (Array.isArray(raw) ? raw : [])
    .map(mapItem)
    .filter((item): item is T => item !== null);
}

export function mapCharts(data: unknown): DashboardCharts {
  const record = asRecord(data);

  if (record?.available === false) {
    return {
      available: false,
      tasksByStatus: [],
      tasksByCategory: [],
      completionTrend: [],
      overdueByProject: [],
      teamWorkload: null,
    };
  }

  return {
    available: true,
    tasksByStatus: mapList(record?.tasksByStatus, mapStatusCount),
    tasksByCategory: mapList(record?.tasksByCategory, mapCategoryCount),
    completionTrend: mapList(record?.completionTrend, mapTrendPoint),
    overdueByProject: mapList(record?.overdueByProject, mapProjectCount),
    teamWorkload: Array.isArray(record?.teamWorkload)
      ? mapList(record.teamWorkload, mapMemberWorkload)
      : null,
  };
}

export function mapActivityEvent(raw: unknown): ActivityEventRecord | null {
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
    actorName:
      pick(record, ["actorName"], asNonEmptyString) ??
      pick(actor, ["fullName", "name"], asNonEmptyString),
    action: pick(record, ["action"], asNonEmptyString),
    resourceType: pick(record, ["resourceType"], asNonEmptyString),
    resourceId: pick(record, ["resourceId"], asNonEmptyString),
    projectId: pick(record, ["projectId"], asNonEmptyString),
    projectName: pick(record, ["projectName"], asNonEmptyString),
    summary,
    createdAt: pick(record, ["createdAt"], asNonEmptyString),
  };
}

export function mapActivityList(
  data: unknown,
  meta?: unknown,
): ActivityListResult {
  const record = asRecord(data);
  const rawItems = Array.isArray(data)
    ? data
    : (record?.items ?? record?.events ?? record?.data);

  const items = mapList(rawItems, mapActivityEvent);

  const metaRecord = asRecord(meta);
  const pagination = asRecord(metaRecord?.pagination);

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

/** Query params sent with every dashboard request. */
export function dashboardQueryParams(
  filters: DashboardFilters,
  timezone: string,
): Record<string, string | null> {
  return {
    from: filters.from,
    to: filters.to,
    timezone,
    projectId: filters.projectId,
    memberId: filters.memberId,
    status: filters.status,
  };
}
