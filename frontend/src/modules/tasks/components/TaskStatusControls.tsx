"use client";

import { useState } from "react";
import { Check, ChevronDown, Loader2 } from "lucide-react";
import { useAuth } from "@/modules/auth";
import { DropdownMenu, MenuItem, useToast } from "@/modules/design-system";
import {
  TASK_STATUSES,
  TASK_STATUS_LABELS,
  isConflictError,
} from "../tasks.helpers";
import * as tasksService from "../tasks.service";
import { emitTasksChanged } from "../tasks.events";
import type { TaskRecord, TaskStatus } from "../tasks.types";
import styles from "./task-ui.module.css";

/**
 * Round checkbox-style control that toggles a task between DONE and TODO.
 */
export function TaskQuickComplete({
  task,
  onUpdated,
  disabled = false,
}: {
  task: TaskRecord;
  onUpdated: (task: TaskRecord) => void;
  disabled?: boolean;
}) {
  const { selectedWorkspace } = useAuth();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  const done = task.status === "DONE";

  async function toggle() {
    if (!selectedWorkspace || busy) {
      return;
    }

    setBusy(true);
    const nextStatus: TaskStatus = done ? "TODO" : "DONE";
    const result = await tasksService.updateTaskStatus(
      selectedWorkspace.id,
      task.id,
      { status: nextStatus, version: task.version },
    );
    setBusy(false);

    if (!result.ok) {
      toast({
        title: isConflictError(result.code)
          ? "Task was updated elsewhere"
          : "Couldn't update task",
        description: isConflictError(result.code)
          ? "Reload the list and try again."
          : result.message,
        tone: "error",
      });
      return;
    }

    onUpdated(result.data);
    emitTasksChanged();
  }

  return (
    <button
      type="button"
      className={`${styles.completeButton} ${done ? styles.completeButtonDone : ""}`.trim()}
      aria-label={
        done ? `Reopen "${task.title}"` : `Mark "${task.title}" complete`
      }
      aria-pressed={done}
      disabled={disabled || busy}
      onClick={toggle}
    >
      {busy ? (
        <Loader2 size={13} aria-hidden />
      ) : (
        <Check size={13} aria-hidden />
      )}
    </button>
  );
}

/**
 * Compact status pill that opens a menu with all task statuses.
 */
export function TaskStatusMenu({
  task,
  onUpdated,
  disabled = false,
}: {
  task: TaskRecord;
  onUpdated: (task: TaskRecord) => void;
  disabled?: boolean;
}) {
  const { selectedWorkspace } = useAuth();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  async function setStatus(status: TaskStatus) {
    if (!selectedWorkspace || busy || status === task.status) {
      return;
    }

    setBusy(true);
    const result = await tasksService.updateTaskStatus(
      selectedWorkspace.id,
      task.id,
      { status, version: task.version },
    );
    setBusy(false);

    if (!result.ok) {
      toast({
        title: isConflictError(result.code)
          ? "Task was updated elsewhere"
          : "Couldn't update status",
        description: isConflictError(result.code)
          ? "Reload the list and try again."
          : result.message,
        tone: "error",
      });
      return;
    }

    onUpdated(result.data);
    emitTasksChanged();
  }

  if (disabled) {
    return (
      <span className={styles.statusTrigger}>
        {TASK_STATUS_LABELS[task.status]}
      </span>
    );
  }

  return (
    <DropdownMenu
      align="end"
      menuLabel={`Change status of "${task.title}"`}
      trigger={(props) => (
        <button
          {...props}
          type="button"
          className={styles.statusTrigger}
          aria-label={`Status: ${TASK_STATUS_LABELS[task.status]}. Change status of "${task.title}"`}
          disabled={busy}
        >
          {busy ? (
            <Loader2 size={12} aria-hidden />
          ) : (
            TASK_STATUS_LABELS[task.status]
          )}
          <ChevronDown size={12} aria-hidden />
        </button>
      )}
    >
      {TASK_STATUSES.map((status) => (
        <MenuItem
          key={status}
          selected={status === task.status}
          onSelect={() => void setStatus(status)}
        >
          {TASK_STATUS_LABELS[status]}
        </MenuItem>
      ))}
    </DropdownMenu>
  );
}
