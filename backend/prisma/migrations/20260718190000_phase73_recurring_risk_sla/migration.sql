-- Phase 7.3: Recurring tasks, risk indicators, SLA automation

ALTER TYPE "TaskSource" ADD VALUE IF NOT EXISTS 'RECURRING';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'RECURRENCE_CREATED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'RECURRENCE_SKIPPED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'SLA_WARNING';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'SLA_BREACHED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'RISK_ESCALATED';

CREATE TYPE "RecurrenceFrequency" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY');
CREATE TYPE "RecurrenceOverlapPolicy" AS ENUM (
  'CREATE_ANYWAY',
  'SKIP_IF_OPEN',
  'CREATE_AND_NOTIFY'
);
CREATE TYPE "RecurrenceOccurrenceStatus" AS ENUM (
  'PENDING',
  'CREATED',
  'SKIPPED',
  'FAILED'
);
CREATE TYPE "RiskLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
CREATE TYPE "SlaInstanceStatus" AS ENUM (
  'ACTIVE',
  'PAUSED',
  'MET',
  'BREACHED',
  'CANCELLED'
);
CREATE TYPE "AutomationJobType" AS ENUM (
  'RECURRENCE_GENERATE',
  'RISK_RECALCULATE',
  'SLA_WARNING',
  'SLA_BREACH',
  'RETRY'
);
CREATE TYPE "AutomationRunStatus" AS ENUM (
  'PENDING',
  'RUNNING',
  'SUCCEEDED',
  'FAILED',
  'SKIPPED',
  'DEAD'
);

ALTER TABLE "notification_preferences"
  ADD COLUMN "recurrenceCreated" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "recurrenceSkipped" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "slaWarning" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "slaBreached" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "riskEscalated" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "tasks"
  ADD COLUMN "manualRiskLevel" "RiskLevel",
  ADD COLUMN "riskLevel" "RiskLevel",
  ADD COLUMN "riskScore" INTEGER,
  ADD COLUMN "riskReasonsJson" JSONB,
  ADD COLUMN "riskCalculatedAt" TIMESTAMP(3),
  ADD COLUMN "riskRecalculateAt" TIMESTAMP(3);

CREATE INDEX "tasks_riskRecalculateAt_idx" ON "tasks"("riskRecalculateAt");
CREATE INDEX "tasks_workspaceId_riskLevel_idx" ON "tasks"("workspaceId", "riskLevel");

CREATE TABLE "task_recurrences" (
  "id" UUID NOT NULL,
  "workspaceId" UUID NOT NULL,
  "templateTaskId" UUID NOT NULL,
  "frequency" "RecurrenceFrequency" NOT NULL,
  "interval" INTEGER NOT NULL DEFAULT 1,
  "daysOfWeekJson" JSONB NOT NULL DEFAULT '[]',
  "dayOfMonth" INTEGER,
  "timezone" TEXT NOT NULL DEFAULT 'UTC',
  "startAt" TIMESTAMP(3) NOT NULL,
  "endAt" TIMESTAMP(3),
  "nextRunAt" TIMESTAMP(3),
  "lastRunAt" TIMESTAMP(3),
  "overlapPolicy" "RecurrenceOverlapPolicy" NOT NULL DEFAULT 'SKIP_IF_OPEN',
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdById" UUID,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "task_recurrences_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "task_recurrences_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "task_recurrences_templateTaskId_fkey"
    FOREIGN KEY ("templateTaskId") REFERENCES "tasks"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "task_recurrences_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "task_recurrences_interval_positive" CHECK ("interval" >= 1),
  CONSTRAINT "task_recurrences_dayOfMonth_range"
    CHECK ("dayOfMonth" IS NULL OR ("dayOfMonth" >= 1 AND "dayOfMonth" <= 31))
);

CREATE INDEX "task_recurrences_workspaceId_isActive_nextRunAt_idx"
  ON "task_recurrences"("workspaceId", "isActive", "nextRunAt");
CREATE INDEX "task_recurrences_templateTaskId_idx"
  ON "task_recurrences"("templateTaskId");
CREATE INDEX "task_recurrences_isActive_nextRunAt_idx"
  ON "task_recurrences"("isActive", "nextRunAt");

