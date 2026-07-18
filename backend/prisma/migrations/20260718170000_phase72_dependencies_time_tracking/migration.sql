-- Phase 7.2: Dependencies, handoff, time tracking, and stage history

ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'TASK_UNBLOCKED';

CREATE TYPE "DependencyType" AS ENUM ('FINISH_TO_START');
CREATE TYPE "DependencyCompletionPolicy" AS ENUM (
  'WARN_ONLY',
  'BLOCK',
  'BLOCK_WITH_OVERRIDE'
);
CREATE TYPE "TimeLogSource" AS ENUM ('TIMER', 'MANUAL', 'IMPORT');

ALTER TABLE "workspaces"
  ADD COLUMN "dependencyCompletionPolicy" "DependencyCompletionPolicy"
  NOT NULL DEFAULT 'WARN_ONLY';

ALTER TABLE "notification_preferences"
  ADD COLUMN "taskUnblocked" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "tasks"
  ADD COLUMN "dependencyBlocked" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "dependencyOverrideReason" TEXT,
  ADD COLUMN "dependencyOverriddenById" UUID,
  ADD COLUMN "dependencyOverriddenAt" TIMESTAMP(3),
  ADD CONSTRAINT "tasks_dependencyOverriddenById_fkey"
    FOREIGN KEY ("dependencyOverriddenById")
    REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "tasks_dependencyOverriddenById_idx"
  ON "tasks"("dependencyOverriddenById");

CREATE TABLE "task_dependencies" (
  "id" UUID NOT NULL,
  "workspaceId" UUID NOT NULL,
  "predecessorTaskId" UUID NOT NULL,
  "successorTaskId" UUID NOT NULL,
  "dependencyType" "DependencyType" NOT NULL DEFAULT 'FINISH_TO_START',
  "createdById" UUID,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "task_dependencies_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "task_dependencies_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "task_dependencies_predecessorTaskId_fkey"
    FOREIGN KEY ("predecessorTaskId") REFERENCES "tasks"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "task_dependencies_successorTaskId_fkey"
    FOREIGN KEY ("successorTaskId") REFERENCES "tasks"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "task_dependencies_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "task_dependencies_not_self"
    CHECK ("predecessorTaskId" <> "successorTaskId")
);

CREATE UNIQUE INDEX "task_dependencies_predecessorTaskId_successorTaskId_dependencyType_key"
  ON "task_dependencies"("predecessorTaskId", "successorTaskId", "dependencyType");
CREATE INDEX "task_dependencies_workspaceId_predecessorTaskId_idx"
  ON "task_dependencies"("workspaceId", "predecessorTaskId");
CREATE INDEX "task_dependencies_workspaceId_successorTaskId_idx"
  ON "task_dependencies"("workspaceId", "successorTaskId");

CREATE TABLE "time_logs" (
  "id" UUID NOT NULL,
  "workspaceId" UUID NOT NULL,
  "taskId" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "startedAt" TIMESTAMP(3) NOT NULL,
  "endedAt" TIMESTAMP(3),
  "durationSeconds" INTEGER,
  "description" TEXT,
  "source" "TimeLogSource" NOT NULL DEFAULT 'MANUAL',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "time_logs_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "time_logs_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "time_logs_taskId_fkey"
    FOREIGN KEY ("taskId") REFERENCES "tasks"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "time_logs_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "time_logs_valid_interval"
    CHECK ("endedAt" IS NULL OR "endedAt" >= "startedAt"),
  CONSTRAINT "time_logs_nonnegative_duration"
    CHECK ("durationSeconds" IS NULL OR "durationSeconds" >= 0)
);

CREATE INDEX "time_logs_workspaceId_userId_endedAt_idx"
  ON "time_logs"("workspaceId", "userId", "endedAt");
CREATE INDEX "time_logs_taskId_startedAt_idx"
  ON "time_logs"("taskId", "startedAt");
CREATE INDEX "time_logs_workspaceId_startedAt_endedAt_idx"
  ON "time_logs"("workspaceId", "startedAt", "endedAt");
CREATE UNIQUE INDEX "time_logs_one_running_timer_per_workspace_user"
  ON "time_logs"("workspaceId", "userId")
  WHERE "endedAt" IS NULL;

CREATE TABLE "task_status_history" (
  "id" UUID NOT NULL,
  "taskId" UUID NOT NULL,
  "fromStatus" "TaskStatus",
  "toStatus" "TaskStatus" NOT NULL,
  "changedById" UUID,
  "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "durationInPreviousStatus" INTEGER,
  CONSTRAINT "task_status_history_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "task_status_history_taskId_fkey"
    FOREIGN KEY ("taskId") REFERENCES "tasks"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "task_status_history_changedById_fkey"
    FOREIGN KEY ("changedById") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "task_status_history_nonnegative_duration"
    CHECK ("durationInPreviousStatus" IS NULL OR "durationInPreviousStatus" >= 0)
);

CREATE INDEX "task_status_history_taskId_changedAt_idx"
  ON "task_status_history"("taskId", "changedAt");

INSERT INTO "task_status_history" (
  "id", "taskId", "fromStatus", "toStatus", "changedById",
  "changedAt", "durationInPreviousStatus"
)
SELECT
  gen_random_uuid(), t."id", NULL, t."status", t."createdById",
  t."createdAt", NULL
FROM "tasks" t
WHERE NOT EXISTS (
  SELECT 1 FROM "task_status_history" h WHERE h."taskId" = t."id"
);

WITH new_permissions(key, description) AS (
  VALUES
    ('task_dependency.view', 'View task dependencies'),
    ('task_dependency.manage', 'Manage task dependencies'),
    ('task_dependency.override', 'Override dependency completion policy'),
    ('time_log.view_own', 'View own time logs'),
    ('time_log.create', 'Create and run own time logs'),
    ('time_log.update_own', 'Update own time logs'),
    ('time_log.delete_own', 'Delete own time logs'),
    ('time_log.view_all', 'View all workspace time logs'),
    ('time_log.manage_all', 'Manage all workspace time logs'),
    ('task_history.view', 'View task stage history')
)
INSERT INTO "permissions" ("id", "key", "description", "createdAt", "updatedAt")
SELECT gen_random_uuid(), key, description, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM new_permissions
WHERE NOT EXISTS (
  SELECT 1 FROM "permissions" p WHERE p."key" = new_permissions.key
);

INSERT INTO "role_permissions" ("roleId", "permissionId")
SELECT r."id", p."id"
FROM "roles" r
CROSS JOIN "permissions" p
WHERE r."key" IN ('owner', 'admin', 'manager')
  AND p."key" IN (
    'task_dependency.view', 'task_dependency.manage',
    'task_dependency.override', 'time_log.view_own', 'time_log.create',
    'time_log.update_own', 'time_log.delete_own', 'time_log.view_all',
    'time_log.manage_all', 'task_history.view'
  )
ON CONFLICT DO NOTHING;

INSERT INTO "role_permissions" ("roleId", "permissionId")
SELECT r."id", p."id"
FROM "roles" r
CROSS JOIN "permissions" p
WHERE r."key" = 'member'
  AND p."key" IN (
    'task_dependency.view', 'task_dependency.manage',
    'time_log.view_own', 'time_log.create', 'time_log.update_own',
    'time_log.delete_own', 'task_history.view'
  )
ON CONFLICT DO NOTHING;
