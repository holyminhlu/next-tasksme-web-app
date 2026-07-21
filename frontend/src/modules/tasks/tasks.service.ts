import { projectsService as projectsModule } from "@/modules/projects";
import { del, downloadBlob, get, patch, post, postBlob, put } from "@/lib/api/client";
import { buildQueryString } from "@/lib/api/query";
import {
  MAPPING_ERROR,
  toServiceResult,
  type ServiceResult,
} from "@/lib/api/service";
import type {
  AssigneeMutationInput,
  BulkDeleteInput,
  BulkMutationResult,
  BulkUpdateInput,
  CalendarTasksResult,
  CandidateOption,
  CreateProjectInput,
  CreateSavedViewInput,
  CreateTaskInput,
  DeleteTaskResult,
  ExportFileResult,
  ExportTasksInput,
  MoveTaskInput,
  ParseTaskInput,
  ParseTaskResult,
  ProjectMemberSummary,
  ProjectRecord,
  SavedViewRecord,
  StatusMutationInput,
  TaskActivityResult,
  TaskListFilters,
  TaskListResult,
  TaskRecord,
  TaskStatus,
  TimelineGroupBy,
  TimelineTasksResult,
  UpdateProjectInput,
  UpdateSavedViewInput,
  UpdateTaskInput,
  VersionMutationInput,
} from "./tasks.types";
import {
  mapBulkMutationResult,
  mapCalendarTasksResult,
  mapCandidates,
  mapDeleteTaskResult,
  mapParseResult,
  mapProject,
  mapProjectList,
  mapProjectMemberList,
  mapSavedView,
  mapSavedViewList,
  mapTask,
  mapTaskActivityList,
  mapTaskList,
  mapTimelineTasksResult,
} from "./tasks.helpers";

function requireMapped<T>(result: ServiceResult<T | null>): ServiceResult<T> {
  if (result.ok && result.data === null) {
    return MAPPING_ERROR;
  }

  return result as ServiceResult<T>;
}

function asListParam<T extends string>(
  value: T | T[] | null | undefined,
): T | T[] | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }

  return value;
}

/** Query params for listTasks — aligns with Phase 5 list contract. */
export function buildTaskListQueryParams(
  filters: TaskListFilters,
): Record<string, string | number | boolean | string[] | null | undefined> {
  return {
    search: filters.search,
    projectId: asListParam(
      filters.projectId as string | string[] | null | undefined,
    ),
    status: asListParam(filters.status),
    priority: asListParam(filters.priority),
    assigneeId: filters.assigneeId,
    createdById: filters.createdById,
    due: filters.due,
    deadlineFrom: filters.deadlineFrom,
    deadlineTo: filters.deadlineTo,
    overdue: filters.overdue || undefined,
    unassigned: filters.unassigned || undefined,
    includeArchived: filters.includeArchived || undefined,
    includeDeleted: filters.includeDeleted || undefined,
    tagIds: asListParam(filters.tagIds),
    timezone: filters.timezone,
    page: filters.page,
    pageSize: filters.pageSize,
    sortBy: filters.sortBy,
    sortOrder: filters.sortOrder,
  };
}

// ---------------------------------------------------------------------------
// Tasks (all routes are workspace-scoped: /workspaces/:workspaceId/tasks)
// ---------------------------------------------------------------------------

