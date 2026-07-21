import type { TaskListResult, TaskStatus } from "@/modules/tasks";

/** Filters shared by all dashboard widgets. */
export type DashboardFilters = {
  from: string | null;
  to: string | null;
  projectId: string | null;
  memberId: string | null;
  status: TaskStatus | null;
};

export type DateRangePresetKey =
  | "today"
  | "last7"
  | "last30"
  | "thisMonth"
  | "all";

export type DashboardScope = {
  workspaceId: string | null;
  from: string | null;
  to: string | null;
  timezone: string | null;
  workspaceScope: string | null;
};

export type DashboardStats = {
  openTasks: number;
  dueToday: number;
  overdue: number;
  completed: number;
  activeProjects: number;
  /** Present only when the caller may see workspace-wide data. */
  unassignedTasks: number | null;
  blockedTasks: number | null;
};

export type DashboardSummary = {
  scope: DashboardScope;
  stats: DashboardStats;
  generatedAt: string | null;
};

export type MyWorkTab =
  | "today"
  | "upcoming"
  | "overdue"
  | "in-progress"
  | "completed";

export type MyWorkResult = TaskListResult;

export type StatusCount = {
  status: TaskStatus;
  count: number;
};

/** Mirrors backend WorkflowStageCategory (Phase 8.2). */
export type WorkflowStageCategory =
  | "BACKLOG"
  | "NOT_STARTED"
  | "IN_PROGRESS"
  | "BLOCKED"
  | "COMPLETED"
  | "CANCELLED";

export type CategoryCount = {
  category: WorkflowStageCategory;
  count: number;
};

export type TrendPoint = {
  date: string;
  count: number;
};

export type ProjectCount = {
  projectId: string;
  projectName: string;
  count: number;
};

export type MemberWorkload = {
  memberId: string;
  memberName: string;
  openTasks: number;
  overdueTasks: number;
};

export type DashboardCharts = {
  /** False when the caller may not see workspace-wide charts (member scope). */
  available: boolean;
  tasksByStatus: StatusCount[];
  /** Phase 8.2: tasks grouped by workflow stage category (or mapped legacy status). */
  tasksByCategory: CategoryCount[];
  completionTrend: TrendPoint[];
  overdueByProject: ProjectCount[];
  /** Null when the backend omits it (e.g. personal workspace / no permission). */
  teamWorkload: MemberWorkload[] | null;
};

export type ActivityEventRecord = {
  id: string;
  actorName: string | null;
  action: string | null;
  resourceType: string | null;
  resourceId: string | null;
  projectId: string | null;
  projectName: string | null;
  summary: string;
  createdAt: string | null;
};

export type ActivityListResult = {
  items: ActivityEventRecord[];
  total: number;
  page: number;
  totalPages: number;
};
