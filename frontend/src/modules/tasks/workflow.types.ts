import type { TaskStatus } from "./tasks.types";

export type DependencyPolicy =
  | "WARN_ONLY"
  | "BLOCK"
  | "BLOCK_WITH_OVERRIDE";

export type DependencyTask = {
  id: string;
  taskNumber: number;
  title: string;
  status: TaskStatus;
  assigneeId: string | null;
  assigneeName: string | null;
  dueDate: string | null;
};

export type DependencyRecord = {
  id: string;
  dependencyType: "FINISH_TO_START";
  task: DependencyTask;
};

export type DependencySummary = {
  policy: DependencyPolicy;
  waitingOn: DependencyRecord[];
  blocking: DependencyRecord[];
  hasIncompletePredecessors: boolean;
};

export type TimeLogRecord = {
  id: string;
  workspaceId: string;
  taskId: string;
  userId: string;
  startedAt: string;
  endedAt: string | null;
  durationSeconds: number | null;
  description: string | null;
  source: "TIMER" | "MANUAL" | "IMPORT";
  userName: string;
  userEmail: string;
  taskNumber: number;
  taskTitle: string;
};

export type TimeLogSummary = {
  items: TimeLogRecord[];
  scope: "mine" | "team";
  ownSeconds: number;
  totalSeconds: number;
};

export type TaskStatusHistoryRecord = {
  id: string;
  fromStatus: TaskStatus | null;
  toStatus: TaskStatus;
  changedById: string | null;
  changedByName: string | null;
  changedAt: string;
  durationInPreviousStatus: number | null;
};

export type TaskStatusHistorySummary = {
  items: TaskStatusHistoryRecord[];
  durationByStatus: Partial<Record<TaskStatus, number>>;
  leadTimeSeconds: number;
  cycleTimeSeconds: number;
};
