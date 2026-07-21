-- Workflow/template version families, milestones, subtasks, and durable clone jobs.

ALTER TYPE "CloneJobStatus" ADD VALUE 'RETRY_WAIT';
ALTER TYPE "CloneJobStatus" ADD VALUE 'DEAD';
ALTER TYPE "CloneJobStatus" ADD VALUE 'CANCELLED';

CREATE TYPE "MilestoneStatus" AS ENUM (
  'PLANNED',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED'
);

-- Start conservatively: every existing workflow is its own family. Then link
-- only the current project workflow and its project-owned drafts, where lineage
-- is explicit. Human-readable names are not a safe identity boundary.
ALTER TABLE "workflows" ADD COLUMN "familyId" UUID;

UPDATE "workflows" SET "familyId" = "id";

UPDATE "workflows" AS draft
SET "familyId" = applied."workflowId"
FROM "project_workflows" AS applied
WHERE draft."sourceProjectId" = applied."projectId"
  AND draft."status" = 'DRAFT';

ALTER TABLE "workflows" ALTER COLUMN "familyId" SET NOT NULL;

-- Keep the newest draft in each inferred family current. Older drafts remain
-- available as archived versions, making the partial uniqueness safe to add.
WITH ranked_drafts AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY "familyId"
      ORDER BY "version" DESC, "updatedAt" DESC, "id" DESC
    ) AS draft_rank
  FROM "workflows"
  WHERE "status" = 'DRAFT'
)
UPDATE "workflows" AS w
SET "status" = 'ARCHIVED',
    "updatedAt" = CURRENT_TIMESTAMP
FROM ranked_drafts AS d
WHERE w."id" = d."id"
  AND d.draft_rank > 1;

DROP INDEX "workflows_workspaceId_name_version_key";
CREATE UNIQUE INDEX "workflows_familyId_version_key"
  ON "workflows"("familyId", "version");
CREATE INDEX "workflows_workspaceId_familyId_idx"
  ON "workflows"("workspaceId", "familyId");
CREATE UNIQUE INDEX "workflows_current_draft_per_family_key"
  ON "workflows"("familyId")
  WHERE "status" = 'DRAFT';

CREATE UNIQUE INDEX "workflow_stages_workflowId_id_key"
  ON "workflow_stages"("workflowId", "id");

-- Abort before changing constraints if either endpoint belongs to another
-- workflow. Silently repairing such transitions could change workflow meaning.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "workflow_transitions" AS wt
    JOIN "workflow_stages" AS source_stage
      ON source_stage."id" = wt."fromStageId"
    JOIN "workflow_stages" AS target_stage
      ON target_stage."id" = wt."toStageId"
    WHERE source_stage."workflowId" <> wt."workflowId"
       OR target_stage."workflowId" <> wt."workflowId"
  ) THEN
    RAISE EXCEPTION
      'Cannot install composite transition constraints: one or more transition endpoints belong to a different workflow';
  END IF;
END
$$;

ALTER TABLE "workflow_transitions"
  DROP CONSTRAINT "workflow_transitions_fromStageId_fkey",
  DROP CONSTRAINT "workflow_transitions_toStageId_fkey";

