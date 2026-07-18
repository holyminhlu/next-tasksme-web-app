"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowLeft, HelpCircle, Sparkles } from "lucide-react";
import { hasPermission, useAuth } from "@/modules/auth";
import {
  Button,
  FormField,
  Select,
  TextArea,
  TextInput,
  useToast,
} from "@/modules/design-system";
import {
  TASK_PRIORITIES,
  TASK_PRIORITY_LABELS,
  formatAbsoluteDate,
  toDateInputValue,
  toLocalDateString,
} from "../tasks.helpers";
import * as tasksService from "../tasks.service";
import type {
  CandidateOption,
  ParseTaskResult,
  TaskPriority,
  TaskRecord,
} from "../tasks.types";
import styles from "./smart-capture.module.css";

const EXAMPLES = [
  "Call the supplier tomorrow at 10am, high priority",
  "Prepare payroll for the Finance project by Friday",
  "Ask Ann to review the landing page next Monday",
];

type Mode = "capture" | "review" | "manual";

type DraftFields = {
  title: string;
  description: string;
  priority: TaskPriority;
  dueDate: string; // YYYY-MM-DD ("" = none)
  projectId: string;
  assigneeId: string;
};

const EMPTY_DRAFT: DraftFields = {
  title: "",
  description: "",
  priority: "MEDIUM",
  dueDate: "",
  projectId: "",
  assigneeId: "",
};

function dueDateToIso(value: string): string | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

/**
 * Smart Capture: natural-language task entry with an AI parse step, an
 * editable structured preview, and a manual form fallback.
 */
