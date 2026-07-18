"use client";

import { useCallback, useState } from "react";
import { useAuth } from "@/modules/auth";
import { Button, EmptyState } from "@/modules/design-system";
import { formatAbsoluteDateTime } from "@/modules/tasks";
import * as dashboardService from "../dashboard.service";
import type { DashboardFilters } from "../dashboard.types";
import { useWidget } from "../useWidget";
import { WidgetCard } from "./WidgetCard";
import styles from "./widgets.module.css";

const PAGE_SIZE = 8;

export function ActivityWidget({
  filters,
  refreshKey,
}: {
  filters: DashboardFilters;
  refreshKey: number;
}) {
  const { selectedWorkspace } = useAuth();
  const workspaceId = selectedWorkspace?.id ?? null;
  const [page, setPage] = useState(1);

  const fetcher = useCallback(() => {
    void refreshKey;
    return dashboardService.getActivity(workspaceId ?? "", filters, {
      limit: PAGE_SIZE,
      page,
    });
  }, [workspaceId, filters, page, refreshKey]);

  const state = useWidget(workspaceId ? fetcher : null);

  // Activity may be restricted for some roles; hide instead of erroring.
  if (state.error && state.error.code === "FORBIDDEN") {
    return null;
  }

  const locale =
    typeof navigator !== "undefined" ? navigator.language : undefined;
  const data = state.data;

  return (
    <WidgetCard
      title="Recent activity"
      description="Latest changes across this workspace."
      labelledBy="dashboard-activity-title"
      loading={state.loading}
      refreshing={state.refreshing}
      error={state.error}
      onRetry={state.reload}
      skeletonRows={4}
    >
      {data && data.items.length === 0 ? (
        <EmptyState
          plain
          title="No activity yet"
          description="Workspace changes will show up here as your team works."
        />
      ) : (
        <ul className={styles.activityList}>
          {data?.items.map((event) => {
            const when = formatAbsoluteDateTime(event.createdAt, locale);

            return (
              <li key={event.id} className={styles.activityItem}>
                <span className={styles.activityDot} aria-hidden />
                <div className={styles.activityBody}>
                  <span className={styles.activitySummary}>{event.summary}</span>
                  <span className={styles.activityMeta}>
                    {[event.actorName, event.projectName, when]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {data && data.totalPages > 1 && (
        <div className={styles.activityFooter}>
          <Button
            variant="ghost"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
          >
            Newer
          </Button>
          <span className={styles.activityMeta}>
            Page {data.page} of {data.totalPages}
          </span>
          <Button
            variant="ghost"
            size="sm"
            disabled={page >= data.totalPages}
            onClick={() => setPage((current) => current + 1)}
          >
            Older
          </Button>
        </div>
      )}
    </WidgetCard>
  );
}
