-- Phase 8.2: Project workflows, task workflow stages, and transitions

CREATE TYPE "WorkflowStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');
CREATE TYPE "WorkflowStageCategory" AS ENUM (
  'BACKLOG',
  'NOT_STARTED',
  'IN_PROGRESS',
  'BLOCKED',
  'COMPLETED',
  'CANCELLED'
);

CREATE TABLE "workflows" (
  "id" UUID NOT NULL,
  "workspaceId" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "status" "WorkflowStatus" NOT NULL DEFAULT 'DRAFT',
  "createdById" UUID,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "workflows_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "workflows_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "workflows_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "workflows_workspaceId_name_version_key"
  ON "workflows"("workspaceId", "name", "version");
CREATE INDEX "workflows_workspaceId_status_idx"
  ON "workflows"("workspaceId", "status");

CREATE TABLE "workflow_stages" (
  "id" UUID NOT NULL,
  "workflowId" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "category" "WorkflowStageCategory" NOT NULL,
  "color" TEXT,
  "position" INTEGER NOT NULL,
  "isInitial" BOOLEAN NOT NULL DEFAULT false,
  "isTerminal" BOOLEAN NOT NULL DEFAULT false,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "workflow_stages_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "workflow_stages_workflowId_fkey"
    FOREIGN KEY ("workflowId") REFERENCES "workflows"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "workflow_stages_workflowId_name_key"
  ON "workflow_stages"("workflowId", "name");
CREATE INDEX "workflow_stages_workflowId_position_idx"
  ON "workflow_stages"("workflowId", "position");

CREATE TABLE "workflow_transitions" (
  "id" UUID NOT NULL,
  "workflowId" UUID NOT NULL,
  "fromStageId" UUID NOT NULL,
  "toStageId" UUID NOT NULL,
  "requiredPermission" TEXT,
  "conditionsJson" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "workflow_transitions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "workflow_transitions_workflowId_fkey"
    FOREIGN KEY ("workflowId") REFERENCES "workflows"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "workflow_transitions_fromStageId_fkey"
    FOREIGN KEY ("fromStageId") REFERENCES "workflow_stages"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "workflow_transitions_toStageId_fkey"
    FOREIGN KEY ("toStageId") REFERENCES "workflow_stages"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "workflow_transitions_workflowId_fromStageId_toStageId_key"
  ON "workflow_transitions"("workflowId", "fromStageId", "toStageId");
CREATE INDEX "workflow_transitions_workflowId_fromStageId_idx"
  ON "workflow_transitions"("workflowId", "fromStageId");
CREATE INDEX "workflow_transitions_workflowId_toStageId_idx"
  ON "workflow_transitions"("workflowId", "toStageId");

CREATE TABLE "project_workflows" (
  "projectId" UUID NOT NULL,
  "workflowId" UUID NOT NULL,
  "workflowVersion" INTEGER NOT NULL,
  "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "project_workflows_pkey" PRIMARY KEY ("projectId"),
  CONSTRAINT "project_workflows_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "projects"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "project_workflows_workflowId_fkey"
    FOREIGN KEY ("workflowId") REFERENCES "workflows"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "project_workflows_workflowId_appliedAt_idx"
  ON "project_workflows"("workflowId", "appliedAt");

ALTER TABLE "tasks"
  ADD COLUMN "workflowStageId" UUID;

ALTER TABLE "tasks"
  ADD CONSTRAINT "tasks_workflowStageId_fkey"
  FOREIGN KEY ("workflowStageId") REFERENCES "workflow_stages"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

