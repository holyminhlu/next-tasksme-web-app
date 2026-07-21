import { del, get, patch, post, put } from "@/lib/api/client";
import { buildQueryString } from "@/lib/api/query";
import {
  MAPPING_ERROR,
  toServiceResult,
  type ServiceResult,
} from "@/lib/api/service";
import { mapProject, mapProjectList } from "./projects.helpers";
import type {
  CreateProjectInput,
  ProjectListFilters,
  ProjectListResult,
  ProjectMemberRecord,
  ProjectRecord,
  UpdateProjectInput,
} from "./projects.types";

function requireMapped<T>(result: ServiceResult<T | null>): ServiceResult<T> {
  if (result.ok && result.data === null) return MAPPING_ERROR;
  return result as ServiceResult<T>;
}

function ws(workspaceId: string, suffix = "") {
  return `/workspaces/${workspaceId}/projects${suffix}`;
}

export async function listProjects(
  workspaceId: string,
  filters: ProjectListFilters = {},
): Promise<ServiceResult<ProjectListResult>> {
  const envelope = await get<unknown>(
    `${ws(workspaceId)}${buildQueryString({
      search: filters.search,
      status: filters.status,
      managerId: filters.managerId,
      memberId: filters.memberId,
      startFrom: filters.startFrom,
      startTo: filters.startTo,
      endFrom: filters.endFrom,
      endTo: filters.endTo,
      includeArchived: filters.includeArchived,
      archivedOnly: filters.archivedOnly,
      includeDeleted: filters.includeDeleted,
      deletedOnly: filters.deletedOnly,
      sortBy: filters.sortBy,
      sortOrder: filters.sortOrder,
      page: filters.page,
      pageSize: filters.pageSize,
    })}`,
  );
  return toServiceResult(envelope, (data, meta) => mapProjectList(data, meta));
}

export async function getProject(
  workspaceId: string,
  projectId: string,
): Promise<ServiceResult<ProjectRecord>> {
  return requireMapped(
    toServiceResult(await get<unknown>(ws(workspaceId, `/${projectId}`)), mapProject),
  );
}

export async function createProject(
  workspaceId: string,
  input: CreateProjectInput,
): Promise<ServiceResult<ProjectRecord>> {
  return requireMapped(
    toServiceResult(
      await post<unknown>(ws(workspaceId), input),
      mapProject,
    ),
  );
}

export async function updateProject(
  workspaceId: string,
  projectId: string,
  input: UpdateProjectInput,
): Promise<ServiceResult<ProjectRecord>> {
  return requireMapped(
    toServiceResult(
      await patch<unknown>(ws(workspaceId, `/${projectId}`), input),
      mapProject,
    ),
  );
}

export async function archiveProject(
  workspaceId: string,
  projectId: string,
): Promise<ServiceResult<ProjectRecord>> {
  return requireMapped(
    toServiceResult(
      await post<unknown>(ws(workspaceId, `/${projectId}/archive`), {}),
      mapProject,
    ),
  );
}

export async function unarchiveProject(
  workspaceId: string,
  projectId: string,
): Promise<ServiceResult<ProjectRecord>> {
  return requireMapped(
    toServiceResult(
      await post<unknown>(ws(workspaceId, `/${projectId}/unarchive`), {}),
      mapProject,
    ),
  );
}

export async function deleteProject(
  workspaceId: string,
  projectId: string,
): Promise<ServiceResult<ProjectRecord>> {
  return requireMapped(
    toServiceResult(await del<unknown>(ws(workspaceId, `/${projectId}`)), mapProject),
  );
}

export async function restoreProject(
  workspaceId: string,
  projectId: string,
): Promise<ServiceResult<ProjectRecord>> {
  return requireMapped(
    toServiceResult(
      await post<unknown>(ws(workspaceId, `/${projectId}/restore`), {}),
      mapProject,
    ),
  );
}

export async function listProjectMembers(
  workspaceId: string,
  projectId: string,
): Promise<ServiceResult<ProjectMemberRecord[]>> {
  const envelope = await get<unknown>(ws(workspaceId, `/${projectId}/members`));
  return toServiceResult(envelope, (data) => {
    if (!Array.isArray(data)) return [];
    return data
      .map((raw) => {
        const record = raw as Record<string, unknown>;
        const userId = String(record.userId ?? record.id ?? "");
        if (!userId) return null;
        return {
          userId,
          projectRole:
            (record.projectRole as ProjectMemberRecord["projectRole"]) ??
            "PROJECT_MEMBER",
          joinedAt: typeof record.joinedAt === "string" ? record.joinedAt : null,
          id: String(record.id ?? userId),
          fullName: typeof record.fullName === "string" ? record.fullName : null,
          email: typeof record.email === "string" ? record.email : null,
          roleKey: typeof record.role === "string" ? record.role : null,
          status: typeof record.status === "string" ? record.status : null,
        } satisfies ProjectMemberRecord;
      })
      .filter((item): item is ProjectMemberRecord => item !== null);
  });
}

export async function replaceProjectMembers(
  workspaceId: string,
  projectId: string,
  memberIds: string[],
): Promise<ServiceResult<ProjectRecord>> {
  return requireMapped(
    toServiceResult(
      await put<unknown>(ws(workspaceId, `/${projectId}/members`), { memberIds }),
      mapProject,
    ),
  );
}

export async function addProjectMember(
  workspaceId: string,
  projectId: string,
  input: { userId: string; projectRole?: ProjectMemberRecord["projectRole"] },
): Promise<ServiceResult<ProjectRecord>> {
  return requireMapped(
    toServiceResult(
      await post<unknown>(ws(workspaceId, `/${projectId}/members`), input),
      mapProject,
    ),
  );
}

export async function updateProjectMemberRole(
  workspaceId: string,
  projectId: string,
  memberUserId: string,
  projectRole: ProjectMemberRecord["projectRole"],
): Promise<ServiceResult<ProjectRecord>> {
  return requireMapped(
    toServiceResult(
      await patch<unknown>(ws(workspaceId, `/${projectId}/members/${memberUserId}`), {
        projectRole,
      }),
      mapProject,
    ),
  );
}

export async function removeProjectMember(
  workspaceId: string,
  projectId: string,
  memberUserId: string,
): Promise<ServiceResult<ProjectRecord>> {
  return requireMapped(
    toServiceResult(
      await del<unknown>(ws(workspaceId, `/${projectId}/members/${memberUserId}`)),
      mapProject,
    ),
  );
}

export async function updateProjectVisibility(
  workspaceId: string,
  projectId: string,
  visibility: "WORKSPACE" | "PRIVATE",
): Promise<ServiceResult<ProjectRecord>> {
  return requireMapped(
    toServiceResult(
      await patch<unknown>(ws(workspaceId, `/${projectId}/visibility`), {
        visibility,
      }),
      mapProject,
    ),
  );
}
