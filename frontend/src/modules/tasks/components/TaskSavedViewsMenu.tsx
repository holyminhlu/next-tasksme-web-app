"use client";

import { useCallback, useEffect, useState } from "react";
import { Bookmark, MoreHorizontal } from "lucide-react";
import {
  Button,
  Dialog,
  DropdownMenu,
  FormField,
  MenuItem,
  MenuLabel,
  MenuSeparator,
  TextInput,
  useToast,
} from "@/modules/design-system";
import {
  pageStateToSavedViewInput,
  savedViewToPageState,
} from "../tasks.helpers";
import * as tasksService from "../tasks.service";
import type {
  SavedViewRecord,
  TaskFilterState,
  TaskViewUrlState,
} from "../tasks.types";
import styles from "./task-views.module.css";

export function TaskSavedViewsMenu({
  workspaceId,
  filterState,
  viewState,
  columns,
  onApply,
}: {
  workspaceId: string;
  filterState: TaskFilterState;
  viewState: TaskViewUrlState;
  columns?: string[];
  onApply: (next: {
    filters: Partial<TaskFilterState>;
    view: Partial<TaskViewUrlState>;
  }) => void;
}) {
  const { toast } = useToast();
  const [views, setViews] = useState<SavedViewRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState<SavedViewRecord | null>(
    null,
  );
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    const result = await tasksService.listSavedViews(workspaceId);
    if (result.ok) {
      setViews(result.data);
    }
    setLoading(false);
  }, [workspaceId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void reload();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [reload]);

  async function handleCreate() {
    const trimmed = name.trim();
    if (!trimmed) {
      return;
    }

    setBusy(true);
    const payload = pageStateToSavedViewInput(
      filterState,
      viewState,
      columns ?? [],
    );
    const result = await tasksService.createSavedView(workspaceId, {
      name: trimmed,
      ...payload,
    });
    setBusy(false);

    if (!result.ok) {
      toast({
        title: "Couldn't save view",
        description: result.message,
        tone: "error",
      });
      return;
    }

    toast({ title: "View saved", tone: "success" });
    setCreateOpen(false);
    setName("");
    void reload();
  }

  async function handleRename() {
    if (!renameTarget) {
      return;
    }
    const trimmed = name.trim();
    if (!trimmed) {
      return;
    }

    setBusy(true);
    const result = await tasksService.updateSavedView(
      workspaceId,
      renameTarget.id,
      { name: trimmed },
    );
    setBusy(false);

    if (!result.ok) {
      toast({
        title: "Couldn't rename view",
        description: result.message,
        tone: "error",
      });
      return;
    }

    toast({ title: "View renamed", tone: "success" });
    setRenameTarget(null);
    setName("");
    void reload();
  }

  async function handleUpdate(view: SavedViewRecord) {
    const payload = pageStateToSavedViewInput(
      filterState,
      viewState,
      columns ?? [],
    );
    const result = await tasksService.updateSavedView(
      workspaceId,
      view.id,
      payload,
    );
    if (!result.ok) {
      toast({
        title: "Couldn't update view",
        description: result.message,
        tone: "error",
      });
      return;
    }
    toast({ title: "View updated", tone: "success" });
    void reload();
  }

  async function handleSetDefault(view: SavedViewRecord) {
    const result = await tasksService.updateSavedView(
      workspaceId,
      view.id,
      { isDefault: true },
    );
    if (!result.ok) {
      toast({
        title: "Couldn't set default",
        description: result.message,
        tone: "error",
      });
      return;
    }
    toast({ title: "Default view set", tone: "success" });
    void reload();
  }

  async function handleDelete(view: SavedViewRecord) {
    const result = await tasksService.deleteSavedView(workspaceId, view.id);
    if (!result.ok) {
      toast({
        title: "Couldn't delete view",
        description: result.message,
        tone: "error",
      });
      return;
    }
    toast({ title: "View deleted", tone: "success" });
    void reload();
  }

  return (
    <>
      <DropdownMenu
        align="end"
        menuLabel="Saved views"
        menuClassName={styles.savedViewsMenu}
        trigger={(props) => (
          <Button
            {...props}
            variant="secondary"
            size="sm"
            iconLeft={<Bookmark size={15} aria-hidden />}
          >
            Saved views
          </Button>
        )}
      >
        <MenuItem
          onSelect={() => {
            setName("");
            setCreateOpen(true);
          }}
        >
          Save current view…
        </MenuItem>
        <MenuSeparator />
        <MenuLabel>{loading ? "Loading…" : "Your views"}</MenuLabel>
        {views.length === 0 && !loading ? (
          <MenuItem disabled onSelect={() => undefined}>
            No saved views yet
          </MenuItem>
        ) : (
          views.map((view) => (
            <div key={view.id} className={styles.savedViewItem}>
              <MenuItem
                onSelect={() => onApply(savedViewToPageState(view))}
              >
                <span className={styles.savedViewName}>
                  {view.name}
                  {view.isDefault ? (
                    <span className={styles.savedViewDefault}> · default</span>
                  ) : null}
                </span>
              </MenuItem>
              <DropdownMenu
                align="end"
                trigger={(props) => (
                  <button
                    {...props}
                    type="button"
                    className={styles.savedViewActions}
                    aria-label={`Manage ${view.name}`}
                  >
                    <MoreHorizontal size={14} />
                  </button>
                )}
              >
                <MenuItem onSelect={() => void handleUpdate(view)}>
                  Update with current filters
                </MenuItem>
                <MenuItem
                  onSelect={() => {
                    setRenameTarget(view);
                    setName(view.name);
                  }}
                >
                  Rename…
                </MenuItem>
                {!view.isDefault && (
                  <MenuItem onSelect={() => void handleSetDefault(view)}>
                    Set as default
                  </MenuItem>
                )}
                <MenuSeparator />
                <MenuItem
                  danger
                  onSelect={() => void handleDelete(view)}
                >
                  Delete
                </MenuItem>
              </DropdownMenu>
            </div>
          ))
        )}
      </DropdownMenu>

      <Dialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Save view"
        description="Store the current filters and display mode for quick access."
        footer={
          <>
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              loading={busy}
              disabled={!name.trim()}
              onClick={() => void handleCreate()}
            >
              Save
            </Button>
          </>
        }
      >
        <FormField label="Name">
          {(props) => (
            <TextInput
              {...props}
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. My board — overdue"
              autoFocus
            />
          )}
        </FormField>
      </Dialog>

      <Dialog
        open={Boolean(renameTarget)}
        onClose={() => setRenameTarget(null)}
        title="Rename view"
        footer={
          <>
            <Button variant="secondary" onClick={() => setRenameTarget(null)}>
              Cancel
            </Button>
            <Button
              loading={busy}
              disabled={!name.trim()}
              onClick={() => void handleRename()}
            >
              Rename
            </Button>
          </>
        }
      >
        <FormField label="Name">
          {(props) => (
            <TextInput
              {...props}
              value={name}
              onChange={(event) => setName(event.target.value)}
              autoFocus
            />
          )}
        </FormField>
      </Dialog>
    </>
  );
}
