"use client";

import { useState } from "react";
import { ChevronDown, Columns3, SlidersHorizontal, X } from "lucide-react";
import {
  Button,
  Checkbox,
  DropdownMenu,
  MenuItem,
  MenuLabel,
  MenuSeparator,
  Select,
  TextInput,
} from "@/modules/design-system";
import {
  DEFAULT_TASK_FILTER_STATE,
  TASK_PRIORITIES,
  TASK_PRIORITY_LABELS,
  TASK_SORT_FIELDS,
  TASK_SORT_LABELS,
  TASK_STATUSES,
  TASK_STATUS_LABELS,
  describeActiveFilterChips,
  removeFilterChip,
  taskFilterHasActiveFilters,
} from "../tasks.helpers";
import type {
  CandidateOption,
  SortOrder,
  TaskFilterState,
  TaskSortBy,
} from "../tasks.types";
import styles from "./task-filter-bar.module.css";

export type TaskColumnKey =
  | "taskNumber"
  | "title"
  | "status"
  | "priority"
  | "project"
  | "assignee"
  | "startAt"
  | "dueDate"
  | "actions";

export const DEFAULT_VISIBLE_COLUMNS: TaskColumnKey[] = [
  "taskNumber",
  "title",
  "status",
  "priority",
  "project",
  "assignee",
  "startAt",
  "dueDate",
  "actions",
];

export const COLUMN_LABELS: Record<TaskColumnKey, string> = {
  taskNumber: "Task #",
  title: "Title",
  status: "Status",
  priority: "Priority",
  project: "Project",
  assignee: "Assignee",
  startAt: "Start",
  dueDate: "Deadline",
  actions: "Actions",
};

const COLUMNS_STORAGE_KEY = "taskmng:my-tasks-columns";

export function loadVisibleColumns(): TaskColumnKey[] {
  if (typeof window === "undefined") {
    return DEFAULT_VISIBLE_COLUMNS;
  }

  try {
    const raw = window.localStorage.getItem(COLUMNS_STORAGE_KEY);
    if (!raw) {
      return DEFAULT_VISIBLE_COLUMNS;
    }

    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return DEFAULT_VISIBLE_COLUMNS;
    }

    const allowed = new Set(DEFAULT_VISIBLE_COLUMNS);
    const columns = parsed.filter(
      (key): key is TaskColumnKey =>
        typeof key === "string" && allowed.has(key as TaskColumnKey),
    );

    return columns.includes("title")
      ? columns
      : ["title", ...columns.filter((key) => key !== "title")];
  } catch {
    return DEFAULT_VISIBLE_COLUMNS;
  }
}

export function saveVisibleColumns(columns: TaskColumnKey[]): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(COLUMNS_STORAGE_KEY, JSON.stringify(columns));
}

type DeadlineMode = "" | "today" | "upcoming" | "overdue" | "range" | "unassigned";

function deadlineModeFromState(state: TaskFilterState): DeadlineMode {
  if (state.unassigned) {
    return "unassigned";
  }
  if (state.deadlineFrom || state.deadlineTo) {
    return "range";
  }
  if (state.due) {
    return state.due;
  }
  if (state.overdue) {
    return "overdue";
  }
  return "";
}

function countMoreFilters(
  state: TaskFilterState,
  canFilterMembers: boolean,
  canIncludeDeleted: boolean,
): number {
  let count = 0;
  if (canFilterMembers && state.assigneeId) count += 1;
  if (canFilterMembers && state.unassigned) count += 1;
  if (canFilterMembers && state.createdById) count += 1;
  if (state.due || state.overdue || state.deadlineFrom || state.deadlineTo) {
    count += 1;
  }
  if (state.sortBy !== DEFAULT_TASK_FILTER_STATE.sortBy) count += 1;
  if (state.sortOrder !== DEFAULT_TASK_FILTER_STATE.sortOrder) count += 1;
  if (state.includeArchived) count += 1;
  if (canIncludeDeleted && state.includeDeleted) count += 1;
  if (state.tagIds.length) count += 1;
  return count;
}

