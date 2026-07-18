"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { hasPermission, useAuth } from "@/modules/auth";
import { Badge, EmptyState, Tabs } from "@/modules/design-system";
import {
  TASK_PRIORITY_LABELS,
  TASK_PRIORITY_TONES,
  TaskDetailDialog,
  TaskQuickComplete,
  TaskStatusMenu,
  describeDueDate,
  formatAbsoluteDate,
  type TaskRecord,
} from "@/modules/tasks";
import { myTasksHref } from "../dashboard.helpers";
import * as dashboardService from "../dashboard.service";
import type { DashboardFilters, MyWorkTab } from "../dashboard.types";
import { useWidget } from "../useWidget";
import { WidgetCard } from "./WidgetCard";
import styles from "./widgets.module.css";

const TABS: Array<{ id: MyWorkTab; label: string }> = [
  { id: "today", label: "Today" },
  { id: "upcoming", label: "Upcoming" },
  { id: "overdue", label: "Overdue" },
  { id: "in-progress", label: "In progress" },
  { id: "completed", label: "Completed" },
];

const EMPTY_COPY: Record<MyWorkTab, string> = {
  today: "Nothing due today. Enjoy the breathing room!",
  upcoming: "No upcoming tasks in the selected range.",
  overdue: "No overdue tasks — you're all caught up.",
  "in-progress": "Nothing currently in progress.",
  completed: "No tasks completed in the selected range yet.",
};

export function MyWorkWidget({
  filters,
  timezone,
  refreshKey,
  onTaskDeleted,
}: {
  filters: DashboardFilters;
  timezone: string;
  refreshKey: number;
  /** Lets the page refresh sibling widgets (stats, charts) after a delete. */
  onTaskDeleted?: () => void;
}) {
  const { selectedWorkspace, permissions } = useAuth();
  const workspaceId = selectedWorkspace?.id ?? null;
  const canUpdate = hasPermission(permissions, "tasks:update");

  const [tab, setTab] = useState<MyWorkTab>("today");
  const [selectedTask, setSelectedTask] = useState<TaskRecord | null>(null);
  // Local overrides so quick actions update rows without a full refetch.
  const [overrides, setOverrides] = useState<Record<string, TaskRecord>>({});
  const [deletedIds, setDeletedIds] = useState<string[]>([]);

  const fetcher = useCallback(() => {
    void refreshKey;
    return dashboardService.getMyWork(
      workspaceId ?? "",
      tab,
      filters,
      timezone,
    );
  }, [workspaceId, tab, filters, timezone, refreshKey]);

  const state = useWidget(workspaceId ? fetcher : null);

  const locale =
    typeof navigator !== "undefined" ? navigator.language : undefined;
  const now = new Date();

  function applyUpdate(task: TaskRecord) {
    setOverrides((current) => ({ ...current, [task.id]: task }));
    setSelectedTask((current) => (current?.id === task.id ? task : current));
  }

  function applyDelete(taskId: string) {
    setDeletedIds((current) =>
      current.includes(taskId) ? current : [...current, taskId],
    );
    setSelectedTask((current) => (current?.id === taskId ? null : current));

    // Refetch so tab totals and sibling widgets (stats, charts) stay accurate.
    if (onTaskDeleted) {
      onTaskDeleted();
    } else {
      state.reload();
    }
  }

  const items = (state.data?.items ?? [])
    .filter((task) => !deletedIds.includes(task.id))
    .map((task) => overrides[task.id] ?? task);

  return (
    <WidgetCard
      title="My Work"
      description="Your assigned tasks, grouped by urgency."
      labelledBy="dashboard-my-work-title"
      loading={state.loading}
      refreshing={state.refreshing}
      error={state.error}
      onRetry={state.reload}
      skeletonRows={4}
    >
      <Tabs
        items={TABS}
        value={tab}
        onChange={(id) => setTab(id as MyWorkTab)}
        aria-label="My Work views"
        idPrefix="my-work"
      />

      {items.length === 0 ? (
        <EmptyState plain title="All clear" description={EMPTY_COPY[tab]} />
      ) : (
        <ul className={styles.taskList}>
          {items.map((task) => {
            const due = describeDueDate(task, now);
            const dueAbsolute = formatAbsoluteDate(task.dueDate, locale);

            return (
              <li key={task.id} className={styles.taskRow}>
                <TaskQuickComplete
                  task={task}
                  onUpdated={applyUpdate}
                  disabled={!canUpdate}
                />
                <button
                  type="button"
                  className={styles.taskRowMain}
                  onClick={() => setSelectedTask(task)}
                  aria-label={`Open details for "${task.title}"`}
                >
                  <span
                    className={`${styles.taskRowTitle} ${task.status === "DONE" ? styles.taskRowTitleDone : ""}`.trim()}
                  >
                    {task.title}
                  </span>
                  <span className={styles.taskRowMeta}>
                    {task.projectName && <span>{task.projectName}</span>}
                    {dueAbsolute && <span title={dueAbsolute}>{dueAbsolute}</span>}
                    {due && (
                      <Badge tone={due.tone} withDot>
                        {due.label}
                      </Badge>
                    )}
                  </span>
                </button>
                <span className={styles.taskRowActions}>
                  <Badge tone={TASK_PRIORITY_TONES[task.priority]}>
                    {TASK_PRIORITY_LABELS[task.priority]}
                  </Badge>
                  <TaskStatusMenu
                    task={task}
                    onUpdated={applyUpdate}
                    disabled={!canUpdate}
                  />
                </span>
              </li>
            );
          })}
        </ul>
      )}

      {state.data && state.data.total > items.length && (
        <Link
          className={styles.widgetFooterLink}
          href={myTasksHref({
            due: tab === "today" ? "today" : tab === "overdue" ? "overdue" : null,
            status:
              tab === "completed"
                ? "DONE"
                : tab === "in-progress"
                  ? "IN_PROGRESS"
                  : null,
            projectId: filters.projectId,
          })}
        >
          View all {state.data.total} in My tasks
        </Link>
      )}

      <TaskDetailDialog
        task={selectedTask}
        onClose={() => setSelectedTask(null)}
        onUpdated={applyUpdate}
        onDeleted={applyDelete}
        canUpdate={canUpdate}
      />
    </WidgetCard>
  );
}
