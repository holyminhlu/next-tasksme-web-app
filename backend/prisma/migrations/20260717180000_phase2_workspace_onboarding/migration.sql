-- RenameEnum
ALTER TYPE "CompanyStatus" RENAME TO "WorkspaceStatus";

-- CreateEnum
CREATE TYPE "WorkspaceType" AS ENUM ('PERSONAL', 'ORGANIZATION');

-- CreateEnum
CREATE TYPE "OnboardingType" AS ENUM ('PERSONAL_OWNER', 'ORGANIZATION_OWNER', 'INVITED_MEMBER', 'INVITED_MANAGER');

-- CreateEnum
CREATE TYPE "OnboardingStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('TODO', 'IN_PROGRESS', 'DONE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TaskPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- RenameTable
ALTER TABLE "companies" RENAME TO "workspaces";
ALTER TABLE "company_members" RENAME TO "workspace_members";
ALTER TABLE "company_invitations" RENAME TO "workspace_invitations";

-- RenameColumn
ALTER TABLE "roles" RENAME COLUMN "companyId" TO "workspaceId";
ALTER TABLE "workspace_members" RENAME COLUMN "companyId" TO "workspaceId";
ALTER TABLE "workspace_invitations" RENAME COLUMN "companyId" TO "workspaceId";
ALTER TABLE "audit_logs" RENAME COLUMN "companyId" TO "workspaceId";

-- RenameIndex
ALTER INDEX "companies_slug_key" RENAME TO "workspaces_slug_key";
ALTER INDEX "companies_ownerId_idx" RENAME TO "workspaces_ownerId_idx";
ALTER INDEX "companies_status_idx" RENAME TO "workspaces_status_idx";
ALTER INDEX "roles_companyId_idx" RENAME TO "roles_workspaceId_idx";
ALTER INDEX "roles_companyId_key_key" RENAME TO "roles_workspaceId_key_key";
ALTER INDEX "roles_id_companyId_key" RENAME TO "roles_id_workspaceId_key";
ALTER INDEX "company_members_userId_idx" RENAME TO "workspace_members_userId_idx";
ALTER INDEX "company_members_roleId_idx" RENAME TO "workspace_members_roleId_idx";
ALTER INDEX "company_members_companyId_status_idx" RENAME TO "workspace_members_workspaceId_status_idx";
ALTER INDEX "company_members_companyId_userId_key" RENAME TO "workspace_members_workspaceId_userId_key";
ALTER INDEX "company_invitations_tokenHash_key" RENAME TO "workspace_invitations_tokenHash_key";
ALTER INDEX "company_invitations_companyId_email_idx" RENAME TO "workspace_invitations_workspaceId_email_idx";
ALTER INDEX "company_invitations_status_idx" RENAME TO "workspace_invitations_status_idx";
ALTER INDEX "company_invitations_expiresAt_idx" RENAME TO "workspace_invitations_expiresAt_idx";
ALTER INDEX "audit_logs_companyId_idx" RENAME TO "audit_logs_workspaceId_idx";

-- RenameConstraint
ALTER TABLE "workspaces" RENAME CONSTRAINT "companies_pkey" TO "workspaces_pkey";
ALTER TABLE "workspaces" RENAME CONSTRAINT "companies_ownerId_fkey" TO "workspaces_ownerId_fkey";
ALTER TABLE "workspace_members" RENAME CONSTRAINT "company_members_pkey" TO "workspace_members_pkey";
ALTER TABLE "workspace_members" RENAME CONSTRAINT "company_members_companyId_fkey" TO "workspace_members_workspaceId_fkey";
ALTER TABLE "workspace_members" RENAME CONSTRAINT "company_members_userId_fkey" TO "workspace_members_userId_fkey";
ALTER TABLE "workspace_members" RENAME CONSTRAINT "company_members_roleId_companyId_fkey" TO "workspace_members_roleId_workspaceId_fkey";
ALTER TABLE "workspace_invitations" RENAME CONSTRAINT "company_invitations_pkey" TO "workspace_invitations_pkey";
ALTER TABLE "workspace_invitations" RENAME CONSTRAINT "company_invitations_companyId_fkey" TO "workspace_invitations_workspaceId_fkey";
ALTER TABLE "workspace_invitations" RENAME CONSTRAINT "company_invitations_roleId_companyId_fkey" TO "workspace_invitations_roleId_workspaceId_fkey";
ALTER TABLE "workspace_invitations" RENAME CONSTRAINT "company_invitations_invitedById_fkey" TO "workspace_invitations_invitedById_fkey";
ALTER TABLE "roles" RENAME CONSTRAINT "roles_companyId_fkey" TO "roles_workspaceId_fkey";

-- AlterTable workspaces: Phase 2 fields + ORGANIZATION backfill via default
ALTER TABLE "workspaces"
ADD COLUMN "type" "WorkspaceType" NOT NULL DEFAULT 'ORGANIZATION',
ADD COLUMN "industryCode" TEXT,
ADD COLUMN "usagePurpose" TEXT,
ADD COLUMN "companySize" TEXT,
ADD COLUMN "timezone" TEXT NOT NULL DEFAULT 'UTC',
ADD COLUMN "locale" TEXT NOT NULL DEFAULT 'vi',
ADD COLUMN "logoUrl" TEXT;

UPDATE "workspaces" SET "type" = 'ORGANIZATION';

CREATE INDEX "workspaces_type_idx" ON "workspaces"("type");

