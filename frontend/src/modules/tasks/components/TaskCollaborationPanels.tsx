"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type DragEvent,
} from "react";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ArrowDown,
  ArrowUp,
  Eye,
  GripVertical,
  Paperclip,
  Trash2,
} from "lucide-react";
import { hasPermission, useAuth } from "@/modules/auth";
import {
  Badge,
  Button,
  Checkbox,
  Collapsible,
  FormField,
  Select,
  TextArea,
  TextInput,
  useToast,
} from "@/modules/design-system";
import {
  getRealtimeSocket,
  joinTaskRoom,
  leaveTaskRoom,
} from "@/lib/realtime/socket";
import * as collab from "../collaboration.service";
import type {
  AttachmentRecord,
  ChecklistItem,
  CommentRecord,
  CustomFieldDefinition,
  CustomFieldType,
  TagRecord,
  TaskCustomFieldValueRow,
} from "../collaboration.types";
import type { CandidateOption, TaskRecord } from "../tasks.types";
import { canMutateTask } from "../tasks.helpers";
import styles from "./task-collab.module.css";

function SortableChecklistRow({
  item,
  canManage,
  busy,
  onToggle,
  onDelete,
}: {
  item: ChecklistItem;
  canManage: boolean;
  busy: boolean;
  onToggle: (item: ChecklistItem) => void;
  onDelete: (item: ChecklistItem) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: item.id, disabled: !canManage });

  return (
    <div
      ref={setNodeRef}
      className={styles.checklistItem}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
    >
      {canManage && (
        <button
          type="button"
          className={styles.dragHandle}
          aria-label="Reorder"
          {...attributes}
          {...listeners}
        >
          <GripVertical size={14} />
        </button>
      )}
      <Checkbox
        label=""
        checked={item.isCompleted}
        disabled={!canManage || busy}
        onChange={() => onToggle(item)}
      />
      <span
        className={`${styles.checklistTitle} ${item.isCompleted ? styles.checklistTitleDone : ""}`.trim()}
      >
        {item.title}
      </span>
      {canManage && (
        <Button
          size="sm"
          variant="ghost"
          disabled={busy}
          onClick={() => onDelete(item)}
          aria-label="Delete checklist item"
        >
          <Trash2 size={14} />
        </Button>
      )}
    </div>
  );
}

