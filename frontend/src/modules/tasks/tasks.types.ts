export type TaskStatus = "TODO" | "IN_PROGRESS" | "DONE" | "CANCELLED";

export type TaskPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

/** Normalized task shape used across dashboard and task pages. */
export type TaskRecord = {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string | null;
  completedAt: string | null;
  isBlocked: boolean;
  projectId: string | null;
  projectName: string | null;
  assigneeId: string | null;
  assigneeName: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export type TaskListResult = {
  items: TaskRecord[];
  total: number;
};

export type TaskListFilters = {
  status?: TaskStatus | null;
  projectId?: string | null;
  assigneeId?: string | null;
  search?: string | null;
  /** Due filter, resolved server-side against `timezone`. */
  due?: "today" | "upcoming" | "overdue" | null;
  /** IANA timezone the backend uses to resolve the due filter. */
  timezone?: string | null;
  page?: number;
  pageSize?: number;
};

export type DeleteTaskResult = {
  id: string;
  deleted: boolean;
  deletedAt: string | null;
};

export type CreateTaskInput = {
  title: string;
  description?: string;
  priority: TaskPriority;
  dueDate?: string;
  projectId?: string;
  assigneeId?: string;
  confirmedFromQuickCapture?: boolean;
};

export type UpdateTaskInput = Partial<{
  title: string;
  description: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  dueDate: string | null;
  projectId: string | null;
  assigneeId: string | null;
}>;

/** Draft produced by POST /tasks/parse (Smart Capture). */
export type TaskDraft = {
  title: string;
  description: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  dueDate: string | null;
  projectName: string | null;
  assigneeName: string | null;
};

export type CandidateOption = {
  id: string;
  name: string;
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

export type ProjectRecord = {
  id: string;
  name: string;
  description: string | null;
  status: string;
  createdAt: string | null;
  updatedAt: string | null;
  /** Optional task counts, when the backend includes them. */
  openTasks: number | null;
  totalTasks: number | null;
};

export type CreateProjectInput = {
  name: string;
  description?: string;
};
