"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
} from "react";
import { Button, ErrorState, LoadingState } from "@/modules/design-system";
import {
  taskFilterStateToListFilters,
  timelineRangeForZoom,
  toDateInputValue,
  toLocalDateString,
} from "../tasks.helpers";
import { subscribeTasksChanged } from "../tasks.events";
import * as tasksService from "../tasks.service";
import type {
  TaskFilterState,
  TaskRecord,
  TimelineGroup,
  TimelineGroupBy,
  TimelineZoom,
} from "../tasks.types";
import styles from "./task-views.module.css";

const MAX_ROWS = 40;

function barStyle(
  task: TaskRecord,
  days: Date[],
): { left: string; width: string } | null {
  const startYmd = task.startAt
    ? toDateInputValue(task.startAt)
    : task.dueDate
      ? toDateInputValue(task.dueDate)
      : "";
  const endYmd = task.dueDate
    ? toDateInputValue(task.dueDate)
    : task.startAt
      ? toDateInputValue(task.startAt)
      : "";

  if (!startYmd || !endYmd || days.length === 0) {
    return null;
  }

  const from = toLocalDateString(days[0]!);
  const to = toLocalDateString(days[days.length - 1]!);
  if (endYmd < from || startYmd > to) {
    return null;
  }

  const clampedStart = startYmd < from ? from : startYmd;
  const clampedEnd = endYmd > to ? to : endYmd;
  const startIndex = days.findIndex(
    (day) => toLocalDateString(day) === clampedStart,
  );
  const endIndex = days.findIndex(
    (day) => toLocalDateString(day) === clampedEnd,
  );

  if (startIndex < 0 || endIndex < 0) {
    return null;
  }

  const span = Math.max(1, endIndex - startIndex + 1);
  return {
    left: `${(startIndex / days.length) * 100}%`,
    width: `${(span / days.length) * 100}%`,
  };
}

export function TaskTimelineView({
  workspaceId,
  filterState,
  tlZoom,
  groupBy,
  onTlZoomChange,
  onGroupByChange,
  timezone,
  defaultAssigneeId,
  onOpenTask,
}: {
  workspaceId: string;
  filterState: TaskFilterState;
  tlZoom: TimelineZoom;
  groupBy: TimelineGroupBy;
  onTlZoomChange: (zoom: TimelineZoom) => void;
  onGroupByChange: (groupBy: TimelineGroupBy) => void;
  timezone: string;
  defaultAssigneeId?: string | null;
  onOpenTask: (task: TaskRecord) => void;
}) {
  const [anchor, setAnchor] = useState(() => new Date());
  const [groups, setGroups] = useState<TimelineGroup[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const range = useMemo(
    () => timelineRangeForZoom(anchor, tlZoom),
    [anchor, tlZoom],
  );

  const baseFilters = useMemo(
    () =>
      taskFilterStateToListFilters(filterState, {
        defaultAssigneeId,
        timezone,
        pageSize: MAX_ROWS,
      }),
    [filterState, defaultAssigneeId, timezone],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    const result = await tasksService.listTimeline(workspaceId, {
      ...baseFilters,
      from: range.from,
      to: range.to,
      groupBy,
      timezone,
      page: 1,
      pageSize: MAX_ROWS,
    });

    if (!result.ok) {
      setError(result.message);
      setLoading(false);
      return;
    }

    setGroups(result.data.groups);
    setTotal(result.data.total);
    setLoading(false);
  }, [workspaceId, baseFilters, range.from, range.to, groupBy, timezone]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  useEffect(() => subscribeTasksChanged(() => void load()), [load]);

  const limitedGroups = useMemo(() => {
    let remaining = MAX_ROWS;
    const result: TimelineGroup[] = [];
    for (const group of groups) {
      if (remaining <= 0) {
        break;
      }
      const items = group.items.slice(0, remaining);
      remaining -= items.length;
      result.push({ ...group, items });
    }
    return result;
  }, [groups]);

  const dayLabelStep = tlZoom === "day" ? 1 : tlZoom === "week" ? 7 : 14;
  const shownCount = limitedGroups.reduce(
    (sum, group) => sum + group.items.length,
    0,
  );

  return (
    <div>
      <div className={styles.tlToolbar}>
        <Button
          size="sm"
          variant="secondary"
          onClick={() =>
            setAnchor((current) => {
              const next = new Date(current);
              next.setDate(next.getDate() - (tlZoom === "month" ? 30 : 14));
              return next;
            })
          }
        >
          Previous
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => setAnchor(new Date())}
        >
          Today
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onClick={() =>
            setAnchor((current) => {
              const next = new Date(current);
              next.setDate(next.getDate() + (tlZoom === "month" ? 30 : 14));
              return next;
            })
          }
        >
          Next
        </Button>
        <strong>Timeline</strong>
        {(["day", "week", "month"] as TimelineZoom[]).map((zoom) => (
          <Button
            key={zoom}
            size="sm"
            variant={tlZoom === zoom ? "primary" : "secondary"}
            onClick={() => onTlZoomChange(zoom)}
          >
            {zoom === "day" ? "Day" : zoom === "week" ? "Week" : "Month"}
          </Button>
        ))}
        <Button
          size="sm"
          variant={groupBy === "project" ? "primary" : "secondary"}
          onClick={() => onGroupByChange("project")}
        >
          By project
        </Button>
        <Button
          size="sm"
          variant={groupBy === "assignee" ? "primary" : "secondary"}
          onClick={() => onGroupByChange("assignee")}
        >
          By assignee
        </Button>
      </div>

      {loading ? (
        <LoadingState label="Loading timeline…" />
      ) : error ? (
        <ErrorState
          title="Couldn't load timeline"
          description={error}
          onRetry={() => void load()}
        />
      ) : shownCount === 0 ? (
        <p className={styles.tlLimitNote}>
          No scheduled tasks in this range.
        </p>
      ) : (
        <>
          <div className={styles.tlScroll}>
            <div
              className={styles.tlGrid}
              style={
                {
                  gridTemplateColumns: `160px minmax(480px, 1fr)`,
                  ["--tl-days" as string]: String(range.days.length),
                } as CSSProperties
              }
            >
              <div className={styles.tlLabelCell} />
              <div
                className={styles.tlRowTrack}
                style={{
                  display: "grid",
                  gridTemplateColumns: `repeat(${range.days.length}, minmax(28px, 1fr))`,
                  minHeight: 32,
                }}
              >
                {range.days.map((day, index) => (
                  <div
                    key={toLocalDateString(day)}
                    className={styles.tlHeaderCell}
                  >
                    {index % dayLabelStep === 0 ? day.getDate() : ""}
                  </div>
                ))}
              </div>

              {limitedGroups.map((group) => (
                <div key={group.id} style={{ display: "contents" }}>
                  <div
                    className={styles.tlGroupHeader}
                    style={{ gridColumn: "1 / -1" }}
                  >
                    {group.label}
                  </div>
                  {group.items.map((task) => {
                    const style = barStyle(task, range.days);
                    return (
                      <div key={task.id} style={{ display: "contents" }}>
                        <div className={styles.tlLabelCell}>{task.title}</div>
                        <div className={styles.tlRowTrack}>
                          {style && (
                            <button
                              type="button"
                              className={styles.tlBar}
                              style={style}
                              onClick={() => onOpenTask(task)}
                              title={task.title}
                            >
                              {task.title}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
          {total > shownCount && (
            <p className={styles.tlLimitNote}>
              Showing {shownCount} of {total} scheduled tasks. Narrow filters to
              see more.
            </p>
          )}
        </>
      )}
    </div>
  );
}