export function TaskCollaborationPanels({
  task,
  members,
}: {
  task: TaskRecord;
  members: CandidateOption[];
}) {
  const { selectedWorkspace, permissions, profile } = useAuth();
  const { toast } = useToast();
  const workspaceId = selectedWorkspace?.id ?? null;
  const canMutate = canMutateTask(
    selectedWorkspace?.roleKey,
    profile?.id,
    task,
  );

  const canChecklist =
    canMutate && hasPermission(permissions, "checklist.manage");
  const canTagView = hasPermission(permissions, "tag.view");
  const canTagCreate = hasPermission(permissions, "tag.create");
  const canTaskTag =
    canMutate && hasPermission(permissions, "task.tag.manage");
  const canFieldView = hasPermission(permissions, "custom_field.view");
  const canFieldValue =
    canMutate && hasPermission(permissions, "custom_field.value.update");
  const canFieldConfigure = hasPermission(
    permissions,
    "custom_field.configure",
  );
  const canCommentView = hasPermission(permissions, "comment.view");
  const canCommentCreate = hasPermission(permissions, "comment.create");
  const canCommentUpdateOwn = hasPermission(permissions, "comment.update_own");
  const canCommentDeleteOwn = hasPermission(permissions, "comment.delete_own");
  const canCommentModerate = hasPermission(permissions, "comment.moderate");
  const canAttachmentView = hasPermission(permissions, "attachment.view");
  const canAttachmentUpload =
    canMutate && hasPermission(permissions, "attachment.upload");
  const canAttachmentDeleteOwn = hasPermission(
    permissions,
    "attachment.delete_own",
  );
  const canAttachmentManage = hasPermission(permissions, "attachment.manage");

  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [progress, setProgress] = useState({ completed: 0, total: 0 });
  const [newItem, setNewItem] = useState("");
  const [tags, setTags] = useState<TagRecord[]>([]);
  const [allTags, setAllTags] = useState<TagRecord[]>([]);
  const [tagQuery, setTagQuery] = useState("");
  const [newTagName, setNewTagName] = useState("");
  const [fieldRows, setFieldRows] = useState<TaskCustomFieldValueRow[]>([]);
  const [fieldDefinitions, setFieldDefinitions] = useState<
    CustomFieldDefinition[]
  >([]);
  const [fieldDraft, setFieldDraft] = useState<Record<string, unknown>>({});
  const [newFieldName, setNewFieldName] = useState("");
  const [newFieldType, setNewFieldType] =
    useState<CustomFieldType>("TEXT");
  const [newFieldRequired, setNewFieldRequired] = useState(false);
  const [newFieldOptions, setNewFieldOptions] = useState("");
  const [comments, setComments] = useState<CommentRecord[]>([]);
  const [commentText, setCommentText] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<AttachmentRecord[]>([]);
  const [preview, setPreview] = useState<{
    attachment: AttachmentRecord;
    url: string;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [dropActive, setDropActive] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const reload = useCallback(async () => {
    if (!workspaceId) return;

    const jobs: Array<Promise<void>> = [];

    if (canChecklist) {
      jobs.push(
        collab.listChecklist(workspaceId, task.id).then((result) => {
          if (result.ok) {
            setChecklist(result.data.items);
            setProgress(result.data.progress);
          }
        }),
      );
    }
    if (canTagView) {
      jobs.push(
        collab.listTaskTags(workspaceId, task.id).then((result) => {
          if (result.ok) setTags(result.data);
        }),
      );
      jobs.push(
        collab.listTags(workspaceId, tagQuery || undefined).then((result) => {
          if (result.ok) setAllTags(result.data);
        }),
      );
    }
    if (canFieldView) {
      jobs.push(
        collab.listCustomFieldValues(workspaceId, task.id).then((result) => {
          if (result.ok) {
            setFieldRows(result.data);
            const draft: Record<string, unknown> = {};
            for (const row of result.data) {
              draft[row.field.id] = row.value;
            }
            setFieldDraft(draft);
          }
        }),
      );
    }
    if (canFieldConfigure) {
      jobs.push(
        collab.listCustomFields(workspaceId, task.projectId).then((result) => {
          if (result.ok) setFieldDefinitions(result.data);
        }),
      );
    }
    if (canCommentView) {
      jobs.push(
        collab.listComments(workspaceId, task.id).then((result) => {
          if (result.ok) setComments(result.data);
        }),
      );
    }
    if (canAttachmentView) {
      jobs.push(
        collab.listAttachments(workspaceId, task.id).then((result) => {
          if (result.ok) setAttachments(result.data);
        }),
      );
    }

    await Promise.all(jobs);
  }, [
    workspaceId,
    task.id,
    canChecklist,
    canTagView,
    canFieldView,
    canFieldConfigure,
    canCommentView,
    canAttachmentView,
    tagQuery,
    task.projectId,
  ]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void reload();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [reload]);

  useEffect(() => {
    if (!workspaceId || !canCommentView) return;

    joinTaskRoom(workspaceId, task.id);
    const socket = getRealtimeSocket();
    if (!socket) return;

    const onCreated = (payload: { comment: CommentRecord }) => {
      setComments((current) => {
        if (current.some((item) => item.id === payload.comment.id)) {
          return current;
        }
        return [...current, payload.comment];
      });
    };
    const onUpdated = (payload: { comment: CommentRecord }) => {
      setComments((current) =>
        current.map((item) =>
          item.id === payload.comment.id ? payload.comment : item,
        ),
      );
    };
    const onDeleted = (payload: { comment: CommentRecord }) => {
      setComments((current) =>
        current.map((item) =>
          item.id === payload.comment.id ? payload.comment : item,
        ),
      );
    };

    socket.on("comment:created", onCreated);
    socket.on("comment:updated", onUpdated);
    socket.on("comment:deleted", onDeleted);

    return () => {
      socket.off("comment:created", onCreated);
      socket.off("comment:updated", onUpdated);
      socket.off("comment:deleted", onDeleted);
      leaveTaskRoom(task.id);
    };
  }, [workspaceId, task.id, canCommentView]);

  const selectedTagIds = useMemo(() => new Set(tags.map((tag) => tag.id)), [tags]);

  async function handleAddChecklist() {
    if (!workspaceId || !newItem.trim() || busy) return;
    setBusy(true);
    const result = await collab.createChecklistItem(
      workspaceId,
      task.id,
      newItem.trim(),
    );
    setBusy(false);
    if (!result.ok) {
      toast({ title: "Couldn't add item", description: result.message, tone: "error" });
      return;
    }
    setNewItem("");
    await reload();
  }

  async function handleToggleChecklist(item: ChecklistItem) {
    if (!workspaceId || busy) return;
    setBusy(true);
    const result = await collab.updateChecklistItem(
      workspaceId,
      task.id,
      item.id,
      { isCompleted: !item.isCompleted },
    );
    setBusy(false);
    if (!result.ok) {
      toast({ title: "Couldn't update item", description: result.message, tone: "error" });
      return;
    }
    await reload();
  }

  async function handleDeleteChecklist(item: ChecklistItem) {
    if (!workspaceId || busy) return;
    setBusy(true);
    const result = await collab.deleteChecklistItem(
      workspaceId,
      task.id,
      item.id,
    );
    setBusy(false);
    if (!result.ok) {
      toast({ title: "Couldn't delete item", description: result.message, tone: "error" });
      return;
    }
    await reload();
  }

  async function handleChecklistDragEnd(event: DragEndEvent) {
    if (!workspaceId || !canChecklist) return;
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = checklist.findIndex((item) => item.id === active.id);
    const newIndex = checklist.findIndex((item) => item.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const next = arrayMove(checklist, oldIndex, newIndex);
    setChecklist(next);
    const result = await collab.reorderChecklist(
      workspaceId,
      task.id,
      next.map((item) => item.id),
    );
    if (!result.ok) {
      toast({ title: "Couldn't reorder", description: result.message, tone: "error" });
      await reload();
    } else {
      setChecklist(result.data.items);
      setProgress(result.data.progress);
    }
  }

  async function handleToggleTag(tag: TagRecord) {
    if (!workspaceId || !canTaskTag || busy) return;
    const nextIds = selectedTagIds.has(tag.id)
      ? tags.filter((item) => item.id !== tag.id).map((item) => item.id)
      : [...tags.map((item) => item.id), tag.id];
    setBusy(true);
    const result = await collab.setTaskTags(workspaceId, task.id, nextIds);
    setBusy(false);
    if (!result.ok) {
      toast({ title: "Couldn't update tags", description: result.message, tone: "error" });
      return;
    }
    setTags(result.data);
  }

  async function handleCreateTag() {
    if (!workspaceId || !canTagCreate || !newTagName.trim() || busy) return;
    setBusy(true);
    const created = await collab.createTag(workspaceId, {
      name: newTagName.trim(),
      color: "#3B82F6",
    });
    if (!created.ok) {
      setBusy(false);
      toast({ title: "Couldn't create tag", description: created.message, tone: "error" });
      return;
    }
    const nextIds = [...tags.map((tag) => tag.id), created.data.id];
    const assigned = canTaskTag
      ? await collab.setTaskTags(workspaceId, task.id, nextIds)
      : null;
    setBusy(false);
    setNewTagName("");
    if (assigned && !assigned.ok) {
      toast({ title: "Tag created but not assigned", description: assigned.message, tone: "error" });
    }
    await reload();
  }

  async function handleSaveFields() {
    if (!workspaceId || !canFieldValue || busy) return;
    setBusy(true);
    const result = await collab.setCustomFieldValues(
      workspaceId,
      task.id,
      fieldRows.map((row) => ({
        customFieldId: row.field.id,
        value: fieldDraft[row.field.id] ?? null,
      })),
    );
    setBusy(false);
    if (!result.ok) {
      toast({ title: "Couldn't save fields", description: result.message, tone: "error" });
      return;
    }
    setFieldRows(result.data);
    toast({ title: "Custom fields saved", tone: "success" });
  }

  function parseFieldOptions() {
    return newFieldOptions
      .split(",")
      .map((option) => option.trim())
      .filter(Boolean)
      .map((option) => ({
        value: option.toLowerCase().replace(/\s+/g, "_"),
        label: option,
      }));
  }

  async function handleCreateField() {
    if (!workspaceId || !canFieldConfigure || !newFieldName.trim() || busy) {
      return;
    }

    const needsOptions =
      newFieldType === "SELECT" || newFieldType === "MULTI_SELECT";
    const options = parseFieldOptions();
    if (needsOptions && options.length === 0) {
      toast({
        title: "Options are required",
        description: "Enter comma-separated options for this field.",
        tone: "error",
      });
      return;
    }

    setBusy(true);
    const result = await collab.createCustomField(workspaceId, {
      name: newFieldName.trim(),
      fieldType: newFieldType,
      projectId: task.projectId,
      isRequired: newFieldRequired,
      options: needsOptions ? options : [],
    });
    setBusy(false);

    if (!result.ok) {
      toast({
        title: "Couldn't create custom field",
        description: result.message,
        tone: "error",
      });
      return;
    }

    setNewFieldName("");
    setNewFieldType("TEXT");
    setNewFieldRequired(false);
    setNewFieldOptions("");
    await reload();
  }

  async function handleRenameField(field: CustomFieldDefinition) {
    if (!workspaceId || !canFieldConfigure || busy) return;
    const name = window.prompt("Custom field name", field.name)?.trim();
    if (!name || name === field.name) return;

    setBusy(true);
    const result = await collab.updateCustomField(workspaceId, field.id, {
      name,
    });
    setBusy(false);
    if (!result.ok) {
      toast({
        title: "Couldn't rename field",
        description: result.message,
        tone: "error",
      });
      return;
    }
    await reload();
  }

  async function handleMoveField(
    field: CustomFieldDefinition,
    direction: -1 | 1,
  ) {
    if (!workspaceId || !canFieldConfigure || busy) return;
    const index = fieldDefinitions.findIndex((item) => item.id === field.id);
    const other = fieldDefinitions[index + direction];
    if (!other) return;

    setBusy(true);
    const [first, second] = await Promise.all([
      collab.updateCustomField(workspaceId, field.id, {
        position: other.position,
      }),
      collab.updateCustomField(workspaceId, other.id, {
        position: field.position,
      }),
    ]);
    setBusy(false);
    if (!first.ok || !second.ok) {
      toast({
        title: "Couldn't reorder fields",
        description: !first.ok ? first.message : !second.ok ? second.message : "",
        tone: "error",
      });
      await reload();
      return;
    }
    await reload();
  }

  async function handleDeactivateField(field: CustomFieldDefinition) {
    if (!workspaceId || !canFieldConfigure || busy) return;
    if (!window.confirm(`Deactivate custom field "${field.name}"?`)) return;

    setBusy(true);
    const result = await collab.deleteCustomField(workspaceId, field.id);
    setBusy(false);
    if (!result.ok) {
      toast({
        title: "Couldn't deactivate field",
        description: result.message,
        tone: "error",
      });
      return;
    }
    await reload();
  }

  async function handleSubmitComment() {
    if (!workspaceId || !canCommentCreate || !commentText.trim() || busy) return;
    setBusy(true);
    const result = editingCommentId
      ? await collab.updateComment(
          workspaceId,
          task.id,
          editingCommentId,
          commentText.trim(),
        )
      : await collab.createComment(workspaceId, task.id, {
          content: commentText.trim(),
          parentCommentId: replyTo,
        });
    setBusy(false);
    if (!result.ok) {
      toast({ title: "Couldn't save comment", description: result.message, tone: "error" });
      return;
    }
    setCommentText("");
    setReplyTo(null);
    setEditingCommentId(null);
    await reload();
  }

  async function handleDeleteComment(comment: CommentRecord) {
    if (!workspaceId || busy) return;
    setBusy(true);
    const result = await collab.deleteComment(workspaceId, task.id, comment.id);
    setBusy(false);
    if (!result.ok) {
      toast({ title: "Couldn't delete comment", description: result.message, tone: "error" });
      return;
    }
    await reload();
  }

  async function handleUpload(files: FileList | File[]) {
    if (!workspaceId || !canAttachmentUpload || busy) return;
    const list = Array.from(files);
    if (list.length === 0) return;
    setBusy(true);
    for (const file of list) {
      const result = await collab.uploadAttachment(workspaceId, task.id, file);
      if (!result.ok) {
        toast({
          title: `Upload failed: ${file.name}`,
          description: result.message,
          tone: "error",
        });
      }
    }
    setBusy(false);
    await reload();
  }

  async function handleDownload(attachment: AttachmentRecord) {
    if (!workspaceId) return;
    const result = await collab.getAttachmentDownload(
      workspaceId,
      task.id,
      attachment.id,
    );
    if (!result.ok) {
      toast({ title: "Download failed", description: result.message, tone: "error" });
      return;
    }
    window.open(result.data.downloadUrl, "_blank", "noopener,noreferrer");
  }

  async function handlePreview(attachment: AttachmentRecord) {
    if (!workspaceId) return;
    const result = await collab.getAttachmentDownload(
      workspaceId,
      task.id,
      attachment.id,
    );
    if (!result.ok) {
      toast({
        title: "Preview failed",
        description: result.message,
        tone: "error",
      });
      return;
    }
    setPreview({
      attachment,
      url: result.data.downloadUrl,
    });
  }

  async function handleDeleteAttachment(attachment: AttachmentRecord) {
    if (!workspaceId || busy) return;
    setBusy(true);
    const result = await collab.deleteAttachment(
      workspaceId,
      task.id,
      attachment.id,
    );
    setBusy(false);
    if (!result.ok) {
      toast({ title: "Couldn't delete file", description: result.message, tone: "error" });
      return;
    }
    await reload();
  }

  function onDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setDropActive(false);
    if (event.dataTransfer.files?.length) {
      void handleUpload(event.dataTransfer.files);
    }
  }

  return (
    <div className={styles.stack}>
      {canChecklist && (
        <Collapsible
          title="Checklist"
          badge={
            <span className={styles.progress}>
              {progress.completed}/{progress.total}
            </span>
          }
        >
          <div className={styles.stack}>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={(event) => void handleChecklistDragEnd(event)}
            >
              <SortableContext
                items={checklist.map((item) => item.id)}
                strategy={verticalListSortingStrategy}
              >
                {checklist.map((item) => (
                  <SortableChecklistRow
                    key={item.id}
                    item={item}
                    canManage={canChecklist}
                    busy={busy}
                    onToggle={(row) => void handleToggleChecklist(row)}
                    onDelete={(row) => void handleDeleteChecklist(row)}
                  />
                ))}
              </SortableContext>
            </DndContext>
            {checklist.length === 0 && (
              <p className={styles.muted}>No checklist items yet.</p>
            )}
            <div className={styles.row}>
              <TextInput
                className={styles.grow}
                placeholder="Add checklist item"
                value={newItem}
                disabled={busy}
                onChange={(event) => setNewItem(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void handleAddChecklist();
                  }
                }}
              />
              <Button size="sm" disabled={busy || !newItem.trim()} onClick={() => void handleAddChecklist()}>
                Add
              </Button>
            </div>
          </div>
        </Collapsible>
      )}

      {canTagView && (
        <Collapsible title="Tags" defaultOpen={false}>
          <div className={styles.stack}>
            <div className={styles.tagList}>
              {tags.map((tag) => (
                <span key={tag.id} className={styles.tagChip}>
                  <span className={styles.tagDot} style={{ background: tag.color }} />
                  {tag.name}
                </span>
              ))}
              {tags.length === 0 && <p className={styles.muted}>No tags on this task.</p>}
            </div>
            <TextInput
              placeholder="Search tags"
              value={tagQuery}
              onChange={(event) => setTagQuery(event.target.value)}
            />
            <div className={styles.tagList}>
              {allTags.map((tag) => (
                <button
                  key={tag.id}
                  type="button"
                  className={styles.tagChip}
                  disabled={!canTaskTag || busy}
                  onClick={() => void handleToggleTag(tag)}
                >
                  <span className={styles.tagDot} style={{ background: tag.color }} />
                  {tag.name}
                  {selectedTagIds.has(tag.id) ? " ✓" : ""}
                </button>
              ))}
            </div>
            {canTagCreate && (
              <div className={styles.row}>
                <TextInput
                  className={styles.grow}
                  placeholder="New tag name"
                  value={newTagName}
                  disabled={busy}
                  onChange={(event) => setNewTagName(event.target.value)}
                />
                <Button
                  size="sm"
                  disabled={busy || !newTagName.trim()}
                  onClick={() => void handleCreateTag()}
                >
                  Create
                </Button>
              </div>
            )}
          </div>
        </Collapsible>
      )}

      {canFieldView && (
        <Collapsible title="Custom fields" defaultOpen={false}>
          <div className={styles.fieldGrid}>
            {fieldRows.length === 0 && (
              <p className={styles.muted}>No custom fields configured.</p>
            )}
            {fieldRows.map(({ field }) => (
              <FormField
                key={field.id}
                label={field.name}
                required={field.isRequired}
              >
                {(props) => {
                  const value = fieldDraft[field.id];
                  if (field.fieldType === "BOOLEAN") {
                    return (
                      <Checkbox
                        {...props}
                        label="Yes"
                        checked={Boolean(value)}
                        disabled={!canFieldValue || busy}
                        onChange={(event) =>
                          setFieldDraft((current) => ({
                            ...current,
                            [field.id]: event.target.checked,
                          }))
                        }
                      />
                    );
                  }
                  if (field.fieldType === "SELECT") {
                    return (
                      <Select
                        {...props}
                        value={typeof value === "string" ? value : ""}
                        disabled={!canFieldValue || busy}
                        onChange={(event) =>
                          setFieldDraft((current) => ({
                            ...current,
                            [field.id]: event.target.value || null,
                          }))
                        }
                      >
                        <option value="">—</option>
                        {field.options.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </Select>
                    );
                  }
                  if (field.fieldType === "MULTI_SELECT") {
                    const selectedValues = new Set(
                      Array.isArray(value)
                        ? value.filter(
                            (item): item is string => typeof item === "string",
                          )
                        : [],
                    );
                    return (
                      <div className={styles.multiSelect}>
                        {field.options.map((option) => (
                          <Checkbox
                            key={option.value}
                            label={option.label}
                            checked={selectedValues.has(option.value)}
                            disabled={!canFieldValue || busy}
                            onChange={(event) => {
                              const next = new Set(selectedValues);
                              if (event.target.checked) {
                                next.add(option.value);
                              } else {
                                next.delete(option.value);
                              }
                              setFieldDraft((current) => ({
                                ...current,
                                [field.id]: [...next],
                              }));
                            }}
                          />
                        ))}
                      </div>
                    );
                  }
                  if (field.fieldType === "USER") {
                    return (
                      <Select
                        {...props}
                        value={typeof value === "string" ? value : ""}
                        disabled={!canFieldValue || busy}
                        onChange={(event) =>
                          setFieldDraft((current) => ({
                            ...current,
                            [field.id]: event.target.value || null,
                          }))
                        }
                      >
                        <option value="">—</option>
                        {members.map((member) => (
                          <option key={member.id} value={member.id}>
                            {member.name}
                          </option>
                        ))}
                      </Select>
                    );
                  }
                  if (field.fieldType === "NUMBER") {
                    return (
                      <TextInput
                        {...props}
                        type="number"
                        value={typeof value === "number" ? String(value) : ""}
                        disabled={!canFieldValue || busy}
                        onChange={(event) =>
                          setFieldDraft((current) => ({
                            ...current,
                            [field.id]:
                              event.target.value === ""
                                ? null
                                : Number(event.target.value),
                          }))
                        }
                      />
                    );
                  }
                  return (
                    <TextInput
                      {...props}
                      type={field.fieldType === "DATE" ? "date" : "text"}
                      value={typeof value === "string" ? value : ""}
                      disabled={!canFieldValue || busy}
                      onChange={(event) =>
                        setFieldDraft((current) => ({
                          ...current,
                          [field.id]: event.target.value || null,
                        }))
                      }
                    />
                  );
                }}
              </FormField>
            ))}
            {canFieldValue && fieldRows.length > 0 && (
              <Button size="sm" disabled={busy} onClick={() => void handleSaveFields()}>
                Save fields
              </Button>
            )}

            {canFieldConfigure && (
              <div className={styles.configureBlock}>
                <h4 className={styles.subheading}>Configure fields</h4>
                {fieldDefinitions.map((field, index) => (
                  <div key={field.id} className={styles.configFieldRow}>
                    <div className={styles.grow}>
                      <div className={styles.fileName}>{field.name}</div>
                      <div className={styles.muted}>
                        {field.fieldType}
                        {field.isRequired ? " · required" : ""}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busy || index === 0}
                      aria-label={`Move ${field.name} up`}
                      onClick={() => void handleMoveField(field, -1)}
                    >
                      <ArrowUp size={14} />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busy || index === fieldDefinitions.length - 1}
                      aria-label={`Move ${field.name} down`}
                      onClick={() => void handleMoveField(field, 1)}
                    >
                      <ArrowDown size={14} />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busy}
                      onClick={() => void handleRenameField(field)}
                    >
                      Rename
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busy}
                      onClick={() => void handleDeactivateField(field)}
                    >
                      Deactivate
                    </Button>
                  </div>
                ))}

                <div className={styles.fieldComposer}>
                  <TextInput
                    placeholder="Field name"
                    value={newFieldName}
                    disabled={busy}
                    onChange={(event) => setNewFieldName(event.target.value)}
                  />
                  <Select
                    aria-label="Custom field type"
                    value={newFieldType}
                    disabled={busy}
                    onChange={(event) =>
                      setNewFieldType(event.target.value as CustomFieldType)
                    }
                  >
                    <option value="TEXT">Text</option>
                    <option value="NUMBER">Number</option>
                    <option value="BOOLEAN">Boolean</option>
                    <option value="DATE">Date</option>
                    <option value="SELECT">Select</option>
                    <option value="MULTI_SELECT">Multi select</option>
                    <option value="USER">User</option>
                  </Select>
                  {(newFieldType === "SELECT" ||
                    newFieldType === "MULTI_SELECT") && (
                    <TextInput
                      placeholder="Options, comma separated"
                      value={newFieldOptions}
                      disabled={busy}
                      onChange={(event) =>
                        setNewFieldOptions(event.target.value)
                      }
                    />
                  )}
                  <Checkbox
                    label="Required"
                    checked={newFieldRequired}
                    disabled={busy}
                    onChange={(event) =>
                      setNewFieldRequired(event.target.checked)
                    }
                  />
                  <Button
                    size="sm"
                    disabled={busy || !newFieldName.trim()}
                    onClick={() => void handleCreateField()}
                  >
                    Add field
                  </Button>
                </div>
              </div>
            )}
          </div>
        </Collapsible>
      )}

      {canAttachmentView && (
        <Collapsible title="Attachments" defaultOpen={false}>
          <div className={styles.stack}>
            {canAttachmentUpload && (
              <label
                className={`${styles.dropzone} ${dropActive ? styles.dropzoneActive : ""}`.trim()}
                onDragOver={(event) => {
                  event.preventDefault();
                  setDropActive(true);
                }}
                onDragLeave={() => setDropActive(false)}
                onDrop={onDrop}
              >
                <Paperclip size={16} />
                <span>Drop files here or click to upload</span>
                <input
                  type="file"
                  hidden
                  multiple
                  disabled={busy}
                  onChange={(event) => {
                    if (event.target.files) {
                      void handleUpload(event.target.files);
                      event.target.value = "";
                    }
                  }}
                />
              </label>
            )}
            {attachments.map((file) => {
              const canDelete =
                canAttachmentManage ||
                (canAttachmentDeleteOwn && file.uploadedById === profile?.id);
              return (
                <div key={file.id} className={styles.fileRow}>
                  <div className={styles.grow}>
                    <div className={styles.fileName}>{file.originalFileName}</div>
                    <div className={styles.muted}>
                      {file.mimeType} · {Math.round(file.sizeBytes / 1024)} KB
                    </div>
                  </div>
                  {(file.mimeType.startsWith("image/") ||
                    file.mimeType === "application/pdf" ||
                    file.mimeType === "text/plain") && (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => void handlePreview(file)}
                    >
                      <Eye size={14} />
                      Preview
                    </Button>
                  )}
                  <Button size="sm" variant="secondary" onClick={() => void handleDownload(file)}>
                    Download
                  </Button>
                  {canDelete && (
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busy}
                      onClick={() => void handleDeleteAttachment(file)}
                    >
                      Delete
                    </Button>
                  )}
                </div>
              );
            })}
            {attachments.length === 0 && (
              <p className={styles.muted}>No attachments yet.</p>
            )}
            {preview && (
              <div className={styles.previewPanel}>
                <div className={styles.row}>
                  <strong className={styles.grow}>
                    {preview.attachment.originalFileName}
                  </strong>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setPreview(null)}
                  >
                    Close preview
                  </Button>
                </div>
                {preview.attachment.mimeType.startsWith("image/") ? (
                  // Signed URLs expire quickly; the browser fetches directly.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={preview.url}
                    alt={preview.attachment.originalFileName}
                    className={styles.imagePreview}
                  />
                ) : (
                  <iframe
                    src={preview.url}
                    title={`Preview ${preview.attachment.originalFileName}`}
                    className={styles.documentPreview}
                  />
                )}
              </div>
            )}
          </div>
        </Collapsible>
      )}

      {canCommentView && (
        <Collapsible
          title="Comments"
          badge={<Badge tone="neutral">{comments.filter((item) => !item.deleted).length}</Badge>}
        >
          <div className={styles.stack}>
            <div className={styles.commentList}>
              {comments.map((comment) => {
                const canEdit =
                  !comment.deleted &&
                  (canCommentModerate ||
                    (canCommentUpdateOwn && comment.authorId === profile?.id));
                const canDelete =
                  !comment.deleted &&
                  (canCommentModerate ||
                    (canCommentDeleteOwn && comment.authorId === profile?.id));
                return (
                  <div key={comment.id} className={styles.commentItem}>
                    <div className={styles.commentMeta}>
                      {[
                        comment.authorName ?? "User",
                        comment.parentCommentId ? "reply" : null,
                        comment.deleted ? "deleted" : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </div>
                    <p className={styles.commentBody}>
                      {comment.deleted ? "(comment deleted)" : comment.content}
                    </p>
                    {!comment.deleted && (
                      <div className={styles.commentActions}>
                        {canCommentCreate && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setReplyTo(comment.id);
                              setEditingCommentId(null);
                            }}
                          >
                            Reply
                          </Button>
                        )}
                        {canEdit && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setEditingCommentId(comment.id);
                              setReplyTo(null);
                              setCommentText(comment.content);
                            }}
                          >
                            Edit
                          </Button>
                        )}
                        {canDelete && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => void handleDeleteComment(comment)}
                          >
                            Delete
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
              {comments.length === 0 && (
                <p className={styles.muted}>No comments yet.</p>
              )}
            </div>
            {canCommentCreate && (
              <>
                {(replyTo || editingCommentId) && (
                  <p className={styles.muted}>
                    {editingCommentId ? "Editing comment" : "Replying"} ·{" "}
                    <button
                      type="button"
                      onClick={() => {
                        setReplyTo(null);
                        setEditingCommentId(null);
                      }}
                    >
                      Cancel
                    </button>
                  </p>
                )}
                <TextArea
                  rows={3}
                  placeholder="Write a comment… Use @email to mention"
                  value={commentText}
                  disabled={busy}
                  onChange={(event) => setCommentText(event.target.value)}
                />
                <Button
                  size="sm"
                  disabled={busy || !commentText.trim()}
                  onClick={() => void handleSubmitComment()}
                >
                  {editingCommentId ? "Save comment" : "Post comment"}
                </Button>
              </>
            )}
          </div>
        </Collapsible>
      )}
    </div>
  );
}
