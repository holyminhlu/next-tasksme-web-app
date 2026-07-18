"use client";

import { useCallback, useId } from "react";
import { RefreshCw } from "lucide-react";
import { hasPermission, useAuth } from "@/modules/auth";
import { Button, Select } from "@/modules/design-system";
import { listMembers } from "@/modules/workspaces/members.service";
import {
  TASK_STATUSES,
  TASK_STATUS_LABELS,
  hasWorkspaceTaskScope,
  tasksService,
  type TaskStatus,
} from "@/modules/tasks";
import { DATE_RANGE_PRESETS } from "../dashboard.helpers";
import type { DateRangePresetKey } from "../dashboard.types";
import { useWidget } from "../useWidget";
import styles from "./widgets.module.css";

export type DashboardFilterState = {
  preset: DateRangePresetKey;
  projectId: string | null;
  memberId: string | null;
  status: TaskStatus | null;
};

/**
 * Permission-aware dashboard filters: the project filter appears for
 * projects:read, the member filter only in organization workspaces with
 * members:read. Option lists degrade silently when their requests fail.
 */
export function DashboardFilterBar({
  value,
  onChange,
  onRefresh,
  refreshing,
  lastUpdatedLabel,
  projectsEnabled,
}: {
  value: DashboardFilterState;
  onChange: (next: DashboardFilterState) => void;
  onRefresh: () => void;
  refreshing: boolean;
  lastUpdatedLabel: string | null;
  projectsEnabled: boolean;
}) {
  const { selectedWorkspace, permissions } = useAuth();
  const workspaceId = selectedWorkspace?.id ?? null;
  const fieldId = useId();

  const canFilterProjects =
    projectsEnabled && hasPermission(permissions, "projects:read");
  // Members can read the member list but only see their own tasks, so the
  // backend rejects a memberId filter from them (FORBIDDEN). Only offer the
  // filter to roles with workspace-wide task scope (owner/admin/manager).
  const canFilterMembers =
    selectedWorkspace?.type === "ORGANIZATION" &&
    hasPermission(permissions, "members:read") &&
    hasWorkspaceTaskScope(selectedWorkspace.roleKey);

  const projectsFetcher = useCallback(
    () => tasksService.listProjects(workspaceId ?? ""),
    [workspaceId],
  );
  const membersFetcher = useCallback(async () => {
    const envelope = await listMembers(workspaceId ?? "");

    if (!envelope.success) {
      return {
        ok: false as const,
        code: envelope.error.code,
        message: envelope.error.message,
      };
    }

    return { ok: true as const, data: envelope.data };
  }, [workspaceId]);

  const projects = useWidget(
    workspaceId && canFilterProjects ? projectsFetcher : null,
  );
  const members = useWidget(
    workspaceId && canFilterMembers ? membersFetcher : null,
  );

  return (
    <div className={styles.filterBar} role="group" aria-label="Dashboard filters">
      <div className={styles.filterField}>
        <label className={styles.filterLabel} htmlFor={`${fieldId}-range`}>
          Date range
        </label>
        <Select
          id={`${fieldId}-range`}
          value={value.preset}
          onChange={(event) =>
            onChange({
              ...value,
              preset: event.target.value as DateRangePresetKey,
            })
          }
        >
          {DATE_RANGE_PRESETS.map((preset) => (
            <option key={preset.key} value={preset.key}>
              {preset.label}
            </option>
          ))}
        </Select>
      </div>

      {canFilterProjects && (
        <div className={styles.filterField}>
          <label className={styles.filterLabel} htmlFor={`${fieldId}-project`}>
            Project
          </label>
          <Select
            id={`${fieldId}-project`}
            value={value.projectId ?? ""}
            onChange={(event) =>
              onChange({ ...value, projectId: event.target.value || null })
            }
          >
            <option value="">All projects</option>
            {(projects.data ?? []).map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </Select>
        </div>
      )}

      {canFilterMembers && (
        <div className={styles.filterField}>
          <label className={styles.filterLabel} htmlFor={`${fieldId}-member`}>
            Member
          </label>
          <Select
            id={`${fieldId}-member`}
            value={value.memberId ?? ""}
            onChange={(event) =>
              onChange({ ...value, memberId: event.target.value || null })
            }
          >
            <option value="">Everyone</option>
            {/* The backend matches memberId against task assignee/creator
                user ids, so options use the user id, not the membership id. */}
            {(members.data ?? []).map((member) => (
              <option key={member.id} value={member.user.id}>
                {member.user.fullName}
              </option>
            ))}
          </Select>
        </div>
      )}

      <div className={styles.filterField}>
        <label className={styles.filterLabel} htmlFor={`${fieldId}-status`}>
          Status
        </label>
        <Select
          id={`${fieldId}-status`}
          value={value.status ?? ""}
          onChange={(event) =>
            onChange({
              ...value,
              status: (event.target.value || null) as TaskStatus | null,
            })
          }
        >
          <option value="">All statuses</option>
          {TASK_STATUSES.map((status) => (
            <option key={status} value={status}>
              {TASK_STATUS_LABELS[status]}
            </option>
          ))}
        </Select>
      </div>

      <div className={styles.filterMeta}>
        {lastUpdatedLabel && (
          <span className={styles.lastUpdated} aria-live="polite">
            Updated {lastUpdatedLabel}
          </span>
        )}
        <Button
          variant="secondary"
          size="sm"
          iconLeft={<RefreshCw size={14} aria-hidden />}
          onClick={onRefresh}
          loading={refreshing}
        >
          Refresh
        </Button>
      </div>
    </div>
  );
}
