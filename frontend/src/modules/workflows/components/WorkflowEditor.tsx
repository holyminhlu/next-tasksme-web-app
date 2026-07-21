"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Badge,
  Button,
  Checkbox,
  Dialog,
  EmptyState,
  ErrorState,
  LoadingState,
  Select,
  TextInput,
  useToast,
} from "@/modules/design-system";
import {
  categoryToLegacyStatus,
  conditionPayload,
  mappingChangesImpact,
  requiredMappingsComplete,
  TASK_PRIORITIES,
  toggleTransition,
  toTransitionInputs,
  transitionKey,
  WORKFLOW_STAGE_CATEGORIES,
} from "../workflows.helpers";
import * as workflowsService from "../workflows.service";
import type {
  ProjectWorkflowState,
  PublishPreview,
  TaskPriority,
  WorkflowConditionClause,
  WorkflowStageCategory,
  WorkflowStageRecord,
  WorkflowTransitionInput,
  WorkflowValidationIssue,
} from "../workflows.types";
import styles from "./workflow-builder.module.css";

type Props = { workspaceId: string; projectId: string; canEdit: boolean };
type StageForm = {
  name: string;
  category: WorkflowStageCategory;
  color: string;
  isInitial: boolean;
  isTerminal: boolean;
};

const PERMISSION_PRESETS = [
  "",
  "tasks:update",
  "tasks:transition",
  "projects:update",
] as const;

function clausesFor(transition: WorkflowTransitionInput): WorkflowConditionClause[] {
  return "version" in transition.conditionsJson
    ? transition.conditionsJson.all
    : [];
}

function defaultClause(): WorkflowConditionClause {
  return { field: "task.assigneeId", operator: "isSet" };
}

function ConditionEditor({
  transition,
  disabled,
  onChange,
}: {
  transition: WorkflowTransitionInput;
  disabled: boolean;
  onChange: (conditions: WorkflowTransitionInput["conditionsJson"]) => void;
}) {
  const clauses = clausesFor(transition);

  function replace(index: number, clause: WorkflowConditionClause) {
    const next = [...clauses];
    next[index] = clause;
    onChange(conditionPayload(next));
  }

  return (
    <div className={styles.conditionList}>
      {clauses.map((clause, index) => (
        <div className={styles.conditionRow} key={`${clause.field}-${index}`}>
          <Select
            aria-label={`Condition ${index + 1} field`}
            value={clause.field}
            disabled={disabled}
            onChange={(event) => {
              const field = event.target.value;
              if (field === "task.assigneeId") {
                replace(index, { field, operator: "isSet" });
              } else if (field === "task.priority") {
                replace(index, { field, operator: "eq", value: "MEDIUM" });
              } else {
                replace(index, {
                  field: field as
                    | "task.isBlocked"
                    | "task.checklistComplete"
                    | "task.dependenciesComplete",
                  operator: "eq",
                  value: true,
                });
              }
            }}
          >
            <option value="task.assigneeId">Assignee</option>
            <option value="task.priority">Priority</option>
            <option value="task.isBlocked">Blocked</option>
            <option value="task.checklistComplete">Checklist complete</option>
            <option value="task.dependenciesComplete">Dependencies complete</option>
          </Select>
          {clause.field === "task.assigneeId" ? (
            <Select
              aria-label={`Condition ${index + 1} operator`}
              value={clause.operator}
              disabled={disabled}
              onChange={(event) =>
                replace(index, {
                  field: "task.assigneeId",
                  operator: event.target.value as "isSet" | "isNotSet",
                })
              }
            >
              <option value="isSet">is assigned</option>
              <option value="isNotSet">is unassigned</option>
            </Select>
          ) : clause.field === "task.priority" ? (
            <>
              <Select
                aria-label={`Condition ${index + 1} operator`}
                value={clause.operator}
                disabled={disabled}
                onChange={(event) =>
                  replace(
                    index,
                    event.target.value === "in"
                      ? {
                          field: "task.priority",
                          operator: "in",
                          value: [clause.operator === "eq" ? clause.value : clause.value[0]!],
                        }
                      : {
                          field: "task.priority",
                          operator: "eq",
                          value:
                            clause.operator === "eq" ? clause.value : clause.value[0]!,
                        },
                  )
                }
              >
                <option value="eq">equals</option>
                <option value="in">is one of</option>
              </Select>
              <Select
                aria-label={`Condition ${index + 1} priority`}
                value={
                  clause.operator === "eq" ? clause.value : clause.value.join(",")
                }
                disabled={disabled}
                onChange={(event) =>
                  replace(
                    index,
                    clause.operator === "eq"
                      ? {
                          field: "task.priority",
                          operator: "eq",
                          value: event.target.value as TaskPriority,
                        }
                      : {
                          field: "task.priority",
                          operator: "in",
                          value: event.target.value.split(",") as TaskPriority[],
                        },
                  )
                }
              >
                {clause.operator === "eq"
                  ? TASK_PRIORITIES.map((priority) => (
                      <option key={priority} value={priority}>
                        {priority}
                      </option>
                    ))
                  : TASK_PRIORITIES.map((priority) => (
                      <option key={priority} value={priority}>
                        {priority}
                      </option>
                    ))}
                {clause.operator === "in" ? (
                  <>
                    <option value="LOW,MEDIUM">LOW or MEDIUM</option>
                    <option value="HIGH,URGENT">HIGH or URGENT</option>
                    <option value="LOW,MEDIUM,HIGH,URGENT">Any priority</option>
                  </>
                ) : null}
              </Select>
            </>
          ) : (
            <Select
              aria-label={`Condition ${index + 1} value`}
              value={String(clause.value)}
              disabled={disabled}
              onChange={(event) =>
                replace(index, { ...clause, value: event.target.value === "true" })
              }
            >
              <option value="true">is true</option>
              <option value="false">is false</option>
            </Select>
          )}
          <Button
            size="sm"
            variant="ghost"
            disabled={disabled}
            onClick={() =>
              onChange(conditionPayload(clauses.filter((_, item) => item !== index)))
            }
          >
            Remove
          </Button>
        </div>
      ))}
      <Button
        size="sm"
        variant="secondary"
        disabled={disabled || clauses.length >= 20}
        onClick={() => onChange(conditionPayload([...clauses, defaultClause()]))}
      >
        Add condition
      </Button>
    </div>
  );
}

