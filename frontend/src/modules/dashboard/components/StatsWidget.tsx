"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import {
  AlertTriangle,
  Ban,
  CalendarClock,
  CheckCircle2,
  CircleDot,
  FolderKanban,
  UserX,
} from "lucide-react";
import { myTasksHref } from "../dashboard.helpers";
import type { DashboardFilters, DashboardSummary } from "../dashboard.types";
import type { WidgetState } from "../useWidget";
import { WidgetCard } from "./WidgetCard";
import styles from "./widgets.module.css";

function StatTile({
  label,
  value,
  href,
  icon,
  tone,
}: {
  label: string;
  value: number;
  href?: string;
  icon: ReactNode;
  tone?: "danger" | "warning";
}) {
  const valueClass = [
    styles.statValue,
    tone === "danger" && value > 0 ? styles.statValueDanger : "",
    tone === "warning" && value > 0 ? styles.statValueWarning : "",
  ]
    .filter(Boolean)
    .join(" ");

  const body = (
    <>
      <span className={valueClass}>{value}</span>
      <span className={styles.statLabel}>
        {icon}
        {label}
      </span>
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className={styles.statTile}
        aria-label={`${label}: ${value}. View matching tasks.`}
      >
        {body}
      </Link>
    );
  }

  return <div className={styles.statTile}>{body}</div>;
}

/**
 * Presentational stats grid; the page owns the summary fetch so the header
 * can share its refresh / last-updated state.
 */
export function StatsWidget({
  state,
  filters,
}: {
  state: WidgetState<DashboardSummary>;
  filters: DashboardFilters;
}) {
  const stats = state.data?.stats;

  return (
    <WidgetCard
      title="At a glance"
      description="Task and project totals for the selected range."
      labelledBy="dashboard-stats-title"
      loading={state.loading}
      refreshing={state.refreshing}
      error={state.error}
      onRetry={state.reload}
      skeletonRows={2}
    >
      {stats && (
        <div className={styles.statsGrid}>
          <StatTile
            label="Open tasks"
            value={stats.openTasks}
            href={myTasksHref({ projectId: filters.projectId })}
            icon={<CircleDot size={13} aria-hidden />}
          />
          <StatTile
            label="Due today"
            value={stats.dueToday}
            href={myTasksHref({ due: "today", projectId: filters.projectId })}
            icon={<CalendarClock size={13} aria-hidden />}
            tone="warning"
          />
          <StatTile
            label="Overdue"
            value={stats.overdue}
            href={myTasksHref({ due: "overdue", projectId: filters.projectId })}
            icon={<AlertTriangle size={13} aria-hidden />}
            tone="danger"
          />
          <StatTile
            label="Completed"
            value={stats.completed}
            href={myTasksHref({ status: "DONE", projectId: filters.projectId })}
            icon={<CheckCircle2 size={13} aria-hidden />}
          />
          <StatTile
            label="Active projects"
            value={stats.activeProjects}
            href="/projects"
            icon={<FolderKanban size={13} aria-hidden />}
          />
          {stats.unassignedTasks !== null && (
            <StatTile
              label="Unassigned"
              value={stats.unassignedTasks}
              icon={<UserX size={13} aria-hidden />}
              tone="warning"
            />
          )}
          {stats.blockedTasks !== null && (
            <StatTile
              label="Blocked"
              value={stats.blockedTasks}
              icon={<Ban size={13} aria-hidden />}
              tone="danger"
            />
          )}
        </div>
      )}
    </WidgetCard>
  );
}
