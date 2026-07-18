"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useMemo, useState } from "react";
import { CheckSquare, Plus, Search, X } from "lucide-react";
import { hasPermission, useAuth } from "@/modules/auth";
import {
  Badge,
  Button,
  EmptyState,
  ErrorState,
  ForbiddenState,
  LoadingState,
  Pagination,
  Select,
  TextInput,
} from "@/modules/design-system";
import { useWidget } from "@/modules/dashboard";
import {
  TASK_PRIORITY_LABELS,
  TASK_PRIORITY_TONES,
  TASK_STATUSES,
  TASK_STATUS_LABELS,
  TaskDetailDialog,
  TaskQuickComplete,
  TaskStatusMenu,
  describeDueDate,
  formatAbsoluteDate,
  hasWorkspaceTaskScope,
  normalizeTaskStatus,
  tasksService,
  type TaskRecord,
} from "@/modules/tasks";
import { PageHeader, useShell } from "@/modules/shell";
import styles from "../app-pages.module.css";
import pageStyles from "./my-tasks.module.css";

const PAGE_SIZE = 20;

type DueFilter = "today" | "overdue" | null;

function parseDueParam(value: string | null): DueFilter {
  return value === "today" || value === "overdue" ? value : null;
}

function MyTasksContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { profile, selectedWorkspace, permissions } = useAuth();
  const { setQuickCreate, navContext } = useShell();

  const workspaceId = selectedWorkspace?.id ?? null;
  const canUpdate = hasPermission(permissions, "tasks:update");
  const canPickProject = hasPermission(permissions, "projects:read");

  // Owner/admin/manager see the whole workspace by default on the backend;
  // "My tasks" narrows to tasks assigned to the current user. Members are
  // already scoped server-side to their own tasks.
  const assigneeId =
    hasWorkspaceTaskScope(selectedWorkspace?.roleKey) && profile
      ? profile.id
      : null;

  const timezone = useMemo(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
    [],
  );

  // Filters live in the URL so dashboard drill-down links work directly.
  const status = normalizeTaskStatus(searchParams.get("status"));
  const due = parseDueParam(searchParams.get("due"));
  const projectId = searchParams.get("projectId");
  const search = searchParams.get("q") ?? "";
  const page = Math.max(1, Number(searchParams.get("page")) || 1);

  const [searchInput, setSearchInput] = useState(search);
  const [selectedTask, setSelectedTask] = useState<TaskRecord | null>(null);
  const [overrides, setOverrides] = useState<Record<string, TaskRecord>>({});
  // Deleted tasks disappear immediately; a reload then fixes totals/pages.
  const [deletedIds, setDeletedIds] = useState<string[]>([]);

  const setParams = useCallback(
    (updates: Record<string, string | null>) => {
      const next = new URLSearchParams(searchParams.toString());

      for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === "") {
          next.delete(key);
        } else {
          next.set(key, value);
        }
      }

      // Any filter change restarts pagination.
      if (!("page" in updates)) {
        next.delete("page");
      }

      const query = next.toString();
      router.replace(query ? `${pathname}?${query}` : pathname);
    },
    [router, pathname, searchParams],
  );

  const fetcher = useCallback(
    () =>
      tasksService.listTasks(workspaceId ?? "", {
        status,
        projectId,
        assigneeId,
        search: search || null,
        due,
        timezone: due ? timezone : null,
        page,
        pageSize: PAGE_SIZE,
      }),
    [workspaceId, status, projectId, assigneeId, search, due, timezone, page],
  );

  const state = useWidget(workspaceId ? fetcher : null);

  const projectsFetcher = useCallback(
    () => tasksService.listProjects(workspaceId ?? ""),
    [workspaceId],
  );
  const projects = useWidget(
    workspaceId && canPickProject ? projectsFetcher : null,
  );

  const locale =
    typeof navigator !== "undefined" ? navigator.language : undefined;
  const now = new Date();

  const modulesKnown = navContext.enabledModuleKeys !== null;
  const tasksModuleDisabled =
    modulesKnown && !navContext.enabledModuleKeys!.includes("tasks");

  const hasFilters = Boolean(status || due || projectId || search);

  const items = useMemo(
    () =>
      (state.data?.items ?? [])
        .filter((task) => !deletedIds.includes(task.id))
        .map((task) => overrides[task.id] ?? task),
    [state.data?.items, overrides, deletedIds],
  );

  // Only subtract deletions the current payload still contains; once the
  // post-delete reload lands, the server total is already correct.
  const deletedInPage = deletedIds.filter((id) =>
    (state.data?.items ?? []).some((task) => task.id === id),
  ).length;
  const total = Math.max(items.length, (state.data?.total ?? 0) - deletedInPage);
  const totalPages = state.data ? Math.max(1, Math.ceil(total / PAGE_SIZE)) : 1;

  function applyUpdate(task: TaskRecord) {
    setOverrides((current) => ({ ...current, [task.id]: task }));
    setSelectedTask((current) => (current?.id === task.id ? task : current));
  }

  function applyDelete(taskId: string) {
    setDeletedIds((current) =>
      current.includes(taskId) ? current : [...current, taskId],
    );
    setSelectedTask((current) => (current?.id === taskId ? null : current));
    // Refetch so the server total and pagination stay accurate.
    state.reload();
  }

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
        description="Tasks assigned to you across all projects in this workspace."
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
          <form
            className={pageStyles.filters}
            role="search"
            aria-label="Task filters"
            onSubmit={(event) => {
              event.preventDefault();
              setParams({ q: searchInput.trim() || null });
            }}
          >
            <div
              className={`${pageStyles.filterField} ${pageStyles.searchField}`}
            >
              <label className={pageStyles.filterLabel} htmlFor="task-search">
                Search
              </label>
              <TextInput
                id="task-search"
                type="search"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                onBlur={() => setParams({ q: searchInput.trim() || null })}
                placeholder="Search tasks…"
              />
            </div>

            <div className={pageStyles.filterField}>
              <label className={pageStyles.filterLabel} htmlFor="task-status">
                Status
              </label>
              <Select
                id="task-status"
                value={status ?? ""}
                onChange={(event) =>
                  setParams({ status: event.target.value || null })
                }
              >
                <option value="">All statuses</option>
                {TASK_STATUSES.map((key) => (
                  <option key={key} value={key}>
                    {TASK_STATUS_LABELS[key]}
                  </option>
                ))}
              </Select>
            </div>

            <div className={pageStyles.filterField}>
              <label className={pageStyles.filterLabel} htmlFor="task-due">
                Due
              </label>
              <Select
                id="task-due"
                value={due ?? ""}
                onChange={(event) =>
                  setParams({ due: event.target.value || null })
                }
              >
                <option value="">Any due date</option>
                <option value="today">Due today</option>
                <option value="overdue">Overdue</option>
              </Select>
            </div>

            {canPickProject && (
              <div className={pageStyles.filterField}>
                <label
                  className={pageStyles.filterLabel}
                  htmlFor="task-project"
                >
                  Project
                </label>
                <Select
                  id="task-project"
                  value={projectId ?? ""}
                  onChange={(event) =>
                    setParams({ projectId: event.target.value || null })
                  }
                >
                  <option value="">All projects</option>
                  {(projects.data ?? []).map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </Select>
              </div>
            )}

            {hasFilters && (
              <Button
                variant="ghost"
                size="sm"
                className={pageStyles.clearButton}
                iconLeft={<X size={14} aria-hidden />}
                onClick={() => {
                  setSearchInput("");
                  setParams({
                    status: null,
                    due: null,
                    projectId: null,
                    q: null,
                    page: null,
                  });
                }}
              >
                Clear filters
              </Button>
            )}
          </form>

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
                    onClick={() => {
                      setSearchInput("");
                      setParams({
                        status: null,
                        due: null,
                        projectId: null,
                        q: null,
                        page: null,
                      });
                    }}
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
              <ul className={pageStyles.taskList}>
                {items.map((task) => {
                  const dueInfo = describeDueDate(task, now);
                  const dueAbsolute = formatAbsoluteDate(task.dueDate, locale);

                  return (
                    <li key={task.id} className={pageStyles.taskRow}>
                      <TaskQuickComplete
                        task={task}
                        onUpdated={applyUpdate}
                        disabled={!canUpdate}
                      />
                      <button
                        type="button"
                        className={pageStyles.taskMain}
                        onClick={() => setSelectedTask(task)}
                        aria-label={`Open details for "${task.title}"`}
                      >
                        <span
                          className={`${pageStyles.taskTitle} ${task.status === "DONE" ? pageStyles.taskTitleDone : ""}`.trim()}
                        >
                          {task.title}
                        </span>
                        <span className={pageStyles.taskMeta}>
                          {task.projectName && <span>{task.projectName}</span>}
                          {dueAbsolute && <span>{dueAbsolute}</span>}
                          {dueInfo && (
                            <Badge tone={dueInfo.tone} withDot>
                              {dueInfo.label}
                            </Badge>
                          )}
                          {task.isBlocked && (
                            <Badge tone="danger">Blocked</Badge>
                          )}
                        </span>
                      </button>
                      <span className={pageStyles.taskActions}>
                        <Badge tone={TASK_PRIORITY_TONES[task.priority]}>
                          {TASK_PRIORITY_LABELS[task.priority]}
                        </Badge>
                        <TaskStatusMenu
                          task={task}
                          onUpdated={applyUpdate}
                          disabled={!canUpdate}
                        />
                      </span>
                    </li>
                  );
                })}
              </ul>
              {totalPages > 1 && (
                <div className={pageStyles.paginationRow}>
                  <Pagination
                    page={page}
                    pageCount={totalPages}
                    onPageChange={(nextPage) =>
                      setParams({ page: String(nextPage) })
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
