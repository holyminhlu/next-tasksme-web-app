import { del, get, patch, post, postFormData, put } from "@/lib/api/client";
import { buildQueryString } from "@/lib/api/query";
import { toServiceResult, type ServiceResult } from "@/lib/api/service";
import type {
  AttachmentRecord,
  ChecklistItem,
  ChecklistProgress,
  CommentRecord,
  CustomFieldDefinition,
  TagRecord,
  TaskCustomFieldValueRow,
} from "./collaboration.types";

function taskPath(workspaceId: string, taskId: string, suffix: string) {
  return `/workspaces/${workspaceId}/tasks/${taskId}${suffix}`;
}

function identity<T>(data: T): T {
  return data;
}

export async function listChecklist(
  workspaceId: string,
  taskId: string,
): Promise<ServiceResult<{ items: ChecklistItem[]; progress: ChecklistProgress }>> {
  const envelope = await get<{ items: ChecklistItem[]; progress: ChecklistProgress }>(
    taskPath(workspaceId, taskId, "/checklist-items"),
  );
  return toServiceResult(envelope, identity);
}

export async function createChecklistItem(
  workspaceId: string,
  taskId: string,
  title: string,
): Promise<ServiceResult<ChecklistItem>> {
  const envelope = await post<ChecklistItem>(
    taskPath(workspaceId, taskId, "/checklist-items"),
    { title },
  );
  return toServiceResult(envelope, identity);
}

export async function updateChecklistItem(
  workspaceId: string,
  taskId: string,
  itemId: string,
  changes: { title?: string; isCompleted?: boolean },
): Promise<ServiceResult<ChecklistItem>> {
  const envelope = await patch<ChecklistItem>(
    taskPath(workspaceId, taskId, `/checklist-items/${itemId}`),
    changes,
  );
  return toServiceResult(envelope, identity);
}

export async function deleteChecklistItem(
  workspaceId: string,
  taskId: string,
  itemId: string,
): Promise<ServiceResult<{ id: string }>> {
  const envelope = await del<{ id: string }>(
    taskPath(workspaceId, taskId, `/checklist-items/${itemId}`),
  );
  return toServiceResult(envelope, identity);
}

export async function reorderChecklist(
  workspaceId: string,
  taskId: string,
  orderedIds: string[],
): Promise<ServiceResult<{ items: ChecklistItem[]; progress: ChecklistProgress }>> {
  const envelope = await post<{ items: ChecklistItem[]; progress: ChecklistProgress }>(
    taskPath(workspaceId, taskId, "/checklist-items/reorder"),
    { orderedIds },
  );
  return toServiceResult(envelope, identity);
}

export async function listTags(
  workspaceId: string,
  q?: string,
): Promise<ServiceResult<TagRecord[]>> {
  const envelope = await get<TagRecord[]>(
    `/workspaces/${workspaceId}/tags${buildQueryString({ q })}`,
  );
  return toServiceResult(envelope, identity);
}

export async function createTag(
  workspaceId: string,
  input: { name: string; color?: string },
): Promise<ServiceResult<TagRecord>> {
  const envelope = await post<TagRecord>(`/workspaces/${workspaceId}/tags`, input);
  return toServiceResult(envelope, identity);
}

export async function deleteTag(
  workspaceId: string,
  tagId: string,
): Promise<ServiceResult<{ id: string }>> {
  const envelope = await del<{ id: string }>(
    `/workspaces/${workspaceId}/tags/${tagId}`,
  );
  return toServiceResult(envelope, identity);
}

export async function listTaskTags(
  workspaceId: string,
  taskId: string,
): Promise<ServiceResult<TagRecord[]>> {
  const envelope = await get<TagRecord[]>(taskPath(workspaceId, taskId, "/tags"));
  return toServiceResult(envelope, identity);
}

export async function setTaskTags(
  workspaceId: string,
  taskId: string,
  tagIds: string[],
): Promise<ServiceResult<TagRecord[]>> {
  const envelope = await put<TagRecord[]>(taskPath(workspaceId, taskId, "/tags"), {
    tagIds,
  });
  return toServiceResult(envelope, identity);
}

export async function listCustomFieldValues(
  workspaceId: string,
  taskId: string,
): Promise<ServiceResult<TaskCustomFieldValueRow[]>> {
  const envelope = await get<TaskCustomFieldValueRow[]>(
    taskPath(workspaceId, taskId, "/custom-field-values"),
  );
  return toServiceResult(envelope, identity);
}

export async function setCustomFieldValues(
  workspaceId: string,
  taskId: string,
  values: Array<{ customFieldId: string; value: unknown }>,
): Promise<ServiceResult<TaskCustomFieldValueRow[]>> {
  const envelope = await put<TaskCustomFieldValueRow[]>(
    taskPath(workspaceId, taskId, "/custom-field-values"),
    { values },
  );
  return toServiceResult(envelope, identity);
}

