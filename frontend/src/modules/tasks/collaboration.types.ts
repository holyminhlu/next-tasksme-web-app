export type ChecklistItem = {
  id: string;
  taskId: string;
  title: string;
  isCompleted: boolean;
  position: number;
  completedById: string | null;
  completedAt: string | null;
  createdById: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ChecklistProgress = {
  completed: number;
  total: number;
};

export type TagRecord = {
  id: string;
  workspaceId: string;
  name: string;
  color: string;
  createdById: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CustomFieldType =
  | "TEXT"
  | "NUMBER"
  | "BOOLEAN"
  | "DATE"
  | "SELECT"
  | "MULTI_SELECT"
  | "USER";

export type CustomFieldOption = {
  value: string;
  label: string;
};

export type CustomFieldDefinition = {
  id: string;
  workspaceId: string;
  projectId: string | null;
  name: string;
  fieldType: CustomFieldType;
  isRequired: boolean;
  options: CustomFieldOption[];
  defaultValue: unknown;
  position: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type TaskCustomFieldValueRow = {
  field: CustomFieldDefinition;
  value: unknown;
};

export type CommentRecord = {
  id: string;
  taskId: string;
  authorId: string;
  authorName: string | null;
  authorEmail: string | null;
  parentCommentId: string | null;
  content: string;
  mentionUserIds: string[];
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  deleted: boolean;
};

export type AttachmentRecord = {
  id: string;
  workspaceId: string;
  taskId: string;
  uploadedById: string | null;
  originalFileName: string;
  mimeType: string;
  sizeBytes: number;
  checksum: string | null;
  scanStatus: "PENDING" | "CLEAN" | "REJECTED" | string;
  createdAt: string;
  deletedAt: string | null;
};
