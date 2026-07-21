"use client";

import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useCallback, useEffect, useMemo, useState } from "react";
import { hasPermission, useAuth } from "@/modules/auth";
import {
  Badge,
  Button,
  LoadingState,
  useToast,
} from "@/modules/design-system";
import { workflowsService, type WorkflowStageRecord } from "@/modules/workflows";
import {
  TASK_PRIORITY_LABELS,
  TASK_PRIORITY_TONES,
  TASK_STATUSES,
  TASK_STATUS_LABELS,
  applyOptimisticColumnMove,
  canMutateTask,
  formatAbsoluteDate,
  isConflictError,
  resolveBoardMoveNeighbors,
  taskFilterStateToListFilters,
} from "../tasks.helpers";
import { subscribeTasksChanged } from "../tasks.events";
import * as tasksService from "../tasks.service";
import type {
  TaskFilterState,
  TaskRecord,
  TaskStatus,
} from "../tasks.types";
import styles from "./task-views.module.css";

const COLUMN_PAGE_SIZE = 50;

type ColumnState = {
  items: TaskRecord[];
  total: number;
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
};

const EMPTY_COLUMN_STATE: ColumnState = {
  items: [],
  total: 0,
  loading: true,
  loadingMore: false,
  error: null,
};

type ColumnDescriptor = {
  key: string;
  label: string;
  color: string | null;
};

function BoardCardContent({ task }: { task: TaskRecord }) {
  const locale =
    typeof navigator !== "undefined" ? navigator.language : undefined;

  return (
    <>
      <span className={styles.boardCardTitle}>{task.title}</span>
      <div className={styles.boardCardMeta}>
        <Badge tone={TASK_PRIORITY_TONES[task.priority]}>
          {TASK_PRIORITY_LABELS[task.priority]}
        </Badge>
        <span>{task.assigneeName ?? "Unassigned"}</span>
        {task.dueDate && (
          <span>{formatAbsoluteDate(task.dueDate, locale)}</span>
        )}
      </div>
    </>
  );
}

function SortableBoardCard({
  task,
  disabled,
  onOpen,
}: {
  task: TaskRecord;
  disabled: boolean;
  onOpen: (task: TaskRecord) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: task.id,
    data: { task },
    disabled,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <button
      ref={setNodeRef}
      type="button"
      style={style}
      className={`${styles.boardCard} ${isDragging ? styles.boardCardDragging : ""} ${disabled ? styles.boardCardDisabled : ""}`.trim()}
      onClick={() => onOpen(task)}
      {...attributes}
      {...(disabled ? {} : listeners)}
    >
      <BoardCardContent task={task} />
    </button>
  );
}

function BoardColumn({
  column,
  state,
  canDrag,
  onOpen,
  onLoadMore,
}: {
  column: ColumnDescriptor;
  state: ColumnState;
  canDrag: (task: TaskRecord) => boolean;
  onOpen: (task: TaskRecord) => void;
  onLoadMore: (key: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `column:${column.key}` });

  return (
    <section
      className={`${styles.boardColumn} ${isOver ? styles.boardColumnOver : ""}`.trim()}
      aria-label={column.label}
      style={column.color ? { borderTopColor: column.color } : undefined}
    >
      <header className={styles.boardColumnHeader}>
        <h3 className={styles.boardColumnTitle}>{column.label}</h3>
        <span className={styles.boardColumnCount}>{state.total}</span>
      </header>
      <div ref={setNodeRef} className={styles.boardColumnBody}>
        {state.loading ? (
          <LoadingState label="Loading…" />
        ) : state.error ? (
          <p className={styles.boardEmpty}>{state.error}</p>
        ) : state.items.length === 0 ? (
          <p className={styles.boardEmpty}>No tasks</p>
        ) : (
          <SortableContext
            items={state.items.map((task) => task.id)}
            strategy={verticalListSortingStrategy}
          >
            {state.items.map((task) => (
              <SortableBoardCard
                key={task.id}
                task={task}
                disabled={!canDrag(task)}
                onOpen={onOpen}
              />
            ))}
          </SortableContext>
        )}
        {!state.loading && state.items.length < state.total && (
          <Button
            size="sm"
            variant="secondary"
            className={styles.boardLoadMore}
            loading={state.loadingMore}
            onClick={() => onLoadMore(column.key)}
          >
            Load more
          </Button>
        )}
      </div>
    </section>
  );
}

