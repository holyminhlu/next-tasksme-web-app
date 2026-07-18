"use client";

import { useCallback, useEffect, useMemo, useState, type KeyboardEvent } from "react";
import { Button, ErrorState, LoadingState } from "@/modules/design-system";
import {
  calendarMonthRange,
  calendarWeekRange,
  taskFilterStateToListFilters,
  taskOverlapsDay,
  toLocalDateString,
} from "../tasks.helpers";
import { subscribeTasksChanged } from "../tasks.events";
import * as tasksService from "../tasks.service";
import type {
  CalendarMode,
  TaskFilterState,
  TaskRecord,
} from "../tasks.types";
import styles from "./task-views.module.css";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MAX_VISIBLE = 3;

function monthLabel(anchor: Date, locale?: string): string {
  try {
    return new Intl.DateTimeFormat(locale, {
      month: "long",
      year: "numeric",
    }).format(anchor);
  } catch {
    return anchor.toDateString();
  }
}

function isMultiDay(task: TaskRecord): boolean {
  if (!task.startAt || !task.dueDate) {
    return false;
  }
  return toLocalDateString(new Date(task.startAt)) !==
    toLocalDateString(new Date(task.dueDate));
}

export function TaskCalendarView({
  workspaceId,
  filterState,
  calMode,
  onCalModeChange,
  timezone,
  defaultAssigneeId,
  onOpenTask,
  onCreateOnDay,
}: {
  workspaceId: string;
  filterState: TaskFilterState;
  calMode: CalendarMode;
  onCalModeChange: (mode: CalendarMode) => void;
  timezone: string;
  defaultAssigneeId?: string | null;
  onOpenTask: (task: TaskRecord) => void;
  onCreateOnDay: (ymd: string) => void;
}) {
  const [anchor, setAnchor] = useState(() => new Date());
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [unscheduledCount, setUnscheduledCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedDay, setExpandedDay] = useState<string | null>(null);

  const locale =
    typeof navigator !== "undefined" ? navigator.language : undefined;
  const todayYmd = toLocalDateString(new Date());

  const range = useMemo(
    () =>
      calMode === "month"
        ? calendarMonthRange(anchor)
        : calendarWeekRange(anchor),
    [anchor, calMode],
  );

  const baseFilters = useMemo(
    () =>
      taskFilterStateToListFilters(filterState, {
        defaultAssigneeId,
        timezone,
        pageSize: 500,
      }),
    [filterState, defaultAssigneeId, timezone],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    const result = await tasksService.listCalendar(workspaceId, {
      ...baseFilters,
      from: range.from,
      to: range.to,
      timezone,
      page: 1,
      pageSize: 500,
    });

    if (!result.ok) {
      setError(result.message);
      setLoading(false);
      return;
    }

    setTasks(result.data.items);
    setUnscheduledCount(result.data.unscheduledCount);
    setLoading(false);
  }, [workspaceId, baseFilters, range.from, range.to, timezone]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  useEffect(() => subscribeTasksChanged(() => void load()), [load]);

  function shift(delta: number) {
    setAnchor((current) => {
      const next = new Date(current);
      if (calMode === "month") {
        next.setMonth(next.getMonth() + delta);
      } else {
        next.setDate(next.getDate() + delta * 7);
      }
      return next;
    });
    setExpandedDay(null);
  }

  function tasksForDay(ymd: string): TaskRecord[] {
    return tasks.filter((task) => taskOverlapsDay(task, ymd));
  }

  function renderDayCell(
    day: Date,
    options: { muted?: boolean; week?: boolean } = {},
  ) {
    const ymd = toLocalDateString(day);
    const dayTasks = tasksForDay(ymd);
    const expanded = expandedDay === ymd;
    const visible = expanded ? dayTasks : dayTasks.slice(0, MAX_VISIBLE);
    const overflow = dayTasks.length - visible.length;
    const className = options.week
      ? `${styles.calWeekDay} ${ymd === todayYmd ? styles.calDayToday : ""}`.trim()
      : `${styles.calDay} ${options.muted ? styles.calDayMuted : ""} ${ymd === todayYmd ? styles.calDayToday : ""}`.trim();

    return (
      <div
        key={ymd}
        className={className}
        role="button"
        tabIndex={0}
        aria-label={`Create task on ${ymd}`}
        onClick={() => onCreateOnDay(ymd)}
        onKeyDown={(event: KeyboardEvent) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onCreateOnDay(ymd);
          }
        }}
      >
        <span className={styles.calDayNumber}>{day.getDate()}</span>
        {visible.map((task) => (
          <button
            key={task.id}
            type="button"
            className={`${styles.calEvent} ${isMultiDay(task) ? styles.calEventMulti : ""}`.trim()}
            onClick={(event) => {
              event.stopPropagation();
              onOpenTask(task);
            }}
          >
            {task.title}
          </button>
        ))}
        {overflow > 0 && (
          <button
            type="button"
            className={styles.calMore}
            onClick={(event) => {
              event.stopPropagation();
              setExpandedDay(expanded ? null : ymd);
            }}
          >
            +{overflow} more
          </button>
        )}
      </div>
    );
  }

  return (
    <div>
      <div className={styles.calToolbar}>
        <Button size="sm" variant="secondary" onClick={() => shift(-1)}>
          Previous
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => {
            setAnchor(new Date());
            setExpandedDay(null);
          }}
        >
          Today
        </Button>
        <Button size="sm" variant="secondary" onClick={() => shift(1)}>
          Next
        </Button>
        <h3 className={styles.calTitle}>{monthLabel(anchor, locale)}</h3>
        <Button
          size="sm"
          variant={calMode === "month" ? "primary" : "secondary"}
          onClick={() => onCalModeChange("month")}
        >
          Month
        </Button>
        <Button
          size="sm"
          variant={calMode === "week" ? "primary" : "secondary"}
          onClick={() => onCalModeChange("week")}
        >
          Week
        </Button>
        <span className={styles.calUnscheduled}>
          {unscheduledCount > 0
            ? `${unscheduledCount} unscheduled`
            : "No unscheduled tasks"}
        </span>
      </div>

      {loading ? (
        <LoadingState label="Loading calendar…" />
      ) : error ? (
        <ErrorState
          title="Couldn't load calendar"
          description={error}
          onRetry={() => void load()}
        />
      ) : calMode === "month" ? (
        <div className={styles.calGrid}>
          {WEEKDAYS.map((label) => (
            <div key={label} className={styles.calWeekday}>
              {label}
            </div>
          ))}
          {"weeks" in range &&
            range.weeks.flat().map((day) =>
              renderDayCell(day, {
                muted: day.getMonth() !== anchor.getMonth(),
              }),
            )}
        </div>
      ) : (
        <div className={styles.calWeekGrid}>
          {"days" in range &&
            range.days.map((day) => renderDayCell(day, { week: true }))}
        </div>
      )}
    </div>
  );
}
