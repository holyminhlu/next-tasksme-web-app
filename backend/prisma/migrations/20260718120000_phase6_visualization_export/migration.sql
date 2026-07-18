-- CreateEnum
CREATE TYPE "SavedViewResourceType" AS ENUM ('TASK');
CREATE TYPE "SavedViewType" AS ENUM ('LIST', 'BOARD', 'CALENDAR', 'TIMELINE');
CREATE TYPE "SavedViewVisibility" AS ENUM ('PRIVATE');

-- AlterTable
ALTER TABLE "tasks" ADD COLUMN "rank" TEXT;

WITH ranked AS (
  SELECT
    "id",
    LPAD(
      (
        ROW_NUMBER() OVER (
          PARTITION BY "workspaceId", COALESCE("projectId"::text, ''), "status"
          ORDER BY "taskNumber" ASC, "createdAt" ASC, "id" ASC
        ) * 1000
      )::text,
      16,
      '0'
    ) AS next_rank
  FROM "tasks"
)
UPDATE "tasks" t
SET "rank" = ranked.next_rank
FROM ranked
WHERE t."id" = ranked."id";

ALTER TABLE "tasks" ALTER COLUMN "rank" SET NOT NULL;
ALTER TABLE "tasks" ALTER COLUMN "rank" SET DEFAULT '0000000000001000';

CREATE INDEX "tasks_workspaceId_projectId_status_rank_idx"
  ON "tasks"("workspaceId", "projectId", "status", "rank");
CREATE INDEX "tasks_workspaceId_startAt_idx" ON "tasks"("workspaceId", "startAt");
CREATE INDEX "tasks_workspaceId_dueDate_idx" ON "tasks"("workspaceId", "dueDate");

-- CreateTable
CREATE TABLE "saved_views" (
  "id" UUID NOT NULL,
  "workspaceId" UUID NOT NULL,
  "ownerUserId" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "resourceType" "SavedViewResourceType" NOT NULL DEFAULT 'TASK',
  "viewType" "SavedViewType" NOT NULL DEFAULT 'LIST',
  "visibility" "SavedViewVisibility" NOT NULL DEFAULT 'PRIVATE',
  "filtersJson" JSONB NOT NULL DEFAULT '{}',
  "sortJson" JSONB NOT NULL DEFAULT '{}',
  "groupByJson" JSONB NOT NULL DEFAULT '{}',
  "columnsJson" JSONB NOT NULL DEFAULT '[]',
  "displayOptionsJson" JSONB NOT NULL DEFAULT '{}',
  "configVersion" INTEGER NOT NULL DEFAULT 1,
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "saved_views_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "saved_views_workspaceId_ownerUserId_name_key"
  ON "saved_views"("workspaceId", "ownerUserId", "name");
CREATE INDEX "saved_views_workspaceId_ownerUserId_isDefault_idx"
  ON "saved_views"("workspaceId", "ownerUserId", "isDefault");
CREATE INDEX "saved_views_workspaceId_ownerUserId_viewType_idx"
  ON "saved_views"("workspaceId", "ownerUserId", "viewType");

ALTER TABLE "saved_views"
  ADD CONSTRAINT "saved_views_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "saved_views"
  ADD CONSTRAINT "saved_views_ownerUserId_fkey"
  FOREIGN KEY ("ownerUserId") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