export function TaskBoardView({
  filterState,
  timezone,
  defaultAssigneeId,
  onOpenTask,
}: {
  filterState: TaskFilterState;
  timezone: string;
  defaultAssigneeId?: string | null;
  onOpenTask: (task: TaskRecord) => void;
}) {
  const { profile, selectedWorkspace, permissions } = useAuth();
  const { toast } = useToast();
  const workspaceId = selectedWorkspace?.id ?? null;
  const canUpdate = hasPermission(permissions, "tasks:update");
  const singleProjectId = filterState.projectId;

  const [stages, setStages] = useState<WorkflowStageRecord[]>([]);
  const [stageMode, setStageMode] = useState(false);

  const [columns, setColumns] = useState<Record<string, ColumnState>>({});
  const [activeTask, setActiveTask] = useState<TaskRecord | null>(null);
  const [snapshot, setSnapshot] = useState<Record<
    string,
    ColumnState
  > | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  // Load the project's published workflow when exactly one project is
  // selected; fall back to legacy status columns otherwise (or when the
  // project has no published workflow with active stages).
  useEffect(() => {
    let cancelled = false;

    async function loadWorkflow() {
      if (!workspaceId || !singleProjectId) {
        if (!cancelled) {
          setStages([]);
          setStageMode(false);
        }
        return;
      }

      const result = await workflowsService.getProjectWorkflow(
        workspaceId,
        singleProjectId,
      );
      if (cancelled) return;

      const publishedStages = result.ok
        ? (result.data.published?.stages ?? [])
            .filter((stage) => stage.isActive)
            .sort((a, b) => a.position - b.position)
        : [];

      setStages(publishedStages);
      setStageMode(publishedStages.length > 0);
    }

    void loadWorkflow();
    return () => {
      cancelled = true;
    };
  }, [workspaceId, singleProjectId]);

  const columnDescriptors = useMemo<ColumnDescriptor[]>(() => {
    if (stageMode) {
      return stages.map((stage) => ({
        key: stage.id,
        label: stage.name,
        color: stage.color,
      }));
    }
    return TASK_STATUSES.map((status) => ({
      key: status,
      label: TASK_STATUS_LABELS[status],
      color: null,
    }));
  }, [stageMode, stages]);

  const columnKeys = useMemo(
    () => columnDescriptors.map((column) => column.key),
    [columnDescriptors],
  );
  const columnKeysSignature = columnKeys.join("|");

  const getColumnState = useCallback(
    (key: string): ColumnState => columns[key] ?? EMPTY_COLUMN_STATE,
    [columns],
  );

  const baseFilters = useMemo(
    () =>
      taskFilterStateToListFilters(filterState, {
        defaultAssigneeId,
        timezone,
        pageSize: COLUMN_PAGE_SIZE,
      }),
    [filterState, defaultAssigneeId, timezone],
  );

  const loadColumn = useCallback(
    async (key: string, page = 1, append = false) => {
      if (!workspaceId) {
        return;
      }

      setColumns((current) => ({
        ...current,
        [key]: {
          ...(current[key] ?? EMPTY_COLUMN_STATE),
          loading: !append,
          loadingMore: append,
          error: null,
        },
      }));

      const result = stageMode
        ? await tasksService.listBoardColumn(workspaceId, {
            ...baseFilters,
            status: undefined,
            workflowStageId: key,
            sortBy: "rank",
            sortOrder: "asc",
            page,
            pageSize: COLUMN_PAGE_SIZE,
          })
        : await tasksService.listBoardColumn(workspaceId, {
            ...baseFilters,
            status: key as TaskStatus,
            workflowStageId: undefined,
            sortBy: "rank",
            sortOrder: "asc",
            page,
            pageSize: COLUMN_PAGE_SIZE,
          });

      setColumns((current) => {
        const existing = current[key] ?? EMPTY_COLUMN_STATE;
        if (!result.ok) {
          return {
            ...current,
            [key]: {
              ...existing,
              loading: false,
              loadingMore: false,
              error: result.message,
            },
          };
        }

        const prevItems = append ? existing.items : [];
        const merged = [
          ...prevItems,
          ...result.data.items.filter(
            (task) => !prevItems.some((prevTask) => prevTask.id === task.id),
          ),
        ];

        return {
          ...current,
          [key]: {
            items: merged,
            total: result.data.total,
            loading: false,
            loadingMore: false,
            error: null,
          },
        };
      });
    },
    [workspaceId, baseFilters, stageMode],
  );

  const reloadAll = useCallback(() => {
    for (const key of columnKeys) {
      void loadColumn(key, 1, false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadColumn, columnKeysSignature]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      reloadAll();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [reloadAll]);

  useEffect(() => subscribeTasksChanged(reloadAll), [reloadAll]);

  function canDrag(task: TaskRecord): boolean {
    return (
      canUpdate &&
      !task.deletedAt &&
      canMutateTask(selectedWorkspace?.roleKey, profile?.id, task)
    );
  }

  function patchTaskForColumn(task: TaskRecord, key: string): TaskRecord {
    if (!stageMode) {
      return { ...task, status: key as TaskStatus };
    }
    const stage = stages.find((item) => item.id === key);
    return {
      ...task,
      workflowStageId: key,
      workflowStage: stage
        ? {
            id: stage.id,
            name: stage.name,
            category: stage.category,
            color: stage.color,
            isInitial: stage.isInitial,
            isTerminal: stage.isTerminal,
          }
        : task.workflowStage,
    };
  }

  function findColumnKeyById(id: string): string | null {
    if (id.startsWith("column:")) {
      const key = id.slice("column:".length);
      return columnKeys.includes(key) ? key : null;
    }

    for (const key of columnKeys) {
      if (getColumnState(key).items.some((task) => task.id === id)) {
        return key;
      }
    }

    return null;
  }

  function onDragStart(event: DragStartEvent) {
    const task = event.active.data.current?.task as TaskRecord | undefined;
    setActiveTask(task ?? null);
    setSnapshot(columns);
  }

  function onDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over) {
      return;
    }

    const activeKey = findColumnKeyById(String(active.id));
    const overKey = findColumnKeyById(String(over.id));
    if (!activeKey || !overKey || activeKey === overKey) {
      return;
    }

    setColumns((current) => {
      const itemsMap = Object.fromEntries(
        columnKeys.map((key) => [key, (current[key] ?? EMPTY_COLUMN_STATE).items]),
      ) as Record<string, TaskRecord[]>;

      const nextItems = applyOptimisticColumnMove(
        itemsMap,
        columnKeys,
        String(active.id),
        overKey,
        String(over.id).startsWith("column:") ? null : String(over.id),
        (task) => patchTaskForColumn(task, overKey),
      );

      const next = { ...current };
      for (const key of columnKeys) {
        const existing = current[key] ?? EMPTY_COLUMN_STATE;
        next[key] = {
          ...existing,
          items: nextItems[key] ?? [],
          total: existing.total + ((nextItems[key]?.length ?? 0) - existing.items.length),
        };
      }
      return next;
    });
  }

  async function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveTask(null);

    if (!over || !workspaceId) {
      if (snapshot) {
        setColumns(snapshot);
      }
      setSnapshot(null);
      return;
    }

    const activeId = String(active.id);
    const overId = String(over.id);
    const targetKey = findColumnKeyById(overId);
    const baseColumns = snapshot ?? columns;
    const sourceTask = columnKeys
      .map((key) => (baseColumns[key] ?? EMPTY_COLUMN_STATE).items.find((task) => task.id === activeId))
      .find(Boolean);

    if (!targetKey || !sourceTask || !canDrag(sourceTask)) {
      if (snapshot) {
        setColumns(snapshot);
      }
      setSnapshot(null);
      return;
    }

    const itemsMap = Object.fromEntries(
      columnKeys.map((key) => [key, (baseColumns[key] ?? EMPTY_COLUMN_STATE).items]),
    ) as Record<string, TaskRecord[]>;

    const optimistic = applyOptimisticColumnMove(
      itemsMap,
      columnKeys,
      activeId,
      targetKey,
      overId.startsWith("column:") ? null : overId,
      (task) => patchTaskForColumn(task, targetKey),
    );

    setColumns((current) => {
      const next = { ...current };
      for (const key of columnKeys) {
        next[key] = {
          ...(current[key] ?? EMPTY_COLUMN_STATE),
          items: optimistic[key] ?? [],
        };
      }
      return next;
    });

    const neighbors = resolveBoardMoveNeighbors(
      optimistic[targetKey] ?? [],
      activeId,
      overId.startsWith("column:") ? null : overId,
    );

    const result = await tasksService.moveTask(workspaceId, activeId, {
      ...(stageMode
        ? { targetStageId: targetKey }
        : { targetStatus: targetKey as TaskStatus }),
      beforeTaskId: neighbors.beforeTaskId,
      afterTaskId: neighbors.afterTaskId,
      version: sourceTask.version,
    });

    if (!result.ok) {
      if (snapshot) {
        setColumns(snapshot);
      }
      toast({
        title: isConflictError(result.code)
          ? "Task was updated elsewhere"
          : "Couldn't move task",
        description: result.message,
        tone: "error",
      });
      setSnapshot(null);
      return;
    }

    setColumns((current) => {
      const next = { ...current };
      for (const key of columnKeys) {
        const existing = current[key] ?? EMPTY_COLUMN_STATE;
        next[key] = {
          ...existing,
          items: existing.items.map((task) =>
            task.id === result.data.id ? result.data : task,
          ),
        };
      }
      return next;
    });

    setSnapshot(null);
  }

  function onDragCancel() {
    if (snapshot) {
      setColumns(snapshot);
    }
    setActiveTask(null);
    setSnapshot(null);
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={(event) => void onDragEnd(event)}
      onDragCancel={onDragCancel}
    >
      {stageMode && (
        <p className={styles.boardModeNote}>
          Columns follow this project&rsquo;s published workflow stages.
        </p>
      )}
      <div className={styles.board}>
        {columnDescriptors.map((column) => (
          <BoardColumn
            key={column.key}
            column={column}
            state={getColumnState(column.key)}
            canDrag={canDrag}
            onOpen={onOpenTask}
            onLoadMore={(key) => {
              const loaded = getColumnState(key).items.length;
              const page = Math.floor(loaded / COLUMN_PAGE_SIZE) + 1;
              void loadColumn(key, page, true);
            }}
          />
        ))}
      </div>
      <DragOverlay>
        {activeTask ? (
          <div className={`${styles.boardCard} ${styles.boardCardDragging}`}>
            <BoardCardContent task={activeTask} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
