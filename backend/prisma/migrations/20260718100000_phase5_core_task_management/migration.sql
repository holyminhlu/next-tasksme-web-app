ALTER TYPE "TaskStatus" ADD VALUE IF NOT EXISTS 'IN_REVIEW';
ALTER TYPE "TaskStatus" ADD VALUE IF NOT EXISTS 'BLOCKED';

CREATE TYPE "ProjectVisibility" AS ENUM ('WORKSPACE', 'PRIVATE');
CREATE TYPE "NotificationType" AS ENUM ('TASK_ASSIGNED');

ALTER TABLE "projects"
  ADD COLUMN "visibility" "ProjectVisibility" NOT NULL DEFAULT 'WORKSPACE';

ALTER TABLE "tasks"
  ADD COLUMN "taskNumber" INTEGER,
  ADD COLUMN "startAt" TIMESTAMP(3),
  ADD COLUMN "completedById" UUID,
  ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "archivedAt" TIMESTAMP(3);

WITH numbered AS (
  SELECT "id", ROW_NUMBER() OVER (
    PARTITION BY "workspaceId" ORDER BY "createdAt", "id"
  )::INTEGER AS task_number
  FROM "tasks"
)
UPDATE "tasks" t
SET "taskNumber" = numbered.task_number
FROM numbered
WHERE t."id" = numbered."id";

ALTER TABLE "tasks" ALTER COLUMN "taskNumber" SET NOT NULL;

CREATE TABLE "project_members" (
  "id" UUID NOT NULL,
  "workspaceId" UUID NOT NULL,
  "projectId" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "project_members_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "project_members_workspaceId_fkey" FOREIGN KEY ("workspaceId")
    REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "project_members_projectId_fkey" FOREIGN KEY ("projectId")
    REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "project_members_userId_fkey" FOREIGN KEY ("userId")
    REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO "project_members" ("id", "workspaceId", "projectId", "userId")
SELECT gen_random_uuid(), p."workspaceId", p."id", p."createdById"
FROM "projects" p
WHERE p."visibility" = 'PRIVATE' AND p."createdById" IS NOT NULL
ON CONFLICT DO NOTHING;

CREATE TABLE "workspace_task_counters" (
  "workspaceId" UUID NOT NULL,
  "nextNumber" INTEGER NOT NULL DEFAULT 1,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "workspace_task_counters_pkey" PRIMARY KEY ("workspaceId"),
  CONSTRAINT "workspace_task_counters_workspaceId_fkey" FOREIGN KEY ("workspaceId")
    REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO "workspace_task_counters" ("workspaceId", "nextNumber", "updatedAt")
SELECT w."id", COALESCE(MAX(t."taskNumber"), 0) + 1, CURRENT_TIMESTAMP
FROM "workspaces" w
LEFT JOIN "tasks" t ON t."workspaceId" = w."id"
GROUP BY w."id"
ON CONFLICT ("workspaceId") DO NOTHING;

CREATE TABLE "notifications" (
  "id" UUID NOT NULL,
  "workspaceId" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "taskId" UUID,
  "type" "NotificationType" NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT,
  "dedupeKey" TEXT NOT NULL,
  "readAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "notifications_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "notifications_workspaceId_fkey" FOREIGN KEY ("workspaceId")
    REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId")
    REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "notifications_taskId_fkey" FOREIGN KEY ("taskId")
    REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "notification_preferences" (
  "id" UUID NOT NULL,
  "workspaceId" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "taskAssigned" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "notification_preferences_workspaceId_fkey" FOREIGN KEY ("workspaceId")
    REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "notification_preferences_userId_fkey" FOREIGN KEY ("userId")
    REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

ALTER TABLE "tasks" ADD CONSTRAINT "tasks_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assigneeId_fkey"
  FOREIGN KEY ("assigneeId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_completedById_fkey"
  FOREIGN KEY ("completedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE UNIQUE INDEX "tasks_workspaceId_taskNumber_key"
  ON "tasks"("workspaceId", "taskNumber");
CREATE INDEX "tasks_completedById_idx" ON "tasks"("completedById");
CREATE INDEX "tasks_workspaceId_archivedAt_deletedAt_idx"
  ON "tasks"("workspaceId", "archivedAt", "deletedAt");
CREATE UNIQUE INDEX "project_members_projectId_userId_key"
  ON "project_members"("projectId", "userId");
CREATE INDEX "project_members_workspaceId_userId_idx"
  ON "project_members"("workspaceId", "userId");
CREATE UNIQUE INDEX "notifications_dedupeKey_key" ON "notifications"("dedupeKey");
CREATE INDEX "notifications_workspaceId_userId_readAt_createdAt_idx"
  ON "notifications"("workspaceId", "userId", "readAt", "createdAt");
CREATE UNIQUE INDEX "notification_preferences_workspaceId_userId_key"
  ON "notification_preferences"("workspaceId", "userId");

INSERT INTO "permissions" ("id", "key", "description", "createdAt", "updatedAt")
SELECT gen_random_uuid(), 'tasks:assign', 'Assign tasks to workspace members',
       CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "permissions" WHERE "key" = 'tasks:assign');

INSERT INTO "role_permissions" ("roleId", "permissionId")
SELECT r."id", p."id"
FROM "roles" r
CROSS JOIN "permissions" p
WHERE p."key" = 'tasks:assign' AND r."key" IN ('owner', 'admin', 'manager', 'member')
ON CONFLICT DO NOTHING;
