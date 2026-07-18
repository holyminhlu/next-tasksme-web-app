"use client";

import { useMemo, useState } from "react";
import {
  Button,
  Checkbox,
  Dialog,
  FormField,
  Select,
  useToast,
} from "@/modules/design-system";
import { taskFilterStateToExportFilters } from "../tasks.helpers";
import * as tasksService from "../tasks.service";
import {
  EXPORT_ROW_LIMIT,
  type ExportColumn,
  type TaskFilterState,
} from "../tasks.types";
import styles from "./task-views.module.css";

const EXPORT_COLUMNS: { key: ExportColumn; label: string }[] = [
  { key: "taskNumber", label: "Task #" },
  { key: "title", label: "Title" },
  { key: "status", label: "Status" },
  { key: "priority", label: "Priority" },
  { key: "project", label: "Project" },
  { key: "assignee", label: "Assignee" },
  { key: "creator", label: "Creator" },
  { key: "startAt", label: "Start" },
  { key: "dueDate", label: "Deadline" },
  { key: "completedAt", label: "Completed" },
  { key: "createdAt", label: "Created" },
  { key: "updatedAt", label: "Updated" },
];

const DEFAULT_COLUMNS: ExportColumn[] = [
  "taskNumber",
  "title",
  "status",
  "priority",
  "project",
  "assignee",
  "dueDate",
];

export function TaskExportDialog({
  open,
  onClose,
  workspaceId,
  filterState,
  selectedIds,
  timezone,
}: {
  open: boolean;
  onClose: () => void;
  workspaceId: string;
  filterState: TaskFilterState;
  selectedIds: string[];
  timezone: string;
}) {
  const { toast } = useToast();
  const [format, setFormat] = useState<"csv" | "xlsx">("csv");
  const [scope, setScope] = useState<"filters" | "selected">(
    selectedIds.length > 0 ? "selected" : "filters",
  );
  const [columns, setColumns] = useState<ExportColumn[]>(DEFAULT_COLUMNS);
  const [dateFormat, setDateFormat] = useState<"iso" | "locale">("iso");
  const [busy, setBusy] = useState(false);

  const filters = useMemo(
    () => taskFilterStateToExportFilters(filterState),
    [filterState],
  );

  function toggleColumn(key: ExportColumn) {
    setColumns((current) =>
      current.includes(key)
        ? current.filter((entry) => entry !== key)
        : [...current, key],
    );
  }

  async function handleExport() {
    if (columns.length === 0) {
      toast({
        title: "Select at least one column",
        tone: "error",
      });
      return;
    }

    if (scope === "selected" && selectedIds.length === 0) {
      toast({
        title: "No tasks selected",
        description: "Select rows in the list view, or export by filters.",
        tone: "error",
      });
      return;
    }

    setBusy(true);
    const result = await tasksService.downloadExportedTasks(workspaceId, {
      format,
      scope,
      selectedIds: scope === "selected" ? selectedIds : undefined,
      columns,
      timezone,
      dateFormat,
      filters: scope === "filters" ? filters : undefined,
    });
    setBusy(false);

    if (!result.ok) {
      toast({
        title: "Export failed",
        description: result.message,
        tone: "error",
      });
      return;
    }

    toast({
      title: "Export ready",
      description:
        result.data.rowCount != null
          ? `Downloaded ${result.data.rowCount} row${result.data.rowCount === 1 ? "" : "s"}.`
          : "File downloaded.",
      tone: "success",
    });
    onClose();
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Export tasks"
      description="Download tasks as CSV or Excel. Exports respect your permissions and current visibility."
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={busy} onClick={() => void handleExport()}>
            Download
          </Button>
        </>
      }
    >
      <div className={styles.exportForm}>
        <FormField label="Format">
          {(props) => (
            <Select
              {...props}
              value={format}
              onChange={(event) =>
                setFormat(event.target.value === "xlsx" ? "xlsx" : "csv")
              }
            >
              <option value="csv">CSV</option>
              <option value="xlsx">Excel (.xlsx)</option>
            </Select>
          )}
        </FormField>

        <FormField label="Scope">
          {(props) => (
            <Select
              {...props}
              value={scope}
              onChange={(event) =>
                setScope(
                  event.target.value === "selected" ? "selected" : "filters",
                )
              }
            >
              <option value="filters">Current filters</option>
              <option value="selected" disabled={selectedIds.length === 0}>
                Selected tasks ({selectedIds.length})
              </option>
            </Select>
          )}
        </FormField>

        <FormField label="Date format">
          {(props) => (
            <Select
              {...props}
              value={dateFormat}
              onChange={(event) =>
                setDateFormat(
                  event.target.value === "locale" ? "locale" : "iso",
                )
              }
            >
              <option value="iso">ISO (UTC)</option>
              <option value="locale">Local calendar date ({timezone})</option>
            </Select>
          )}
        </FormField>

        <fieldset>
          <legend>Columns</legend>
          <div className={styles.exportColumns}>
            {EXPORT_COLUMNS.map((column) => (
              <Checkbox
                key={column.key}
                label={column.label}
                checked={columns.includes(column.key)}
                onChange={() => toggleColumn(column.key)}
              />
            ))}
          </div>
        </fieldset>

        <p className={styles.exportHint}>
          Exports are capped at {EXPORT_ROW_LIMIT.toLocaleString()} rows. If
          your filters match more tasks, narrow them before exporting.
        </p>
      </div>
    </Dialog>
  );
}
