"use client";

import { useCallback } from "react";
import { useAuth } from "@/modules/auth";
import { TASK_STATUS_LABELS } from "@/modules/tasks";
import type { TaskStatus } from "@/modules/tasks";
import { myTasksHref } from "../dashboard.helpers";
import * as dashboardService from "../dashboard.service";
import type { DashboardFilters, WorkflowStageCategory } from "../dashboard.types";
import { useWidget } from "../useWidget";
import {
  BarChart,
  ChartEmpty,
  DonutChart,
  LineChart,
  type ChartDatum,
} from "./Charts";
import { WidgetCard } from "./WidgetCard";
import styles from "./widgets.module.css";

const STATUS_COLORS: Record<TaskStatus, string> = {
  TODO: "var(--ds-color-text-subtle)",
  IN_PROGRESS: "var(--ds-color-primary)",
  IN_REVIEW: "var(--ds-color-primary)",
  BLOCKED: "var(--ds-color-danger)",
  DONE: "var(--ds-color-success)",
  CANCELLED: "var(--ds-color-warning)",
};

const CATEGORY_LABELS: Record<WorkflowStageCategory, string> = {
  BACKLOG: "Backlog",
  NOT_STARTED: "Not started",
  IN_PROGRESS: "In progress",
  BLOCKED: "Blocked",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

const CATEGORY_COLORS: Record<WorkflowStageCategory, string> = {
  BACKLOG: "var(--ds-color-text-subtle)",
  NOT_STARTED: "var(--ds-color-text-subtle)",
  IN_PROGRESS: "var(--ds-color-primary)",
  BLOCKED: "var(--ds-color-danger)",
  COMPLETED: "var(--ds-color-success)",
  CANCELLED: "var(--ds-color-warning)",
};

function shortDate(value: string, locale?: string): string {
  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  try {
    return new Intl.DateTimeFormat(locale ?? undefined, {
      month: "short",
      day: "numeric",
    }).format(parsed);
  } catch {
    return value;
  }
}

export function OverviewWidget({
  filters,
  timezone,
  refreshKey,
}: {
  filters: DashboardFilters;
  timezone: string;
  refreshKey: number;
}) {
  const { selectedWorkspace } = useAuth();
  const workspaceId = selectedWorkspace?.id ?? null;

  const fetcher = useCallback(() => {
    void refreshKey;
    return dashboardService.getCharts(workspaceId ?? "", filters, timezone);
  }, [workspaceId, filters, timezone, refreshKey]);

  const state = useWidget(workspaceId ? fetcher : null);

  // Hide the whole section when the backend says we may not see
  // workspace-wide data (e.g. restricted member scope).
  if (state.error && state.error.code === "FORBIDDEN") {
    return null;
  }

  const charts = state.data;

  if (!state.loading && !state.error && charts && !charts.available) {
    return null;
  }

  const locale =
    typeof navigator !== "undefined" ? navigator.language : undefined;

  const statusData: ChartDatum[] = (charts?.tasksByStatus ?? []).map(
    (entry) => ({
      key: entry.status,
      label: TASK_STATUS_LABELS[entry.status],
      value: entry.count,
      color: STATUS_COLORS[entry.status],
      href: myTasksHref({ status: entry.status, projectId: filters.projectId }),
      detail: `${TASK_STATUS_LABELS[entry.status]}: ${entry.count} task${entry.count === 1 ? "" : "s"}`,
    }),
  );

  const categoryData: ChartDatum[] = (charts?.tasksByCategory ?? []).map(
    (entry) => ({
      key: entry.category,
      label: CATEGORY_LABELS[entry.category],
      value: entry.count,
      color: CATEGORY_COLORS[entry.category],
      detail: `${CATEGORY_LABELS[entry.category]}: ${entry.count} task${entry.count === 1 ? "" : "s"}`,
    }),
  );

  const trendPoints = (charts?.completionTrend ?? []).map((point) => ({
    key: point.date,
    label: shortDate(point.date, locale),
    value: point.count,
  }));

  const overdueData: ChartDatum[] = (charts?.overdueByProject ?? []).map(
    (entry) => ({
      key: entry.projectId,
      label: entry.projectName,
      value: entry.count,
      href: myTasksHref({ due: "overdue", projectId: entry.projectId }),
      detail: `${entry.projectName}: ${entry.count} overdue task${entry.count === 1 ? "" : "s"}`,
    }),
  );

  const workloadData: ChartDatum[] = (charts?.teamWorkload ?? []).map(
    (member) => ({
      key: member.memberId,
      label: member.memberName,
      value: member.openTasks,
      color:
        member.overdueTasks > 0
          ? "var(--ds-color-warning)"
          : "var(--ds-color-primary)",
      detail: `${member.memberName}: ${member.openTasks} open, ${member.overdueTasks} overdue`,
    }),
  );

  const categorySummary =
    categoryData.length > 0
      ? `Tasks by workflow category: ${categoryData
          .map((item) => `${item.label} ${item.value}`)
          .join(", ")}.`
      : "No tasks by category data.";

  const statusSummary =
    statusData.length > 0
      ? `Tasks by status: ${statusData
          .map((item) => `${item.label} ${item.value}`)
          .join(", ")}.`
      : "No tasks by status data.";

  const trendSummary =
    trendPoints.length > 0
      ? `Completed tasks per day: ${trendPoints
          .map((point) => `${point.label}: ${point.value}`)
          .join(", ")}.`
      : "No completion trend data.";

  const overdueSummary =
    overdueData.length > 0
      ? `Overdue tasks by project: ${overdueData
          .map((item) => `${item.label} ${item.value}`)
          .join(", ")}.`
      : "No overdue tasks by project.";

  const workloadSummary =
    workloadData.length > 0
      ? `Team workload: ${(charts?.teamWorkload ?? [])
          .map(
            (member) =>
              `${member.memberName} has ${member.openTasks} open and ${member.overdueTasks} overdue tasks`,
          )
          .join("; ")}.`
      : "No team workload data.";

  return (
    <WidgetCard
      title="Workspace overview"
      description="How work is distributed across the workspace."
      labelledBy="dashboard-overview-title"
      loading={state.loading}
      refreshing={state.refreshing}
      error={state.error}
      onRetry={state.reload}
      skeletonRows={5}
    >
      <div className={styles.chartsGrid}>
        <div className={styles.chartBlock}>
          <h3 className={styles.chartBlockTitle}>Tasks by status</h3>
          {statusData.length === 0 ? (
            <ChartEmpty>No tasks in the selected range.</ChartEmpty>
          ) : (
            <DonutChart
              data={statusData}
              centerLabel="tasks"
              summary={statusSummary}
            />
          )}
        </div>

        {categoryData.length > 0 && (
          <div className={styles.chartBlock}>
            <h3 className={styles.chartBlockTitle}>Tasks by workflow category</h3>
            <DonutChart
              data={categoryData}
              centerLabel="tasks"
              summary={categorySummary}
            />
          </div>
        )}

        <div className={styles.chartBlock}>
          <h3 className={styles.chartBlockTitle}>Completion trend</h3>
          {trendPoints.length === 0 ? (
            <ChartEmpty>No completions in the selected range.</ChartEmpty>
          ) : (
            <LineChart points={trendPoints} summary={trendSummary} />
          )}
        </div>

        <div className={styles.chartBlock}>
          <h3 className={styles.chartBlockTitle}>Overdue by project</h3>
          {overdueData.length === 0 ? (
            <ChartEmpty>No overdue tasks. Great job!</ChartEmpty>
          ) : (
            <BarChart data={overdueData} summary={overdueSummary} />
          )}
        </div>

        {charts && charts.teamWorkload !== null && (
          <div className={styles.chartBlock}>
            <h3 className={styles.chartBlockTitle}>Team workload</h3>
            {workloadData.length === 0 ? (
              <ChartEmpty>No open tasks assigned to teammates.</ChartEmpty>
            ) : (
              <BarChart
                data={workloadData}
                summary={workloadSummary}
                color="var(--ds-color-primary)"
              />
            )}
          </div>
        )}
      </div>
    </WidgetCard>
  );
}