ALTER TABLE "workflow_transitions"
  ADD CONSTRAINT "workflow_transitions_workflowId_fromStageId_fkey"
  FOREIGN KEY ("workflowId", "fromStageId")
  REFERENCES "workflow_stages"("workflowId", "id")
  ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "workflow_transitions_workflowId_toStageId_fkey"
  FOREIGN KEY ("workflowId", "toStageId")
  REFERENCES "workflow_stages"("workflowId", "id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "tasks_workflowStageId_projectId_deletedAt_rank_idx"
  ON "tasks"("workflowStageId", "projectId", "deletedAt", "rank");

-- Existing templates are conservatively treated as independent series because
-- shared workspace/name alone does not prove a safe publishing lineage.
ALTER TABLE "project_templates"
  ADD COLUMN "seriesId" UUID,
  ADD COLUMN "contentSchemaVersion" INTEGER NOT NULL DEFAULT 2,
  ADD COLUMN "contentHash" TEXT,
  ADD COLUMN "publishedAt" TIMESTAMP(3),
  ADD COLUMN "supersededAt" TIMESTAMP(3);

UPDATE "project_templates"
SET "seriesId" = "id",
    "publishedAt" = CASE
      WHEN "status" = 'PUBLISHED' THEN "createdAt"
      ELSE NULL
    END,
    "supersededAt" = CASE
      WHEN "status" = 'ARCHIVED' THEN "updatedAt"
      ELSE NULL
    END;

ALTER TABLE "project_templates" ALTER COLUMN "seriesId" SET NOT NULL;

DROP INDEX "project_templates_workspaceId_name_version_key";
CREATE UNIQUE INDEX "project_templates_seriesId_version_key"
  ON "project_templates"("seriesId", "version");
CREATE INDEX "project_templates_workspaceId_seriesId_idx"
  ON "project_templates"("workspaceId", "seriesId");
CREATE UNIQUE INDEX "project_templates_current_published_per_series_key"
  ON "project_templates"("seriesId")
  WHERE "status" = 'PUBLISHED' AND "supersededAt" IS NULL;

CREATE TABLE "milestones" (
  "id" UUID NOT NULL,
  "workspaceId" UUID NOT NULL,
  "projectId" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "status" "MilestoneStatus" NOT NULL DEFAULT 'PLANNED',
  "position" INTEGER NOT NULL DEFAULT 0,
  "startAt" TIMESTAMP(3),
  "dueAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdById" UUID,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "milestones_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "milestones_workspaceId_projectId_position_idx"
  ON "milestones"("workspaceId", "projectId", "position");
CREATE INDEX "milestones_projectId_status_dueAt_idx"
  ON "milestones"("projectId", "status", "dueAt");
CREATE INDEX "milestones_createdById_idx" ON "milestones"("createdById");

ALTER TABLE "milestones"
  ADD CONSTRAINT "milestones_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id")
  ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "milestones_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "projects"("id")
  ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "milestones_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "tasks"
  ADD COLUMN "parentTaskId" UUID,
  ADD COLUMN "subtaskPosition" INTEGER,
  ADD COLUMN "milestoneId" UUID;

CREATE INDEX "tasks_parentTaskId_subtaskPosition_idx"
  ON "tasks"("parentTaskId", "subtaskPosition");
CREATE INDEX "tasks_milestoneId_subtaskPosition_idx"
  ON "tasks"("milestoneId", "subtaskPosition");

ALTER TABLE "tasks"
  ADD CONSTRAINT "tasks_parentTaskId_fkey"
  FOREIGN KEY ("parentTaskId") REFERENCES "tasks"("id")
  ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "tasks_milestoneId_fkey"
  FOREIGN KEY ("milestoneId") REFERENCES "milestones"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "clone_jobs"
  ADD COLUMN "payloadJson" JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN "requestHash" TEXT,
  ADD COLUMN "templateContentHash" TEXT,
  ADD COLUMN "attempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "maxAttempts" INTEGER NOT NULL DEFAULT 5,
  ADD COLUMN "nextAttemptAt" TIMESTAMP(3),
  ADD COLUMN "leaseToken" TEXT,
  ADD COLUMN "leasedBy" TEXT,
  ADD COLUMN "leasedAt" TIMESTAMP(3),
  ADD COLUMN "leaseExpiresAt" TIMESTAMP(3),
  ADD COLUMN "heartbeatAt" TIMESTAMP(3),
  ADD COLUMN "lastErrorCode" TEXT,
  ADD COLUMN "lastErrorAt" TIMESTAMP(3),
  ADD COLUMN "cleanupAfter" TIMESTAMP(3);

UPDATE "clone_jobs"
SET "requestHash" = md5("workspaceId"::text || ':' || "idempotencyKey");

ALTER TABLE "clone_jobs" ALTER COLUMN "requestHash" SET NOT NULL;

CREATE INDEX "clone_jobs_status_nextAttemptAt_idx"
  ON "clone_jobs"("status", "nextAttemptAt");
CREATE INDEX "clone_jobs_leaseExpiresAt_idx" ON "clone_jobs"("leaseExpiresAt");
CREATE INDEX "clone_jobs_cleanupAfter_idx" ON "clone_jobs"("cleanupAfter");

ALTER TABLE "projects" ADD COLUMN "sourceCloneJobId" UUID;

CREATE UNIQUE INDEX "projects_sourceCloneJobId_key"
  ON "projects"("sourceCloneJobId");

ALTER TABLE "projects"
  ADD CONSTRAINT "projects_sourceCloneJobId_fkey"
  FOREIGN KEY ("sourceCloneJobId") REFERENCES "clone_jobs"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
