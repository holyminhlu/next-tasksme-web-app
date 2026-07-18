"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { CheckSquare, Plus, Search } from "lucide-react";
import { hasPermission, useAuth } from "@/modules/auth";
import {
  Badge,
  Button,
  Checkbox,
  EmptyState,
  ErrorState,
  ForbiddenState,
  LoadingState,
  Pagination,
  Table,
} from "@/modules/design-system";
import { useWidget } from "@/modules/dashboard";
import { listMembers } from "@/modules/workspaces/members.service";
import {
  COLUMN_LABELS,
  TaskFilterBar,
  loadVisibleColumns,
  saveVisibleColumns,
  type TaskColumnKey,
} from "@/modules/tasks/components/TaskFilterBar";
import { TaskBulkActionBar } from "@/modules/tasks/components/TaskBulkActionBar";
import {
  TASK_PRIORITY_LABELS,
  TASK_PRIORITY_TONES,
  TASK_STATUS_LABELS,
  TASK_STATUS_TONES,
  TaskDetailDialog,
  TaskQuickComplete,
  TaskStatusMenu,
  describeDueDate,
  formatAbsoluteDate,
  formatTaskNumber,
  hasWorkspaceTaskScope,
  parseTaskFilterState,
  resolveTaskListViewPreset,
  serializeTaskFilterState,
  subscribeTasksChanged,
  taskFilterHasActiveFilters,
  taskFilterStateToListFilters,
  taskListViewPresetToFilterPatch,
  tasksService,
  type CandidateOption,
  type TaskFilterState,
  type TaskListViewPreset,
  type TaskRecord,
} from "@/modules/tasks";
import { PageHeader, useShell } from "@/modules/shell";
import styles from "../app-pages.module.css";
import pageStyles from "./my-tasks.module.css";

const PAGE_SIZE = 20;

function MyTasksContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { profile, selectedWorkspace, permissions } = useAuth();
  const { setQuickCreate, navContext } = useShell();

  const workspaceId = selectedWorkspace?.id ?? null;
  const canUpdate = hasPermission(permissions, "tasks:update");
  const canPickProject = hasPermission(permissions, "projects:read");
  const canFilterMembers = hasPermission(permissions, "members:read");
  const canIncludeDeleted =
    selectedWorkspace?.roleKey === "owner" ||
    selectedWorkspace?.roleKey === "admin";
  const canRestore = canIncludeDeleted;

  const timezone = useMemo(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
    [],
  );

  const filterState = useMemo(
    () => parseTaskFilterState(searchParams),
    [searchParams],
  );
  const viewPreset = resolveTaskListViewPreset(filterState);
  // Phase 4: workspace-scope roles default to tasks assigned to the current
  // user unless assignee/unassigned is set explicitly in the URL.
  const listDefaultAssignee =
    hasWorkspaceTaskScope(selectedWorkspace?.roleKey) && profile
      ? profile.id
      : null;

  const [selectedTask, setSelectedTask] = useState<TaskRecord | null>(null);
  const [overrides, setOverrides] = useState<Record<string, TaskRecord>>({});
  const [deletedIds, setDeletedIds] = useState<string[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [visibleColumns, setVisibleColumns] = useState<TaskColumnKey[]>(
    () => loadVisibleColumns(),
  );
  const [projects, setProjects] = useState<CandidateOption[]>([]);
  const [members, setMembers] = useState<CandidateOption[]>([]);
  const selectAllRef = useRef<HTMLInputElement>(null);

  const setFilterPatch = useCallback(
    (patch: Partial<TaskFilterState>) => {
      const nextState: TaskFilterState = {
        ...filterState,
        ...patch,
        page: "page" in patch ? (patch.page ?? 1) : 1,
      };
      const next = serializeTaskFilterState(nextState);
      const query = next.toString();
      router.replace(query ? `${pathname}?${query}` : pathname);
    },
    [filterState, router, pathname],
  );

  const fetcher = useCallback(
    () =>
      tasksService.listTasks(
        workspaceId ?? "",
        taskFilterStateToListFilters(filterState, {
          defaultAssigneeId: listDefaultAssignee,
          timezone,
          pageSize: PAGE_SIZE,
        }),
      ),
    [workspaceId, filterState, listDefaultAssignee, timezone],
  );

  const state = useWidget(workspaceId ? fetcher : null);

  useEffect(() => subscribeTasksChanged(() => state.reload()), [state]);

  useEffect(() => {
    if (!workspaceId) {
      return;
    }

    let cancelled = false;

    if (canPickProject) {
      void tasksService.listProjects(workspaceId).then((result) => {
        if (!cancelled && result.ok) {
          setProjects(
            result.data.map((project) => ({
              id: project.id,
              name:
                project.visibility === "PRIVATE"
                  ? `${project.name} (private)`
                  : project.name,
              restricted: project.visibility === "PRIVATE",
            })),
          );
        }
      });
    }

    if (canFilterMembers) {
      void listMembers(workspaceId).then((result) => {
        if (!cancelled && result.success) {
          setMembers(
            result.data
              .filter((member) => member.status === "ACTIVE")
              .map((member) => ({
                id: member.user.id,
                name: member.user.fullName,
                role: member.role.key,
              })),
          );
        }
      });
    }

    return () => {
      cancelled = true;
    };
  }, [workspaceId, canPickProject, canFilterMembers]);

  const locale =
    typeof navigator !== "undefined" ? navigator.language : undefined;
  const now = new Date();

  const modulesKnown = navContext.enabledModuleKeys !== null;
  const tasksModuleDisabled =
    modulesKnown && !navContext.enabledModuleKeys!.includes("tasks");

  const hasFilters = taskFilterHasActiveFilters(filterState);

  const items = useMemo(
    () =>
      (state.data?.items ?? [])
        .filter((task) => !deletedIds.includes(task.id))
        .map((task) => overrides[task.id] ?? task),
    [state.data?.items, overrides, deletedIds],
  );

  const deletedInPage = deletedIds.filter((id) =>
    (state.data?.items ?? []).some((task) => task.id === id),
  ).length;
  const total = Math.max(
    items.length,
    (state.data?.total ?? 0) - deletedInPage,
  );
  const totalPages = state.data ? Math.max(1, Math.ceil(total / PAGE_SIZE)) : 1;

  const allSelected =
    items.length > 0 && items.every((task) => selectedIds.includes(task.id));
  const someSelected = items.some((task) => selectedIds.includes(task.id));

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = someSelected && !allSelected;
    }
  }, [someSelected, allSelected]);

  function applyUpdate(task: TaskRecord) {
    setOverrides((current) => ({ ...current, [task.id]: task }));
    setSelectedTask((current) => (current?.id === task.id ? task : current));
  }

  function applyDelete(taskId: string) {
    setDeletedIds((current) =>
      current.includes(taskId) ? current : [...current, taskId],
    );
    setSelectedIds((current) => current.filter((id) => id !== taskId));
    setSelectedTask((current) => (current?.id === taskId ? null : current));
    state.reload();
  }

  async function handleRestore(task: TaskRecord) {
    if (!workspaceId || !canRestore) {
      return;
    }

    const result = await tasksService.restoreTask(workspaceId, task.id, {
      version: task.version,
    });

    if (!result.ok) {
      return;
    }

    applyUpdate(result.data);
    setDeletedIds((current) => current.filter((id) => id !== task.id));
    state.reload();
  }

  function setViewPreset(preset: TaskListViewPreset) {
    setFilterPatch(taskListViewPresetToFilterPatch(preset));
  }

  function handleVisibleColumnsChange(columns: TaskColumnKey[]) {
    setVisibleColumns(columns);
    saveVisibleColumns(columns);
  }

  function toggleSelect(taskId: string) {
    setSelectedIds((current) =>
      current.includes(taskId)
        ? current.filter((id) => id !== taskId)
        : [...current, taskId],
    );
  }

  function toggleSelectAll() {
    if (allSelected) {
      setSelectedIds([]);
      return;
    }
    setSelectedIds(items.map((task) => task.id));
  }

  const selectedTasks = items.filter((task) => selectedIds.includes(task.id));
  const show = (key: TaskColumnKey) => visibleColumns.includes(key);

  if (!hasPermission(permissions, "tasks:read")) {
    return (
      <div className={styles.stack}>
        <PageHeader title="My tasks" />
        <ForbiddenState />
      </div>
    );
  }

  return (
    <div className={styles.stack}>
      <PageHeader
        title="My tasks"
        description={
          viewPreset === "trash"
            ? "Deleted tasks you can restore (owner/admin)."
            : viewPreset === "archived"
              ? "Archived tasks across this workspace."
              : "Tasks assigned to you across all projects in this workspace."
        }
        actions={
          hasPermission(permissions, "tasks:create") && !tasksModuleDisabled ? (
            <Button
              iconLeft={<Plus size={16} aria-hidden />}
              onClick={() => setQuickCreate("task")}
            >
              New task
            </Button>
          ) : undefined
        }
      />

      {tasksModuleDisabled ? (
        <EmptyState
          title="Tasks module is disabled"
          description={
            <>
              The tasks module is turned off for this workspace. An admin can
              re-enable it under{" "}
              <Link href="/settings/modules">Settings → Modules</Link>.
            </>
          }
        />
      ) : (
        <>
          <div
            className={pageStyles.viewPresets}
            role="tablist"
            aria-label="Task views"
          >
            <button
              type="button"
              role="tab"
              aria-selected={viewPreset === "active"}
              className={`${pageStyles.viewPreset} ${viewPreset === "active" ? pageStyles.viewPresetActive : ""}`.trim()}
              onClick={() => setViewPreset("active")}
            >
              Active
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={viewPreset === "archived"}
              className={`${pageStyles.viewPreset} ${viewPreset === "archived" ? pageStyles.viewPresetActive : ""}`.trim()}
              onClick={() => setViewPreset("archived")}
            >
              Archived
            </button>
            {canIncludeDeleted && (
              <button
                type="button"
                role="tab"
                aria-selected={viewPreset === "trash"}
                className={`${pageStyles.viewPreset} ${viewPreset === "trash" ? pageStyles.viewPresetActive : ""}`.trim()}
                onClick={() => setViewPreset("trash")}
              >
                Trash
              </button>
            )}
          </div>

          <TaskFilterBar
            state={filterState}
            onChange={setFilterPatch}
            projects={projects}
            members={members}
            canPickProject={canPickProject}
            canFilterMembers={canFilterMembers}
            canIncludeDeleted={canIncludeDeleted}
            visibleColumns={visibleColumns}
            onVisibleColumnsChange={handleVisibleColumnsChange}
          />

          {selectedTasks.length > 0 && (
            <TaskBulkActionBar
              selectedTasks={selectedTasks}
              projects={projects}
              members={members}
              onClear={() => setSelectedIds([])}
              onComplete={(updated, removed) => {
                for (const task of updated) {
                  applyUpdate(task);
                }
                for (const id of removed) {
                  applyDelete(id);
                }
                setSelectedIds([]);
                state.reload();
              }}
            />
          )}

          {state.loading ? (
            <LoadingState label="Loading tasks..." />
          ) : state.error ? (
            <ErrorState
              title="Couldn't load tasks"
              description={state.error.message}
              onRetry={state.reload}
            />
          ) : items.length === 0 ? (
            <EmptyState
              icon={
                hasFilters ? <Search size={22} /> : <CheckSquare size={22} />
              }
              title={hasFilters ? "No matching tasks" : "No tasks yet"}
              description={
                hasFilters
                  ? "No tasks match the current filters. Try clearing them."
                  : "Create your first task to see it here."
              }
              actions={
                hasFilters ? (
                  <Button
                    variant="secondary"
                    onClick={() =>
                      setFilterPatch({
                        search: "",
                        projectId: null,
                        statuses: [],
                        priorities: [],
                        assigneeId: null,
                        createdById: null,
                        due: null,
                        deadlineFrom: null,
                        deadlineTo: null,
                        overdue: false,
                        unassigned: false,
                        includeArchived: false,
                        includeDeleted: false,
                        page: 1,
                      })
                    }
                  >
                    Clear filters
                  </Button>
                ) : hasPermission(permissions, "tasks:create") ? (
                  <Button onClick={() => setQuickCreate("task")}>
                    New task
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <div className={pageStyles.resultsCard}>
              <p className={pageStyles.resultsSummary} aria-live="polite">
                {total} task
                {total === 1 ? "" : "s"}
                {hasFilters ? " matching filters" : ""}
                {state.refreshing ? " · refreshing…" : ""}
              </p>

              <div className={pageStyles.desktopTable}>
                <Table aria-label="Tasks">
                  <thead>
                    <tr>
                      <th scope="col" className={pageStyles.selectCol}>
                        <input
                          ref={selectAllRef}
                          type="checkbox"
                          checked={allSelected}
                          onChange={toggleSelectAll}
                          aria-label="Select all tasks on this page"
                        />
                      </th>
                      {show("taskNumber") && (
                        <th scope="col">{COLUMN_LABELS.taskNumber}</th>
                      )}
                      {show("title") && (
                        <th scope="col">{COLUMN_LABELS.title}</th>
                      )}
                      {show("status") && (
                        <th scope="col">{COLUMN_LABELS.status}</th>
                      )}
                      {show("priority") && (
                        <th scope="col">{COLUMN_LABELS.priority}</th>
                      )}
                      {show("project") && (
                        <th scope="col">{COLUMN_LABELS.project}</th>
                      )}
                      {show("assignee") && (
                        <th scope="col">{COLUMN_LABELS.assignee}</th>
                      )}
                      {show("startAt") && (
                        <th scope="col">{COLUMN_LABELS.startAt}</th>
                      )}
                      {show("dueDate") && (
                        <th scope="col">{COLUMN_LABELS.dueDate}</th>
                      )}
                      {show("actions") && (
                        <th scope="col">{COLUMN_LABELS.actions}</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((task) => {
                      const dueInfo = describeDueDate(task, now);
                      return (
                        <tr key={task.id}>
                          <td className={pageStyles.selectCol}>
                            <Checkbox
                              label={
                                <span className={pageStyles.srOnly}>
                                  Select {task.title}
                                </span>
                              }
                              checked={selectedIds.includes(task.id)}
                              onChange={() => toggleSelect(task.id)}
                            />
                          </td>
                          {show("taskNumber") && (
                            <td>{formatTaskNumber(task.taskNumber) ?? "—"}</td>
                          )}
                          {show("title") && (
                            <td>
                              <button
                                type="button"
                                className={pageStyles.titleButton}
                                onClick={() => setSelectedTask(task)}
                              >
                                <span
                                  className={`${pageStyles.taskTitle} ${task.status === "DONE" ? pageStyles.taskTitleDone : ""}`.trim()}
                                >
                                  {task.title}
                                </span>
                              </button>
                            </td>
                          )}
                          {show("status") && (
                            <td>
                              <Badge
                                tone={TASK_STATUS_TONES[task.status]}
                                withDot
                              >
                                {TASK_STATUS_LABELS[task.status]}
                              </Badge>
                            </td>
                          )}
                          {show("priority") && (
                            <td>
                              <Badge tone={TASK_PRIORITY_TONES[task.priority]}>
                                {TASK_PRIORITY_LABELS[task.priority]}
                              </Badge>
                            </td>
                          )}
                          {show("project") && (
                            <td>{task.projectName ?? "—"}</td>
                          )}
                          {show("assignee") && (
                            <td>
                              {task.assigneeName ??
                                (task.assigneeId === profile?.id
                                  ? "You"
                                  : "—")}
                            </td>
                          )}
                          {show("startAt") && (
                            <td>
                              {formatAbsoluteDate(task.startAt, locale) ?? "—"}
                            </td>
                          )}
                          {show("dueDate") && (
                            <td>
                              <span className={pageStyles.dueCell}>
                                {formatAbsoluteDate(task.dueDate, locale) ??
                                  "—"}
                                {dueInfo && (
                                  <Badge tone={dueInfo.tone} withDot>
                                    {dueInfo.label}
                                  </Badge>
                                )}
                              </span>
                            </td>
                          )}
                          {show("actions") && (
                            <td>
                              <span className={pageStyles.taskActions}>
                                {viewPreset === "trash" && canRestore ? (
                                  <Button
                                    size="sm"
                                    variant="secondary"
                                    onClick={() => void handleRestore(task)}
                                  >
                                    Restore
                                  </Button>
                                ) : (
                                  <>
                                    <TaskQuickComplete
                                      task={task}
                                      onUpdated={applyUpdate}
                                      disabled={!canUpdate || Boolean(task.deletedAt)}
                                    />
                                    <TaskStatusMenu
                                      task={task}
                                      onUpdated={applyUpdate}
                                      disabled={!canUpdate || Boolean(task.deletedAt)}
                                    />
                                  </>
                                )}
                              </span>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </Table>
              </div>

              <ul className={pageStyles.mobileCards}>
                {items.map((task) => {
                  const dueInfo = describeDueDate(task, now);
                  return (
                    <li key={task.id} className={pageStyles.mobileCard}>
                      <div className={pageStyles.mobileCardHeader}>
                        <Checkbox
                          label={
                            <span className={pageStyles.srOnly}>
                              Select {task.title}
                            </span>
                          }
                          checked={selectedIds.includes(task.id)}
                          onChange={() => toggleSelect(task.id)}
                        />
                        <TaskQuickComplete
                          task={task}
                          onUpdated={applyUpdate}
                          disabled={!canUpdate}
                        />
                        <button
                          type="button"
                          className={pageStyles.titleButton}
                          onClick={() => setSelectedTask(task)}
                        >
                          <span className={pageStyles.taskNumber}>
                            {formatTaskNumber(task.taskNumber)}
                          </span>
                          <span
                            className={`${pageStyles.taskTitle} ${task.status === "DONE" ? pageStyles.taskTitleDone : ""}`.trim()}
                          >
                            {task.title}
                          </span>
                        </button>
                      </div>
                      <div className={pageStyles.taskMeta}>
                        <Badge tone={TASK_STATUS_TONES[task.status]} withDot>
                          {TASK_STATUS_LABELS[task.status]}
                        </Badge>
                        <Badge tone={TASK_PRIORITY_TONES[task.priority]}>
                          {TASK_PRIORITY_LABELS[task.priority]}
                        </Badge>
                        {task.projectName && <span>{task.projectName}</span>}
                        {(task.assigneeName ||
                          task.assigneeId === profile?.id) && (
                          <span>
                            {task.assigneeName ??
                              (task.assigneeId === profile?.id ? "You" : "")}
                          </span>
                        )}
                        {formatAbsoluteDate(task.startAt, locale) && (
                          <span>
                            Start {formatAbsoluteDate(task.startAt, locale)}
                          </span>
                        )}
                        {formatAbsoluteDate(task.dueDate, locale) && (
                          <span>
                            Due {formatAbsoluteDate(task.dueDate, locale)}
                          </span>
                        )}
                        {dueInfo && (
                          <Badge tone={dueInfo.tone} withDot>
                            {dueInfo.label}
                          </Badge>
                        )}
                      </div>
                      <div className={pageStyles.taskActions}>
                        {viewPreset === "trash" && canRestore ? (
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => void handleRestore(task)}
                          >
                            Restore
                          </Button>
                        ) : (
                          <TaskStatusMenu
                            task={task}
                            onUpdated={applyUpdate}
                            disabled={!canUpdate || Boolean(task.deletedAt)}
                          />
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>

              {totalPages > 1 && (
                <div className={pageStyles.paginationRow}>
                  <Pagination
                    page={filterState.page}
                    pageCount={totalPages}
                    onPageChange={(nextPage) =>
                      setFilterPatch({ page: nextPage })
                    }
                    aria-label="Task pages"
                  />
                </div>
              )}
            </div>
          )}
        </>
      )}

      <TaskDetailDialog
        task={selectedTask}
        onClose={() => setSelectedTask(null)}
        onUpdated={applyUpdate}
        onDeleted={applyDelete}
        canUpdate={canUpdate}
      />
    </div>
  );
}

export default function MyTasksPage() {
  return (
    <Suspense fallback={<LoadingState label="Loading tasks..." />}>
      <MyTasksContent />
    </Suspense>
  );
}