-- AlterTable users: last active workspace
ALTER TABLE "users" ADD COLUMN "lastActiveWorkspaceId" UUID;

CREATE INDEX "users_lastActiveWorkspaceId_idx" ON "users"("lastActiveWorkspaceId");

ALTER TABLE "users"
ADD CONSTRAINT "users_lastActiveWorkspaceId_fkey"
FOREIGN KEY ("lastActiveWorkspaceId") REFERENCES "workspaces"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

-- Rename permission keys company:* → workspace:*
UPDATE "permissions"
SET "key" = 'workspace:read',
    "description" = 'View workspace profile'
WHERE "key" = 'company:read';

UPDATE "permissions"
SET "key" = 'workspace:update',
    "description" = 'Update workspace profile'
WHERE "key" = 'company:update';

UPDATE "permissions"
SET "description" = 'View workspace members'
WHERE "key" = 'members:read';

UPDATE "permissions"
SET "description" = 'Invite workspace members'
WHERE "key" = 'members:invite';

UPDATE "permissions"
SET "description" = 'Update workspace member roles'
WHERE "key" = 'members:update';

UPDATE "permissions"
SET "description" = 'Remove workspace members'
WHERE "key" = 'members:remove';

UPDATE "permissions"
SET "description" = 'Transfer workspace ownership'
WHERE "key" = 'ownership:transfer';

UPDATE "permissions"
SET "description" = 'View workspace roles'
WHERE "key" = 'roles:read';

UPDATE "permissions"
SET "description" = 'Manage workspace roles and permissions'
WHERE "key" = 'roles:manage';

-- Insert new Phase 2 permissions (idempotent)
INSERT INTO "permissions" ("id", "key", "description", "createdAt", "updatedAt")
SELECT gen_random_uuid(), v.key, v.description, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM (VALUES
  ('modules:manage', 'Manage workspace modules'),
  ('projects:read', 'View projects'),
  ('projects:create', 'Create projects'),
  ('projects:update', 'Update projects'),
  ('tasks:read', 'View tasks'),
  ('tasks:create', 'Create tasks'),
  ('tasks:update', 'Update tasks')
) AS v(key, description)
WHERE NOT EXISTS (
  SELECT 1 FROM "permissions" p WHERE p."key" = v.key
);

-- Attach new permissions to existing system roles
INSERT INTO "role_permissions" ("roleId", "permissionId")
SELECT r."id", p."id"
FROM "roles" r
CROSS JOIN "permissions" p
WHERE p."key" IN (
  'modules:manage',
  'projects:read',
  'projects:create',
  'projects:update',
  'tasks:read',
  'tasks:create',
  'tasks:update'
)
AND (
  (r."key" = 'owner')
  OR (r."key" = 'admin')
  OR (r."key" = 'manager' AND p."key" IN (
    'projects:read', 'projects:create', 'projects:update',
    'tasks:read', 'tasks:create', 'tasks:update'
  ))
  OR (r."key" = 'member' AND p."key" IN (
    'projects:read', 'tasks:read', 'tasks:create', 'tasks:update'
  ))
)
ON CONFLICT DO NOTHING;

-- CreateTable
CREATE TABLE "workspace_onboardings" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "onboardingType" "OnboardingType" NOT NULL,
    "status" "OnboardingStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "currentStep" TEXT NOT NULL,
    "completedSteps" JSONB NOT NULL DEFAULT '[]',
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workspace_onboardings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workspace_modules" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "moduleKey" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "core" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workspace_modules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tasks" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "projectId" UUID,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "TaskStatus" NOT NULL DEFAULT 'TODO',
    "priority" "TaskPriority" NOT NULL DEFAULT 'MEDIUM',
    "dueDate" TIMESTAMP(3),
    "createdById" UUID,
    "assigneeId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "workspace_onboardings_workspaceId_userId_key" ON "workspace_onboardings"("workspaceId", "userId");
CREATE INDEX "workspace_onboardings_userId_idx" ON "workspace_onboardings"("userId");
CREATE INDEX "workspace_onboardings_status_idx" ON "workspace_onboardings"("status");

CREATE UNIQUE INDEX "workspace_modules_workspaceId_moduleKey_key" ON "workspace_modules"("workspaceId", "moduleKey");
CREATE INDEX "workspace_modules_workspaceId_idx" ON "workspace_modules"("workspaceId");

CREATE INDEX "projects_workspaceId_idx" ON "projects"("workspaceId");
CREATE INDEX "projects_createdById_idx" ON "projects"("createdById");

CREATE INDEX "tasks_workspaceId_idx" ON "tasks"("workspaceId");
CREATE INDEX "tasks_projectId_idx" ON "tasks"("projectId");
CREATE INDEX "tasks_assigneeId_idx" ON "tasks"("assigneeId");

-- AddForeignKey
ALTER TABLE "workspace_onboardings"
ADD CONSTRAINT "workspace_onboardings_workspaceId_fkey"
FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "workspace_onboardings"
ADD CONSTRAINT "workspace_onboardings_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "workspace_modules"
ADD CONSTRAINT "workspace_modules_workspaceId_fkey"
FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "projects"
ADD CONSTRAINT "projects_workspaceId_fkey"
FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "tasks"
ADD CONSTRAINT "tasks_workspaceId_fkey"
FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "tasks"
ADD CONSTRAINT "tasks_projectId_fkey"
FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
