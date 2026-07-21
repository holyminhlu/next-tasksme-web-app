-- Phase 8.2: project workflow drafts, templates, clone jobs

CREATE TYPE "TemplateStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');
CREATE TYPE "TemplateVisibility" AS ENUM ('WORKSPACE', 'SYSTEM');
CREATE TYPE "CloneJobStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

ALTER TABLE "workflows" ADD COLUMN "sourceProjectId" UUID;

CREATE INDEX "workflows_sourceProjectId_status_idx" ON "workflows"("sourceProjectId", "status");

ALTER TABLE "workflows"
  ADD CONSTRAINT "workflows_sourceProjectId_fkey"
  FOREIGN KEY ("sourceProjectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "project_templates" (
  "id" UUID NOT NULL,
  "workspaceId" UUID,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "industryCode" TEXT,
  "version" INTEGER NOT NULL DEFAULT 1,
  "visibility" "TemplateVisibility" NOT NULL DEFAULT 'WORKSPACE',
  "status" "TemplateStatus" NOT NULL DEFAULT 'DRAFT',
  "contentJson" JSONB NOT NULL DEFAULT '{}',
  "createdById" UUID,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "project_templates_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "project_templates_workspaceId_name_version_key"
  ON "project_templates"("workspaceId", "name", "version");
CREATE INDEX "project_templates_workspaceId_status_idx"
  ON "project_templates"("workspaceId", "status");
CREATE INDEX "project_templates_visibility_status_idx"
  ON "project_templates"("visibility", "status");

ALTER TABLE "project_templates"
  ADD CONSTRAINT "project_templates_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "project_templates"
  ADD CONSTRAINT "project_templates_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "clone_jobs" (
  "id" UUID NOT NULL,
  "workspaceId" UUID NOT NULL,
  "templateId" UUID NOT NULL,
  "projectId" UUID,
  "status" "CloneJobStatus" NOT NULL DEFAULT 'PENDING',
  "idempotencyKey" TEXT NOT NULL,
  "progress" INTEGER NOT NULL DEFAULT 0,
  "errorMessage" TEXT,
  "resultJson" JSONB,
  "createdById" UUID,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),

  CONSTRAINT "clone_jobs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "clone_jobs_workspaceId_idempotencyKey_key"
  ON "clone_jobs"("workspaceId", "idempotencyKey");
CREATE INDEX "clone_jobs_status_createdAt_idx" ON "clone_jobs"("status", "createdAt");
CREATE INDEX "clone_jobs_templateId_idx" ON "clone_jobs"("templateId");

ALTER TABLE "clone_jobs"
  ADD CONSTRAINT "clone_jobs_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "clone_jobs"
  ADD CONSTRAINT "clone_jobs_templateId_fkey"
  FOREIGN KEY ("templateId") REFERENCES "project_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "clone_jobs"
  ADD CONSTRAINT "clone_jobs_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "clone_jobs"
  ADD CONSTRAINT "clone_jobs_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