export function TaskFilterBar({
  state,
  onChange,
  projects,
  members,
  tags = [],
  canPickProject,
  canFilterMembers,
  canIncludeDeleted,
  visibleColumns,
  onVisibleColumnsChange,
}: {
  state: TaskFilterState;
  onChange: (patch: Partial<TaskFilterState>) => void;
  projects: CandidateOption[];
  members: CandidateOption[];
  tags?: Array<{ id: string; name: string; color?: string }>;
  canPickProject: boolean;
  canFilterMembers: boolean;
  canIncludeDeleted: boolean;
  visibleColumns: TaskColumnKey[];
  onVisibleColumnsChange: (columns: TaskColumnKey[]) => void;
}) {
  const [searchInput, setSearchInput] = useState(state.search);
  const [prevSearch, setPrevSearch] = useState(state.search);
  const [moreOpen, setMoreOpen] = useState(false);

  if (state.search !== prevSearch) {
    setPrevSearch(state.search);
    setSearchInput(state.search);
  }

  const hasFilters = taskFilterHasActiveFilters(state);
  const deadlineMode = deadlineModeFromState(state);
  const moreFilterCount = countMoreFilters(
    state,
    canFilterMembers,
    canIncludeDeleted,
  );

  const chips = describeActiveFilterChips(state, {
    projectName: projects.find((project) => project.id === state.projectId)?.name,
    assigneeName: members.find((member) => member.id === state.assigneeId)?.name,
    creatorName: members.find((member) => member.id === state.createdById)?.name,
  });

  function applySearch() {
    onChange({ search: searchInput.trim(), page: 1 });
  }

  function setDeadlineMode(mode: DeadlineMode) {
    if (mode === "unassigned") {
      onChange({
        due: null,
        overdue: false,
        unassigned: true,
        deadlineFrom: null,
        deadlineTo: null,
        page: 1,
      });
      return;
    }

    if (mode === "range") {
      onChange({
        due: null,
        overdue: false,
        unassigned: false,
        page: 1,
      });
      return;
    }

    if (mode === "overdue") {
      onChange({
        due: "overdue",
        overdue: true,
        unassigned: false,
        deadlineFrom: null,
        deadlineTo: null,
        page: 1,
      });
      return;
    }

    if (mode === "today" || mode === "upcoming") {
      onChange({
        due: mode,
        overdue: false,
        unassigned: false,
        deadlineFrom: null,
        deadlineTo: null,
        page: 1,
      });
      return;
    }

    onChange({
      due: null,
      overdue: false,
      unassigned: false,
      deadlineFrom: null,
      deadlineTo: null,
      page: 1,
    });
  }

  function clearAll() {
    setSearchInput("");
    onChange({ ...DEFAULT_TASK_FILTER_STATE, page: 1 });
  }

  function toggleColumn(key: TaskColumnKey) {
    if (key === "title") {
      return;
    }

    const next = visibleColumns.includes(key)
      ? visibleColumns.filter((column) => column !== key)
      : [...visibleColumns, key];

    onVisibleColumnsChange(next.includes("title") ? next : ["title", ...next]);
  }

  return (
    <div className={styles.bar}>
      <form
        className={styles.filters}
        role="search"
        aria-label="Task filters"
        onSubmit={(event) => {
          event.preventDefault();
          applySearch();
        }}
      >
        <div className={styles.primaryRow}>
          <div className={`${styles.filterField} ${styles.searchField}`}>
            <label className={styles.filterLabel} htmlFor="task-search">
              Search
            </label>
            <TextInput
              id="task-search"
              type="search"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              onBlur={applySearch}
              placeholder="Title or task #"
            />
          </div>

          <div className={styles.filterField}>
            <label className={styles.filterLabel} htmlFor="task-status">
              Status
            </label>
            <Select
              id="task-status"
              value={state.statuses[0] ?? ""}
              onChange={(event) =>
                onChange({
                  statuses: event.target.value
                    ? [event.target.value as TaskFilterState["statuses"][number]]
                    : [],
                  page: 1,
                })
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

          <div className={styles.filterField}>
            <label className={styles.filterLabel} htmlFor="task-priority">
              Priority
            </label>
            <Select
              id="task-priority"
              value={state.priorities[0] ?? ""}
              onChange={(event) =>
                onChange({
                  priorities: event.target.value
                    ? [
                        event.target
                          .value as TaskFilterState["priorities"][number],
                      ]
                    : [],
                  page: 1,
                })
              }
            >
              <option value="">All priorities</option>
              {TASK_PRIORITIES.map((key) => (
                <option key={key} value={key}>
                  {TASK_PRIORITY_LABELS[key]}
                </option>
              ))}
            </Select>
          </div>

          {canPickProject && (
            <div className={styles.filterField}>
              <label className={styles.filterLabel} htmlFor="task-project">
                Project
              </label>
              <Select
                id="task-project"
                value={state.projectId ?? ""}
                onChange={(event) =>
                  onChange({
                    projectId: event.target.value || null,
                    page: 1,
                  })
                }
              >
                <option value="">All projects</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </Select>
            </div>
          )}

          <div className={styles.toolbarActions}>
            <Button
              type="button"
              variant={moreOpen || moreFilterCount > 0 ? "secondary" : "ghost"}
              size="sm"
              aria-expanded={moreOpen}
              aria-controls="task-more-filters"
              iconLeft={<SlidersHorizontal size={14} aria-hidden />}
              iconRight={
                <ChevronDown
                  size={14}
                  aria-hidden
                  className={moreOpen ? styles.chevronOpen : undefined}
                />
              }
              onClick={() => setMoreOpen((open) => !open)}
            >
              More filters
              {moreFilterCount > 0 ? ` (${moreFilterCount})` : ""}
            </Button>

            <DropdownMenu
              align="end"
              menuLabel="Visible columns"
              trigger={(props) => (
                <Button
                  {...props}
                  type="button"
                  variant="secondary"
                  size="sm"
                  iconLeft={<Columns3 size={14} aria-hidden />}
                >
                  Columns
                </Button>
              )}
            >
              <MenuLabel>Show columns</MenuLabel>
              <MenuSeparator />
              {DEFAULT_VISIBLE_COLUMNS.map((key) => (
                <MenuItem
                  key={key}
                  selected={visibleColumns.includes(key)}
                  disabled={key === "title"}
                  onSelect={() => toggleColumn(key)}
                >
                  {COLUMN_LABELS[key]}
                </MenuItem>
              ))}
            </DropdownMenu>

            {hasFilters && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                iconLeft={<X size={14} aria-hidden />}
                onClick={clearAll}
              >
                Clear
              </Button>
            )}
          </div>
        </div>

        {moreOpen && (
          <div
            id="task-more-filters"
            className={styles.morePanel}
            role="region"
            aria-label="Additional filters"
          >
            {tags.length > 0 && (
              <div className={styles.filterField}>
                <label className={styles.filterLabel} htmlFor="task-tag">
                  Tag
                </label>
                <Select
                  id="task-tag"
                  value={state.tagIds[0] ?? ""}
                  onChange={(event) =>
                    onChange({
                      tagIds: event.target.value ? [event.target.value] : [],
                      page: 1,
                    })
                  }
                >
                  <option value="">Any tag</option>
                  {tags.map((tag) => (
                    <option key={tag.id} value={tag.id}>
                      {tag.name}
                    </option>
                  ))}
                </Select>
              </div>
            )}

            {canFilterMembers && (
              <>
                <div className={styles.filterField}>
                  <label className={styles.filterLabel} htmlFor="task-assignee">
                    Assignee
                  </label>
                  <Select
                    id="task-assignee"
                    value={
                      state.unassigned
                        ? "__unassigned__"
                        : (state.assigneeId ?? "")
                    }
                    onChange={(event) => {
                      const value = event.target.value;
                      if (value === "__unassigned__") {
                        onChange({
                          unassigned: true,
                          assigneeId: null,
                          page: 1,
                        });
                        return;
                      }
                      onChange({
                        unassigned: false,
                        assigneeId: value || null,
                        page: 1,
                      });
                    }}
                  >
                    <option value="">Anyone</option>
                    <option value="__unassigned__">Unassigned</option>
                    {members.map((member) => (
                      <option key={member.id} value={member.id}>
                        {member.role
                          ? `${member.name} · ${member.role}`
                          : member.name}
                      </option>
                    ))}
                  </Select>
                </div>

                <div className={styles.filterField}>
                  <label className={styles.filterLabel} htmlFor="task-creator">
                    Creator
                  </label>
                  <Select
                    id="task-creator"
                    value={state.createdById ?? ""}
                    onChange={(event) =>
                      onChange({
                        createdById: event.target.value || null,
                        page: 1,
                      })
                    }
                  >
                    <option value="">Anyone</option>
                    {members.map((member) => (
                      <option key={member.id} value={member.id}>
                        {member.name}
                      </option>
                    ))}
                  </Select>
                </div>
              </>
            )}

            <div className={styles.filterField}>
              <label
                className={styles.filterLabel}
                htmlFor="task-deadline-mode"
              >
                Deadline
              </label>
              <Select
                id="task-deadline-mode"
                value={deadlineMode}
                onChange={(event) =>
                  setDeadlineMode(event.target.value as DeadlineMode)
                }
              >
                <option value="">Any deadline</option>
                <option value="today">Due today</option>
                <option value="upcoming">Upcoming</option>
                <option value="overdue">Overdue</option>
                <option value="range">Date range</option>
                <option value="unassigned">Unassigned</option>
              </Select>
            </div>

            {(deadlineMode === "range" ||
              state.deadlineFrom ||
              state.deadlineTo) && (
              <>
                <div className={styles.filterField}>
                  <label
                    className={styles.filterLabel}
                    htmlFor="task-deadline-from"
                  >
                    From
                  </label>
                  <TextInput
                    id="task-deadline-from"
                    type="date"
                    value={state.deadlineFrom ?? ""}
                    onChange={(event) =>
                      onChange({
                        deadlineFrom: event.target.value || null,
                        due: null,
                        overdue: false,
                        page: 1,
                      })
                    }
                  />
                </div>
                <div className={styles.filterField}>
                  <label
                    className={styles.filterLabel}
                    htmlFor="task-deadline-to"
                  >
                    To
                  </label>
                  <TextInput
                    id="task-deadline-to"
                    type="date"
                    value={state.deadlineTo ?? ""}
                    onChange={(event) =>
                      onChange({
                        deadlineTo: event.target.value || null,
                        due: null,
                        overdue: false,
                        page: 1,
                      })
                    }
                  />
                </div>
              </>
            )}

            <div className={styles.filterField}>
              <label className={styles.filterLabel} htmlFor="task-sort-by">
                Sort by
              </label>
              <Select
                id="task-sort-by"
                value={state.sortBy}
                onChange={(event) =>
                  onChange({
                    sortBy: event.target.value as TaskSortBy,
                    page: 1,
                  })
                }
              >
                {TASK_SORT_FIELDS.map((field) => (
                  <option key={field} value={field}>
                    {TASK_SORT_LABELS[field]}
                  </option>
                ))}
              </Select>
            </div>

            <div className={styles.filterField}>
              <label className={styles.filterLabel} htmlFor="task-sort-order">
                Direction
              </label>
              <Select
                id="task-sort-order"
                value={state.sortOrder}
                onChange={(event) =>
                  onChange({
                    sortOrder: event.target.value as SortOrder,
                    page: 1,
                  })
                }
              >
                <option value="desc">Descending</option>
                <option value="asc">Ascending</option>
              </Select>
            </div>

            <div className={styles.checkRow}>
              <Checkbox
                label="Include archived"
                checked={state.includeArchived}
                onChange={(event) =>
                  onChange({
                    includeArchived: event.target.checked,
                    page: 1,
                  })
                }
              />
              {canIncludeDeleted && (
                <Checkbox
                  label="Include deleted"
                  checked={state.includeDeleted}
                  onChange={(event) =>
                    onChange({
                      includeDeleted: event.target.checked,
                      page: 1,
                    })
                  }
                />
              )}
            </div>
          </div>
        )}
      </form>

      {chips.length > 0 && (
        <ul className={styles.chips} aria-label="Active filters">
          {chips.map((chip) => (
            <li key={chip.key}>
              <button
                type="button"
                className={styles.chip}
                onClick={() => onChange(removeFilterChip(state, chip.key))}
              >
                {chip.label}
                <X size={12} aria-hidden />
                <span className={styles.srOnly}>Remove filter</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
