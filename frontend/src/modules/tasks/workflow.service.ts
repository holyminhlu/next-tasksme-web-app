import { del, get, patch, post } from "@/lib/api/client";
import { buildQueryString } from "@/lib/api/query";
import { toServiceResult, type ServiceResult } from "@/lib/api/service";
import type {
  DependencySummary,
  TaskStatusHistorySummary,
  TimeLogRecord,
  TimeLogSummary,
} from "./workflow.types";

function identity<T>(value: T) {
  return value;
}

function taskPath(workspaceId: string, taskId: string, suffix: string) {
  return `/workspaces/${workspaceId}/tasks/${taskId}${suffix}`;
}

export async function listDependencies(
  workspaceId: string,
  taskId: string,
): Promise<ServiceResult<DependencySummary>> {
  return toServiceResult(
    await get<DependencySummary>(
      taskPath(workspaceId, taskId, "/dependencies"),
    ),
    identity,
  );
}

export async function createDependency(
  workspaceId: string,
  taskId: string,
  input: {
    relatedTaskId: string;
    direction: "WAITING_ON" | "BLOCKING";
  },
): Promise<ServiceResult<DependencySummary>> {
  return toServiceResult(
    await post<DependencySummary>(
      taskPath(workspaceId, taskId, "/dependencies"),
      input,
    ),
    identity,
  );
}

export async function deleteDependency(
  workspaceId: string,
  taskId: string,
  dependencyId: string,
): Promise<ServiceResult<DependencySummary>> {
  return toServiceResult(
    await del<DependencySummary>(
      taskPath(
        workspaceId,
        taskId,
        `/dependencies/${dependencyId}`,
      ),
    ),
    identity,
  );
}

export async function listTimeLogs(
  workspaceId: string,
  taskId: string,
  scope: "mine" | "team",
): Promise<ServiceResult<TimeLogSummary>> {
  return toServiceResult(
    await get<TimeLogSummary>(
      `${taskPath(workspaceId, taskId, "/time-logs")}${buildQueryString({
        scope,
      })}`,
    ),
    identity,
  );
}

export async function getRunningTimer(
  workspaceId: string,
): Promise<ServiceResult<TimeLogRecord | null>> {
  return toServiceResult(
    await get<TimeLogRecord | null>(
      `/workspaces/${workspaceId}/timers/running`,
    ),
    identity,
  );
}

export async function startTimer(
  workspaceId: string,
  taskId: string,
  description?: string,
): Promise<ServiceResult<TimeLogRecord>> {
  return toServiceResult(
    await post<TimeLogRecord>(
      taskPath(workspaceId, taskId, "/time-logs/timer/start"),
      { description: description || null },
    ),
    identity,
  );
}

export async function stopTimer(
  workspaceId: string,
  taskId: string,
): Promise<ServiceResult<TimeLogRecord>> {
  return toServiceResult(
    await post<TimeLogRecord>(
      taskPath(workspaceId, taskId, "/time-logs/timer/stop"),
      {},
    ),
    identity,
  );
}

export async function createManualTimeLog(
  workspaceId: string,
  taskId: string,
  input: {
    startedAt: string;
    endedAt: string;
    description?: string | null;
  },
): Promise<ServiceResult<TimeLogRecord>> {
  return toServiceResult(
    await post<TimeLogRecord>(
      taskPath(workspaceId, taskId, "/time-logs"),
      input,
    ),
    identity,
  );
}

export async function updateTimeLog(
  workspaceId: string,
  taskId: string,
  timeLogId: string,
  input: {
    startedAt?: string;
    endedAt?: string;
    description?: string | null;
  },
): Promise<ServiceResult<TimeLogRecord>> {
  return toServiceResult(
    await patch<TimeLogRecord>(
      taskPath(workspaceId, taskId, `/time-logs/${timeLogId}`),
      input,
    ),
    identity,
  );
}

export async function deleteTimeLog(
  workspaceId: string,
  taskId: string,
  timeLogId: string,
): Promise<ServiceResult<{ id: string }>> {
  return toServiceResult(
    await del<{ id: string }>(
      taskPath(workspaceId, taskId, `/time-logs/${timeLogId}`),
    ),
    identity,
  );
}

export async function listStatusHistory(
  workspaceId: string,
  taskId: string,
): Promise<ServiceResult<TaskStatusHistorySummary>> {
  return toServiceResult(
    await get<TaskStatusHistorySummary>(
      taskPath(workspaceId, taskId, "/status-history"),
    ),
    identity,
  );
}
