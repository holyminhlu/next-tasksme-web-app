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
import {
  TASK_PRIORITY_LABELS,
  TASK_PRIORITY_TONES,
  TASK_STATUSES,
  TASK_STATUS_LABELS,
  applyOptimisticBoardMove,
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

function emptyColumns(): Record<TaskStatus, ColumnState> {
  return Object.fromEntries(
    TASK_STATUSES.map((status) => [
      status,
      { items: [], total: 0, loading: true, loadingMore: false, error: null },
    ]),
  ) as unknown as Record<TaskStatus, ColumnState>;
}

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
    data: { status: task.status, task },
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
  status,
  state,
  canDrag,
  onOpen,
  onLoadMore,
}: {
  status: TaskStatus;
  state: ColumnState;
  canDrag: (task: TaskRecord) => boolean;
  onOpen: (task: TaskRecord) => void;
  onLoadMore: (status: TaskStatus) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `column:${status}` });

  return (
    <section
      className={`${styles.boardColumn} ${isOver ? styles.boardColumnOver : ""}`.trim()}
      aria-label={TASK_STATUS_LABELS[status]}
    >
      <header className={styles.boardColumnHeader}>
        <h3 className={styles.boardColumnTitle}>
          {TASK_STATUS_LABELS[status]}
        </h3>
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
            onClick={() => onLoadMore(status)}
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

  const [columns, setColumns] = useState(emptyColumns);
  const [activeTask, setActiveTask] = useState<TaskRecord | null>(null);
  const [snapshot, setSnapshot] = useState<Record<
    TaskStatus,
    ColumnState
  > | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
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
    async (status: TaskStatus, page = 1, append = false) => {
      if (!workspaceId) {
        return;
      }

      setColumns((current) => ({
        ...current,
        [status]: {
          ...current[status],
          loading: !append,
          loadingMore: append,
          error: null,
        },
      }));

      const result = await tasksService.listBoardColumn(workspaceId, {
        ...baseFilters,
        status,
        sortBy: "rank",
        sortOrder: "asc",
        page,
        pageSize: COLUMN_PAGE_SIZE,
      });

      setColumns((current) => {
        if (!result.ok) {
          return {
            ...current,
            [status]: {
              ...current[status],
              loading: false,
              loadingMore: false,
              error: result.message,
            },
          };
        }

        const prevItems = append ? current[status].items : [];
        const merged = [
          ...prevItems,
          ...result.data.items.filter(
            (task) => !prevItems.some((existing) => existing.id === task.id),
          ),
        ];

        return {
          ...current,
          [status]: {
            items: merged,
            total: result.data.total,
            loading: false,
            loadingMore: false,
            error: null,
          },
        };
      });
    },
    [workspaceId, baseFilters],
  );

  const reloadAll = useCallback(() => {
    for (const status of TASK_STATUSES) {
      void loadColumn(status, 1, false);
    }
  }, [loadColumn]);

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

  function findStatusById(id: string): TaskStatus | null {
    if (id.startsWith("column:")) {
      const status = id.slice("column:".length) as TaskStatus;
      return TASK_STATUSES.includes(status) ? status : null;
    }

    for (const status of TASK_STATUSES) {
      if (columns[status].items.some((task) => task.id === id)) {
        return status;
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

    const activeStatus = findStatusById(String(active.id));
    const overStatus = findStatusById(String(over.id));
    if (!activeStatus || !overStatus || activeStatus === overStatus) {
      return;
    }

    setColumns((current) => {
      const itemsMap = Object.fromEntries(
        TASK_STATUSES.map((status) => [status, current[status].items]),
      ) as Record<TaskStatus, TaskRecord[]>;

      const nextItems = applyOptimisticBoardMove(
        itemsMap,
        String(active.id),
        overStatus,
        String(over.id).startsWith("column:") ? null : String(over.id),
      );

      const next = { ...current };
      for (const status of TASK_STATUSES) {
        next[status] = {
          ...current[status],
          items: nextItems[status],
          total:
            current[status].total +
            (nextItems[status].length - current[status].items.length),
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
    const targetStatus = findStatusById(overId);
    const sourceTask =
      snapshot &&
      TASK_STATUSES.map((status) =>
        snapshot[status].items.find((task) => task.id === activeId),
      ).find(Boolean);

    if (!targetStatus || !sourceTask || !canDrag(sourceTask)) {
      if (snapshot) {
        setColumns(snapshot);
      }
      setSnapshot(null);
      return;
    }

    const optimistic = applyOptimisticBoardMove(
      Object.fromEntries(
        TASK_STATUSES.map((status) => [
          status,
          (snapshot ?? columns)[status].items,
        ]),
      ) as Record<TaskStatus, TaskRecord[]>,
      activeId,
      targetStatus,
      overId.startsWith("column:") ? null : overId,
    );

    setColumns((current) => {
      const next = { ...current };
      for (const status of TASK_STATUSES) {
        next[status] = {
          ...current[status],
          items: optimistic[status],
        };
      }
      return next;
    });

    const neighbors = resolveBoardMoveNeighbors(
      optimistic[targetStatus],
      activeId,
      overId.startsWith("column:") ? null : overId,
    );

    const result = await tasksService.moveTask(workspaceId, activeId, {
      targetStatus,
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
      for (const status of TASK_STATUSES) {
        next[status] = {
          ...current[status],
          items: current[status].items.map((task) =>
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
      <div className={styles.board}>
        {TASK_STATUSES.map((status) => (
          <BoardColumn
            key={status}
            status={status}
            state={columns[status]}
            canDrag={canDrag}
            onOpen={onOpenTask}
            onLoadMore={(columnStatus) => {
              const loaded = columns[columnStatus].items.length;
              const page = Math.floor(loaded / COLUMN_PAGE_SIZE) + 1;
              void loadColumn(columnStatus, page, true);
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
