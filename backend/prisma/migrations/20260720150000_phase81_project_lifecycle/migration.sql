-- Phase 8.1: Project lifecycle, membership roles, and extended fields

CREATE TYPE "ProjectStatus" AS ENUM (
  'PLANNING',
  'ACTIVE',
  'ON_HOLD',
  'COMPLETED',
  'CANCELLED',
  'ARCHIVED'
);

CREATE TYPE "ProjectRole" AS ENUM (
  'PROJECT_OWNER',
  'PROJECT_MANAGER',
  'PROJECT_MEMBER',
  'PROJECT_VIEWER'
);

ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'PROJECT_STATUS_CHANGED';

ALTER TABLE "projects" ADD COLUMN "code" TEXT;
ALTER TABLE "projects" ADD COLUMN "priority" "TaskPriority" NOT NULL DEFAULT 'MEDIUM';
ALTER TABLE "projects" ADD COLUMN "managerId" UUID;
ALTER TABLE "projects" ADD COLUMN "startAt" TIMESTAMP(3);
ALTER TABLE "projects" ADD COLUMN "endAt" TIMESTAMP(3);
ALTER TABLE "projects" ADD COLUMN "completionPolicy" "DependencyCompletionPolicy" NOT NULL DEFAULT 'WARN_ONLY';
ALTER TABLE "projects" ADD COLUMN "completedAt" TIMESTAMP(3);
ALTER TABLE "projects" ADD COLUMN "archivedAt" TIMESTAMP(3);
ALTER TABLE "projects" ADD COLUMN "status_enum" "ProjectStatus";

UPDATE "projects"
SET "status_enum" = CASE
  WHEN UPPER("status") = 'PLANNING' THEN 'PLANNING'::"ProjectStatus"
  WHEN UPPER("status") = 'ON_HOLD' THEN 'ON_HOLD'::"ProjectStatus"
  WHEN UPPER("status") = 'COMPLETED' THEN 'COMPLETED'::"ProjectStatus"
  WHEN UPPER("status") = 'CANCELLED' THEN 'CANCELLED'::"ProjectStatus"
  WHEN UPPER("status") = 'ARCHIVED' THEN 'ARCHIVED'::"ProjectStatus"
  ELSE 'ACTIVE'::"ProjectStatus"
END;

ALTER TABLE "projects" DROP COLUMN "status";
ALTER TABLE "projects" RENAME COLUMN "status_enum" TO "status";
ALTER TABLE "projects" ALTER COLUMN "status" SET NOT NULL;
ALTER TABLE "projects" ALTER COLUMN "status" SET DEFAULT 'ACTIVE'::"ProjectStatus";

ALTER TABLE "projects" ADD CONSTRAINT "projects_managerId_fkey"
  FOREIGN KEY ("managerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE UNIQUE INDEX "projects_workspaceId_code_key" ON "projects"("workspaceId", "code");

ALTER TABLE "project_members" ADD COLUMN "projectRole" "ProjectRole" NOT NULL DEFAULT 'PROJECT_MEMBER';
ALTER TABLE "project_members" ADD COLUMN "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "project_members" ADD COLUMN "addedById" UUID;

ALTER TABLE "project_members" ADD CONSTRAINT "project_members_addedById_fkey"
  FOREIGN KEY ("addedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

UPDATE "project_members" pm
SET "projectRole" = 'PROJECT_OWNER'::"ProjectRole"
FROM "projects" p
WHERE pm."projectId" = p."id"
  AND pm."userId" = p."createdById";

INSERT INTO "project_members" ("id", "workspaceId", "projectId", "userId", "projectRole", "joinedAt", "createdAt")
SELECT gen_random_uuid(), p."workspaceId", p."id", p."createdById", 'PROJECT_OWNER'::"ProjectRole", p."createdAt", p."createdAt"
FROM "projects" p
WHERE p."createdById" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "project_members" pm
    WHERE pm."projectId" = p."id" AND pm."userId" = p."createdById"
  );

UPDATE "projects" SET "managerId" = "createdById" WHERE "createdById" IS NOT NULL AND "managerId" IS NULL;

CREATE INDEX "projects_workspaceId_managerId_idx" ON "projects"("workspaceId", "managerId");
CREATE INDEX "projects_workspaceId_archivedAt_deletedAt_idx" ON "projects"("workspaceId", "archivedAt", "deletedAt");
CREATE INDEX "project_members_projectId_projectRole_idx" ON "project_members"("projectId", "projectRole");
