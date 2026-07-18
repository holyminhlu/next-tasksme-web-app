"use client";

import { useEffect, useMemo, useState } from "react";
import { hasPermission, useAuth } from "@/modules/auth";
import {
  Badge,
  Button,
  Drawer,
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
  filterEligibleAssignees,
  formatAbsoluteDate,
  formatAbsoluteDateTime,
  formatTaskNumber,
  isConflictError,
  pastDueWarning,
  projectMembersToCandidates,
  toDateInputValue,
  validateTaskDates,
} from "../tasks.helpers";
import * as tasksService from "../tasks.service";
import { emitTasksChanged } from "../tasks.events";
import type {
  CandidateOption,
  ProjectRecord,
  TaskActivityEvent,
  TaskPriority,
  TaskRecord,
  TaskStatus,
  UpdateTaskInput,
} from "../tasks.types";
import { AssigneePicker } from "./AssigneePicker";
import styles from "./task-ui.module.css";

type EditFields = {
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  startAt: string;
  dueDate: string;
  projectId: string;
  assigneeId: string;
  blockedReason: string;
};

function editFieldsFromTask(task: TaskRecord): EditFields {
  return {
    title: task.title,
    description: task.description ?? "",
    status: task.status,
    priority: task.priority,
    startAt: toDateInputValue(task.startAt),
    dueDate: toDateInputValue(task.dueDate),
    projectId: task.projectId ?? "",
    assigneeId: task.assigneeId ?? "",
    blockedReason: task.blockedReason ?? "",
  };
}

