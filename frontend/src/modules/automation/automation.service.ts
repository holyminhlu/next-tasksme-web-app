import { del, get, patch, post, put } from "@/lib/api/client";
import { buildQueryString } from "@/lib/api/query";
import { toServiceResult, type ServiceResult } from "@/lib/api/service";
import type {
  AutomationRunRecord,
  BusinessCalendarRecord,
  HolidayInput,
  RecurrenceUpsertInput,
  RiskRuleRecord,
  SlaPolicyRecord,
  TaskRecurrenceRecord,
  TaskRiskRecord,
  TaskSlaInstanceRecord,
  WorkingHoursInput,
} from "./automation.types";

function identity<T>(value: T) {
  return value;
}

function ws(workspaceId: string, suffix: string) {
  return `/workspaces/${workspaceId}${suffix}`;
}

function taskPath(workspaceId: string, taskId: string, suffix: string) {
  return `/workspaces/${workspaceId}/tasks/${taskId}${suffix}`;
}

export async function getRecurrence(
  workspaceId: string,
  taskId: string,
): Promise<ServiceResult<TaskRecurrenceRecord | null>> {
  return toServiceResult(
    await get<TaskRecurrenceRecord | null>(
      taskPath(workspaceId, taskId, "/recurrence"),
    ),
    identity,
  );
}

export async function upsertRecurrence(
  workspaceId: string,
  taskId: string,
  input: RecurrenceUpsertInput,
): Promise<ServiceResult<TaskRecurrenceRecord>> {
  return toServiceResult(
    await put<TaskRecurrenceRecord>(
      taskPath(workspaceId, taskId, "/recurrence"),
      input,
    ),
    identity,
  );
}

export async function deleteRecurrence(
  workspaceId: string,
  taskId: string,
): Promise<ServiceResult<{ ok: true }>> {
  return toServiceResult(
    await del<{ ok: true }>(taskPath(workspaceId, taskId, "/recurrence")),
    identity,
  );
}

export async function pauseRecurrence(
  workspaceId: string,
  taskId: string,
): Promise<ServiceResult<TaskRecurrenceRecord>> {
  return toServiceResult(
    await post<TaskRecurrenceRecord>(
      taskPath(workspaceId, taskId, "/recurrence/pause"),
      {},
    ),
    identity,
  );
}

export async function resumeRecurrence(
  workspaceId: string,
  taskId: string,
): Promise<ServiceResult<TaskRecurrenceRecord>> {
  return toServiceResult(
    await post<TaskRecurrenceRecord>(
      taskPath(workspaceId, taskId, "/recurrence/resume"),
      {},
    ),
    identity,
  );
}

export async function previewRecurrence(
  workspaceId: string,
  taskId: string,
  input: RecurrenceUpsertInput,
): Promise<ServiceResult<{ nextRuns: string[] }>> {
  return toServiceResult(
    await post<{ nextRuns: string[] }>(
      taskPath(workspaceId, taskId, "/recurrence/preview"),
      input,
    ),
    identity,
  );
}

export async function getTaskRisk(
  workspaceId: string,
  taskId: string,
): Promise<ServiceResult<TaskRiskRecord>> {
  return toServiceResult(
    await get<TaskRiskRecord>(taskPath(workspaceId, taskId, "/risk")),
    identity,
  );
}

export async function updateManualRisk(
  workspaceId: string,
  taskId: string,
  manualRiskLevel: string | null,
): Promise<ServiceResult<TaskRiskRecord>> {
  return toServiceResult(
    await patch<TaskRiskRecord>(taskPath(workspaceId, taskId, "/risk"), {
      manualRiskLevel,
    }),
    identity,
  );
}

export async function getRiskRule(
  workspaceId: string,
): Promise<ServiceResult<RiskRuleRecord | null>> {
  return toServiceResult(
    await get<RiskRuleRecord | null>(ws(workspaceId, "/risk-rules")),
    identity,
  );
}

export async function upsertRiskRule(
  workspaceId: string,
  input: {
    name?: string;
    weights: RiskRuleRecord["weights"];
    thresholds: RiskRuleRecord["thresholds"];
    isActive?: boolean;
  },
): Promise<ServiceResult<RiskRuleRecord>> {
  return toServiceResult(
    await put<RiskRuleRecord>(ws(workspaceId, "/risk-rules"), input),
    identity,
  );
}

