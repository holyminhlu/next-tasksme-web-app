-- Phase 7.1: Task metadata & collaboration

ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'TASK_MENTIONED';

CREATE TYPE "CustomFieldType" AS ENUM (
  'TEXT',
  'NUMBER',
  'BOOLEAN',
  'DATE',
  'SELECT',
  'MULTI_SELECT',
  'USER'
);

CREATE TYPE "AttachmentScanStatus" AS ENUM ('PENDING', 'CLEAN', 'REJECTED');

ALTER TABLE "notification_preferences"
  ADD COLUMN IF NOT EXISTS "taskMentioned" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE "checklist_items" (
  "id" UUID NOT NULL,
  "taskId" UUID NOT NULL,
  "title" TEXT NOT NULL,
  "isCompleted" BOOLEAN NOT NULL DEFAULT false,
  "position" INTEGER NOT NULL,
  "completedById" UUID,
  "completedAt" TIMESTAMP(3),
  "createdById" UUID,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "checklist_items_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "checklist_items_taskId_fkey" FOREIGN KEY ("taskId")
    REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "checklist_items_createdById_fkey" FOREIGN KEY ("createdById")
    REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "checklist_items_completedById_fkey" FOREIGN KEY ("completedById")
    REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "checklist_items_taskId_position_idx"
  ON "checklist_items"("taskId", "position");

CREATE TABLE "tags" (
  "id" UUID NOT NULL,
  "workspaceId" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "color" TEXT NOT NULL,
  "createdById" UUID,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "tags_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "tags_workspaceId_fkey" FOREIGN KEY ("workspaceId")
    REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "tags_createdById_fkey" FOREIGN KEY ("createdById")
    REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "tags_workspaceId_name_key" ON "tags"("workspaceId", "name");
CREATE INDEX "tags_workspaceId_idx" ON "tags"("workspaceId");

CREATE TABLE "task_tags" (
  "taskId" UUID NOT NULL,
  "tagId" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "task_tags_pkey" PRIMARY KEY ("taskId", "tagId"),
  CONSTRAINT "task_tags_taskId_fkey" FOREIGN KEY ("taskId")
    REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "task_tags_tagId_fkey" FOREIGN KEY ("tagId")
    REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "task_tags_tagId_idx" ON "task_tags"("tagId");

CREATE TABLE "custom_field_definitions" (
  "id" UUID NOT NULL,
  "workspaceId" UUID NOT NULL,
  "projectId" UUID,
  "name" TEXT NOT NULL,
  "fieldType" "CustomFieldType" NOT NULL,
  "isRequired" BOOLEAN NOT NULL DEFAULT false,
  "optionsJson" JSONB NOT NULL DEFAULT '[]',
  "defaultValueJson" JSONB,
  "position" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "custom_field_definitions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "custom_field_definitions_workspaceId_fkey" FOREIGN KEY ("workspaceId")
    REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "custom_field_definitions_projectId_fkey" FOREIGN KEY ("projectId")
    REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "custom_field_definitions_workspaceId_projectId_position_idx"
  ON "custom_field_definitions"("workspaceId", "projectId", "position");
CREATE INDEX "custom_field_definitions_workspaceId_isActive_idx"
  ON "custom_field_definitions"("workspaceId", "isActive");

CREATE TABLE "task_custom_field_values" (
  "taskId" UUID NOT NULL,
  "customFieldId" UUID NOT NULL,
  "valueJson" JSONB NOT NULL,
  "updatedById" UUID,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "task_custom_field_values_pkey" PRIMARY KEY ("taskId", "customFieldId"),
  CONSTRAINT "task_custom_field_values_taskId_fkey" FOREIGN KEY ("taskId")
    REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "task_custom_field_values_customFieldId_fkey" FOREIGN KEY ("customFieldId")
    REFERENCES "custom_field_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "task_custom_field_values_updatedById_fkey" FOREIGN KEY ("updatedById")
    REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "task_custom_field_values_customFieldId_idx"
  ON "task_custom_field_values"("customFieldId");

CREATE TABLE "comments" (
  "id" UUID NOT NULL,
  "taskId" UUID NOT NULL,
  "authorId" UUID NOT NULL,
  "parentCommentId" UUID,
  "content" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "comments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "comments_taskId_fkey" FOREIGN KEY ("taskId")
    REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "comments_authorId_fkey" FOREIGN KEY ("authorId")
    REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "comments_parentCommentId_fkey" FOREIGN KEY ("parentCommentId")
    REFERENCES "comments"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "comments_taskId_deletedAt_createdAt_idx"
  ON "comments"("taskId", "deletedAt", "createdAt");
CREATE INDEX "comments_parentCommentId_idx" ON "comments"("parentCommentId");

CREATE TABLE "comment_mentions" (
  "id" UUID NOT NULL,
  "commentId" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "comment_mentions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "comment_mentions_commentId_fkey" FOREIGN KEY ("commentId")
    REFERENCES "comments"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "comment_mentions_commentId_userId_key"
  ON "comment_mentions"("commentId", "userId");
CREATE INDEX "comment_mentions_userId_idx" ON "comment_mentions"("userId");

CREATE TABLE "attachments" (
  "id" UUID NOT NULL,
  "workspaceId" UUID NOT NULL,
  "taskId" UUID NOT NULL,
  "uploadedById" UUID,
  "originalFileName" TEXT NOT NULL,
  "storageKey" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "sizeBytes" INTEGER NOT NULL,
  "checksum" TEXT,
  "scanStatus" "AttachmentScanStatus" NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "attachments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "attachments_workspaceId_fkey" FOREIGN KEY ("workspaceId")
    REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "attachments_taskId_fkey" FOREIGN KEY ("taskId")
    REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "attachments_uploadedById_fkey" FOREIGN KEY ("uploadedById")
    REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "attachments_storageKey_key" ON "attachments"("storageKey");
CREATE INDEX "attachments_taskId_deletedAt_createdAt_idx"
  ON "attachments"("taskId", "deletedAt", "createdAt");
CREATE INDEX "attachments_workspaceId_deletedAt_idx"
  ON "attachments"("workspaceId", "deletedAt");

-- Permission catalog + backfill for existing system roles
WITH new_permissions(key, description) AS (
  VALUES
    ('checklist.manage', 'Manage task checklist items'),
    ('tag.view', 'View workspace tags'),
    ('tag.create', 'Create workspace tags'),
    ('tag.update', 'Update workspace tags'),
    ('tag.delete', 'Delete workspace tags'),
    ('task.tag.manage', 'Assign tags to tasks'),
    ('custom_field.view', 'View custom field definitions and values'),
    ('custom_field.configure', 'Configure custom field definitions'),
    ('custom_field.value.update', 'Update custom field values on tasks'),
    ('comment.view', 'View task comments'),
    ('comment.create', 'Create task comments'),
    ('comment.update_own', 'Update own task comments'),
    ('comment.delete_own', 'Delete own task comments'),
    ('comment.moderate', 'Moderate any task comments'),
    ('attachment.view', 'View task attachments'),
    ('attachment.upload', 'Upload task attachments'),
    ('attachment.delete_own', 'Delete own task attachments'),
    ('attachment.manage', 'Manage any task attachments')
)
INSERT INTO "permissions" ("id", "key", "description", "createdAt", "updatedAt")
SELECT gen_random_uuid(), key, description, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM new_permissions
WHERE NOT EXISTS (
  SELECT 1 FROM "permissions" p WHERE p."key" = new_permissions.key
);

-- owner + admin: all new permissions
INSERT INTO "role_permissions" ("roleId", "permissionId")
SELECT r."id", p."id"
FROM "roles" r
CROSS JOIN "permissions" p
WHERE r."key" IN ('owner', 'admin')
  AND p."key" IN (
    'checklist.manage',
    'tag.view', 'tag.create', 'tag.update', 'tag.delete', 'task.tag.manage',
    'custom_field.view', 'custom_field.configure', 'custom_field.value.update',
    'comment.view', 'comment.create', 'comment.update_own', 'comment.delete_own', 'comment.moderate',
    'attachment.view', 'attachment.upload', 'attachment.delete_own', 'attachment.manage'
  )
ON CONFLICT DO NOTHING;

-- manager: most, including configure and tag delete
INSERT INTO "role_permissions" ("roleId", "permissionId")
SELECT r."id", p."id"
FROM "roles" r
CROSS JOIN "permissions" p
WHERE r."key" = 'manager'
  AND p."key" IN (
    'checklist.manage',
    'tag.view', 'tag.create', 'tag.update', 'tag.delete', 'task.tag.manage',
    'custom_field.view', 'custom_field.configure', 'custom_field.value.update',
    'comment.view', 'comment.create', 'comment.update_own', 'comment.delete_own', 'comment.moderate',
    'attachment.view', 'attachment.upload', 'attachment.delete_own', 'attachment.manage'
  )
ON CONFLICT DO NOTHING;

-- member: collaborate without tag.delete / configure / moderate / manage
INSERT INTO "role_permissions" ("roleId", "permissionId")
SELECT r."id", p."id"
FROM "roles" r
CROSS JOIN "permissions" p
WHERE r."key" = 'member'
  AND p."key" IN (
    'checklist.manage',
    'tag.view', 'tag.create', 'tag.update', 'task.tag.manage',
    'custom_field.view', 'custom_field.value.update',
    'comment.view', 'comment.create', 'comment.update_own', 'comment.delete_own',
    'attachment.view', 'attachment.upload', 'attachment.delete_own'
  )
ON CONFLICT DO NOTHING;
