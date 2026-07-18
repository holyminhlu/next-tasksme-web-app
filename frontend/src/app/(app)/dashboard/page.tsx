"use client";

import { useCallback, useMemo, useState } from "react";
import { FolderKanban, Plus, UserPlus } from "lucide-react";
import { Can, hasPermission, useAuth } from "@/modules/auth";
import { Button } from "@/modules/design-system";
import {
  ActivityWidget,
  DashboardFilterBar,
  MyWorkWidget,
  OverviewWidget,
  StatsWidget,
  dashboardService,
  dateRangeForPreset,
  greetingForHour,
  useWidget,
  type DashboardFilterState,
  type DashboardFilters,
} from "@/modules/dashboard";
import { formatAbsoluteDateTime } from "@/modules/tasks";
import { PageHeader, useShell } from "@/modules/shell";
import styles from "../app-pages.module.css";
import dashboardStyles from "./dashboard.module.css";

const ROLE_LABELS: Record<string, string> = {
  owner: "Owner",
  admin: "Admin",
  manager: "Manager",
  member: "Member",
};

export default function DashboardPage() {
  const { user, selectedWorkspace, permissions } = useAuth();
  const { setQuickCreate, navContext } = useShell();

  const workspaceId = selectedWorkspace?.id ?? null;
  const isOrganization = selectedWorkspace?.type === "ORGANIZATION";
  const canReadDashboard = hasPermission(permissions, "dashboard:read");
  const canReadTasks = hasPermission(permissions, "tasks:read");

  const modulesKnown = navContext.enabledModuleKeys !== null;
  const tasksModuleEnabled =
    !modulesKnown || navContext.enabledModuleKeys!.includes("tasks");
  const projectsModuleEnabled =
    !modulesKnown || navContext.enabledModuleKeys!.includes("projects");

  const timezone = useMemo(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
    [],
  );
  const locale =
    typeof navigator !== "undefined" ? navigator.language : undefined;

  const [filterState, setFilterState] = useState<DashboardFilterState>({
    preset: "last7",
    projectId: null,
    memberId: null,
    status: null,
  });
  const [refreshKey, setRefreshKey] = useState(0);

  const filters = useMemo<DashboardFilters>(() => {
    const range = dateRangeForPreset(filterState.preset, new Date());

    return {
      from: range.from,
      to: range.to,
      projectId: filterState.projectId,
      memberId: filterState.memberId,
      status: filterState.status,
    };
  }, [filterState]);

  // The page owns the summary fetch so the header can show a shared
  // refresh spinner and "last updated" timestamp.
  const summaryFetcher = useCallback(() => {
    void refreshKey;
    return dashboardService.getSummary(workspaceId ?? "", filters, timezone);
  }, [workspaceId, filters, timezone, refreshKey]);

  const summaryState = useWidget(
    workspaceId && canReadDashboard && canReadTasks ? summaryFetcher : null,
  );

  const refresh = useCallback(() => {
    setRefreshKey((key) => key + 1);
  }, []);

  const greeting = greetingForHour(new Date().getHours());
  const firstName = user?.fullName?.split(" ")[0] ?? "there";
  const roleLabel = selectedWorkspace
    ? (ROLE_LABELS[selectedWorkspace.roleKey] ?? selectedWorkspace.roleKey)
    : null;

  const lastUpdatedLabel = useMemo(() => {
    const generatedAt = summaryState.data?.generatedAt;

    if (generatedAt) {
      const formatted = formatAbsoluteDateTime(generatedAt, locale);

      if (formatted) {
        return formatted;
      }
    }

    return summaryState.lastUpdated
      ? formatAbsoluteDateTime(summaryState.lastUpdated.toISOString(), locale)
      : null;
  }, [summaryState.data?.generatedAt, summaryState.lastUpdated, locale]);

  return (
    <div className={styles.stack}>
      <PageHeader
        title={`${greeting}, ${firstName}`}
        description={
          selectedWorkspace
            ? `${selectedWorkspace.name}${roleLabel ? ` · ${roleLabel}` : ""}`
            : "Select a workspace to get started."
        }
        actions={
          <>
            {tasksModuleEnabled && (
              <Can permission="tasks:create">
                <Button
                  iconLeft={<Plus size={16} aria-hidden />}
                  onClick={() => setQuickCreate("task")}
                >
                  New task
                </Button>
              </Can>
            )}
            {projectsModuleEnabled && (
              <Can permission="projects:create">
                <Button
                  variant="secondary"
                  iconLeft={<FolderKanban size={16} aria-hidden />}
                  onClick={() => setQuickCreate("project")}
                >
                  New project
                </Button>
              </Can>
            )}
            {isOrganization && (
              <Can permission="members:invite">
                <Button
                  variant="ghost"
                  iconLeft={<UserPlus size={16} aria-hidden />}
                  onClick={() => setQuickCreate("invite")}
                >
                  Invite
                </Button>
              </Can>
            )}
          </>
        }
      />

      {canReadDashboard && canReadTasks && tasksModuleEnabled ? (
        <>
          <DashboardFilterBar
            value={filterState}
            onChange={setFilterState}
            onRefresh={refresh}
            refreshing={summaryState.refreshing}
            lastUpdatedLabel={lastUpdatedLabel}
            projectsEnabled={projectsModuleEnabled}
          />

          <StatsWidget state={summaryState} filters={filters} />

          <div className={dashboardStyles.mainGrid}>
            <MyWorkWidget
              filters={filters}
              timezone={timezone}
              refreshKey={refreshKey}
              onTaskDeleted={refresh}
            />
            <ActivityWidget filters={filters} refreshKey={refreshKey} />
          </div>

          <OverviewWidget
            filters={filters}
            timezone={timezone}
            refreshKey={refreshKey}
          />
        </>
      ) : (
        <section className={styles.card} aria-labelledby="dashboard-limited">
          <h2 id="dashboard-limited" className={styles.cardTitle}>
            Workspace dashboard
          </h2>
          <p className={styles.cardDescription}>
            {!canReadDashboard
              ? "Your role doesn't include dashboard access in this workspace."
              : tasksModuleEnabled
                ? "Your role doesn't include access to task data in this workspace, so there are no widgets to show."
                : "The tasks module is disabled for this workspace, so the dashboard has nothing to display. An admin can re-enable it under Settings → Modules."}
          </p>
        </section>
      )}
    </div>
  );
}
