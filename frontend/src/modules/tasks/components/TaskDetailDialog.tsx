"use client";

import { useEffect, useState } from "react";
import { hasPermission, useAuth } from "@/modules/auth";
import {
  Badge,
  Button,
  Dialog,
  FormField,
  Select,
  TextArea,
  TextInput,
  useToast,
} from "@/modules/design-system";
import { listMembers } from "@/modules/workspaces/members.service";
import {
  TASK_PRIORITIES,
  TASK_PRIORITY_LABELS,
  TASK_PRIORITY_TONES,
  TASK_STATUSES,
  TASK_STATUS_LABELS,
  TASK_STATUS_TONES,
  dateInputToIso,
  describeDueDate,
  formatAbsoluteDate,
  formatAbsoluteDateTime,
  toDateInputValue,
} from "../tasks.helpers";
import * as tasksService from "../tasks.service";
import type {
  CandidateOption,
  TaskPriority,
  TaskRecord,
  TaskStatus,
  UpdateTaskInput,
} from "../tasks.types";
import styles from "./task-ui.module.css";

type EditFields = {
  title: string;
  description: string;
  priority: TaskPriority;
  /** YYYY-MM-DD, "" = no due date. */
  dueDate: string;
  projectId: string;
  assigneeId: string;
};

function editFieldsFromTask(task: TaskRecord): EditFields {
  return {
    title: task.title,
    description: task.description ?? "",
    priority: task.priority,
    dueDate: toDateInputValue(task.dueDate),
    projectId: task.projectId ?? "",
    assigneeId: task.assigneeId ?? "",
  };
}

/**
 * Task details with permission-aware status controls, inline editing of
 * title / description / priority / due date / project / assignee, and
 * delete with confirmation (tasks:delete).
 */
