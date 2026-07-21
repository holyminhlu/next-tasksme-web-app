import type {
  TaskStatus,
  WorkflowStageCategory,
} from "../../generated/prisma/client.js";

/**
 * Legacy → normalized category mapping.
 *
 * This mapping is used during the Phase 8.2 migration where Task still
 * has `status` enum, but dashboards/engine should interpret tasks via the
 * workflow stage category.
 */
export function taskStatusToCategory(
  status: TaskStatus,
): WorkflowStageCategory {
  switch (status) {
    case "TODO":
      return "BACKLOG";
    case "IN_PROGRESS":
      return "IN_PROGRESS";
    case "IN_REVIEW":
      // "Chờ duyệt" should behave as an open work stage.
      return "IN_PROGRESS";
    case "BLOCKED":
      return "BLOCKED";
    case "DONE":
      return "COMPLETED";
    case "CANCELLED":
      return "CANCELLED";
    default: {
      // Exhaustiveness check for future enum additions.
      const _exhaustive: never = status;
      return "BACKLOG";
    }
  }
}

export const DEFAULT_WORKFLOW_STAGE_ORDER: WorkflowStageCategory[] = [
  "BACKLOG",
  "NOT_STARTED",
  "IN_PROGRESS",
  "BLOCKED",
  "COMPLETED",
  "CANCELLED",
];

