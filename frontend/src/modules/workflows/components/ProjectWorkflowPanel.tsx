"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Badge,
  Button,
  Checkbox,
  LoadingState,
  Select,
  TextInput,
  useToast,
} from "@/modules/design-system";
import * as workflowsService from "../workflows.service";
import type {
  ProjectWorkflowState,
  WorkflowStageRecord,
} from "../workflows.types";
import styles from "./workflow-builder.module.css";

const CATEGORY_OPTIONS = [
  "BACKLOG",
  "NOT_STARTED",
  "IN_PROGRESS",
  "BLOCKED",
  "COMPLETED",
  "CANCELLED",
] as const;

type Props = {
  workspaceId: string;
  projectId: string;
  canEdit: boolean;
};

export function ProjectWorkflowPanel({ workspaceId, projectId, canEdit }: Props) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [state, setState] = useState<ProjectWorkflowState | null>(null);
  const [newStageName, setNewStageName] = useState("");
  const [newStageCategory, setNewStageCategory] =
    useState<WorkflowStageRecord["category"]>("IN_PROGRESS");
  const [publishOpen, setPublishOpen] = useState(false);
  const [stageMappings, setStageMappings] = useState<Record<string, string>>({});
  const [legacyMappings, setLegacyMappings] = useState<Record<string, string>>({});
  const [deletingStageId, setDeletingStageId] = useState<string | null>(null);
  const [moveToStageId, setMoveToStageId] = useState("");
  const [transitionsDraft, setTransitionsDraft] = useState<
    Record<string, Set<string>>
  >({});

  const draft = state?.draft;
  const published = state?.published;
  const activeWorkflow = draft ?? published;

  const load = useCallback(async () => {
    setLoading(true);
    const result = await workflowsService.getProjectWorkflow(workspaceId, projectId);
    setLoading(false);
    if (!result.ok) {
      toast({ title: "Couldn't load workflow", description: result.message, tone: "error" });
      return;
    }
    setState(result.data);
  }, [workspaceId, projectId, toast]);

  useEffect(() => {
    const id = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(id);
  }, [load]);

  // Seed the transition editor from the draft whenever it (re)loads.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!draft) {
      setTransitionsDraft({});
      return;
    }
    const next: Record<string, Set<string>> = {};
    for (const stage of draft.stages) {
      next[stage.id] = new Set(
        draft.transitions
          .filter((transition) => transition.fromStageId === stage.id)
          .map((transition) => transition.toStageId),
      );
    }
    setTransitionsDraft(next);
  }, [draft]);
  /* eslint-enable react-hooks/set-state-in-effect */

  async function ensureDraft() {
    if (draft) return draft;
    const result = await workflowsService.createWorkflowDraft(workspaceId, projectId);
    if (!result.ok) {
      toast({ title: "Couldn't create draft", description: result.message, tone: "error" });
      return null;
    }
    await load();
    return result.data;
  }

  async function onAddStage() {
    if (!newStageName.trim()) return;
    setBusy(true);
    const currentDraft = await ensureDraft();
    if (!currentDraft) {
      setBusy(false);
      return;
    }
    const result = await workflowsService.addStage(workspaceId, projectId, currentDraft.id, {
      name: newStageName.trim(),
      category: newStageCategory,
    });
    setBusy(false);
    if (!result.ok) {
      toast({ title: "Couldn't add stage", description: result.message, tone: "error" });
      return;
    }
    setNewStageName("");
    await load();
  }

  async function onSetInitial(stage: WorkflowStageRecord) {
    if (!draft) return;
    setBusy(true);
    const result = await workflowsService.updateStage(
      workspaceId,
      projectId,
      draft.id,
      stage.id,
      { isInitial: true },
    );
    setBusy(false);
    if (!result.ok) {
      toast({ title: "Couldn't update stage", description: result.message, tone: "error" });
      return;
    }
    await load();
  }

  async function onToggleTerminal(stage: WorkflowStageRecord) {
    if (!draft) return;
    setBusy(true);
    const result = await workflowsService.updateStage(
      workspaceId,
      projectId,
      draft.id,
      stage.id,
      { isTerminal: !stage.isTerminal },
    );
    setBusy(false);
    if (!result.ok) {
      toast({ title: "Couldn't update stage", description: result.message, tone: "error" });
      return;
    }
    await load();
  }

  async function onMoveStage(stage: WorkflowStageRecord, direction: -1 | 1) {
    if (!draft) return;
    const ordered = [...draft.stages].sort((a, b) => a.position - b.position);
    const index = ordered.findIndex((item) => item.id === stage.id);
    const swapIndex = index + direction;
    if (index < 0 || swapIndex < 0 || swapIndex >= ordered.length) return;
    const next = [...ordered];
    const temp = next[swapIndex]!;
    next[swapIndex] = next[index]!;
    next[index] = temp;
    setBusy(true);
    const result = await workflowsService.reorderStages(
      workspaceId,
      projectId,
      draft.id,
      next.map((item) => item.id),
    );
    setBusy(false);
    if (!result.ok) {
      toast({ title: "Couldn't reorder stages", description: result.message, tone: "error" });
      return;
    }
    await load();
  }

  function startDeleteStage(stage: WorkflowStageRecord) {
    setDeletingStageId(stage.id);
    setMoveToStageId("");
  }

  function cancelDeleteStage() {
    setDeletingStageId(null);
    setMoveToStageId("");
  }

  async function confirmDeleteStage(stage: WorkflowStageRecord) {
    if (!draft) return;
    setBusy(true);
    const result = await workflowsService.deleteStage(
      workspaceId,
      projectId,
      draft.id,
      stage.id,
      moveToStageId || undefined,
    );
    setBusy(false);
    if (!result.ok) {
      toast({ title: "Couldn't delete stage", description: result.message, tone: "error" });
      return;
    }
    setDeletingStageId(null);
    setMoveToStageId("");
    await load();
  }

  function toggleTransition(fromStageId: string, toStageId: string) {
    setTransitionsDraft((current) => {
      const next = { ...current };
      const set = new Set(next[fromStageId] ?? []);
      if (set.has(toStageId)) {
        set.delete(toStageId);
      } else {
        set.add(toStageId);
      }
      next[fromStageId] = set;
      return next;
    });
  }

  async function onSaveTransitions() {
    if (!draft) return;
    setBusy(true);
    const transitions = Object.entries(transitionsDraft).flatMap(
      ([fromStageId, toStageIds]) =>
        [...toStageIds].map((toStageId) => {
          const existing = draft.transitions.find(
            (item) =>
              item.fromStageId === fromStageId && item.toStageId === toStageId,
          );
          return {
            fromStageId,
            toStageId,
            requiredPermission: existing?.requiredPermission ?? null,
            conditionsJson: existing?.conditionsJson ?? {},
          };
        }),
    );
    const result = await workflowsService.saveTransitions(
      workspaceId,
      projectId,
      draft.id,
      transitions,
    );
    setBusy(false);
    if (!result.ok) {
      toast({ title: "Couldn't save transitions", description: result.message, tone: "error" });
      return;
    }
    toast({ title: "Transitions saved", tone: "success" });
    await load();
  }

  async function openPublishDialog() {
    if (!draft) return;
    setBusy(true);
    const preview = await workflowsService.getPublishPreview(workspaceId, projectId, draft.id);
    setBusy(false);
    if (!preview.ok) {
      toast({ title: "Couldn't prepare publish", description: preview.message, tone: "error" });
      return;
    }
    const nextStageMappings: Record<string, string> = {};
    for (const stage of preview.data.currentStages) {
      const match = draft.stages.find(
        (item) => item.name.toLowerCase() === stage.name.toLowerCase(),
      );
      if (match) nextStageMappings[stage.id] = match.id;
    }
    const nextLegacy: Record<string, string> = {};
    for (const item of preview.data.legacyStatusCounts) {
      const match = draft.stages.find((stage) => {
        const label = item.status.toLowerCase().replace(/_/g, " ");
        return stage.name.toLowerCase().includes(label.split(" ")[0] ?? label);
      });
      if (match) nextLegacy[item.status] = match.id;
    }
    setStageMappings(nextStageMappings);
    setLegacyMappings(nextLegacy);
    setPublishOpen(true);
  }

  async function onPublish() {
    if (!draft) return;
    setBusy(true);
    const result = await workflowsService.publishWorkflow(workspaceId, projectId, {
      draftWorkflowId: draft.id,
      stageMappings: Object.entries(stageMappings).map(([fromStageId, toStageId]) => ({
        fromStageId,
        toStageId,
      })),
      legacyStatusMappings: Object.entries(legacyMappings).map(([fromStatus, toStageId]) => ({
        fromStatus,
        toStageId,
      })),
    });
    setBusy(false);
    if (!result.ok) {
      toast({ title: "Publish failed", description: result.message, tone: "error" });
      return;
    }
    toast({
      title: "Workflow published",
      description: `Version ${result.data.workflowVersion} applied (${result.data.movedTasks} tasks migrated).`,
      tone: "success",
    });
    setPublishOpen(false);
    await load();
  }

  const previewStages = useMemo(
    () => [...(activeWorkflow?.stages ?? [])].sort((a, b) => a.position - b.position),
    [activeWorkflow?.stages],
  );

  if (loading) return <LoadingState label="Loading workflow…" />;

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <div>
          <h3>{activeWorkflow?.name ?? "Project workflow"}</h3>
          <p className={styles.subtitle}>
            {draft
              ? "Editing draft — publish to apply safely with task migration."
              : published
                ? `Published v${published.version}`
                : "No workflow configured yet."}
          </p>
        </div>
        {canEdit ? (
          <div className={styles.actions}>
            {!draft ? (
              <Button disabled={busy} onClick={() => void ensureDraft()}>
                Edit workflow
              </Button>
            ) : (
              <Button disabled={busy} onClick={() => void openPublishDialog()}>
                Publish workflow
              </Button>
            )}
          </div>
        ) : null}
      </div>

      <div className={styles.previewBoard}>
        {previewStages.map((stage, index) => (
          <div key={stage.id} className={styles.previewColumn} style={{ borderTopColor: stage.color ?? "#94a3b8" }}>
            <div className={styles.previewColumnHeader}>
              <strong>{stage.name}</strong>
              <Badge tone="neutral">{stage.category}</Badge>
            </div>
            {draft && canEdit ? (
              <div className={styles.stageMetaActions}>
                <div className={styles.reorderButtons}>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busy || index === 0}
                    aria-label={`Move ${stage.name} earlier`}
                    onClick={() => void onMoveStage(stage, -1)}
                  >
                    ↑
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busy || index === previewStages.length - 1}
                    aria-label={`Move ${stage.name} later`}
                    onClick={() => void onMoveStage(stage, 1)}
                  >
                    ↓
                  </Button>
                </div>
                {stage.isInitial ? <Badge tone="primary">Initial</Badge> : (
                  <Button size="sm" variant="ghost" disabled={busy} onClick={() => void onSetInitial(stage)}>
                    Set initial
                  </Button>
                )}
                <Button size="sm" variant="ghost" disabled={busy} onClick={() => void onToggleTerminal(stage)}>
                  {stage.isTerminal ? "Terminal" : "Mark terminal"}
                </Button>
                <Button
                  size="sm"
                  variant="dangerOutline"
                  disabled={busy || previewStages.length <= 1}
                  onClick={() => startDeleteStage(stage)}
                >
                  Delete
                </Button>
              </div>
            ) : null}
            {deletingStageId === stage.id ? (
              <div className={styles.deleteStageRow}>
                <Select
                  value={moveToStageId}
                  onChange={(event) => setMoveToStageId(event.target.value)}
                >
                  <option value="">No existing tasks to move</option>
                  {draft?.stages
                    .filter((item) => item.id !== stage.id)
                    .map((item) => (
                      <option key={item.id} value={item.id}>
                        Move tasks to {item.name}
                      </option>
                    ))}
                </Select>
                <div className={styles.deleteStageActions}>
                  <Button size="sm" variant="ghost" onClick={cancelDeleteStage}>
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    disabled={busy}
                    onClick={() => void confirmDeleteStage(stage)}
                  >
                    Confirm delete
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        ))}
      </div>

      {draft && canEdit ? (
        <div className={styles.editor}>
          <h4>Add stage</h4>
          <div className={styles.addStageRow}>
            <TextInput
              value={newStageName}
              onChange={(event) => setNewStageName(event.target.value)}
              placeholder="Stage name"
            />
            <Select
              value={newStageCategory}
              onChange={(event) =>
                setNewStageCategory(event.target.value as WorkflowStageRecord["category"])
              }
            >
              {CATEGORY_OPTIONS.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </Select>
            <Button disabled={busy} onClick={() => void onAddStage()}>
              Add
            </Button>
          </div>
        </div>
      ) : null}

      {draft && canEdit && draft.stages.length > 1 ? (
        <div className={styles.editor}>
          <div className={styles.transitionsHeader}>
            <h4>Transitions</h4>
            <p className={styles.subtitle}>
              Choose which stages a task can move to directly from each stage.
            </p>
          </div>
          <div className={styles.transitionsTable}>
            {previewStages.map((fromStage) => (
              <div key={fromStage.id} className={styles.transitionRow}>
                <span className={styles.transitionFrom}>{fromStage.name}</span>
                <div className={styles.transitionTargets}>
                  {previewStages
                    .filter((toStage) => toStage.id !== fromStage.id)
                    .map((toStage) => (
                      <Checkbox
                        key={toStage.id}
                        label={toStage.name}
                        checked={
                          transitionsDraft[fromStage.id]?.has(toStage.id) ?? false
                        }
                        disabled={busy}
                        onChange={() => toggleTransition(fromStage.id, toStage.id)}
                      />
                    ))}
                </div>
              </div>
            ))}
          </div>
          <div className={styles.publishActions}>
            <Button disabled={busy} onClick={() => void onSaveTransitions()}>
              Save transitions
            </Button>
          </div>
        </div>
      ) : null}

      {publishOpen && draft && published ? (
        <div className={styles.publishDialog}>
          <h4>Map existing tasks before publish</h4>
          {published.stages.map((stage) => (
            <label key={stage.id} className={styles.mappingRow}>
              <span>{stage.name}</span>
              <Select
                value={stageMappings[stage.id] ?? ""}
                onChange={(event) =>
                  setStageMappings((current) => ({
                    ...current,
                    [stage.id]: event.target.value,
                  }))
                }
              >
                <option value="">Select target stage</option>
                {draft.stages.map((target) => (
                  <option key={target.id} value={target.id}>
                    {target.name}
                  </option>
                ))}
              </Select>
            </label>
          ))}
          <div className={styles.publishActions}>
            <Button variant="ghost" onClick={() => setPublishOpen(false)}>
              Cancel
            </Button>
            <Button disabled={busy} onClick={() => void onPublish()}>
              Confirm publish
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