/**
 * Task detail drawer: editable fields per permission, activity history,
 * archive/unarchive/delete/restore, and 409 conflict reload.
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
  const [conflict, setConflict] = useState(false);

  const [fields, setFields] = useState<EditFields | null>(null);
  const [current, setCurrent] = useState<TaskRecord | null>(task);
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [workspaceMembers, setWorkspaceMembers] = useState<CandidateOption[]>(
    [],
  );
  const [eligibleByProject, setEligibleByProject] = useState<{
    projectId: string;
    options: CandidateOption[];
  } | null>(null);
  const [activity, setActivity] = useState<TaskActivityEvent[]>([]);
  const [activityError, setActivityError] = useState<string | null>(null);
  const [loadedTaskId, setLoadedTaskId] = useState<string | null>(null);

  const workspaceId = selectedWorkspace?.id ?? null;
  const taskId = task?.id ?? null;
  const loadingDetail = Boolean(taskId) && loadedTaskId !== taskId;
  const canDelete = hasPermission(permissions, "tasks:delete");
  const canAssign = hasPermission(permissions, "tasks:assign");
  const canListProjects = hasPermission(permissions, "projects:read");
  const canListMembers = hasPermission(permissions, "members:read");
  const canRestore =
    selectedWorkspace?.roleKey === "owner" ||
    selectedWorkspace?.roleKey === "admin";

  const locale =
    typeof navigator !== "undefined" ? navigator.language : undefined;

  const [lastTaskId, setLastTaskId] = useState(taskId);
  if (taskId !== lastTaskId) {
    setLastTaskId(taskId);
    setCurrent(task);
    setFields(task ? editFieldsFromTask(task) : null);
    setError(null);
    setConflict(false);
    setActivity([]);
    setActivityError(null);
    setLoadedTaskId(null);
  }

  useEffect(() => {
    if (!taskId || !workspaceId) {
      return;
    }

    let cancelled = false;

    void tasksService.getTask(workspaceId, taskId).then((result) => {
      if (cancelled) {
        return;
      }

      if (result.ok) {
        setCurrent(result.data);
        setFields(editFieldsFromTask(result.data));
      }
      setLoadedTaskId(taskId);
    });

    void tasksService.getTaskActivity(workspaceId, taskId, { pageSize: 20 }).then(
      (result) => {
        if (cancelled) {
          return;
        }

        if (result.ok) {
          setActivity(result.data.items);
          setActivityError(null);
        } else {
          setActivityError(result.message);
        }
      },
    );

    if (canListProjects) {
      void tasksService.listProjects(workspaceId).then((result) => {
        if (!cancelled && result.ok) {
          setProjects(result.data);
        }
      });
    }

    if (canListMembers) {
      void listMembers(workspaceId).then((result) => {
        if (!cancelled && result.success) {
          setWorkspaceMembers(
            result.data
              .filter((member) => member.status === "ACTIVE")
              .map((member) => ({
                id: member.user.id,
                name: member.user.fullName,
                role: member.role.key,
                status: member.status,
              })),
          );
        }
      });
    }

    return () => {
      cancelled = true;
    };
  }, [taskId, workspaceId, canListProjects, canListMembers]);

  const selectedProject = useMemo(() => {
    const projectId = fields?.projectId || current?.projectId;
    if (!projectId) {
      return null;
    }
    return projects.find((project) => project.id === projectId) ?? null;
  }, [projects, fields?.projectId, current?.projectId]);

  useEffect(() => {
    if (!workspaceId || !selectedProject) {
      return;
    }

    const projectId = selectedProject.id;
    let cancelled = false;
    void tasksService
      .listEligibleAssignees(workspaceId, projectId)
      .then((result) => {
        if (cancelled) {
          return;
        }

        if (result.ok) {
          setEligibleByProject({ projectId, options: result.data });
          return;
        }

        if (
          selectedProject.visibility !== "PRIVATE" &&
          current?.projectVisibility !== "PRIVATE"
        ) {
          return;
        }

        setEligibleByProject({
          projectId,
          options: filterEligibleAssignees(workspaceMembers, {
            projectVisibility: "PRIVATE",
            projectMemberIds: selectedProject.memberIds,
            projectMembers: projectMembersToCandidates(selectedProject.members),
          }),
        });
      });

    return () => {
      cancelled = true;
    };
  }, [workspaceId, selectedProject, workspaceMembers, current?.projectVisibility]);

  const assigneeOptions = useMemo(() => {
    if (!canListMembers) {
      return null;
    }

    if (
      selectedProject &&
      eligibleByProject?.projectId === selectedProject.id
    ) {
      return eligibleByProject.options;
    }

    return filterEligibleAssignees(workspaceMembers, {
      projectVisibility:
        selectedProject?.visibility ?? current?.projectVisibility,
      projectMemberIds: selectedProject?.memberIds,
    });
  }, [
    canListMembers,
    workspaceMembers,
    selectedProject,
    current?.projectVisibility,
    eligibleByProject,
  ]);

  const projectOptions = useMemo(
    () =>
      canListProjects
        ? projects.map((project) => ({
            id: project.id,
            name:
              project.visibility === "PRIVATE"
                ? `${project.name} (private)`
                : project.name,
            restricted: project.visibility === "PRIVATE",
          }))
        : null,
    [canListProjects, projects],
  );

  function handleConflict(message: string) {
    setConflict(true);
    setError(
      message ||
        "This task was updated elsewhere. Reload to see the latest version.",
    );
  }

  async function reloadTask() {
    if (!workspaceId || !taskId) {
      return;
    }

    setBusy(true);
    const result = await tasksService.getTask(workspaceId, taskId);
    setBusy(false);

    if (!result.ok) {
      setError(result.message);
      return;
    }

    setCurrent(result.data);
    setFields(editFieldsFromTask(result.data));
    setConflict(false);
    setError(null);
    onUpdated(result.data);
  }

  function updateField<K extends keyof EditFields>(
    key: K,
    value: EditFields[K],
  ) {
    setFields((currentFields) => {
      if (!currentFields) {
        return currentFields;
      }

      const next = { ...currentFields, [key]: value };
      if (key === "projectId") {
        next.assigneeId = "";
      }
      return next;
    });
  }

  function buildUpdateInput(
    original: TaskRecord,
    edited: EditFields,
  ): UpdateTaskInput | null {
    const startIso = edited.startAt ? dateInputToIso(edited.startAt) : null;
    const dueIso = edited.dueDate ? dateInputToIso(edited.dueDate) : null;
    const dateError = validateTaskDates(startIso, dueIso);
    if (dateError) {
      setError(dateError);
      return null;
    }

    const input: UpdateTaskInput = { version: original.version };

    const title = edited.title.trim();
    if (title && title !== original.title) {
      input.title = title;
    }

    const description = edited.description.trim() || null;
    if (description !== (original.description ?? null)) {
      input.description = description;
    }

    if (edited.status !== original.status) {
      input.status = edited.status;
    }

    if (edited.priority !== original.priority) {
      input.priority = edited.priority;
    }

    if (edited.startAt !== toDateInputValue(original.startAt)) {
      input.startAt = startIso;
    }

    if (edited.dueDate !== toDateInputValue(original.dueDate)) {
      input.dueDate = dueIso;
    }

    if (
      projectOptions !== null &&
      (edited.projectId || null) !== (original.projectId ?? null)
    ) {
      input.projectId = edited.projectId || null;
    }

    if (
      (canAssign || canListMembers) &&
      assigneeOptions !== null &&
      (edited.assigneeId || null) !== (original.assigneeId ?? null)
    ) {
      input.assigneeId = edited.assigneeId || null;
    }

    const blockedReason = edited.blockedReason.trim() || null;
    if (edited.status === "BLOCKED" && blockedReason !== original.blockedReason) {
      input.isBlocked = true;
      input.blockedReason = blockedReason;
    } else if (
      original.status === "BLOCKED" &&
      edited.status !== "BLOCKED"
    ) {
      input.isBlocked = false;
      input.blockedReason = null;
    }

    return input;
  }

  async function handleSave() {
    if (!current || !selectedWorkspace || !fields || busy) {
      return;
    }

    if (!fields.title.trim()) {
      setError("Title is required.");
      return;
    }

    const input = buildUpdateInput(current, fields);
    if (!input) {
      return;
    }

    if (Object.keys(input).length <= 1) {
      return;
    }

    setBusy(true);
    setError(null);
    setConflict(false);

    const result = await tasksService.updateTask(
      selectedWorkspace.id,
      current.id,
      input,
    );

    setBusy(false);

    if (!result.ok) {
      if (isConflictError(result.code)) {
        handleConflict(result.message);
        return;
      }
      setError(result.message);
      return;
    }

    toast({
      title: "Task updated",
      description: `"${result.data.title}" was saved.`,
      tone: "success",
    });
    setCurrent(result.data);
    setFields(editFieldsFromTask(result.data));
    onUpdated(result.data);
    emitTasksChanged();
  }

  async function handleStatus(status: TaskStatus) {
    if (!current || !selectedWorkspace || busy || status === current.status) {
      return;
    }

    setBusy(true);
    setError(null);
    setConflict(false);

    const result = await tasksService.updateTaskStatus(
      selectedWorkspace.id,
      current.id,
      { status, version: current.version },
    );

    setBusy(false);

    if (!result.ok) {
      if (isConflictError(result.code)) {
        handleConflict(result.message);
        return;
      }
      setError(result.message);
      return;
    }

    toast({
      title: "Task updated",
      description: `"${result.data.title}" is now ${TASK_STATUS_LABELS[result.data.status]}.`,
      tone: "success",
    });
    setCurrent(result.data);
    setFields(editFieldsFromTask(result.data));
    onUpdated(result.data);
    emitTasksChanged();
  }

  async function handleArchive(archive: boolean) {
    if (!current || !selectedWorkspace || busy) {
      return;
    }

    setBusy(true);
    setError(null);
    setConflict(false);

    const result = archive
      ? await tasksService.archiveTask(selectedWorkspace.id, current.id, {
          version: current.version,
        })
      : await tasksService.unarchiveTask(selectedWorkspace.id, current.id, {
          version: current.version,
        });

    setBusy(false);

    if (!result.ok) {
      if (isConflictError(result.code)) {
        handleConflict(result.message);
        return;
      }
      setError(result.message);
      return;
    }

    toast({
      title: archive ? "Task archived" : "Task unarchived",
      description: `"${result.data.title}" was ${archive ? "archived" : "restored from archive"}.`,
      tone: "success",
    });
    setCurrent(result.data);
    onUpdated(result.data);
    emitTasksChanged();
  }

  async function handleRestore() {
    if (!current || !selectedWorkspace || busy || !canRestore) {
      return;
    }

    setBusy(true);
    setError(null);

    const result = await tasksService.restoreTask(
      selectedWorkspace.id,
      current.id,
      { version: current.version },
    );

    setBusy(false);

    if (!result.ok) {
      if (isConflictError(result.code)) {
        handleConflict(result.message);
        return;
      }
      setError(result.message);
      return;
    }

    toast({
      title: "Task restored",
      description: `"${result.data.title}" was restored.`,
      tone: "success",
    });
    setCurrent(result.data);
    onUpdated(result.data);
    emitTasksChanged();
  }

  async function handleDelete() {
    if (!current || !selectedWorkspace || deleting) {
      return;
    }

    const confirmed = window.confirm(
      `Delete "${current.title}"? You may be able to restore it later if you have permission.`,
    );
    if (!confirmed) {
      return;
    }

    setDeleting(true);
    setError(null);
    setConflict(false);

    const result = await tasksService.deleteTask(
      selectedWorkspace.id,
      current.id,
      current.version,
    );

    setDeleting(false);

    if (!result.ok) {
      if (isConflictError(result.code)) {
        handleConflict(result.message);
        return;
      }
      setError(result.message);
      return;
    }

    toast({
      title: "Task deleted",
      description: `"${current.title}" was deleted.`,
      tone: "success",
    });
    onDeleted?.(current.id);
    emitTasksChanged();
    onClose();
  }

  if (!task || !current || !fields) {
    return null;
  }

  const due = describeDueDate(current, new Date());
  const dueAbsolute = formatAbsoluteDate(current.dueDate, locale);
  const startAbsolute = formatAbsoluteDate(current.startAt, locale);
  const dueIso = fields.dueDate ? dateInputToIso(fields.dueDate) : null;
  const startIso = fields.startAt ? dateInputToIso(fields.startAt) : null;
  const dateError = validateTaskDates(startIso, dueIso);
  const dueWarning = pastDueWarning(dueIso);
  const taskCode = formatTaskNumber(current.taskNumber);
  const isOpen = current.status !== "DONE" && current.status !== "CANCELLED";
  const isArchived = Boolean(current.archivedAt);
  const isDeleted = Boolean(current.deletedAt);

  return (
    <Drawer
      open
      onClose={onClose}
      title={current.title}
      side="right"
      size="xl"
      headerActions={
        taskCode ? (
          <Badge tone="neutral">{taskCode}</Badge>
        ) : undefined
      }
      footer={
        canUpdate || canDelete ? (
          <div className={styles.drawerFooter}>
            {canUpdate && !isDeleted && (
              <Button
                loading={busy}
                disabled={Boolean(dateError) || !fields.title.trim() || conflict}
                onClick={() => void handleSave()}
              >
                Save changes
              </Button>
            )}
            {canUpdate && isOpen && !isDeleted && (
              <Button
                variant="secondary"
                loading={busy}
                disabled={conflict}
                onClick={() => void handleStatus("DONE")}
              >
                Mark complete
              </Button>
            )}
            {canUpdate && !isOpen && !isDeleted && (
              <Button
                variant="secondary"
                loading={busy}
                disabled={conflict}
                onClick={() => void handleStatus("TODO")}
              >
                Reopen
              </Button>
            )}
            {canUpdate && !isDeleted && (
              <Button
                variant="secondary"
                loading={busy}
                disabled={conflict}
                onClick={() => void handleArchive(!isArchived)}
              >
                {isArchived ? "Unarchive" : "Archive"}
              </Button>
            )}
            {canRestore && isDeleted && (
              <Button
                variant="secondary"
                loading={busy}
                onClick={() => void handleRestore()}
              >
                Restore
              </Button>
            )}
            {canDelete && !isDeleted && (
              <Button
                variant="dangerOutline"
                loading={deleting}
                disabled={conflict}
                onClick={() => void handleDelete()}
              >
                Delete
              </Button>
            )}
          </div>
        ) : undefined
      }
    >
      <div className={styles.detailStack}>
        {loadingDetail && (
          <p className={styles.mutedText}>Refreshing details…</p>
        )}

        <div className={styles.detailBadges}>
          <Badge tone={TASK_STATUS_TONES[current.status]} withDot>
            {TASK_STATUS_LABELS[current.status]}
          </Badge>
          <Badge tone={TASK_PRIORITY_TONES[current.priority]}>
            {TASK_PRIORITY_LABELS[current.priority]}
          </Badge>
          {due && <Badge tone={due.tone}>{due.label}</Badge>}
          {current.isBlocked && <Badge tone="danger">Blocked</Badge>}
          {isArchived && <Badge tone="warning">Archived</Badge>}
          {isDeleted && <Badge tone="danger">Deleted</Badge>}
        </div>

        {conflict && (
          <div className={styles.conflictBanner} role="alert">
            <p>{error}</p>
            <Button size="sm" onClick={() => void reloadTask()}>
              Reload
            </Button>
          </div>
        )}

        {!conflict && error && (
          <p className={styles.errorText} role="alert">
            {error}
          </p>
        )}

        {canUpdate && !isDeleted ? (
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
                  required
                  value={fields.title}
                  disabled={conflict}
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
                  disabled={conflict}
                  onChange={(event) =>
                    updateField("description", event.target.value)
                  }
                />
              )}
            </FormField>

            <div className={styles.editGrid}>
              <FormField label="Status">
                {(props) => (
                  <Select
                    {...props}
                    value={fields.status}
                    disabled={conflict || busy}
                    onChange={(event) =>
                      updateField("status", event.target.value as TaskStatus)
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

              <FormField label="Priority">
                {(props) => (
                  <Select
                    {...props}
                    value={fields.priority}
                    disabled={conflict}
                    onChange={(event) =>
                      updateField(
                        "priority",
                        event.target.value as TaskPriority,
                      )
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

              <FormField label="Start date">
                {(props) => (
                  <TextInput
                    {...props}
                    type="date"
                    value={fields.startAt}
                    disabled={conflict}
                    onChange={(event) =>
                      updateField("startAt", event.target.value)
                    }
                  />
                )}
              </FormField>

              <FormField label="Deadline">
                {(props) => (
                  <TextInput
                    {...props}
                    type="date"
                    value={fields.dueDate}
                    disabled={conflict}
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
                      disabled={conflict}
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

              {assigneeOptions !== null && (canAssign || canUpdate) && (
                <AssigneePicker
                  value={fields.assigneeId}
                  onChange={(assigneeId) =>
                    updateField("assigneeId", assigneeId)
                  }
                  options={assigneeOptions}
                  disabled={conflict}
                />
              )}
            </div>

            {fields.status === "BLOCKED" && (
              <FormField label="Blocked reason" hint="Optional">
                {(props) => (
                  <TextInput
                    {...props}
                    value={fields.blockedReason}
                    disabled={conflict}
                    onChange={(event) =>
                      updateField("blockedReason", event.target.value)
                    }
                  />
                )}
              </FormField>
            )}

            {dateError && (
              <p className={styles.errorText} role="alert">
                {dateError}
              </p>
            )}
            {!dateError && dueWarning && (
              <p className={styles.warningText} role="status">
                {dueWarning}
              </p>
            )}
          </form>
        ) : (
          <>
            {current.description && (
              <p className={styles.detailDescription}>{current.description}</p>
            )}
            <dl className={styles.detailMeta}>
              <dt>Start</dt>
              <dd>{startAbsolute ?? "—"}</dd>
              <dt>Deadline</dt>
              <dd>{dueAbsolute ?? "No deadline"}</dd>
              <dt>Project</dt>
              <dd>{current.projectName ?? "No project"}</dd>
              <dt>Assignee</dt>
              <dd>
                {current.assigneeName ??
                  (current.assigneeId === profile?.id
                    ? "You"
                    : (current.assigneeId ?? "Unassigned"))}
                {current.assigneeRole ? ` · ${current.assigneeRole}` : ""}
              </dd>
            </dl>
          </>
        )}

        <dl className={styles.detailMeta}>
          <dt>Creator</dt>
          <dd>
            {current.createdByName ??
              (current.createdById === profile?.id
                ? "You"
                : (current.createdById ?? "—"))}
          </dd>
          {current.createdAt && (
            <>
              <dt>Created</dt>
              <dd>
                {formatAbsoluteDateTime(current.createdAt, locale) ?? "—"}
              </dd>
            </>
          )}
          {current.completedAt && (
            <>
              <dt>Completed</dt>
              <dd>
                {formatAbsoluteDateTime(current.completedAt, locale) ?? "—"}
                {current.completedByName
                  ? ` · ${current.completedByName}`
                  : ""}
              </dd>
            </>
          )}
          {current.updatedAt && (
            <>
              <dt>Last updated</dt>
              <dd>
                {formatAbsoluteDateTime(current.updatedAt, locale) ?? "—"}
              </dd>
            </>
          )}
          <dt>Version</dt>
          <dd>{current.version}</dd>
        </dl>

        <section className={styles.activitySection} aria-label="Activity">
          <h3 className={styles.activityTitle}>Activity</h3>
          {activityError && (
            <p className={styles.mutedText}>{activityError}</p>
          )}
          {!activityError && activity.length === 0 && (
            <p className={styles.mutedText}>No activity yet.</p>
          )}
          {activity.length > 0 && (
            <ol className={styles.activityList}>
              {activity.map((event) => (
                <li key={event.id} className={styles.activityItem}>
                  <span className={styles.activitySummary}>{event.summary}</span>
                  <span className={styles.activityMeta}>
                    {[event.actorName, formatAbsoluteDateTime(event.createdAt, locale)]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </Drawer>
  );
}