export async function listBusinessCalendars(
  workspaceId: string,
): Promise<ServiceResult<BusinessCalendarRecord[]>> {
  return toServiceResult(
    await get<BusinessCalendarRecord[]>(
      ws(workspaceId, "/business-calendars"),
    ),
    identity,
  );
}

export async function createBusinessCalendar(
  workspaceId: string,
  input: {
    name: string;
    timezone: string;
    isDefault?: boolean;
    workingHours: WorkingHoursInput[];
    holidays?: HolidayInput[];
  },
): Promise<ServiceResult<BusinessCalendarRecord>> {
  return toServiceResult(
    await post<BusinessCalendarRecord>(
      ws(workspaceId, "/business-calendars"),
      input,
    ),
    identity,
  );
}

export async function updateBusinessCalendar(
  workspaceId: string,
  calendarId: string,
  input: Partial<{
    name: string;
    timezone: string;
    isDefault: boolean;
    isActive: boolean;
    workingHours: WorkingHoursInput[];
    holidays: HolidayInput[];
  }>,
): Promise<ServiceResult<BusinessCalendarRecord>> {
  return toServiceResult(
    await patch<BusinessCalendarRecord>(
      ws(workspaceId, `/business-calendars/${calendarId}`),
      input,
    ),
    identity,
  );
}

export async function listSlaPolicies(
  workspaceId: string,
): Promise<ServiceResult<SlaPolicyRecord[]>> {
  return toServiceResult(
    await get<SlaPolicyRecord[]>(ws(workspaceId, "/sla-policies")),
    identity,
  );
}

export async function createSlaPolicy(
  workspaceId: string,
  input: {
    name: string;
    targetDurationMinutes: number;
    warningBeforeMinutes: number;
    businessCalendarId?: string | null;
    applicableConditions?: SlaPolicyRecord["applicableConditions"];
    isActive?: boolean;
  },
): Promise<ServiceResult<SlaPolicyRecord>> {
  return toServiceResult(
    await post<SlaPolicyRecord>(ws(workspaceId, "/sla-policies"), input),
    identity,
  );
}

export async function updateSlaPolicy(
  workspaceId: string,
  policyId: string,
  input: Partial<{
    name: string;
    targetDurationMinutes: number;
    warningBeforeMinutes: number;
    businessCalendarId: string | null;
    applicableConditions: SlaPolicyRecord["applicableConditions"];
    isActive: boolean;
  }>,
): Promise<ServiceResult<SlaPolicyRecord>> {
  return toServiceResult(
    await patch<SlaPolicyRecord>(
      ws(workspaceId, `/sla-policies/${policyId}`),
      input,
    ),
    identity,
  );
}

export async function listTaskSla(
  workspaceId: string,
  taskId: string,
): Promise<ServiceResult<TaskSlaInstanceRecord[]>> {
  return toServiceResult(
    await get<TaskSlaInstanceRecord[]>(
      taskPath(workspaceId, taskId, "/sla"),
    ),
    identity,
  );
}

export async function pauseSlaInstance(
  workspaceId: string,
  _taskId: string,
  instanceId: string,
): Promise<ServiceResult<TaskSlaInstanceRecord>> {
  return toServiceResult(
    await post<TaskSlaInstanceRecord>(
      ws(workspaceId, `/sla-instances/${instanceId}/pause`),
      {},
    ),
    identity,
  );
}

export async function resumeSlaInstance(
  workspaceId: string,
  _taskId: string,
  instanceId: string,
): Promise<ServiceResult<TaskSlaInstanceRecord>> {
  return toServiceResult(
    await post<TaskSlaInstanceRecord>(
      ws(workspaceId, `/sla-instances/${instanceId}/resume`),
      {},
    ),
    identity,
  );
}

export async function listAutomationRuns(
  workspaceId: string,
  query?: { taskId?: string; page?: number; pageSize?: number },
): Promise<ServiceResult<{ items: AutomationRunRecord[]; total: number }>> {
  return toServiceResult(
    await get<{ items: AutomationRunRecord[]; total: number }>(
      `${ws(workspaceId, "/automation-runs")}${buildQueryString(query ?? {})}`,
    ),
    identity,
  );
}

export async function retryAutomationRun(
  workspaceId: string,
  runId: string,
): Promise<ServiceResult<AutomationRunRecord>> {
  return toServiceResult(
    await post<AutomationRunRecord>(
      ws(workspaceId, `/automation-runs/${runId}/retry`),
      {},
    ),
    identity,
  );
}