export function ProjectWorkflowPanel({ workspaceId, projectId, canEdit }: Props) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [state, setState] = useState<ProjectWorkflowState | null>(null);
  const [newName, setNewName] = useState("");
  const [newCategory, setNewCategory] =
    useState<WorkflowStageCategory>("IN_PROGRESS");
  const [newColor, setNewColor] = useState("#64748b");
  const [editingStage, setEditingStage] = useState<WorkflowStageRecord | null>(null);
  const [stageForm, setStageForm] = useState<StageForm | null>(null);
  const [deleteStage, setDeleteStage] = useState<WorkflowStageRecord | null>(null);
  const [transitions, setTransitions] = useState<WorkflowTransitionInput[]>([]);
  const [validationIssues, setValidationIssues] = useState<WorkflowValidationIssue[]>([]);
  const [publishPreview, setPublishPreview] = useState<PublishPreview | null>(null);
  const [publishOpen, setPublishOpen] = useState(false);
  const [stageMappings, setStageMappings] = useState<Record<string, string>>({});
  const [legacyMappings, setLegacyMappings] = useState<Record<string, string>>({});

  const draft = state?.draft ?? null;
  const published = state?.published ?? null;
  const active = draft ?? published;
  const stages = useMemo(
    () => [...(active?.stages ?? [])].sort((a, b) => a.position - b.position),
    [active?.stages],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    const result = await workflowsService.getProjectWorkflow(workspaceId, projectId);
    setLoading(false);
    if (!result.ok) {
      setLoadError(result.message);
      return;
    }
    setState(result.data);
    setTransitions(
      result.data.draft ? toTransitionInputs(result.data.draft.transitions) : [],
    );
    setValidationIssues([]);
  }, [workspaceId, projectId]);

  // Loading is an external API synchronization triggered by route identity.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => void load(), [load]);

  async function ensureDraft() {
    if (draft) return draft;
    setBusy(true);
    const result = await workflowsService.createWorkflowDraft(workspaceId, projectId);
    setBusy(false);
    if (!result.ok) {
      toast({ title: "Couldn't create draft", description: result.message, tone: "error" });
      return null;
    }
    setState((current) => current && { ...current, draft: result.data });
    setTransitions(toTransitionInputs(result.data.transitions));
    return result.data;
  }

  async function mutate(action: () => Promise<{ ok: boolean; message?: string }>, errorTitle: string) {
    setBusy(true);
    const result = await action();
    setBusy(false);
    if (!result.ok) {
      toast({ title: errorTitle, description: result.message, tone: "error" });
      return false;
    }
    await load();
    return true;
  }

  async function addStage() {
    if (!newName.trim()) return;
    const current = await ensureDraft();
    if (!current) return;
    const saved = await mutate(
      () =>
        workflowsService.addStage(workspaceId, projectId, current.id, {
          name: newName.trim(),
          category: newCategory,
          color: newColor || undefined,
        }),
      "Couldn't add stage",
    );
    if (saved) setNewName("");
  }

  function beginStageEdit(stage: WorkflowStageRecord) {
    setEditingStage(stage);
    setStageForm({
      name: stage.name,
      category: stage.category,
      color: stage.color ?? "",
      isInitial: stage.isInitial,
      isTerminal: stage.isTerminal,
    });
  }

  async function saveStage() {
    if (!draft || !editingStage || !stageForm || !stageForm.name.trim()) return;
    const saved = await mutate(
      () =>
        workflowsService.updateStage(
          workspaceId,
          projectId,
          draft.id,
          editingStage.id,
          { ...stageForm, name: stageForm.name.trim(), color: stageForm.color || null },
        ),
      "Couldn't update stage",
    );
    if (saved) {
      setEditingStage(null);
      setStageForm(null);
    }
  }

  async function moveStage(stage: WorkflowStageRecord, direction: -1 | 1) {
    if (!draft) return;
    const index = stages.findIndex((item) => item.id === stage.id);
    const target = index + direction;
    if (target < 0 || target >= stages.length) return;
    const next = [...stages];
    [next[index], next[target]] = [next[target]!, next[index]!];
    await mutate(
      () =>
        workflowsService.reorderStages(
          workspaceId,
          projectId,
          draft.id,
          next.map((item) => item.id),
        ),
      "Couldn't reorder stages",
    );
  }

  function updateTransition(
    key: string,
    update: Partial<Pick<WorkflowTransitionInput, "requiredPermission" | "conditionsJson">>,
  ) {
    setTransitions((current) =>
      current.map((item) => (transitionKey(item) === key ? { ...item, ...update } : item)),
    );
  }

  async function saveTransitions() {
    if (!draft) return;
    const saved = await mutate(
      () => workflowsService.saveTransitions(workspaceId, projectId, draft.id, transitions),
      "Couldn't save transitions",
    );
    if (saved) toast({ title: "Transitions saved", tone: "success" });
  }

  async function validateDraft(): Promise<boolean> {
    if (!draft) return false;
    setBusy(true);
    const result = await workflowsService.validateWorkflowDraft(
      workspaceId,
      projectId,
      draft.id,
    );
    setBusy(false);
    if (!result.ok) {
      toast({ title: "Validation failed", description: result.message, tone: "error" });
      return false;
    }
    setValidationIssues(result.data.issues);
    if (!result.data.valid) return false;
    toast({ title: "Workflow is valid", tone: "success" });
    return true;
  }

  async function preparePublish() {
    if (!draft || !(await validateDraft())) return;
    setBusy(true);
    const result = await workflowsService.getPublishPreview(workspaceId, projectId, draft.id);
    setBusy(false);
    if (!result.ok) {
      toast({ title: "Couldn't prepare publish", description: result.message, tone: "error" });
      return;
    }
    const nextStages: Record<string, string> = {};
    for (const source of result.data.requiredStageMappings) {
      const exact = draft.stages.find(
        (target) => target.name.toLowerCase() === source.name.toLowerCase(),
      );
      if (exact) nextStages[source.id] = exact.id;
    }
    const nextLegacy: Record<string, string> = {};
    for (const source of result.data.legacyStatusCounts) {
      const match = draft.stages.find(
        (target) => categoryToLegacyStatus(target.category) === source.status,
      );
      if (match) nextLegacy[source.status] = match.id;
    }
    setPublishPreview(result.data);
    setStageMappings(nextStages);
    setLegacyMappings(nextLegacy);
    setPublishOpen(true);
  }

  async function publish() {
    if (!draft || !publishPreview) return;
    setBusy(true);
    const result = await workflowsService.publishWorkflow(workspaceId, projectId, {
      draftWorkflowId: draft.id,
      stageMappings: publishPreview.requiredStageMappings.map((source) => ({
        fromStageId: source.id,
        toStageId: stageMappings[source.id]!,
      })),
      legacyStatusMappings: publishPreview.legacyStatusCounts
        .filter((source) => source.count > 0)
        .map((source) => ({
          fromStatus: source.status,
          toStageId: legacyMappings[source.status]!,
        })),
    });
    setBusy(false);
    if (!result.ok) {
      toast({ title: "Publish failed", description: result.message, tone: "error" });
      return;
    }
    setPublishOpen(false);
    toast({
      title: "Workflow published",
      description: `Version ${result.data.workflowVersion} applied to ${result.data.movedTasks} tasks.`,
      tone: "success",
    });
    await load();
  }

  if (loading) return <LoadingState label="Loading workflow…" />;
  if (loadError) {
    return (
      <ErrorState
        title="Couldn't load workflow"
        description={loadError}
        onRetry={() => void load()}
      />
    );
  }
  if (!active) {
    return (
      <EmptyState
        title="No workflow configured"
        description="This project does not have a published workflow yet."
      />
    );
  }

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <div>
          <h3>{active.name}</h3>
          <p className={styles.subtitle}>
            {draft ? "Editing a draft. Publish to migrate existing tasks." : `Published v${active.version}`}
          </p>
        </div>
        {canEdit ? (
          draft ? (
            <Button disabled={busy} onClick={() => void preparePublish()}>
              Publish workflow
            </Button>
          ) : (
            <Button disabled={busy} onClick={() => void ensureDraft()}>
              Edit workflow
            </Button>
          )
        ) : null}
      </div>

      {validationIssues.length > 0 ? (
        <div className={styles.validationBox} role="alert">
          <strong>Resolve before publishing</strong>
          <ul>
            {validationIssues.map((issue, index) => (
              <li key={`${issue.field ?? ""}-${index}`}>
                {issue.field ? `${issue.field}: ` : ""}
                {issue.message}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className={styles.previewBoard}>
        {stages.map((stage, index) => (
          <div
            key={stage.id}
            className={styles.previewColumn}
            style={{ borderTopColor: stage.color ?? "#94a3b8" }}
          >
            <div className={styles.previewColumnHeader}>
              <strong>{stage.name}</strong>
              <Badge tone="neutral">{stage.category}</Badge>
              <div className={styles.badges}>
                {stage.isInitial ? <Badge tone="primary">Initial</Badge> : null}
                {stage.isTerminal ? <Badge tone="success">Terminal</Badge> : null}
              </div>
            </div>
            {draft && canEdit ? (
              <div className={styles.stageMetaActions}>
                <Button size="sm" variant="ghost" disabled={busy || index === 0} aria-label={`Move ${stage.name} earlier`} onClick={() => void moveStage(stage, -1)}>↑</Button>
                <Button size="sm" variant="ghost" disabled={busy || index === stages.length - 1} aria-label={`Move ${stage.name} later`} onClick={() => void moveStage(stage, 1)}>↓</Button>
                <Button size="sm" variant="secondary" disabled={busy} onClick={() => beginStageEdit(stage)}>Edit</Button>
                <Button size="sm" variant="dangerOutline" disabled={busy || stages.length <= 1} onClick={() => setDeleteStage(stage)}>Delete</Button>
              </div>
            ) : null}
          </div>
        ))}
      </div>

      {draft && canEdit ? (
        <>
          <section className={styles.editor}>
            <h4>Add stage</h4>
            <div className={styles.addStageRow}>
              <TextInput aria-label="New stage name" value={newName} placeholder="Stage name" onChange={(event) => setNewName(event.target.value)} />
              <Select aria-label="New stage category" value={newCategory} onChange={(event) => setNewCategory(event.target.value as WorkflowStageCategory)}>
                {WORKFLOW_STAGE_CATEGORIES.map((category) => <option key={category}>{category}</option>)}
              </Select>
              <TextInput aria-label="New stage color" type="color" value={newColor} onChange={(event) => setNewColor(event.target.value)} />
              <Button disabled={busy || !newName.trim()} onClick={() => void addStage()}>Add</Button>
            </div>
          </section>

          <section className={styles.editor}>
            <div className={styles.transitionsHeader}>
              <h4>Transitions</h4>
              <p className={styles.subtitle}>Configure allowed moves, permissions, and conditions. All conditions must pass.</p>
            </div>
            <div className={styles.transitionsTable}>
              {stages.flatMap((from) =>
                stages.filter((to) => to.id !== from.id).map((to) => {
                  const key = `${from.id}:${to.id}`;
                  const transition = transitions.find((item) => transitionKey(item) === key);
                  const preset = transition?.requiredPermission ?? "";
                  const customPermission = Boolean(preset && !PERMISSION_PRESETS.includes(preset as typeof PERMISSION_PRESETS[number]));
                  return (
                    <div className={styles.transitionCard} key={key}>
                      <Checkbox
                        label={`${from.name} → ${to.name}`}
                        checked={Boolean(transition)}
                        disabled={busy}
                        onChange={() => setTransitions((current) => toggleTransition(current, from.id, to.id))}
                      />
                      {transition ? (
                        <div className={styles.transitionDetails}>
                          <label>
                            Required permission
                            <Select
                              value={customPermission ? "__custom__" : preset}
                              disabled={busy}
                              onChange={(event) =>
                                updateTransition(key, {
                                  requiredPermission:
                                    event.target.value === "__custom__" ? "custom.permission" : event.target.value || null,
                                })
                              }
                            >
                              <option value="">No extra permission</option>
                              <option value="tasks:update">tasks:update</option>
                              <option value="tasks:transition">tasks:transition</option>
                              <option value="projects:update">projects:update</option>
                              <option value="__custom__">Custom…</option>
                            </Select>
                          </label>
                          {customPermission ? (
                            <TextInput
                              aria-label={`Custom permission for ${from.name} to ${to.name}`}
                              value={transition.requiredPermission ?? ""}
                              disabled={busy}
                              onChange={(event) => updateTransition(key, { requiredPermission: event.target.value || null })}
                            />
                          ) : null}
                          <ConditionEditor
                            transition={transition}
                            disabled={busy}
                            onChange={(conditionsJson) => updateTransition(key, { conditionsJson })}
                          />
                        </div>
                      ) : null}
                    </div>
                  );
                }),
              )}
            </div>
            <div className={styles.publishActions}>
              <Button variant="secondary" disabled={busy} onClick={() => void validateDraft()}>Validate draft</Button>
              <Button disabled={busy} onClick={() => void saveTransitions()}>Save transitions</Button>
            </div>
          </section>
        </>
      ) : null}

      <Dialog
        open={Boolean(editingStage && stageForm)}
        onClose={() => { setEditingStage(null); setStageForm(null); }}
        title={`Edit ${editingStage?.name ?? "stage"}`}
        footer={
          <>
            <Button variant="ghost" onClick={() => { setEditingStage(null); setStageForm(null); }}>Cancel</Button>
            <Button disabled={busy || !stageForm?.name.trim()} onClick={() => void saveStage()}>Save stage</Button>
          </>
        }
      >
        {stageForm ? (
          <div className={styles.dialogForm}>
            <label>Name<TextInput value={stageForm.name} onChange={(event) => setStageForm({ ...stageForm, name: event.target.value })} /></label>
            <label>Category<Select value={stageForm.category} onChange={(event) => setStageForm({ ...stageForm, category: event.target.value as WorkflowStageCategory })}>{WORKFLOW_STAGE_CATEGORIES.map((category) => <option key={category}>{category}</option>)}</Select></label>
            <label>Color<TextInput type="color" value={stageForm.color || "#64748b"} onChange={(event) => setStageForm({ ...stageForm, color: event.target.value })} /></label>
            <Checkbox label="Initial stage" checked={stageForm.isInitial} onChange={(event) => setStageForm({ ...stageForm, isInitial: event.target.checked })} />
            <Checkbox label="Terminal stage" checked={stageForm.isTerminal} onChange={(event) => setStageForm({ ...stageForm, isTerminal: event.target.checked })} />
          </div>
        ) : null}
      </Dialog>

      <Dialog
        open={Boolean(deleteStage)}
        onClose={() => setDeleteStage(null)}
        title={`Delete ${deleteStage?.name ?? "stage"}?`}
        description="This removes the stage and its draft transitions. Live tasks are not moved until publish."
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleteStage(null)}>Cancel</Button>
            <Button
              variant="danger"
              disabled={busy}
              onClick={() => {
                if (!draft || !deleteStage) return;
                void mutate(
                  () => workflowsService.deleteStage(workspaceId, projectId, draft.id, deleteStage.id),
                  "Couldn't delete stage",
                ).then((saved) => { if (saved) setDeleteStage(null); });
              }}
            >
              Delete draft stage
            </Button>
          </>
        }
      />

      <Dialog
        open={publishOpen}
        onClose={() => setPublishOpen(false)}
        title="Map tasks and publish"
        description={`${publishPreview?.taskCount ?? 0} active tasks will use the published workflow.`}
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setPublishOpen(false)}>Cancel</Button>
            <Button
              disabled={busy || !requiredMappingsComplete(publishPreview, stageMappings, legacyMappings)}
              onClick={() => void publish()}
            >
              Confirm publish
            </Button>
          </>
        }
      >
        <div className={styles.mappingList}>
          {publishPreview?.requiredStageMappings.map((source) => {
            const oldStage = published?.stages.find((stage) => stage.id === source.id);
            const target = draft?.stages.find((stage) => stage.id === stageMappings[source.id]);
            return (
              <label className={styles.mappingRow} key={source.id}>
                <span><strong>{source.name}</strong><small>{source.taskCount} tasks</small></span>
                <Select value={stageMappings[source.id] ?? ""} onChange={(event) => setStageMappings((current) => ({ ...current, [source.id]: event.target.value }))}>
                  <option value="">Select target stage</option>
                  {draft?.stages.filter((stage) => stage.isActive).map((stage) => <option key={stage.id} value={stage.id}>{stage.name} · {stage.category}</option>)}
                </Select>
                {mappingChangesImpact(oldStage, target) ? <span className={styles.impactWarning}>Changes category/status to {target?.category} / {target ? categoryToLegacyStatus(target.category) : ""}</span> : null}
              </label>
            );
          })}
          {publishPreview?.legacyStatusCounts.filter((source) => source.count > 0).map((source) => {
            const target = draft?.stages.find((stage) => stage.id === legacyMappings[source.status]);
            return (
              <label className={styles.mappingRow} key={source.status}>
                <span><strong>Legacy {source.status}</strong><small>{source.count} tasks</small></span>
                <Select value={legacyMappings[source.status] ?? ""} onChange={(event) => setLegacyMappings((current) => ({ ...current, [source.status]: event.target.value }))}>
                  <option value="">Select target stage</option>
                  {draft?.stages.filter((stage) => stage.isActive).map((stage) => <option key={stage.id} value={stage.id}>{stage.name} · {stage.category}</option>)}
                </Select>
                {mappingChangesImpact(undefined, target, source.status) ? <span className={styles.impactWarning}>Status changes to {target ? categoryToLegacyStatus(target.category) : ""}</span> : null}
              </label>
            );
          })}
          {publishPreview && !publishPreview.requiresMapping ? <p>No task mappings are required.</p> : null}
        </div>
      </Dialog>
    </div>
  );
}
