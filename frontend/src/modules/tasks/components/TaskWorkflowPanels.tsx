"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Clock3, Link2, Play, Square, Trash2 } from "lucide-react";
import { hasPermission, useAuth } from "@/modules/auth";
import {
  Badge,
  Button,
  Collapsible,
  FormField,
  Select,
  TextInput,
  useToast,
} from "@/modules/design-system";
import {
  TASK_STATUS_LABELS,
  TASK_STATUS_TONES,
  canMutateTask,
  formatAbsoluteDate,
  formatTaskNumber,
} from "../tasks.helpers";
import * as tasksService from "../tasks.service";
import type { TaskRecord } from "../tasks.types";
import * as workflow from "../workflow.service";
import type {
  DependencyRecord,
  DependencySummary,
  TaskStatusHistorySummary,
  TimeLogRecord,
  TimeLogSummary,
} from "../workflow.types";
import styles from "./task-workflow.module.css";

function formatDuration(seconds: number) {
  const safe = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const remainder = safe % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${remainder}s`;
  return `${remainder}s`;
}

function localDateTimeToIso(value: string) {
  return value ? new Date(value).toISOString() : "";
}

function isoToLocalDateTime(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function DependencyRow({
  dependency,
  canManage,
  busy,
  onOpen,
  onDelete,
}: {
  dependency: DependencyRecord;
  canManage: boolean;
  busy: boolean;
  onOpen: (taskId: string) => void;
  onDelete: (dependencyId: string) => void;
}) {
  const task = dependency.task;
  return (
    <div className={styles.dependencyRow}>
      <button
        type="button"
        className={styles.taskLink}
        onClick={() => onOpen(task.id)}
      >
        <strong>{formatTaskNumber(task.taskNumber)}</strong>
        <span>{task.title}</span>
      </button>
      <Badge tone={TASK_STATUS_TONES[task.status]}>
        {TASK_STATUS_LABELS[task.status]}
      </Badge>
      <span className={styles.meta}>{task.assigneeName ?? "Unassigned"}</span>
      <span className={styles.meta}>
        {task.dueDate ? formatAbsoluteDate(task.dueDate) : "No deadline"}
      </span>
      {canManage && (
        <Button
          size="sm"
          variant="ghost"
          disabled={busy}
          aria-label="Remove dependency"
          onClick={() => onDelete(dependency.id)}
        >
          <Trash2 size={14} />
        </Button>
      )}
    </div>
  );
}

export function TaskWorkflowPanels({
  task,
  onTaskUpdated,
}: {
  task: TaskRecord;
  onTaskUpdated?: (task: TaskRecord) => void;
}) {
  const { selectedWorkspace, permissions, profile } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const workspaceId = selectedWorkspace?.id ?? null;

  const canViewDependencies = hasPermission(
    permissions,
    "task_dependency.view",
  );
  const canManageDependencies = hasPermission(
    permissions,
    "task_dependency.manage",
  );
  const canViewOwnTime = hasPermission(permissions, "time_log.view_own");
  const canCreateTime = hasPermission(permissions, "time_log.create");
  const canDeleteOwnTime = hasPermission(
    permissions,
    "time_log.delete_own",
  );
  const canUpdateOwnTime = hasPermission(
    permissions,
    "time_log.update_own",
  );
  const canManageAllTime = hasPermission(
    permissions,
    "time_log.manage_all",
  );
  const canViewAllTime = hasPermission(permissions, "time_log.view_all");
  const canViewHistory = hasPermission(permissions, "task_history.view");
  const canOverrideCompletion =
    hasPermission(permissions, "task_dependency.override") &&
    hasPermission(permissions, "tasks:update") &&
    canMutateTask(selectedWorkspace?.roleKey, profile?.id, task);

  const [dependencies, setDependencies] =
    useState<DependencySummary | null>(null);
  const [dependencyDirection, setDependencyDirection] = useState<
    "WAITING_ON" | "BLOCKING"
  >("WAITING_ON");
  const [taskQuery, setTaskQuery] = useState("");
  const [taskCandidates, setTaskCandidates] = useState<TaskRecord[]>([]);
  const [selectedRelatedTaskId, setSelectedRelatedTaskId] = useState("");
  const [timeScope, setTimeScope] = useState<"mine" | "team">("mine");
  const [timeLogs, setTimeLogs] = useState<TimeLogSummary | null>(null);
  const [runningTimer, setRunningTimer] = useState<TimeLogRecord | null>(null);
  const [timerDescription, setTimerDescription] = useState("");
  const [manualStart, setManualStart] = useState("");
  const [manualEnd, setManualEnd] = useState("");
  const [manualDescription, setManualDescription] = useState("");
  const [editingLogId, setEditingLogId] = useState<string | null>(null);
  const [editStart, setEditStart] = useState("");
  const [editEnd, setEditEnd] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [history, setHistory] =
    useState<TaskStatusHistorySummary | null>(null);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const reload = useCallback(async () => {
    if (!workspaceId) return;
    const jobs: Promise<void>[] = [];
    if (canViewDependencies) {
      jobs.push(
        workflow.listDependencies(workspaceId, task.id).then((result) => {
          if (result.ok) setDependencies(result.data);
        }),
      );
    }
    if (canViewOwnTime) {
      jobs.push(
        workflow
          .listTimeLogs(workspaceId, task.id, timeScope)
          .then((result) => {
            if (result.ok) setTimeLogs(result.data);
          }),
      );
      jobs.push(
        workflow.getRunningTimer(workspaceId).then((result) => {
          if (result.ok) setRunningTimer(result.data);
        }),
      );
    }
    if (canViewHistory) {
      jobs.push(
        workflow.listStatusHistory(workspaceId, task.id).then((result) => {
          if (result.ok) setHistory(result.data);
        }),
      );
    }
    await Promise.all(jobs);
  }, [
    workspaceId,
    task.id,
    canViewDependencies,
    canViewOwnTime,
    canViewHistory,
    timeScope,
  ]);

  useEffect(() => {
    const timer = window.setTimeout(() => void reload(), 0);
    return () => window.clearTimeout(timer);
  }, [reload]);

  useEffect(() => {
    if (!runningTimer) return;
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [runningTimer]);

  useEffect(() => {
    if (!workspaceId || !taskQuery.trim() || !canManageDependencies) {
      const clearTimer = window.setTimeout(() => setTaskCandidates([]), 0);
      return () => window.clearTimeout(clearTimer);
    }
    const timer = window.setTimeout(() => {
      void tasksService
        .listTasks(workspaceId, {
          search: taskQuery.trim(),
          pageSize: 10,
        })
        .then((result) => {
          if (result.ok) {
            setTaskCandidates(
              result.data.items.filter((candidate) => candidate.id !== task.id),
            );
          }
        });
    }, 250);
    return () => window.clearTimeout(timer);
  }, [workspaceId, task.id, taskQuery, canManageDependencies]);

  const runningSeconds = useMemo(
    () =>
      runningTimer
        ? Math.max(
            0,
            Math.floor(
              (now - new Date(runningTimer.startedAt).getTime()) / 1000,
            ),
          )
        : 0,
    [runningTimer, now],
  );

  function openTask(taskId: string) {
    const next = new URLSearchParams(searchParams.toString());
    next.set("taskId", taskId);
    router.push(`${pathname}?${next.toString()}`);
  }

  async function addDependency() {
    if (!workspaceId || !selectedRelatedTaskId || busy) return;
    setBusy(true);
    const result = await workflow.createDependency(workspaceId, task.id, {
      relatedTaskId: selectedRelatedTaskId,
      direction: dependencyDirection,
    });
    setBusy(false);
    if (!result.ok) {
      toast({
        title: "Couldn't add dependency",
        description: result.message,
        tone: "error",
      });
      return;
    }
    setDependencies(result.data);
    setSelectedRelatedTaskId("");
    setTaskQuery("");
    setTaskCandidates([]);
  }

  async function removeDependency(dependencyId: string) {
    if (!workspaceId || busy) return;
    setBusy(true);
    const result = await workflow.deleteDependency(
      workspaceId,
      task.id,
      dependencyId,
    );
    setBusy(false);
    if (!result.ok) {
      toast({
        title: "Couldn't remove dependency",
        description: result.message,
        tone: "error",
      });
      return;
    }
    setDependencies(result.data);
  }

  async function completeWithOverride() {
    if (!workspaceId || busy) return;
    const reason = window
      .prompt("Reason for overriding unfinished dependencies")
      ?.trim();
    if (!reason || reason.length < 5) {
      toast({
        title: "Override reason required",
        description: "Enter at least 5 characters.",
        tone: "error",
      });
      return;
    }
    setBusy(true);
    const result = await tasksService.updateTaskStatus(workspaceId, task.id, {
      status: "DONE",
      version: task.version,
      dependencyOverrideReason: reason,
    });
    setBusy(false);
    if (!result.ok) {
      toast({
        title: "Couldn't complete task",
        description: result.message,
        tone: "error",
      });
      return;
    }
    toast({
      title: "Task completed with override",
      description: "The reason was recorded in the audit log.",
      tone: "success",
    });
    onTaskUpdated?.(result.data);
    await reload();
  }

  async function toggleTimer() {
    if (!workspaceId || busy) return;
    setBusy(true);
    const result =
      runningTimer?.taskId === task.id
        ? await workflow.stopTimer(workspaceId, task.id)
        : await workflow.startTimer(
            workspaceId,
            task.id,
            timerDescription.trim() || undefined,
          );
    setBusy(false);
    if (!result.ok) {
      toast({
        title: "Timer action failed",
        description: result.message,
        tone: "error",
      });
      return;
    }
    setTimerDescription("");
    await reload();
  }

  async function addManualLog() {
    if (!workspaceId || !manualStart || !manualEnd || busy) return;
    setBusy(true);
    const result = await workflow.createManualTimeLog(workspaceId, task.id, {
      startedAt: localDateTimeToIso(manualStart),
      endedAt: localDateTimeToIso(manualEnd),
      description: manualDescription.trim() || null,
    });
    setBusy(false);
    if (!result.ok) {
      toast({
        title: "Couldn't add time log",
        description: result.message,
        tone: "error",
      });
      return;
    }
    setManualStart("");
    setManualEnd("");
    setManualDescription("");
    await reload();
  }

  async function removeTimeLog(log: TimeLogRecord) {
    if (!workspaceId || busy) return;
    setBusy(true);
    const result = await workflow.deleteTimeLog(
      workspaceId,
      task.id,
      log.id,
    );
    setBusy(false);
    if (!result.ok) {
      toast({
        title: "Couldn't delete time log",
        description: result.message,
        tone: "error",
      });
      return;
    }
    await reload();
  }

  function beginEditLog(log: TimeLogRecord) {
    setEditingLogId(log.id);
    setEditStart(isoToLocalDateTime(log.startedAt));
    setEditEnd(isoToLocalDateTime(log.endedAt));
    setEditDescription(log.description ?? "");
  }

  function cancelEditLog() {
    setEditingLogId(null);
    setEditStart("");
    setEditEnd("");
    setEditDescription("");
  }

  async function saveEditLog(log: TimeLogRecord) {
    if (!workspaceId || !editStart || !editEnd || busy) return;
    setBusy(true);
    const result = await workflow.updateTimeLog(workspaceId, task.id, log.id, {
      startedAt: localDateTimeToIso(editStart),
      endedAt: localDateTimeToIso(editEnd),
      description: editDescription.trim() || null,
    });
    setBusy(false);
    if (!result.ok) {
      toast({
        title: "Couldn't update time log",
        description: result.message,
        tone: "error",
      });
      return;
    }
    cancelEditLog();
    await reload();
  }

  return (
    <div className={styles.stack}>
      {canViewDependencies && (
        <Collapsible
          title="Dependencies"
          badge={
            dependencies?.hasIncompletePredecessors ? (
              <Badge tone="warning">Waiting</Badge>
            ) : undefined
          }
        >
          <div className={styles.stack}>
            {dependencies?.hasIncompletePredecessors && (
              <div className={styles.warning}>
                This task is waiting on unfinished dependencies. Completion
                policy: <strong>{dependencies.policy}</strong>.
                {dependencies.policy === "BLOCK_WITH_OVERRIDE" &&
                  canOverrideCompletion &&
                  task.status !== "DONE" && (
                    <div className={styles.overrideAction}>
                      <Button
                        size="sm"
                        disabled={busy}
                        onClick={() => void completeWithOverride()}
                      >
                        Complete with override
                      </Button>
                    </div>
                  )}
              </div>
            )}
            <section>
              <h4 className={styles.heading}>Waiting on</h4>
              <div className={styles.list}>
                {dependencies?.waitingOn.map((dependency) => (
                  <DependencyRow
                    key={dependency.id}
                    dependency={dependency}
                    canManage={canManageDependencies}
                    busy={busy}
                    onOpen={openTask}
                    onDelete={(id) => void removeDependency(id)}
                  />
                ))}
                {!dependencies?.waitingOn.length && (
                  <p className={styles.muted}>No predecessor tasks.</p>
                )}
              </div>
            </section>
            <section>
              <h4 className={styles.heading}>Blocking</h4>
              <div className={styles.list}>
                {dependencies?.blocking.map((dependency) => (
                  <DependencyRow
                    key={dependency.id}
                    dependency={dependency}
                    canManage={canManageDependencies}
                    busy={busy}
                    onOpen={openTask}
                    onDelete={(id) => void removeDependency(id)}
                  />
                ))}
                {!dependencies?.blocking.length && (
                  <p className={styles.muted}>No successor tasks.</p>
                )}
              </div>
            </section>
            {canManageDependencies && (
              <div className={styles.composer}>
                <Select
                  aria-label="Dependency direction"
                  value={dependencyDirection}
                  onChange={(event) =>
                    setDependencyDirection(
                      event.target.value as "WAITING_ON" | "BLOCKING",
                    )
                  }
                >
                  <option value="WAITING_ON">This task waits on…</option>
                  <option value="BLOCKING">This task blocks…</option>
                </Select>
                <TextInput
                  placeholder="Search task title or number"
                  value={taskQuery}
                  onChange={(event) => setTaskQuery(event.target.value)}
                />
                <Select
                  aria-label="Related task"
                  value={selectedRelatedTaskId}
                  onChange={(event) =>
                    setSelectedRelatedTaskId(event.target.value)
                  }
                >
                  <option value="">Select task…</option>
                  {taskCandidates.map((candidate) => (
                    <option key={candidate.id} value={candidate.id}>
                      {formatTaskNumber(candidate.taskNumber)} · {candidate.title}
                    </option>
                  ))}
                </Select>
                <Button
                  size="sm"
                  disabled={busy || !selectedRelatedTaskId}
                  onClick={() => void addDependency()}
                >
                  <Link2 size={14} />
                  Add dependency
                </Button>
              </div>
            )}
          </div>
        </Collapsible>
      )}

      {canViewOwnTime && (
        <Collapsible title="Time tracking" defaultOpen={false}>
          <div className={styles.stack}>
            {runningTimer && (
              <div className={styles.timer}>
                <Clock3 size={18} />
                <div className={styles.grow}>
                  <strong>{formatDuration(runningSeconds)}</strong>
                  <div className={styles.muted}>
                    Running on {formatTaskNumber(runningTimer.taskNumber)} ·{" "}
                    {runningTimer.taskTitle}
                  </div>
                </div>
              </div>
            )}
            {canCreateTime && (
              <div className={styles.timerActions}>
                <TextInput
                  placeholder="Timer description (optional)"
                  value={timerDescription}
                  disabled={busy || Boolean(runningTimer)}
                  onChange={(event) =>
                    setTimerDescription(event.target.value)
                  }
                />
                <Button
                  size="sm"
                  disabled={
                    busy ||
                    Boolean(runningTimer && runningTimer.taskId !== task.id)
                  }
                  onClick={() => void toggleTimer()}
                >
                  {runningTimer?.taskId === task.id ? (
                    <Square size={14} />
                  ) : (
                    <Play size={14} />
                  )}
                  {runningTimer?.taskId === task.id
                    ? "Stop timer"
                    : "Start timer"}
                </Button>
              </div>
            )}

            {canCreateTime && (
              <div className={styles.manualGrid}>
                <FormField label="Started">
                  {(props) => (
                    <TextInput
                      {...props}
                      type="datetime-local"
                      value={manualStart}
                      onChange={(event) => setManualStart(event.target.value)}
                    />
                  )}
                </FormField>
                <FormField label="Ended">
                  {(props) => (
                    <TextInput
                      {...props}
                      type="datetime-local"
                      value={manualEnd}
                      onChange={(event) => setManualEnd(event.target.value)}
                    />
                  )}
                </FormField>
                <FormField label="Description">
                  {(props) => (
                    <TextInput
                      {...props}
                      value={manualDescription}
                      onChange={(event) =>
                        setManualDescription(event.target.value)
                      }
                    />
                  )}
                </FormField>
                <Button
                  size="sm"
                  disabled={busy || !manualStart || !manualEnd}
                  onClick={() => void addManualLog()}
                >
                  Add manual log
                </Button>
              </div>
            )}

            <div className={styles.summaryRow}>
              <strong>My time: {formatDuration(timeLogs?.ownSeconds ?? 0)}</strong>
              {canViewAllTime && (
                <>
                  <strong>
                    Team total: {formatDuration(timeLogs?.totalSeconds ?? 0)}
                  </strong>
                  <Select
                    aria-label="Time log scope"
                    value={timeScope}
                    onChange={(event) =>
                      setTimeScope(event.target.value as "mine" | "team")
                    }
                  >
                    <option value="mine">My logs</option>
                    <option value="team">Team logs</option>
                  </Select>
                </>
              )}
            </div>
            <div className={styles.list}>
              {timeLogs?.items.map((log) => {
                const isOwn = log.userId === profile?.id;
                const canDelete =
                  canManageAllTime || (canDeleteOwnTime && isOwn);
                const canEdit =
                  Boolean(log.endedAt) &&
                  (canManageAllTime || (canUpdateOwnTime && isOwn));
                if (editingLogId === log.id) {
                  return (
                    <div key={log.id} className={styles.timeEditRow}>
                      <div className={styles.manualGrid}>
                        <FormField label="Started">
                          {(props) => (
                            <TextInput
                              {...props}
                              type="datetime-local"
                              value={editStart}
                              onChange={(event) =>
                                setEditStart(event.target.value)
                              }
                            />
                          )}
                        </FormField>
                        <FormField label="Ended">
                          {(props) => (
                            <TextInput
                              {...props}
                              type="datetime-local"
                              value={editEnd}
                              onChange={(event) =>
                                setEditEnd(event.target.value)
                              }
                            />
                          )}
                        </FormField>
                        <FormField label="Description">
                          {(props) => (
                            <TextInput
                              {...props}
                              value={editDescription}
                              onChange={(event) =>
                                setEditDescription(event.target.value)
                              }
                            />
                          )}
                        </FormField>
                      </div>
                      <div className={styles.summaryRow}>
                        <Button
                          size="sm"
                          disabled={busy || !editStart || !editEnd}
                          onClick={() => void saveEditLog(log)}
                        >
                          Save
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={busy}
                          onClick={cancelEditLog}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  );
                }
                return (
                  <div key={log.id} className={styles.timeRow}>
                    <div className={styles.grow}>
                      <strong>
                        {formatDuration(log.durationSeconds ?? runningSeconds)}
                      </strong>
                      <div className={styles.muted}>
                        {log.userName} · {new Date(log.startedAt).toLocaleString()}
                        {" · "}
                        {log.source}
                      </div>
                      {log.description && <div>{log.description}</div>}
                    </div>
                    {canEdit && (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={busy}
                        onClick={() => beginEditLog(log)}
                      >
                        Edit
                      </Button>
                    )}
                    {canDelete && log.endedAt && (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={busy}
                        onClick={() => void removeTimeLog(log)}
                      >
                        Delete
                      </Button>
                    )}
                  </div>
                );
              })}
              {!timeLogs?.items.length && (
                <p className={styles.muted}>No time logs yet.</p>
              )}
            </div>
          </div>
        </Collapsible>
      )}

      {canViewHistory && (
        <Collapsible title="Stage history" defaultOpen={false}>
          <div className={styles.stack}>
            <div className={styles.summaryRow}>
              <strong>
                Lead time: {formatDuration(history?.leadTimeSeconds ?? 0)}
              </strong>
              <strong>
                Cycle time: {formatDuration(history?.cycleTimeSeconds ?? 0)}
              </strong>
            </div>
            <div className={styles.timeline}>
              {history?.items.map((item) => (
                <div key={item.id} className={styles.historyRow}>
                  <span className={styles.timelineDot} />
                  <div>
                    <strong>
                      {item.fromStatus
                        ? TASK_STATUS_LABELS[item.fromStatus]
                        : "Created"}{" "}
                      → {TASK_STATUS_LABELS[item.toStatus]}
                    </strong>
                    <div className={styles.muted}>
                      {item.changedByName ?? "System"} ·{" "}
                      {new Date(item.changedAt).toLocaleString()}
                      {item.durationInPreviousStatus !== null
                        ? ` · ${formatDuration(item.durationInPreviousStatus)} in previous stage`
                        : ""}
                    </div>
                  </div>
                </div>
              ))}
              {!history?.items.length && (
                <p className={styles.muted}>No status history yet.</p>
              )}
            </div>
          </div>
        </Collapsible>
      )}
    </div>
  );
}