export function TaskDetailDialog({
  task,
  onClose,
  onUpdated,
  onDeleted,
  canUpdate,
}: {
  task: TaskRecord | null;
  onClose: () => void;
  onUpdated: (task: TaskRecord) => void;
  onDeleted?: (taskId: string) => void;
  canUpdate: boolean;
}) {
  const { selectedWorkspace, profile, permissions } = useAuth();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [editing, setEditing] = useState(false);
  const [fields, setFields] = useState<EditFields | null>(null);
  const [saving, setSaving] = useState(false);
  // null = list unavailable (no permission or failed request); the matching
  // field is then left out of the PATCH so the current value is preserved.
  const [projectOptions, setProjectOptions] = useState<
    CandidateOption[] | null
  >(null);
  const [assigneeOptions, setAssigneeOptions] = useState<
    CandidateOption[] | null
  >(null);

  const workspaceId = selectedWorkspace?.id ?? null;
  const taskId = task?.id ?? null;
  const canDelete = hasPermission(permissions, "tasks:delete");
  const canListProjects = hasPermission(permissions, "projects:read");
  const canListMembers = hasPermission(permissions, "members:read");

  const locale =
    typeof navigator !== "undefined" ? navigator.language : undefined;

  // Leave edit mode whenever the dialog switches to another task
  // (render-time state reset, per React's "adjusting state" pattern).
  const [lastTaskId, setLastTaskId] = useState(taskId);
  if (taskId !== lastTaskId) {
    setLastTaskId(taskId);
    setEditing(false);
    setFields(null);
    setError(null);
  }

  // Load project / assignee options once edit mode opens (best effort).
  useEffect(() => {
    if (!editing || !workspaceId) {
      return;
    }

    let cancelled = false;

    if (canListProjects) {
      void tasksService.listProjects(workspaceId).then((result) => {
        if (!cancelled && result.ok) {
          setProjectOptions(
            result.data.map((project) => ({
              id: project.id,
              name: project.name,
            })),
          );
        }
      });
    }

    if (canListMembers) {
      void listMembers(workspaceId).then((result) => {
        if (!cancelled && result.success) {
          setAssigneeOptions(
            result.data.map((member) => ({
              id: member.user.id,
              name: member.user.fullName,
            })),
          );
        }
      });
    }

    return () => {
      cancelled = true;
    };
  }, [editing, workspaceId, canListProjects, canListMembers]);

  async function updateStatus(status: TaskStatus) {
    if (!task || !selectedWorkspace || busy || status === task.status) {
      return;
    }

    setBusy(true);
    setError(null);

    const result = await tasksService.updateTask(
      selectedWorkspace.id,
      task.id,
      { status },
    );

    setBusy(false);

    if (!result.ok) {
      setError(result.message);
      return;
    }

    toast({
      title: "Task updated",
      description: `"${result.data.title}" is now ${TASK_STATUS_LABELS[result.data.status]}.`,
      tone: "success",
    });
    onUpdated(result.data);
  }

  function startEditing() {
    if (!task) {
      return;
    }

    setFields(editFieldsFromTask(task));
    setError(null);
    setEditing(true);
  }

  function updateField<K extends keyof EditFields>(
    key: K,
    value: EditFields[K],
  ) {
    setFields((current) => (current ? { ...current, [key]: value } : current));
  }

  /** PATCH payload with only the fields that actually changed. */
  function buildUpdateInput(
    original: TaskRecord,
    edited: EditFields,
  ): UpdateTaskInput {
    const input: UpdateTaskInput = {};

    const title = edited.title.trim();
    if (title && title !== original.title) {
      input.title = title;
    }

    const description = edited.description.trim() || null;
    if (description !== (original.description ?? null)) {
      input.description = description;
    }

    if (edited.priority !== original.priority) {
      input.priority = edited.priority;
    }

    if (edited.dueDate !== toDateInputValue(original.dueDate)) {
      input.dueDate = dateInputToIso(edited.dueDate);
    }

    // Project / assignee are only sent when the option list loaded, so a
    // missing list can never clear the current value unintentionally.
    if (
      projectOptions !== null &&
      (edited.projectId || null) !== (original.projectId ?? null)
    ) {
      input.projectId = edited.projectId || null;
    }

    if (
      assigneeOptions !== null &&
      (edited.assigneeId || null) !== (original.assigneeId ?? null)
    ) {
      input.assigneeId = edited.assigneeId || null;
    }

    return input;
  }

  async function handleSave() {
    if (!task || !selectedWorkspace || !fields || saving) {
      return;
    }

    if (!fields.title.trim()) {
      setError("Title is required.");
      return;
    }

    const input = buildUpdateInput(task, fields);

    if (Object.keys(input).length === 0) {
      setEditing(false);
      return;
    }

    setSaving(true);
    setError(null);

    const result = await tasksService.updateTask(
      selectedWorkspace.id,
      task.id,
      input,
    );

    setSaving(false);

    if (!result.ok) {
      setError(result.message);
      return;
    }

    toast({
      title: "Task updated",
      description: `"${result.data.title}" was saved.`,
      tone: "success",
    });
    onUpdated(result.data);
    setEditing(false);
  }

  async function handleDelete() {
    if (!task || !selectedWorkspace || deleting) {
      return;
    }

    const confirmed = window.confirm(
      `Delete "${task.title}"? This cannot be undone.`,
    );
    if (!confirmed) {
      return;
    }

    setDeleting(true);
    setError(null);

    const result = await tasksService.deleteTask(selectedWorkspace.id, task.id);

    setDeleting(false);

    if (!result.ok) {
      setError(result.message);
      return;
    }

    toast({
      title: "Task deleted",
      description: `"${task.title}" was deleted.`,
      tone: "success",
    });
    onDeleted?.(task.id);
    onClose();
  }

  if (!task) {
    return null;
  }

  const due = describeDueDate(task, new Date());
  const dueAbsolute = formatAbsoluteDate(task.dueDate, locale);
  const isOpen = task.status !== "DONE" && task.status !== "CANCELLED";

  // Keep a stale assignee selectable so switching focus doesn't lose it.
  const assigneeSelectOptions =
    assigneeOptions &&
    task.assigneeId &&
    !assigneeOptions.some((option) => option.id === task.assigneeId)
      ? [
          {
            id: task.assigneeId,
            name: task.assigneeName ?? "Current assignee",
          },
          ...assigneeOptions,
        ]
      : assigneeOptions;

  if (editing && fields) {
    return (
      <Dialog open onClose={onClose} title="Edit task" size="md">
        <form
          className={styles.editForm}
          onSubmit={(event) => {
            event.preventDefault();
            void handleSave();
          }}
        >
          <FormField label="Title" required>
            {(props) => (
              <TextInput
                {...props}
                data-autofocus
                required
                value={fields.title}
                onChange={(event) => updateField("title", event.target.value)}
              />
            )}
          </FormField>

          <FormField label="Description" hint="Optional">
            {(props) => (
              <TextArea
                {...props}
                rows={3}
                value={fields.description}
                onChange={(event) =>
                  updateField("description", event.target.value)
                }
              />
            )}
          </FormField>

          <div className={styles.editGrid}>
            <FormField label="Priority">
              {(props) => (
                <Select
                  {...props}
                  value={fields.priority}
                  onChange={(event) =>
                    updateField("priority", event.target.value as TaskPriority)
                  }
                >
                  {TASK_PRIORITIES.map((priority) => (
                    <option key={priority} value={priority}>
                      {TASK_PRIORITY_LABELS[priority]}
                    </option>
                  ))}
                </Select>
              )}
            </FormField>

            <FormField label="Due date" hint="Optional">
              {(props) => (
                <TextInput
                  {...props}
                  type="date"
                  value={fields.dueDate}
                  onChange={(event) =>
                    updateField("dueDate", event.target.value)
                  }
                />
              )}
            </FormField>

            {projectOptions !== null && (
              <FormField label="Project">
                {(props) => (
                  <Select
                    {...props}
                    value={fields.projectId}
                    onChange={(event) =>
                      updateField("projectId", event.target.value)
                    }
                  >
                    <option value="">No project</option>
                    {projectOptions.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.name}
                      </option>
                    ))}
                  </Select>
                )}
              </FormField>
            )}

            {assigneeSelectOptions !== null && (
              <FormField label="Assignee">
                {(props) => (
                  <Select
                    {...props}
                    value={fields.assigneeId}
                    onChange={(event) =>
                      updateField("assigneeId", event.target.value)
                    }
                  >
                    <option value="">Unassigned</option>
                    {assigneeSelectOptions.map((member) => (
                      <option key={member.id} value={member.id}>
                        {member.id === profile?.id
                          ? `${member.name} (you)`
                          : member.name}
                      </option>
                    ))}
                  </Select>
                )}
              </FormField>
            )}
          </div>

          {error && (
            <p className={styles.errorText} role="alert">
              {error}
            </p>
          )}

          <div className={styles.detailActions}>
            <Button
              type="submit"
              loading={saving}
              disabled={!fields.title.trim()}
            >
              Save changes
            </Button>
            <Button
              variant="secondary"
              disabled={saving}
              onClick={() => {
                setEditing(false);
                setError(null);
              }}
            >
              Cancel
            </Button>
          </div>
        </form>
      </Dialog>
    );
  }

  return (
    <Dialog open onClose={onClose} title={task.title} size="md">
      <div className={styles.detailStack}>
        <div className={styles.detailBadges}>
          <Badge tone={TASK_STATUS_TONES[task.status]} withDot>
            {TASK_STATUS_LABELS[task.status]}
          </Badge>
          <Badge tone={TASK_PRIORITY_TONES[task.priority]}>
            {TASK_PRIORITY_LABELS[task.priority]} priority
          </Badge>
          {due && <Badge tone={due.tone}>{due.label}</Badge>}
          {task.isBlocked && <Badge tone="danger">Blocked</Badge>}
        </div>

        {task.description && (
          <p className={styles.detailDescription}>{task.description}</p>
        )}

        <dl className={styles.detailMeta}>
          <dt>Due date</dt>
          <dd>{dueAbsolute ?? "No due date"}</dd>
          <dt>Project</dt>
          <dd>{task.projectName ?? "No project"}</dd>
          <dt>Assignee</dt>
          <dd>
            {task.assigneeName ??
              (task.assigneeId && task.assigneeId === profile?.id
                ? "You"
                : (task.assigneeId ?? "Unassigned"))}
          </dd>
          {task.completedAt && (
            <>
              <dt>Completed</dt>
              <dd>{formatAbsoluteDateTime(task.completedAt, locale) ?? "—"}</dd>
            </>
          )}
          {task.createdAt && (
            <>
              <dt>Created</dt>
              <dd>{formatAbsoluteDateTime(task.createdAt, locale) ?? "—"}</dd>
            </>
          )}
          {task.updatedAt && (
            <>
              <dt>Last updated</dt>
              <dd>{formatAbsoluteDateTime(task.updatedAt, locale) ?? "—"}</dd>
            </>
          )}
        </dl>

        {error && (
          <p className={styles.errorText} role="alert">
            {error}
          </p>
        )}

        {(canUpdate || canDelete) && (
          <div className={styles.detailActions}>
            {canUpdate && (
              <>
                <FormField label="Status" id={`task-status-${task.id}`}>
                  {(props) => (
                    <Select
                      {...props}
                      value={task.status}
                      disabled={busy}
                      onChange={(event) =>
                        void updateStatus(event.target.value as TaskStatus)
                      }
                    >
                      {TASK_STATUSES.map((status) => (
                        <option key={status} value={status}>
                          {TASK_STATUS_LABELS[status]}
                        </option>
                      ))}
                    </Select>
                  )}
                </FormField>
                <Button
                  variant={isOpen ? "primary" : "secondary"}
                  loading={busy}
                  onClick={() => void updateStatus(isOpen ? "DONE" : "TODO")}
                >
                  {isOpen ? "Mark complete" : "Reopen task"}
                </Button>
                <Button variant="secondary" onClick={startEditing}>
                  Edit
                </Button>
              </>
            )}
            {canDelete && (
              <Button
                variant="dangerOutline"
                className={styles.deleteButton}
                loading={deleting}
                onClick={() => void handleDelete()}
              >
                Delete
              </Button>
            )}
          </div>
        )}
      </div>
    </Dialog>
  );
}