export async function listTasks(
  workspaceId: string,
  filters: TaskListFilters = {},
): Promise<ServiceResult<TaskListResult>> {
  const envelope = await get<unknown>(
    `/workspaces/${workspaceId}/tasks${buildQueryString(buildTaskListQueryParams(filters))}`,
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

export async function updateTaskStatus(
  workspaceId: string,
  taskId: string,
  input: StatusMutationInput,
): Promise<ServiceResult<TaskRecord>> {
  const envelope = await patch<unknown>(
    `/workspaces/${workspaceId}/tasks/${taskId}/status`,
    input,
  );

  return requireMapped(toServiceResult(envelope, (data) => mapTask(data)));
}

export async function updateTaskAssignee(
  workspaceId: string,
  taskId: string,
  input: AssigneeMutationInput,
): Promise<ServiceResult<TaskRecord>> {
  const envelope = await patch<unknown>(
    `/workspaces/${workspaceId}/tasks/${taskId}/assignee`,
    input,
  );

  return requireMapped(toServiceResult(envelope, (data) => mapTask(data)));
}

export async function archiveTask(
  workspaceId: string,
  taskId: string,
  input: VersionMutationInput,
): Promise<ServiceResult<TaskRecord>> {
  const envelope = await post<unknown>(
    `/workspaces/${workspaceId}/tasks/${taskId}/archive`,
    input,
  );

  return requireMapped(toServiceResult(envelope, (data) => mapTask(data)));
}

export async function unarchiveTask(
  workspaceId: string,
  taskId: string,
  input: VersionMutationInput,
): Promise<ServiceResult<TaskRecord>> {
  const envelope = await post<unknown>(
    `/workspaces/${workspaceId}/tasks/${taskId}/unarchive`,
    input,
  );

  return requireMapped(toServiceResult(envelope, (data) => mapTask(data)));
}

export async function restoreTask(
  workspaceId: string,
  taskId: string,
  input: VersionMutationInput,
): Promise<ServiceResult<TaskRecord>> {
  const envelope = await post<unknown>(
    `/workspaces/${workspaceId}/tasks/${taskId}/restore`,
    input,
  );

  return requireMapped(toServiceResult(envelope, (data) => mapTask(data)));
}

export async function deleteTask(
  workspaceId: string,
  taskId: string,
  version?: number,
): Promise<ServiceResult<DeleteTaskResult>> {
  const query = version != null ? buildQueryString({ version }) : "";
  const envelope = await del<unknown>(
    `/workspaces/${workspaceId}/tasks/${taskId}${query}`,
  );

  return toServiceResult(envelope, (data) =>
    mapDeleteTaskResult(data, taskId),
  );
}

export async function getTaskActivity(
  workspaceId: string,
  taskId: string,
  options: { page?: number; pageSize?: number } = {},
): Promise<ServiceResult<TaskActivityResult>> {
  const envelope = await get<unknown>(
    `/workspaces/${workspaceId}/tasks/${taskId}/activity${buildQueryString({
      page: options.page,
      pageSize: options.pageSize,
    })}`,
  );

  return toServiceResult(envelope, (data, meta) =>
    mapTaskActivityList(data, meta),
  );
}

export async function bulkUpdateTasks(
  workspaceId: string,
  input: BulkUpdateInput,
): Promise<ServiceResult<BulkMutationResult>> {
  const envelope = await post<unknown>(
    `/workspaces/${workspaceId}/tasks/bulk-update`,
    input,
  );

  return toServiceResult(envelope, (data) => mapBulkMutationResult(data));
}

export async function bulkDeleteTasks(
  workspaceId: string,
  input: BulkDeleteInput,
): Promise<ServiceResult<BulkMutationResult>> {
  const envelope = await post<unknown>(
    `/workspaces/${workspaceId}/tasks/bulk-delete`,
    input,
  );

  return toServiceResult(envelope, (data) => mapBulkMutationResult(data));
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
// Phase 6 — board / calendar / timeline / move / export
// ---------------------------------------------------------------------------

/** Board column filters: either a legacy status or a Phase 8.2 workflow stage id. */
export type BoardColumnFilters = Omit<TaskListFilters, "status"> & {
  status?: TaskStatus | null;
  workflowStageId?: string | null;
};

export async function listBoardColumn(
  workspaceId: string,
  filters: BoardColumnFilters,
): Promise<ServiceResult<TaskListResult>> {
  const envelope = await get<unknown>(
    `/workspaces/${workspaceId}/tasks/board${buildQueryString({
      ...buildTaskListQueryParams(filters),
      status: filters.status,
      workflowStageId: filters.workflowStageId,
      sortBy: filters.sortBy ?? "rank",
      sortOrder: filters.sortOrder ?? "asc",
    })}`,
  );

  return toServiceResult(envelope, (data, meta) => mapTaskList(data, meta));
}

export async function listCalendar(
  workspaceId: string,
  filters: TaskListFilters & {
    from: string;
    to: string;
    timezone?: string | null;
  },
): Promise<ServiceResult<CalendarTasksResult>> {
  const envelope = await get<unknown>(
    `/workspaces/${workspaceId}/tasks/calendar${buildQueryString({
      ...buildTaskListQueryParams(filters),
      from: filters.from,
      to: filters.to,
      timezone: filters.timezone,
      page: filters.page,
      pageSize: filters.pageSize,
    })}`,
  );

  return toServiceResult(envelope, (data, meta) =>
    mapCalendarTasksResult(data, meta),
  );
}

export async function listTimeline(
  workspaceId: string,
  filters: TaskListFilters & {
    from: string;
    to: string;
    groupBy?: TimelineGroupBy;
    timezone?: string | null;
  },
): Promise<ServiceResult<TimelineTasksResult>> {
  const envelope = await get<unknown>(
    `/workspaces/${workspaceId}/tasks/timeline${buildQueryString({
      ...buildTaskListQueryParams(filters),
      from: filters.from,
      to: filters.to,
      groupBy: filters.groupBy ?? "project",
      timezone: filters.timezone,
      page: filters.page,
      pageSize: filters.pageSize,
    })}`,
  );

  return toServiceResult(envelope, (data, meta) =>
    mapTimelineTasksResult(data, meta),
  );
}

export async function moveTask(
  workspaceId: string,
  taskId: string,
  input: MoveTaskInput,
): Promise<ServiceResult<TaskRecord>> {
  const envelope = await patch<unknown>(
    `/workspaces/${workspaceId}/tasks/${taskId}/move`,
    input,
  );

  return requireMapped(toServiceResult(envelope, (data) => mapTask(data)));
}

export async function exportTasks(
  workspaceId: string,
  input: ExportTasksInput,
): Promise<ServiceResult<ExportFileResult>> {
  const result = await postBlob(
    `/workspaces/${workspaceId}/tasks/export`,
    input,
  );

  if (!result.ok) {
    return {
      ok: false,
      code: result.code,
      message: result.message,
    };
  }

  const rowHeader = result.headers.get("X-Export-Row-Count");
  const rowCount = rowHeader ? Number(rowHeader) : null;

  return {
    ok: true,
    data: {
      blob: result.blob,
      filename:
        result.filename ??
        `tasks-export.${input.format === "xlsx" ? "xlsx" : "csv"}`,
      contentType: result.contentType ?? result.blob.type,
      rowCount: Number.isFinite(rowCount) ? rowCount : null,
    },
  };
}

/** Convenience: export and trigger a browser download. */
export async function downloadExportedTasks(
  workspaceId: string,
  input: ExportTasksInput,
): Promise<ServiceResult<ExportFileResult>> {
  const result = await exportTasks(workspaceId, input);
  if (result.ok) {
    downloadBlob(result.data.blob, result.data.filename);
  }
  return result;
}

// ---------------------------------------------------------------------------
// Saved views
// ---------------------------------------------------------------------------

export async function listSavedViews(
  workspaceId: string,
): Promise<ServiceResult<SavedViewRecord[]>> {
  const envelope = await get<unknown>(
    `/workspaces/${workspaceId}/saved-views`,
  );
  return toServiceResult(envelope, (data) => mapSavedViewList(data));
}

export async function getSavedView(
  workspaceId: string,
  viewId: string,
): Promise<ServiceResult<SavedViewRecord>> {
  const envelope = await get<unknown>(
    `/workspaces/${workspaceId}/saved-views/${viewId}`,
  );
  return requireMapped(
    toServiceResult(envelope, (data) => mapSavedView(data)),
  );
}

export async function createSavedView(
  workspaceId: string,
  input: CreateSavedViewInput,
): Promise<ServiceResult<SavedViewRecord>> {
  const envelope = await post<unknown>(
    `/workspaces/${workspaceId}/saved-views`,
    input,
  );
  return requireMapped(
    toServiceResult(envelope, (data) => mapSavedView(data)),
  );
}

export async function updateSavedView(
  workspaceId: string,
  viewId: string,
  input: UpdateSavedViewInput,
): Promise<ServiceResult<SavedViewRecord>> {
  const envelope = await patch<unknown>(
    `/workspaces/${workspaceId}/saved-views/${viewId}`,
    input,
  );
  return requireMapped(
    toServiceResult(envelope, (data) => mapSavedView(data)),
  );
}

export async function deleteSavedView(
  workspaceId: string,
  viewId: string,
): Promise<ServiceResult<{ id: string; deleted: boolean }>> {
  const envelope = await del<{ id: string; deleted: boolean }>(
    `/workspaces/${workspaceId}/saved-views/${viewId}`,
  );
  return toServiceResult(envelope, (data) => ({
    id: data?.id ?? viewId,
    deleted: data?.deleted ?? true,
  }));
}

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------

export async function listProjects(
  workspaceId: string,
): Promise<ServiceResult<ProjectRecord[]>> {
  const result = await projectsModule.listProjects(workspaceId, { pageSize: 100 });
  if (!result.ok) return result;
  return {
    ok: true,
    data: mapProjectList(result.data.items),
    meta: result.meta,
  };
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

export async function listProjectMembers(
  workspaceId: string,
  projectId: string,
): Promise<ServiceResult<ProjectMemberSummary[]>> {
  const envelope = await get<unknown>(
    `/workspaces/${workspaceId}/projects/${projectId}/members`,
  );

  return toServiceResult(envelope, (data) => mapProjectMemberList(data));
}

export async function listEligibleAssignees(
  workspaceId: string,
  projectId: string,
  search?: string,
): Promise<ServiceResult<CandidateOption[]>> {
  const envelope = await get<unknown>(
    `/workspaces/${workspaceId}/projects/${projectId}/eligible-assignees${buildQueryString(
      { search: search?.trim() || undefined },
    )}`,
  );

  return toServiceResult(envelope, (data) => mapCandidates(data));
}

/**
 * Updates project visibility and/or membership using the Phase 5 endpoints:
 * PUT .../members and PATCH .../visibility.
 */
export async function updateProject(
  workspaceId: string,
  projectId: string,
  input: UpdateProjectInput,
): Promise<ServiceResult<ProjectRecord>> {
  let latest: ProjectRecord | null = null;

  if (input.visibility !== undefined) {
    const visibilityEnvelope = await patch<unknown>(
      `/workspaces/${workspaceId}/projects/${projectId}/visibility`,
      { visibility: input.visibility },
    );

    if (!visibilityEnvelope.success) {
      return {
        ok: false,
        code: visibilityEnvelope.error.code,
        message: visibilityEnvelope.error.message,
      };
    }

    latest = mapProject(visibilityEnvelope.data);
    if (!latest) {
      return MAPPING_ERROR;
    }
  }

  if (input.memberIds !== undefined) {
    const membersEnvelope = await put<unknown>(
      `/workspaces/${workspaceId}/projects/${projectId}/members`,
      { memberIds: input.memberIds },
    );

    if (!membersEnvelope.success) {
      return {
        ok: false,
        code: membersEnvelope.error.code,
        message: membersEnvelope.error.message,
      };
    }

    latest = mapProject(membersEnvelope.data);
    if (!latest) {
      return MAPPING_ERROR;
    }
  }

  if (!latest) {
    return {
      ok: false,
      code: "VALIDATION_ERROR",
      message: "No project changes were provided.",
    };
  }

  return { ok: true, data: latest };
}
