import { get, patch, post } from "@/lib/api/client";
import { buildQueryString } from "@/lib/api/query";
import { MAPPING_ERROR, toServiceResult, type ServiceResult } from "@/lib/api/service";
import { mapCloneJob, mapTemplate, mapTemplateList } from "./templates.helpers";
import type {
  CloneJobRecord,
  CloneTemplateInput,
  TemplateContentV2,
  TemplateListFilters,
  TemplateListResult,
  TemplateRecord,
  TemplateValidation,
  TemplateVisibility,
} from "./templates.types";

function requireMapped<T>(result: ServiceResult<T | null>): ServiceResult<T> {
  if (result.ok && result.data === null) return MAPPING_ERROR;
  return result as ServiceResult<T>;
}

function ws(workspaceId: string, suffix = "") {
  return `/workspaces/${workspaceId}/templates${suffix}`;
}

export async function listTemplates(
  workspaceId: string,
  filters: TemplateListFilters = {},
): Promise<ServiceResult<TemplateListResult>> {
  return requireMapped(
    toServiceResult(
      await get<unknown>(
        `${ws(workspaceId)}${buildQueryString({
          search: filters.search,
          status: filters.status,
          visibility: filters.visibility,
          page: filters.page,
          pageSize: filters.pageSize,
        })}`,
      ),
      mapTemplateList,
    ),
  );
}

export async function getTemplate(
  workspaceId: string,
  templateId: string,
): Promise<ServiceResult<TemplateRecord>> {
  return requireMapped(
    toServiceResult(await get<unknown>(ws(workspaceId, `/${templateId}`)), mapTemplate),
  );
}

export async function createTemplate(
  workspaceId: string,
  input: {
    name: string;
    description?: string;
    industryCode?: string;
    visibility?: TemplateVisibility;
    contentJson?: TemplateContentV2;
  },
): Promise<ServiceResult<TemplateRecord>> {
  return requireMapped(
    toServiceResult(await post<unknown>(ws(workspaceId), input), mapTemplate),
  );
}

export async function publishTemplate(
  workspaceId: string,
  templateId: string,
): Promise<ServiceResult<TemplateRecord>> {
  return requireMapped(
    toServiceResult(
      await post<unknown>(ws(workspaceId, `/${templateId}/publish`), {}),
      mapTemplate,
    ),
  );
}

export async function archiveTemplate(workspaceId: string, templateId: string) {
  return requireMapped(toServiceResult(
    await post<unknown>(ws(workspaceId, `/${templateId}/archive`), {}),
    mapTemplate,
  ));
}

export async function validateTemplate(
  workspaceId: string,
  templateId: string,
): Promise<ServiceResult<TemplateValidation>> {
  return requireMapped(toServiceResult(
    await post<unknown>(ws(workspaceId, `/${templateId}/validate`), {}),
    (data) => {
      const item = data as Partial<TemplateValidation> | null;
      return item?.valid === true && typeof item.contentHash === "string"
        ? { valid: true, schemaVersion: Number(item.schemaVersion), contentHash: item.contentHash }
        : null;
    },
  ));
}

export async function createTemplateVersion(workspaceId: string, templateId: string) {
  return requireMapped(toServiceResult(
    await post<unknown>(ws(workspaceId, `/${templateId}/versions`), {}),
    mapTemplate,
  ));
}

export async function listTemplateVersions(
  workspaceId: string,
  templateId: string,
): Promise<ServiceResult<TemplateRecord[]>> {
  return requireMapped(toServiceResult(
    await get<unknown>(ws(workspaceId, `/${templateId}/versions`)),
    (data) => {
      if (!Array.isArray(data)) return null;
      const mapped = data.map(mapTemplate);
      return mapped.some((item) => item === null) ? null : mapped as TemplateRecord[];
    },
  ));
}

export async function cloneTemplate(
  workspaceId: string,
  templateId: string,
  input: CloneTemplateInput,
): Promise<ServiceResult<{ mode: string; cloneJobId: string; projectId: string | null }>> {
  return requireMapped(
    toServiceResult(
      await post<unknown>(ws(workspaceId, `/${templateId}/clone`), input),
      (data) =>
        data && typeof data === "object" && typeof (data as Record<string, unknown>).cloneJobId === "string"
          ? {
              mode: String((data as Record<string, unknown>).mode ?? ""),
              cloneJobId: String((data as Record<string, unknown>).cloneJobId ?? ""),
              projectId:
                typeof (data as Record<string, unknown>).projectId === "string"
                  ? ((data as Record<string, unknown>).projectId as string)
                  : null,
            }
          : null,
    ),
  );
}

export async function getCloneJob(
  workspaceId: string,
  cloneJobId: string,
): Promise<ServiceResult<CloneJobRecord>> {
  return requireMapped(
    toServiceResult(
      await get<unknown>(ws(workspaceId, `/clone-jobs/${cloneJobId}`)),
      mapCloneJob,
    ),
  );
}

export async function retryCloneJob(
  workspaceId: string,
  cloneJobId: string,
): Promise<ServiceResult<CloneJobRecord>> {
  return requireMapped(toServiceResult(
    await post<unknown>(ws(workspaceId, `/clone-jobs/${cloneJobId}/retry`), {}),
    mapCloneJob,
  ));
}

export async function duplicateTemplate(
  workspaceId: string,
  templateId: string,
): Promise<ServiceResult<TemplateRecord>> {
  return requireMapped(
    toServiceResult(
      await post<unknown>(ws(workspaceId, `/${templateId}/duplicate`), {}),
      mapTemplate,
    ),
  );
}

export async function updateTemplate(
  workspaceId: string,
  templateId: string,
  input: {
    name?: string;
    description?: string | null;
    industryCode?: string | null;
    contentJson?: TemplateContentV2;
  },
): Promise<ServiceResult<TemplateRecord>> {
  return requireMapped(
    toServiceResult(
      await patch<unknown>(ws(workspaceId, `/${templateId}`), input),
      mapTemplate,
    ),
  );
}
