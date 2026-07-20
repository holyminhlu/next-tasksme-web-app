export type RecurrenceFrequency = "DAILY" | "WEEKLY" | "MONTHLY";

export type RecurrenceOverlapPolicy =
  | "CREATE_ANYWAY"
  | "SKIP_IF_OPEN"
  | "CREATE_AND_NOTIFY";

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type SlaInstanceStatus =
  | "ACTIVE"
  | "PAUSED"
  | "MET"
  | "BREACHED"
  | "CANCELLED";

export type AutomationJobType =
  | "RECURRENCE_GENERATE"
  | "RISK_RECALCULATE"
  | "SLA_WARNING"
  | "SLA_BREACH"
  | "RETRY";

export type AutomationRunStatus =
  | "PENDING"
  | "RUNNING"
  | "SUCCEEDED"
  | "FAILED"
  | "SKIPPED"
  | "DEAD";

export type TaskRecurrenceRecord = {
  id: string;
  workspaceId: string;
  templateTaskId: string;
  frequency: RecurrenceFrequency;
  interval: number;
  daysOfWeek: number[];
  dayOfMonth: number | null;
  timezone: string;
  startAt: string;
  endAt: string | null;
  nextRunAt: string | null;
  lastRunAt: string | null;
  overlapPolicy: RecurrenceOverlapPolicy;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type RecurrenceUpsertInput = {
  frequency: RecurrenceFrequency;
  interval: number;
  daysOfWeek?: number[];
  dayOfMonth?: number | null;
  timezone: string;
  startAt: string;
  endAt?: string | null;
  overlapPolicy: RecurrenceOverlapPolicy;
  isActive?: boolean;
};

export type TaskRiskRecord = {
  taskId: string;
  manualRiskLevel: RiskLevel | null;
  riskLevel: RiskLevel | null;
  riskScore: number | null;
  riskReasons: string[];
  calculatedAt: string | null;
};

export type RiskRuleRecord = {
  id: string;
  workspaceId: string;
  name: string;
  weights: {
    overdue: number;
    blockedOverDays: number;
    dependencyLate: number;
    unassigned: number;
  };
  thresholds: {
    medium: number;
    high: number;
    critical: number;
  };
  isActive: boolean;
};

export type WorkingHoursInput = {
  dayOfWeek: number;
  startMinute: number;
  endMinute: number;
};

export type HolidayInput = {
  date: string;
  name: string;
  isWorking?: boolean;
};

export type BusinessCalendarRecord = {
  id: string;
  workspaceId: string;
  name: string;
  timezone: string;
  isDefault: boolean;
  isActive: boolean;
  workingHours: WorkingHoursInput[];
  holidays: HolidayInput[];
};

export type SlaPolicyRecord = {
  id: string;
  workspaceId: string;
  name: string;
  triggerType: string;
  targetDurationMinutes: number;
  warningBeforeMinutes: number;
  applicableConditions: {
    priorities?: string[];
    statuses?: string[];
  };
  businessCalendarId: string | null;
  businessCalendarName?: string | null;
  isActive: boolean;
};

export type TaskSlaInstanceRecord = {
  id: string;
  taskId: string;
  policyId: string;
  policyName: string;
  startedAt: string;
  dueAt: string;
  warningAt: string | null;
  status: SlaInstanceStatus;
  pausedAt: string | null;
  totalPausedSeconds: number;
  warningSentAt: string | null;
  breachedAt: string | null;
  remainingSeconds: number | null;
};

export type AutomationRunRecord = {
  id: string;
  workspaceId: string;
  taskId: string | null;
  jobType: AutomationJobType;
  status: AutomationRunStatus;
  attempts: number;
  maxAttempts: number;
  errorMessage: string | null;
  nextRetryAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  resultJson?: unknown;
};
