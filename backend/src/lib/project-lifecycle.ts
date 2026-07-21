import type {
  DependencyCompletionPolicy,
  ProjectStatus,
} from "../../generated/prisma/client.js";
import { ValidationError } from "./errors.js";

const ALLOWED_TRANSITIONS: Record<ProjectStatus, ProjectStatus[]> = {
  PLANNING: ["ACTIVE", "CANCELLED"],
  ACTIVE: ["ON_HOLD", "COMPLETED", "CANCELLED", "ARCHIVED"],
  ON_HOLD: ["ACTIVE", "CANCELLED", "ARCHIVED"],
  COMPLETED: ["ARCHIVED"],
  CANCELLED: ["ARCHIVED"],
  ARCHIVED: ["ACTIVE"],
};

export function assertProjectStatusTransition(
  from: ProjectStatus,
  to: ProjectStatus,
): void {
  if (from === to) return;
  if (!ALLOWED_TRANSITIONS[from].includes(to)) {
    throw new ValidationError(`Cannot transition project from ${from} to ${to}`, {
      field: "status",
    });
  }
}

export type ProjectCompletionBlocker = {
  code: "OPEN_TASKS" | "RUNNING_TIMERS" | "BLOCKED_DEPENDENCIES";
  count: number;
  message: string;
};

export type ProjectCompletionAssessment = {
  blockers: ProjectCompletionBlocker[];
  canComplete: boolean;
  requiresOverride: boolean;
};

export function assessProjectCompletion(
  policy: DependencyCompletionPolicy,
  blockers: ProjectCompletionBlocker[],
): ProjectCompletionAssessment {
  if (blockers.length === 0) {
    return { blockers, canComplete: true, requiresOverride: false };
  }
  if (policy === "WARN_ONLY") {
    return { blockers, canComplete: true, requiresOverride: false };
  }
  if (policy === "BLOCK") {
    return { blockers, canComplete: false, requiresOverride: false };
  }
  return { blockers, canComplete: false, requiresOverride: true };
}

export function computeProjectHealth(input: {
  totalTasks: number;
  doneTasks: number;
  overdueTasks: number;
}): "GOOD" | "AT_RISK" | "CRITICAL" {
  if (input.totalTasks === 0) return "GOOD";
  const overdueRatio = input.overdueTasks / input.totalTasks;
  if (overdueRatio >= 0.3 || input.overdueTasks >= 10) return "CRITICAL";
  if (input.overdueTasks > 0) return "AT_RISK";
  const progress = input.doneTasks / input.totalTasks;
  if (progress >= 0.5) return "GOOD";
  return "AT_RISK";
}

export function computeProjectProgress(totalTasks: number, doneTasks: number): number {
  if (totalTasks === 0) return 0;
  return Math.round((doneTasks / totalTasks) * 100);
}
