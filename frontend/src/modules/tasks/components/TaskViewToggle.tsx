"use client";

import { CalendarDays, GanttChart, Kanban, List } from "lucide-react";
import {
  TASK_VIEW_MODE_LABELS,
  TASK_VIEW_MODES,
} from "../tasks.helpers";
import type { TaskViewMode } from "../tasks.types";
import styles from "./task-views.module.css";

const ICONS: Record<TaskViewMode, typeof List> = {
  list: List,
  board: Kanban,
  calendar: CalendarDays,
  timeline: GanttChart,
};

export function TaskViewToggle({
  value,
  onChange,
}: {
  value: TaskViewMode;
  onChange: (view: TaskViewMode) => void;
}) {
  return (
    <div className={styles.viewToggle} role="tablist" aria-label="Task views">
      {TASK_VIEW_MODES.map((mode) => {
        const Icon = ICONS[mode];
        const active = value === mode;
        return (
          <button
            key={mode}
            type="button"
            role="tab"
            aria-selected={active}
            className={`${styles.viewToggleBtn} ${active ? styles.viewToggleBtnActive : ""}`.trim()}
            onClick={() => onChange(mode)}
          >
            <Icon size={15} aria-hidden />
            {TASK_VIEW_MODE_LABELS[mode]}
          </button>
        );
      })}
    </div>
  );
}