export async function listCustomFields(
  workspaceId: string,
  projectId?: string | null,
): Promise<ServiceResult<CustomFieldDefinition[]>> {
  const envelope = await get<CustomFieldDefinition[]>(
    `/workspaces/${workspaceId}/custom-fields${buildQueryString({
      projectId: projectId ?? undefined,
    })}`,
  );
  return toServiceResult(envelope, identity);
}

export async function createCustomField(
  workspaceId: string,
  input: {
    name: string;
    fieldType: CustomFieldDefinition["fieldType"];
    projectId?: string | null;
    isRequired?: boolean;
    options?: Array<{ value: string; label: string }>;
  },
): Promise<ServiceResult<CustomFieldDefinition>> {
  const envelope = await post<CustomFieldDefinition>(
    `/workspaces/${workspaceId}/custom-fields`,
    input,
  );
  return toServiceResult(envelope, identity);
}

export async function updateCustomField(
  workspaceId: string,
  fieldId: string,
  input: {
    name?: string;
    isRequired?: boolean;
    options?: Array<{ value: string; label: string }>;
    position?: number;
    isActive?: boolean;
  },
): Promise<ServiceResult<CustomFieldDefinition>> {
  const envelope = await patch<CustomFieldDefinition>(
    `/workspaces/${workspaceId}/custom-fields/${fieldId}`,
    input,
  );
  return toServiceResult(envelope, identity);
}

export async function deleteCustomField(
  workspaceId: string,
  fieldId: string,
): Promise<ServiceResult<CustomFieldDefinition>> {
  const envelope = await del<CustomFieldDefinition>(
    `/workspaces/${workspaceId}/custom-fields/${fieldId}`,
  );
  return toServiceResult(envelope, identity);
}

export async function listComments(
  workspaceId: string,
  taskId: string,
): Promise<ServiceResult<CommentRecord[]>> {
  const envelope = await get<CommentRecord[]>(
    taskPath(workspaceId, taskId, "/comments"),
  );
  return toServiceResult(envelope, identity);
}

export async function createComment(
  workspaceId: string,
  taskId: string,
  input: { content: string; parentCommentId?: string | null },
): Promise<ServiceResult<CommentRecord>> {
  const envelope = await post<CommentRecord>(
    taskPath(workspaceId, taskId, "/comments"),
    input,
  );
  return toServiceResult(envelope, identity);
}

export async function updateComment(
  workspaceId: string,
  taskId: string,
  commentId: string,
  content: string,
): Promise<ServiceResult<CommentRecord>> {
  const envelope = await patch<CommentRecord>(
    taskPath(workspaceId, taskId, `/comments/${commentId}`),
    { content },
  );
  return toServiceResult(envelope, identity);
}

export async function deleteComment(
  workspaceId: string,
  taskId: string,
  commentId: string,
): Promise<ServiceResult<CommentRecord>> {
  const envelope = await del<CommentRecord>(
    taskPath(workspaceId, taskId, `/comments/${commentId}`),
  );
  return toServiceResult(envelope, identity);
}

export async function listAttachments(
  workspaceId: string,
  taskId: string,
): Promise<ServiceResult<AttachmentRecord[]>> {
  const envelope = await get<AttachmentRecord[]>(
    taskPath(workspaceId, taskId, "/attachments"),
  );
  return toServiceResult(envelope, identity);
}

export async function uploadAttachment(
  workspaceId: string,
  taskId: string,
  file: File,
): Promise<ServiceResult<AttachmentRecord>> {
  const formData = new FormData();
  formData.append("file", file);
  const envelope = await postFormData<AttachmentRecord>(
    taskPath(workspaceId, taskId, "/attachments"),
    formData,
  );
  return toServiceResult(envelope, identity);
}

export async function getAttachmentDownload(
  workspaceId: string,
  taskId: string,
  attachmentId: string,
): Promise<
  ServiceResult<{
    attachment: AttachmentRecord;
    downloadUrl: string;
    expiresIn: number;
  }>
> {
  const envelope = await get<{
    attachment: AttachmentRecord;
    downloadUrl: string;
    expiresIn: number;
  }>(taskPath(workspaceId, taskId, `/attachments/${attachmentId}/download`));
  return toServiceResult(envelope, identity);
}

export async function deleteAttachment(
  workspaceId: string,
  taskId: string,
  attachmentId: string,
): Promise<ServiceResult<{ id: string }>> {
  const envelope = await del<{ id: string }>(
    taskPath(workspaceId, taskId, `/attachments/${attachmentId}`),
  );
  return toServiceResult(envelope, identity);
}