export function SmartCaptureForm({
  onCreated,
  onClose,
}: {
  onCreated?: (task: TaskRecord) => void;
  onClose: () => void;
}) {
  const { selectedWorkspace, permissions } = useAuth();
  const { toast } = useToast();
  const workspaceId = selectedWorkspace?.id ?? null;

  const [mode, setMode] = useState<Mode>("capture");
  const [text, setText] = useState("");
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [parseResult, setParseResult] = useState<ParseTaskResult | null>(null);
  const [fields, setFields] = useState<DraftFields>(EMPTY_DRAFT);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [projects, setProjects] = useState<CandidateOption[]>([]);

  const locale =
    typeof navigator !== "undefined" ? navigator.language : "en-US";
  const timezone = useMemo(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
    [],
  );

  const canPickProject = hasPermission(permissions, "projects:read");

  // Load workspace projects once for the project selects (best effort).
  useEffect(() => {
    if (!workspaceId || !canPickProject) {
      return;
    }

    let cancelled = false;

    void tasksService.listProjects(workspaceId).then((result) => {
      if (!cancelled && result.ok) {
        setProjects(
          result.data.map((project) => ({
            id: project.id,
            name: project.name,
          })),
        );
      }
    });

    return () => {
      cancelled = true;
    };
  }, [workspaceId, canPickProject]);

  const projectOptions = useMemo(() => {
    const merged = new Map<string, CandidateOption>();

    for (const option of [...(parseResult?.projectCandidates ?? []), ...projects]) {
      if (!merged.has(option.id)) {
        merged.set(option.id, option);
      }
    }

    return Array.from(merged.values());
  }, [parseResult?.projectCandidates, projects]);

  const assigneeOptions = parseResult?.assigneeCandidates ?? [];

  const updateField = useCallback(
    <K extends keyof DraftFields>(key: K, value: DraftFields[K]) => {
      setFields((current) => ({ ...current, [key]: value }));
    },
    [],
  );

  async function handleParse() {
    if (!workspaceId || !text.trim() || parsing) {
      return;
    }

    setParsing(true);
    setParseError(null);

    const result = await tasksService.parseTask(workspaceId, {
      text: text.trim(),
      locale,
      timezone,
      referenceDate: toLocalDateString(new Date()),
    });

    setParsing(false);

    if (!result.ok) {
      setParseError(
        result.code === "NOT_FOUND" || result.code === "UNEXPECTED_RESPONSE"
          ? "Smart Capture isn't available right now. You can still create the task manually."
          : result.message,
      );
      return;
    }

    const { draft } = result.data;
    const matchedProject = result.data.projectCandidates.length === 1;
    const matchedAssignee = result.data.assigneeCandidates.length === 1;

    setParseResult(result.data);
    setFields({
      title: draft.title,
      description: draft.description ?? "",
      priority: draft.priority,
      dueDate: toDateInputValue(draft.dueDate),
      projectId: matchedProject ? result.data.projectCandidates[0].id : "",
      assigneeId: matchedAssignee ? result.data.assigneeCandidates[0].id : "",
    });
    setMode("review");
  }

  function startManual(prefillTitle = false) {
    setParseResult(null);
    setParseError(null);
    setFields({
      ...EMPTY_DRAFT,
      title: prefillTitle ? text.trim() : "",
    });
    setMode("manual");
  }

  async function handleCreate() {
    if (!workspaceId || creating || !fields.title.trim()) {
      return;
    }

    setCreating(true);
    setCreateError(null);

    const result = await tasksService.createTask(workspaceId, {
      title: fields.title.trim(),
      description: fields.description.trim() || undefined,
      priority: fields.priority,
      dueDate: dueDateToIso(fields.dueDate),
      projectId: fields.projectId || undefined,
      assigneeId: fields.assigneeId || undefined,
      confirmedFromQuickCapture: mode === "review",
    });

    setCreating(false);

    if (!result.ok) {
      setCreateError(result.message);
      return;
    }

    toast({
      title: "Task created",
      description: `"${result.data.title}" was added to this workspace.`,
      tone: "success",
    });
    onCreated?.(result.data);
    onClose();
  }

  const dueAbsolute = fields.dueDate
    ? formatAbsoluteDate(`${fields.dueDate}T00:00:00`, locale)
    : null;

  // ------------------------------------------------------------------ capture
  if (mode === "capture") {
    return (
      <form
        className={styles.form}
        onSubmit={(event) => {
          event.preventDefault();
          void handleParse();
        }}
      >
        <FormField
          label="Describe the task"
          hint="Include due date, project, assignee or priority in plain language — we'll structure it for you."
          required
        >
          {(props) => (
            <TextArea
              {...props}
              data-autofocus
              rows={3}
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder='e.g. "Call the supplier tomorrow at 10am, high priority"'
            />
          )}
        </FormField>

        <div className={styles.examples}>
          <span className={styles.examplesLabel}>Try:</span>
          {EXAMPLES.map((example) => (
            <button
              key={example}
              type="button"
              className={styles.exampleChip}
              onClick={() => setText(example)}
            >
              {example}
            </button>
          ))}
        </div>

        {parseError && (
          <p className={styles.errorBanner} role="alert">
            {parseError}
          </p>
        )}

        <div className={styles.actionsRow}>
          <Button
            type="submit"
            loading={parsing}
            disabled={!text.trim()}
            iconLeft={<Sparkles size={16} aria-hidden />}
          >
            {parsing ? "Understanding…" : "Preview task"}
          </Button>
          <Button variant="ghost" onClick={() => startManual(true)}>
            Fill in manually
          </Button>
        </div>
      </form>
    );
  }

  // ---------------------------------------------------------- review / manual
  const isReview = mode === "review";

  return (
    <form
      className={styles.form}
      onSubmit={(event) => {
        event.preventDefault();
        void handleCreate();
      }}
    >
      <button
        type="button"
        className={styles.backLink}
        onClick={() => {
          setMode("capture");
          setCreateError(null);
        }}
      >
        <ArrowLeft size={12} aria-hidden /> Back to description
      </button>

      {isReview && (
        <div className={styles.previewCard}>
          <p className={styles.previewTitle}>
            <Sparkles size={14} aria-hidden />
            Here&apos;s what we understood — review and adjust before creating.
          </p>
          {dueAbsolute && (
            <p className={styles.previewSummary}>Due {dueAbsolute}.</p>
          )}
        </div>
      )}

      {isReview && parseResult && parseResult.missingFields.length > 0 && (
        <ul className={styles.noticeList}>
          {parseResult.missingFields.map((field) => (
            <li key={field} className={styles.noticeItem}>
              <HelpCircle size={14} aria-hidden className={styles.noticeIcon} />
              <span>
                We couldn&apos;t determine <strong>{field}</strong> — set it
                below if needed.
              </span>
            </li>
          ))}
        </ul>
      )}

      {isReview && parseResult && parseResult.ambiguities.length > 0 && (
        <ul className={styles.noticeList}>
          {parseResult.ambiguities.map((note) => (
            <li key={note} className={styles.noticeItem}>
              <AlertTriangle
                size={14}
                aria-hidden
                className={styles.noticeIcon}
              />
              <span>{note}</span>
            </li>
          ))}
        </ul>
      )}

      <div className={styles.fieldsGrid}>
        <div className={styles.fieldsGridFull}>
          <FormField label="Title" required>
            {(props) => (
              <TextInput
                {...props}
                required
                value={fields.title}
                onChange={(event) => updateField("title", event.target.value)}
              />
            )}
          </FormField>
        </div>

        <div className={styles.fieldsGridFull}>
          <FormField label="Description" hint="Optional">
            {(props) => (
              <TextArea
                {...props}
                rows={2}
                value={fields.description}
                onChange={(event) =>
                  updateField("description", event.target.value)
                }
              />
            )}
          </FormField>
        </div>

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

        <FormField
          label="Due date"
          hint={dueAbsolute ? `Due ${dueAbsolute}` : "Optional"}
        >
          {(props) => (
            <TextInput
              {...props}
              type="date"
              value={fields.dueDate}
              onChange={(event) => updateField("dueDate", event.target.value)}
            />
          )}
        </FormField>

        {canPickProject && (projectOptions.length > 0 || isReview) && (
          <FormField
            label="Project"
            hint={
              isReview && parseResult?.draft.projectName && !fields.projectId
                ? `Mentioned: "${parseResult.draft.projectName}"`
                : undefined
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
                {projectOptions.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </Select>
            )}
          </FormField>
        )}

        {isReview && assigneeOptions.length > 0 && (
          <FormField
            label="Assignee"
            hint={
              parseResult?.draft.assigneeName && !fields.assigneeId
                ? `Mentioned: "${parseResult.draft.assigneeName}"`
                : undefined
            }
          >
            {(props) => (
              <Select
                {...props}
                value={fields.assigneeId}
                onChange={(event) =>
                  updateField("assigneeId", event.target.value)
                }
              >
                <option value="">Unassigned</option>
                {assigneeOptions.map((candidate) => (
                  <option key={candidate.id} value={candidate.id}>
                    {candidate.name}
                  </option>
                ))}
              </Select>
            )}
          </FormField>
        )}
      </div>

      {createError && (
        <p className={styles.errorBanner} role="alert">
          {createError}
        </p>
      )}

      <div className={styles.actionsRow}>
        <Button type="submit" loading={creating} disabled={!fields.title.trim()}>
          Create task
        </Button>
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
