import { del, get, patch, post } from "@/lib/api/client";
import { buildQueryString } from "@/lib/api/query";
import {
  MAPPING_ERROR,
  toServiceResult,
  type ServiceResult,
} from "@/lib/api/service";
import {
  mapDeleteTaskResult,
  mapParseResult,
  mapProject,
  mapProjectList,
  mapTask,
  mapTaskList,
} from "./tasks.helpers";
import type {
  CreateProjectInput,
  CreateTaskInput,
  DeleteTaskResult,
  ParseTaskInput,
  ParseTaskResult,
  ProjectRecord,
  TaskListFilters,
  TaskListResult,
  TaskRecord,
  UpdateTaskInput,
} from "./tasks.types";

function requireMapped<T>(result: ServiceResult<T | null>): ServiceResult<T> {
  if (result.ok && result.data === null) {
    return MAPPING_ERROR;
  }

  return result as ServiceResult<T>;
}

// ---------------------------------------------------------------------------
// Tasks (all routes are workspace-scoped: /workspaces/:workspaceId/tasks)
// ---------------------------------------------------------------------------

export async function listTasks(
  workspaceId: string,
  filters: TaskListFilters = {},
): Promise<ServiceResult<TaskListResult>> {
  const params = {
    status: filters.status,
    projectId: filters.projectId,
    assigneeId: filters.assigneeId,
    search: filters.search,
    due: filters.due,
    timezone: filters.timezone,
    page: filters.page,
    pageSize: filters.pageSize,
  };

  const envelope = await get<unknown>(
    `/workspaces/${workspaceId}/tasks${buildQueryString(params)}`,
  );

  return toServiceResult(envelope, (data, meta) => mapTaskList(data, meta));
}

export async function getTask(
  workspaceId: string,
  taskId: string,
): Promise<ServiceResult<TaskRecord>> {
  const envelope = await get<unknown>(
    `/workspaces/${workspaceId}/tasks/${taskId}`,
  );

  return requireMapped(toServiceResult(envelope, (data) => mapTask(data)));
}

export async function createTask(
  workspaceId: string,
  input: CreateTaskInput,
): Promise<ServiceResult<TaskRecord>> {
  const envelope = await post<unknown>(
    `/workspaces/${workspaceId}/tasks`,
    input,
  );

  return requireMapped(toServiceResult(envelope, (data) => mapTask(data)));
}

export async function updateTask(
  workspaceId: string,
  taskId: string,
  input: UpdateTaskInput,
): Promise<ServiceResult<TaskRecord>> {
  const envelope = await patch<unknown>(
    `/workspaces/${workspaceId}/tasks/${taskId}`,
    input,
  );

  return requireMapped(toServiceResult(envelope, (data) => mapTask(data)));
}

export async function deleteTask(
  workspaceId: string,
  taskId: string,
): Promise<ServiceResult<DeleteTaskResult>> {
  const envelope = await del<unknown>(
    `/workspaces/${workspaceId}/tasks/${taskId}`,
  );

  return toServiceResult(envelope, (data) =>
    mapDeleteTaskResult(data, taskId),
  );
}

export async function parseTask(
  workspaceId: string,
  input: ParseTaskInput,
): Promise<ServiceResult<ParseTaskResult>> {
  const envelope = await post<unknown>(
    `/workspaces/${workspaceId}/tasks/parse`,
    input,
  );

  return requireMapped(
    toServiceResult(envelope, (data) => mapParseResult(data)),
  );
}

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------

export async function listProjects(
  workspaceId: string,
): Promise<ServiceResult<ProjectRecord[]>> {
  const envelope = await get<unknown>(`/workspaces/${workspaceId}/projects`);
  return toServiceResult(envelope, (data) => mapProjectList(data));
}

export async function createProject(
  workspaceId: string,
  input: CreateProjectInput,
): Promise<ServiceResult<ProjectRecord>> {
  const envelope = await post<unknown>(
    `/workspaces/${workspaceId}/projects`,
    input,
  );

  return requireMapped(toServiceResult(envelope, (data) => mapProject(data)));
}
