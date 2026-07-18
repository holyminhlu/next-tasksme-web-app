"use client";

import { useMemo, useState } from "react";
import { hasPermission, useAuth } from "@/modules/auth";
import {
  Button,
  Dialog,
  FormField,
  Select,
  useToast,
} from "@/modules/design-system";
import {
  TASK_PRIORITIES,
  TASK_PRIORITY_LABELS,
  TASK_STATUSES,
  TASK_STATUS_LABELS,
  canAssignToOtherMembers,
} from "../tasks.helpers";
import * as tasksService from "../tasks.service";
import { emitTasksChanged } from "../tasks.events";
import type {
  BulkItemResult,
  CandidateOption,
  TaskPriority,
  TaskRecord,
  TaskStatus,
} from "../tasks.types";
import { AssigneePicker } from "./AssigneePicker";
import styles from "./task-bulk-bar.module.css";

function summarizeResults(results: BulkItemResult[]): {
  successCount: number;
  failureCount: number;
  failures: BulkItemResult[];
} {
  const failures = results.filter((result) => !result.success);
  return {
    successCount: results.length - failures.length,
    failureCount: failures.length,
    failures,
  };
}

export function TaskBulkActionBar({
  selectedTasks,
  projects,
  members,
  onComplete,
  onClear,
}: {
  selectedTasks: TaskRecord[];
  projects: CandidateOption[];
  members: CandidateOption[];
  onComplete: (updated: TaskRecord[], deletedIds: string[]) => void;
  onClear: () => void;
}) {
  const { profile, selectedWorkspace, permissions } = useAuth();
  const { toast } = useToast();
  const workspaceId = selectedWorkspace?.id ?? null;

  const canUpdate = hasPermission(permissions, "tasks:update");
  const canAssign = hasPermission(permissions, "tasks:assign");
  const canAssignOthers = canAssignToOtherMembers(selectedWorkspace?.roleKey);
  const canDelete = hasPermission(permissions, "tasks:delete");
  const canPickProject =
    hasPermission(permissions, "projects:update") ||
    hasPermission(permissions, "tasks:update");

  const [status, setStatus] = useState<TaskStatus | "">("");
  const [priority, setPriority] = useState<TaskPriority | "">("");
  const [assigneeId, setAssigneeId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  // Component mounts only while a selection exists, so the dialog opens as
  // soon as the first task is ticked and can be reopened from the bar.
  const [dialogOpen, setDialogOpen] = useState(true);

  const showFullAssigneePicker = canAssign && canAssignOthers;
  const showSelfAssign = canAssign && !canAssignOthers && Boolean(profile);

  const privateProjectIds = useMemo(() => {
    const ids = new Set<string>();
    for (const task of selectedTasks) {
      if (task.projectVisibility === "PRIVATE" && task.projectId) {
        ids.add(task.projectId);
      }
    }
    return ids;
  }, [selectedTasks]);

  // Bulk assignee across mixed private projects is unsafe — only offer when
  // selection is homogeneous (no private, or a single private project).
  const bulkAssigneeOptions = useMemo(() => {
    if (privateProjectIds.size > 1) {
      return [];
    }

    if (privateProjectIds.size === 1) {
      const projectIdValue = [...privateProjectIds][0]!;
      const memberIds = new Set(
        selectedTasks
          .filter((task) => task.projectId === projectIdValue)
          .flatMap((task) =>
            task.assigneeId ? [task.assigneeId] : [],
          ),
      );
      // Prefer full member list filtered later by parent; here we only know
      // workspace members passed in. Parent should pass eligible members.
      return members.filter(
        (member) =>
          memberIds.size === 0 ||
          memberIds.has(member.id) ||
          members.length > 0,
      );
    }

    return members;
  }, [members, privateProjectIds, selectedTasks]);

  if (selectedTasks.length === 0) {
    return null;
  }

  async function runBulkUpdate(
    changes: Parameters<typeof tasksService.bulkUpdateTasks>[1]["items"][number]["changes"],
  ) {
    if (!workspaceId || busy) {
      return;
    }

    setBusy(true);
    setSummary(null);

    const result = await tasksService.bulkUpdateTasks(workspaceId, {
      items: selectedTasks.map((task) => ({
        taskId: task.id,
        version: task.version,
        changes,
      })),
    });

    setBusy(false);

    if (!result.ok) {
      toast({
        title: "Bulk update failed",
        description: result.message,
        tone: "error",
      });
      return;
    }

    const { successCount, failureCount, failures } = summarizeResults(
      result.data.results,
    );
    const updated = result.data.results
      .filter((item) => item.success && item.task)
      .map((item) => item.task!);

    onComplete(updated, []);
    emitTasksChanged();

    const failureNote =
      failureCount > 0
        ? ` ${failureCount} failed${failures[0]?.error?.message ? `: ${failures[0].error.message}` : "."}`
        : "";
    const message = `${successCount} updated.${failureNote}`;
    setSummary(message);
    toast({
      title: "Bulk update finished",
      description: message,
      tone: failureCount > 0 ? "error" : "success",
    });
  }

  async function runBulkDelete() {
    if (!workspaceId || busy || !canDelete) {
      return;
    }

    const confirmed = window.confirm(
      `Delete ${selectedTasks.length} task${selectedTasks.length === 1 ? "" : "s"}?`,
    );
    if (!confirmed) {
      return;
    }

    setBusy(true);
    setSummary(null);

    const result = await tasksService.bulkDeleteTasks(workspaceId, {
      items: selectedTasks.map((task) => ({
        taskId: task.id,
        version: task.version,
      })),
    });

    setBusy(false);

    if (!result.ok) {
      toast({
        title: "Bulk delete failed",
        description: result.message,
        tone: "error",
      });
      return;
    }

    const { successCount, failureCount, failures } = summarizeResults(
      result.data.results,
    );
    const deletedIds = result.data.results
      .filter((item) => item.success)
      .map((item) => item.taskId);

    onComplete([], deletedIds);
    emitTasksChanged();

    const failureNote =
      failureCount > 0
        ? ` ${failureCount} failed${failures[0]?.error?.message ? `: ${failures[0].error.message}` : "."}`
        : "";
    const message = `${successCount} deleted.${failureNote}`;
    setSummary(message);
    toast({
      title: "Bulk delete finished",
      description: message,
      tone: failureCount > 0 ? "error" : "success",
    });
  }

  return (
    <>
      <div className={styles.bar} role="region" aria-label="Bulk task actions">
        <p className={styles.count}>{selectedTasks.length} selected</p>
        <Button size="sm" disabled={busy} onClick={() => setDialogOpen(true)}>
          Bulk actions…
        </Button>
        <Button size="sm" variant="ghost" disabled={busy} onClick={onClear}>
          Clear selection
        </Button>
        {summary && (
          <p className={styles.summary} role="status">
            {summary}
          </p>
        )}
      </div>

      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title="Bulk actions"
        description={`${selectedTasks.length} task${selectedTasks.length === 1 ? "" : "s"} selected`}
        footer={
          <div className={styles.dialogFooter}>
            <Button
              variant="ghost"
              disabled={busy}
              onClick={() => {
                setDialogOpen(false);
                onClear();
              }}
            >
              Clear selection
            </Button>
            <Button variant="secondary" onClick={() => setDialogOpen(false)}>
              Close
            </Button>
          </div>
        }
      >
        <div className={styles.form}>
          {canUpdate && (
            <div className={styles.formRow}>
              <FormField label="Status">
                {(fieldProps) => (
                  <Select
                    {...fieldProps}
                    value={status}
                    disabled={busy}
                    onChange={(event) =>
                      setStatus(event.target.value as TaskStatus | "")
                    }
                  >
                    <option value="">Set status…</option>
                    {TASK_STATUSES.map((key) => (
                      <option key={key} value={key}>
                        {TASK_STATUS_LABELS[key]}
                      </option>
                    ))}
                  </Select>
                )}
              </FormField>
              <Button
                size="sm"
                variant="secondary"
                disabled={busy || !status}
                loading={busy}
                onClick={() =>
                  status ? void runBulkUpdate({ status }) : undefined
                }
              >
                Apply status
              </Button>
            </div>
          )}

          {canUpdate && (
            <div className={styles.formRow}>
              <FormField label="Priority">
                {(fieldProps) => (
                  <Select
                    {...fieldProps}
                    value={priority}
                    disabled={busy}
                    onChange={(event) =>
                      setPriority(event.target.value as TaskPriority | "")
                    }
                  >
                    <option value="">Set priority…</option>
                    {TASK_PRIORITIES.map((key) => (
                      <option key={key} value={key}>
                        {TASK_PRIORITY_LABELS[key]}
                      </option>
                    ))}
                  </Select>
                )}
              </FormField>
              <Button
                size="sm"
                variant="secondary"
                disabled={busy || !priority}
                onClick={() =>
                  priority ? void runBulkUpdate({ priority }) : undefined
                }
              >
                Apply priority
              </Button>
            </div>
          )}

          {showFullAssigneePicker && privateProjectIds.size <= 1 && (
            <div className={styles.formRow}>
              <div className={styles.assigneeWrap}>
                <AssigneePicker
                  label="Assignee"
                  value={assigneeId}
                  onChange={setAssigneeId}
                  options={bulkAssigneeOptions}
                  disabled={busy}
                />
              </div>
              <Button
                size="sm"
                variant="secondary"
                disabled={busy}
                onClick={() =>
                  void runBulkUpdate({
                    assigneeId: assigneeId || null,
                  })
                }
              >
                Apply assignee
              </Button>
            </div>
          )}

          {showSelfAssign && profile && (
            <div className={styles.formRow}>
              <Button
                size="sm"
                variant="secondary"
                disabled={busy}
                onClick={() => void runBulkUpdate({ assigneeId: profile.id })}
              >
                Assign to me
              </Button>
            </div>
          )}

          {canPickProject && (
            <div className={styles.formRow}>
              <FormField label="Project">
                {(fieldProps) => (
                  <Select
                    {...fieldProps}
                    value={projectId}
                    disabled={busy}
                    onChange={(event) => setProjectId(event.target.value)}
                  >
                    <option value="">Set project…</option>
                    <option value="__none__">No project</option>
                    {projects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.name}
                      </option>
                    ))}
                  </Select>
                )}
              </FormField>
              <Button
                size="sm"
                variant="secondary"
                disabled={busy || !projectId}
                onClick={() =>
                  projectId
                    ? void runBulkUpdate({
                        projectId: projectId === "__none__" ? null : projectId,
                      })
                    : undefined
                }
              >
                Apply project
              </Button>
            </div>
          )}

          {(canUpdate || canDelete) && (
            <div className={styles.formActions}>
              {canUpdate && (
                <>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={busy}
                    onClick={() => void runBulkUpdate({ archived: true })}
                  >
                    Archive
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={busy}
                    onClick={() => void runBulkUpdate({ archived: false })}
                  >
                    Unarchive
                  </Button>
                </>
              )}
              {canDelete && (
                <Button
                  size="sm"
                  variant="dangerOutline"
                  disabled={busy}
                  onClick={() => void runBulkDelete()}
                >
                  Delete
                </Button>
              )}
            </div>
          )}

          {summary && (
            <p className={styles.summary} role="status">
              {summary}
            </p>
          )}
        </div>
      </Dialog>
    </>
  );
}
