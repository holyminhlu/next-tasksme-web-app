CREATE TYPE "TaskSource" AS ENUM ('MANUAL', 'AI_QUICK_CAPTURE', 'ONBOARDING');
CREATE TYPE "ActivityVisibility" AS ENUM ('WORKSPACE', 'ACTOR_ONLY');

ALTER TABLE "tasks"
  ADD COLUMN "isBlocked" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "blockedReason" TEXT,
  ADD COLUMN "source" "TaskSource" NOT NULL DEFAULT 'MANUAL',
  ADD COLUMN "completedAt" TIMESTAMP(3);

-- Backfill completion time for existing DONE tasks from last update when reasonable
UPDATE "tasks"
SET "completedAt" = "updatedAt"
WHERE "status" = 'DONE'
  AND "completedAt" IS NULL
  AND "deletedAt" IS NULL;

CREATE TABLE "activity_events" (
  "id" UUID NOT NULL,
  "workspaceId" UUID NOT NULL,
  "actorId" UUID,
  "action" TEXT NOT NULL,
  "resourceType" TEXT NOT NULL,
  "resourceId" UUID NOT NULL,
  "projectId" UUID,
  "summary" TEXT NOT NULL,
  "metadata" JSONB,
  "visibility" "ActivityVisibility" NOT NULL DEFAULT 'WORKSPACE',
  "sensitive" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "activity_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "activity_events_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "activity_events_actorId_fkey"
    FOREIGN KEY ("actorId") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "projects_workspaceId_status_deletedAt_idx"
  ON "projects"("workspaceId", "status", "deletedAt");
CREATE INDEX "tasks_workspaceId_status_dueDate_idx"
  ON "tasks"("workspaceId", "status", "dueDate");
CREATE INDEX "tasks_workspaceId_status_completedAt_idx"
  ON "tasks"("workspaceId", "status", "completedAt");
CREATE INDEX "tasks_workspaceId_assigneeId_status_dueDate_idx"
  ON "tasks"("workspaceId", "assigneeId", "status", "dueDate");
CREATE INDEX "tasks_workspaceId_projectId_status_idx"
  ON "tasks"("workspaceId", "projectId", "status");
CREATE INDEX "activity_events_workspaceId_createdAt_idx"
  ON "activity_events"("workspaceId", "createdAt");
CREATE INDEX "activity_events_workspaceId_projectId_createdAt_idx"
  ON "activity_events"("workspaceId", "projectId", "createdAt");
CREATE INDEX "activity_events_workspaceId_actorId_createdAt_idx"
  ON "activity_events"("workspaceId", "actorId", "createdAt");

-- Insert Phase 4 permissions (idempotent)
INSERT INTO "permissions" ("id", "key", "description", "createdAt", "updatedAt")
SELECT gen_random_uuid(), v.key, v.description, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM (VALUES
  ('tasks:delete', 'Delete tasks'),
  ('dashboard:read', 'View workspace dashboard'),
  ('activity:read', 'View workspace activity stream'),
  ('projects:delete', 'Delete projects')
) AS v(key, description)
WHERE NOT EXISTS (
  SELECT 1 FROM "permissions" p WHERE p."key" = v.key
);

-- Attach Phase 4 permissions to existing system roles
INSERT INTO "role_permissions" ("roleId", "permissionId")
SELECT r."id", p."id"
FROM "roles" r
CROSS JOIN "permissions" p
WHERE p."key" IN (
  'tasks:delete',
  'dashboard:read',
  'activity:read',
  'projects:delete'
)
AND (
  (r."key" = 'owner')
  OR (r."key" = 'admin')
  OR (r."key" = 'manager' AND p."key" IN (
    'tasks:delete', 'dashboard:read', 'activity:read'
  ))
  OR (r."key" = 'member' AND p."key" IN (
    'tasks:delete', 'dashboard:read', 'activity:read'
  ))
)
ON CONFLICT DO NOTHING;
