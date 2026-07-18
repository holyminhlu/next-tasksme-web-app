import { get } from "@/lib/api/client";
import { buildQueryString, type QueryParams } from "@/lib/api/query";
import {
  toServiceResult,
  withRouteFallback,
  type ServiceResult,
} from "@/lib/api/service";
import { mapTaskList } from "@/modules/tasks";
import {
  dashboardQueryParams,
  mapActivityList,
  mapCharts,
  mapSummary,
} from "./dashboard.helpers";
import type {
  ActivityListResult,
  DashboardCharts,
  DashboardFilters,
  DashboardSummary,
  MyWorkResult,
  MyWorkTab,
} from "./dashboard.types";

/**
 * The summary contract is workspace-scoped while the sibling dashboard
 * routes are written unscoped; requests try the workspace-scoped mount first
 * and fall back to the top-level one with a workspaceId param.
 */
function getDashboard<T>(
  workspaceId: string,
  resource: string,
  params: QueryParams,
) {
  return withRouteFallback<T>(
    () =>
      get(
        `/workspaces/${workspaceId}/dashboard/${resource}${buildQueryString(params)}`,
      ),
    () =>
      get(
        `/dashboard/${resource}${buildQueryString({ ...params, workspaceId })}`,
      ),
  );
}

export async function getSummary(
  workspaceId: string,
  filters: DashboardFilters,
  timezone: string,
): Promise<ServiceResult<DashboardSummary>> {
  const envelope = await getDashboard<unknown>(
    workspaceId,
    "summary",
    dashboardQueryParams(filters, timezone),
  );

  return toServiceResult(envelope, (data, meta) => mapSummary(data, meta));
}

export async function getMyWork(
  workspaceId: string,
  tab: MyWorkTab,
  filters: DashboardFilters,
  timezone: string,
  limit = 8,
): Promise<ServiceResult<MyWorkResult>> {
  const envelope = await getDashboard<unknown>(workspaceId, "my-work", {
    ...dashboardQueryParams(filters, timezone),
    tab,
    limit,
  });

  return toServiceResult(envelope, (data, meta) => mapTaskList(data, meta));
}

export async function getCharts(
  workspaceId: string,
  filters: DashboardFilters,
  timezone: string,
): Promise<ServiceResult<DashboardCharts>> {
  const envelope = await getDashboard<unknown>(
    workspaceId,
    "charts",
    dashboardQueryParams(filters, timezone),
  );

  return toServiceResult(envelope, (data) => mapCharts(data));
}

export async function getActivity(
  workspaceId: string,
  filters: DashboardFilters,
  options: { limit?: number; page?: number } = {},
): Promise<ServiceResult<ActivityListResult>> {
  const envelope = await getDashboard<unknown>(workspaceId, "activity", {
    projectId: filters.projectId,
    limit: options.limit ?? 10,
    page: options.page ?? 1,
  });

  return toServiceResult(envelope, (data, meta) => mapActivityList(data, meta));
}
