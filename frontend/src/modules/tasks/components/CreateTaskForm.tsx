"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { hasPermission, useAuth } from "@/modules/auth";
import {
  Button,
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
  TASK_STATUSES,
  TASK_STATUS_LABELS,
  dateInputToIso,
  filterEligibleAssignees,
  pastDueWarning,
  projectMembersToCandidates,
  validateTaskDates,
} from "../tasks.helpers";
import * as tasksService from "../tasks.service";
import { emitTasksChanged } from "../tasks.events";
import type {
  CandidateOption,
  ProjectRecord,
  TaskPriority,
  TaskRecord,
  TaskStatus,
} from "../tasks.types";
import { AssigneePicker } from "./AssigneePicker";
import styles from "./task-ui.module.css";

type CreateFields = {
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  projectId: string;
  assigneeId: string;
  startAt: string;
  dueDate: string;
};

const EMPTY: CreateFields = {
  title: "",
  description: "",
  status: "TODO",
  priority: "MEDIUM",
  projectId: "",
  assigneeId: "",
  startAt: "",
  dueDate: "",
};

/**
 * Full create-task form (alongside Smart Capture): title required, dates
 * validated (due >= start), past-due warning.
 */
export function CreateTaskForm({
  onCreated,
  onClose,
  initialDueDate,
}: {
  onCreated?: (task: TaskRecord) => void;
  onClose: () => void;
  /** YYYY-MM-DD prefill from calendar day click. */
  initialDueDate?: string | null;
}) {
  const { selectedWorkspace, profile, permissions } = useAuth();
  const { toast } = useToast();
  const workspaceId = selectedWorkspace?.id ?? null;

  const [fields, setFields] = useState<CreateFields>({
    ...EMPTY,
    assigneeId: profile?.id ?? "",
    dueDate: initialDueDate ?? "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [workspaceMembers, setWorkspaceMembers] = useState<CandidateOption[]>(
    [],
  );
  const [eligibleByProject, setEligibleByProject] = useState<{
    projectId: string;
    options: CandidateOption[];
  } | null>(null);

  const canPickProject = hasPermission(permissions, "projects:read");
  const canListMembers = hasPermission(permissions, "members:read");
  const canAssign = hasPermission(permissions, "tasks:assign");

  useEffect(() => {
    if (!workspaceId) {
      return;
    }

    let cancelled = false;

    if (canPickProject) {
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
  }, [workspaceId, canPickProject, canListMembers]);

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === fields.projectId) ?? null,
    [projects, fields.projectId],
  );

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

        if (selectedProject.visibility !== "PRIVATE") {
          return;
        }

        const fallback =
          projectMembersToCandidates(selectedProject.members).length > 0
            ? projectMembersToCandidates(selectedProject.members)
            : filterEligibleAssignees(workspaceMembers, {
                projectVisibility: "PRIVATE",
                projectMemberIds: selectedProject.memberIds,
              });
        setEligibleByProject({ projectId, options: fallback });
      });

    return () => {
      cancelled = true;
    };
  }, [workspaceId, selectedProject, workspaceMembers]);

  const eligibleAssignees = useMemo(() => {
    if (
      selectedProject &&
      eligibleByProject?.projectId === selectedProject.id
    ) {
      return eligibleByProject.options;
    }

    return filterEligibleAssignees(workspaceMembers, {
      projectVisibility: selectedProject?.visibility,
      projectMemberIds: selectedProject?.memberIds,
    });
  }, [workspaceMembers, selectedProject, eligibleByProject]);

  function updateField<K extends keyof CreateFields>(
    key: K,
    value: CreateFields[K],
  ) {
    setFields((current) => {
      const next = { ...current, [key]: value };
      if (key === "projectId") {
        next.assigneeId = "";
      }
      return next;
    });
  }

  const startIso = dateInputToIso(fields.startAt);
  const dueIso = dateInputToIso(fields.dueDate);
  const dateError = validateTaskDates(startIso, dueIso);
  const dueWarning = pastDueWarning(dueIso);
  const canSubmit = Boolean(fields.title.trim()) && !dateError && !submitting;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    if (!workspaceId || !canSubmit) {
      return;
    }

    setSubmitting(true);
    setError(null);

    const assigneeId = canAssign
      ? fields.assigneeId || null
      : profile?.id ?? null;

    const result = await tasksService.createTask(workspaceId, {
      title: fields.title.trim(),
      description: fields.description.trim() || undefined,
      status: fields.status,
      priority: fields.priority,
      startAt: startIso,
      dueDate: dueIso,
      projectId: fields.projectId || null,
      assigneeId,
    });

    setSubmitting(false);

    if (!result.ok) {
      setError(result.message);
      return;
    }

    toast({
      title: "Task created",
      description: `"${result.data.title}" was added to this workspace.`,
      tone: "success",
    });
    emitTasksChanged();
    onCreated?.(result.data);
    onClose();
  }

  return (
    <form className={styles.editForm} onSubmit={(event) => void handleSubmit(event)}>
      <FormField label="Title" required>
        {(props) => (
          <TextInput
            {...props}
            data-autofocus
            required
            value={fields.title}
            onChange={(event) => updateField("title", event.target.value)}
            placeholder="What needs to be done?"
          />
        )}
      </FormField>

      <FormField label="Description" hint="Optional">
        {(props) => (
          <TextArea
            {...props}
            rows={3}
            value={fields.description}
            onChange={(event) => updateField("description", event.target.value)}
          />
        )}
      </FormField>

      <div className={styles.editGrid}>
        <FormField label="Status">
          {(props) => (
            <Select
              {...props}
              value={fields.status}
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

        {canPickProject && (
          <FormField
            label="Project"
            hint={
              selectedProject?.visibility === "PRIVATE"
                ? "Private project — assignees must be project members"
                : "Optional"
            }
          >
            {(props) => (
              <Select
                {...props}
                value={fields.projectId}
                onChange={(event) =>
                  updateField("projectId", event.target.value)
                }
              >
                <option value="">No project</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.visibility === "PRIVATE"
                      ? `${project.name} (private)`
                      : project.name}
                  </option>
                ))}
              </Select>
            )}
          </FormField>
        )}

        {(canAssign || canListMembers) && (
          <AssigneePicker
            value={fields.assigneeId}
            onChange={(assigneeId) => updateField("assigneeId", assigneeId)}
            options={eligibleAssignees}
          />
        )}

        <FormField label="Start date" hint="Optional">
          {(props) => (
            <TextInput
              {...props}
              type="date"
              value={fields.startAt}
              onChange={(event) => updateField("startAt", event.target.value)}
            />
          )}
        </FormField>

        <FormField label="Deadline" hint="Optional">
          {(props) => (
            <TextInput
              {...props}
              type="date"
              value={fields.dueDate}
              onChange={(event) => updateField("dueDate", event.target.value)}
            />
          )}
        </FormField>
      </div>

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
      {error && (
        <p className={styles.errorText} role="alert">
          {error}
        </p>
      )}

      <div className={styles.detailActions}>
        <Button type="submit" loading={submitting} disabled={!canSubmit}>
          Create task
        </Button>
        <Button variant="secondary" disabled={submitting} onClick={onClose}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