CREATE TABLE "recurring_task_occurrences" (
  "id" UUID NOT NULL,
  "recurrenceId" UUID NOT NULL,
  "scheduledAt" TIMESTAMP(3) NOT NULL,
  "generatedTaskId" UUID,
  "status" "RecurrenceOccurrenceStatus" NOT NULL DEFAULT 'PENDING',
  "errorMessage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "recurring_task_occurrences_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "recurring_task_occurrences_recurrenceId_fkey"
    FOREIGN KEY ("recurrenceId") REFERENCES "task_recurrences"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "recurring_task_occurrences_generatedTaskId_fkey"
    FOREIGN KEY ("generatedTaskId") REFERENCES "tasks"("id")
    ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "recurring_task_occurrences_recurrenceId_scheduledAt_key"
  ON "recurring_task_occurrences"("recurrenceId", "scheduledAt");
CREATE INDEX "recurring_task_occurrences_generatedTaskId_idx"
  ON "recurring_task_occurrences"("generatedTaskId");
CREATE INDEX "recurring_task_occurrences_status_createdAt_idx"
  ON "recurring_task_occurrences"("status", "createdAt");

CREATE TABLE "risk_rules" (
  "id" UUID NOT NULL,
  "workspaceId" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "weightsJson" JSONB NOT NULL,
  "thresholdsJson" JSONB NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "updatedById" UUID,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "risk_rules_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "risk_rules_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "risk_rules_updatedById_fkey"
    FOREIGN KEY ("updatedById") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "risk_rules_workspaceId_name_key"
  ON "risk_rules"("workspaceId", "name");
CREATE INDEX "risk_rules_workspaceId_isActive_idx"
  ON "risk_rules"("workspaceId", "isActive");

CREATE TABLE "task_risk_snapshots" (
  "id" UUID NOT NULL,
  "taskId" UUID NOT NULL,
  "riskLevel" "RiskLevel" NOT NULL,
  "riskScore" INTEGER NOT NULL,
  "riskReasons" JSONB NOT NULL,
  "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "task_risk_snapshots_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "task_risk_snapshots_taskId_fkey"
    FOREIGN KEY ("taskId") REFERENCES "tasks"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "task_risk_snapshots_taskId_calculatedAt_idx"
  ON "task_risk_snapshots"("taskId", "calculatedAt");

CREATE TABLE "business_calendars" (
  "id" UUID NOT NULL,
  "workspaceId" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "timezone" TEXT NOT NULL DEFAULT 'UTC',
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdById" UUID,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "business_calendars_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "business_calendars_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "business_calendars_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "business_calendars_workspaceId_name_key"
  ON "business_calendars"("workspaceId", "name");
CREATE INDEX "business_calendars_workspaceId_isActive_isDefault_idx"
  ON "business_calendars"("workspaceId", "isActive", "isDefault");

CREATE TABLE "working_hours" (
  "id" UUID NOT NULL,
  "calendarId" UUID NOT NULL,
  "dayOfWeek" INTEGER NOT NULL,
  "startMinute" INTEGER NOT NULL,
  "endMinute" INTEGER NOT NULL,
  CONSTRAINT "working_hours_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "working_hours_calendarId_fkey"
    FOREIGN KEY ("calendarId") REFERENCES "business_calendars"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "working_hours_dayOfWeek_range"
    CHECK ("dayOfWeek" >= 0 AND "dayOfWeek" <= 6),
  CONSTRAINT "working_hours_minutes_range"
    CHECK (
      "startMinute" >= 0 AND "startMinute" < 1440
      AND "endMinute" > 0 AND "endMinute" <= 1440
      AND "startMinute" < "endMinute"
    )
);

CREATE UNIQUE INDEX "working_hours_calendarId_dayOfWeek_key"
  ON "working_hours"("calendarId", "dayOfWeek");
CREATE INDEX "working_hours_calendarId_idx" ON "working_hours"("calendarId");

CREATE TABLE "holidays" (
  "id" UUID NOT NULL,
  "calendarId" UUID NOT NULL,
  "date" DATE NOT NULL,
  "name" TEXT NOT NULL,
  "isWorking" BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT "holidays_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "holidays_calendarId_fkey"
    FOREIGN KEY ("calendarId") REFERENCES "business_calendars"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "holidays_calendarId_date_key" ON "holidays"("calendarId", "date");
CREATE INDEX "holidays_calendarId_date_idx" ON "holidays"("calendarId", "date");

CREATE TABLE "sla_policies" (
  "id" UUID NOT NULL,
  "workspaceId" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "triggerType" TEXT NOT NULL DEFAULT 'TASK_CREATED',
  "targetDurationMinutes" INTEGER NOT NULL,
  "warningBeforeMinutes" INTEGER NOT NULL,
  "applicableConditionsJson" JSONB NOT NULL DEFAULT '{}',
  "businessCalendarId" UUID,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdById" UUID,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "sla_policies_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "sla_policies_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "sla_policies_businessCalendarId_fkey"
    FOREIGN KEY ("businessCalendarId") REFERENCES "business_calendars"("id")
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "sla_policies_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "sla_policies_durations_positive"
    CHECK (
      "targetDurationMinutes" > 0
      AND "warningBeforeMinutes" >= 0
      AND "warningBeforeMinutes" < "targetDurationMinutes"
    )
);

CREATE UNIQUE INDEX "sla_policies_workspaceId_name_key"
  ON "sla_policies"("workspaceId", "name");
CREATE INDEX "sla_policies_workspaceId_isActive_idx"
  ON "sla_policies"("workspaceId", "isActive");
CREATE INDEX "sla_policies_businessCalendarId_idx"
  ON "sla_policies"("businessCalendarId");

CREATE TABLE "task_sla_instances" (
  "id" UUID NOT NULL,
  "workspaceId" UUID NOT NULL,
  "taskId" UUID NOT NULL,
  "policyId" UUID NOT NULL,
  "startedAt" TIMESTAMP(3) NOT NULL,
  "dueAt" TIMESTAMP(3) NOT NULL,
  "warningAt" TIMESTAMP(3),
  "status" "SlaInstanceStatus" NOT NULL DEFAULT 'ACTIVE',
  "pausedAt" TIMESTAMP(3),
  "totalPausedSeconds" INTEGER NOT NULL DEFAULT 0,
  "warningSentAt" TIMESTAMP(3),
  "breachedAt" TIMESTAMP(3),
  "breachNotifiedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "task_sla_instances_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "task_sla_instances_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "task_sla_instances_taskId_fkey"
    FOREIGN KEY ("taskId") REFERENCES "tasks"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "task_sla_instances_policyId_fkey"
    FOREIGN KEY ("policyId") REFERENCES "sla_policies"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "task_sla_instances_workspaceId_status_idx"
  ON "task_sla_instances"("workspaceId", "status");
CREATE INDEX "task_sla_instances_taskId_status_idx"
  ON "task_sla_instances"("taskId", "status");
CREATE INDEX "task_sla_instances_status_warningAt_idx"
  ON "task_sla_instances"("status", "warningAt");
CREATE INDEX "task_sla_instances_status_dueAt_idx"
  ON "task_sla_instances"("status", "dueAt");

CREATE TABLE "automation_runs" (
  "id" UUID NOT NULL,
  "workspaceId" UUID NOT NULL,
  "taskId" UUID,
  "jobType" "AutomationJobType" NOT NULL,
  "status" "AutomationRunStatus" NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "maxAttempts" INTEGER NOT NULL DEFAULT 5,
  "idempotencyKey" TEXT NOT NULL,
  "correlationId" TEXT,
  "payloadJson" JSONB NOT NULL DEFAULT '{}',
  "resultJson" JSONB,
  "errorMessage" TEXT,
  "nextRetryAt" TIMESTAMP(3),
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "retriedById" UUID,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "automation_runs_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "automation_runs_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "automation_runs_taskId_fkey"
    FOREIGN KEY ("taskId") REFERENCES "tasks"("id")
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "automation_runs_retriedById_fkey"
    FOREIGN KEY ("retriedById") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "automation_runs_idempotencyKey_key"
  ON "automation_runs"("idempotencyKey");
CREATE INDEX "automation_runs_workspaceId_createdAt_idx"
  ON "automation_runs"("workspaceId", "createdAt");
CREATE INDEX "automation_runs_workspaceId_jobType_status_idx"
  ON "automation_runs"("workspaceId", "jobType", "status");
CREATE INDEX "automation_runs_status_nextRetryAt_idx"
  ON "automation_runs"("status", "nextRetryAt");
CREATE INDEX "automation_runs_taskId_createdAt_idx"
  ON "automation_runs"("taskId", "createdAt");

-- Enable SLA module catalog entry for existing organization workspaces (disabled by default)
INSERT INTO "workspace_modules" ("id", "workspaceId", "moduleKey", "enabled", "core", "createdAt", "updatedAt")
SELECT gen_random_uuid(), w."id", 'sla', false, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "workspaces" w
WHERE w."deletedAt" IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM "workspace_modules" m
    WHERE m."workspaceId" = w."id" AND m."moduleKey" = 'sla'
  );

-- Permissions
WITH new_permissions(key, description) AS (
  VALUES
    ('recurrence.view', 'View task recurrence schedules'),
    ('recurrence.manage', 'Manage task recurrence schedules'),
    ('risk.view', 'View task risk indicators'),
    ('risk.update', 'Update manual task risk level'),
    ('risk.configure', 'Configure workspace risk rules'),
    ('sla.view', 'View SLA policies and task SLA state'),
    ('sla.configure', 'Configure SLA policies and business calendars'),
    ('sla.override', 'Pause, resume, or override SLA instances'),
    ('automation.view', 'View automation history'),
    ('automation.manage', 'Manage automation configuration'),
    ('automation.retry', 'Retry failed automation jobs')
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
    'recurrence.view', 'recurrence.manage',
    'risk.view', 'risk.update', 'risk.configure',
    'sla.view', 'sla.configure', 'sla.override',
    'automation.view', 'automation.manage', 'automation.retry'
  )
ON CONFLICT DO NOTHING;

INSERT INTO "role_permissions" ("roleId", "permissionId")
SELECT r."id", p."id"
FROM "roles" r
CROSS JOIN "permissions" p
WHERE r."key" = 'member'
  AND p."key" IN (
    'recurrence.view', 'recurrence.manage',
    'risk.view', 'risk.update',
    'sla.view',
    'automation.view'
  )
ON CONFLICT DO NOTHING;
