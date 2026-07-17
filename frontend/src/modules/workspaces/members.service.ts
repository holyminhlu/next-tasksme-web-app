import { del, get, patch } from "@/lib/api/client";
import type { WorkspaceMemberSummary } from "@/modules/auth";

export async function listMembers(workspaceId: string) {
  return get<WorkspaceMemberSummary[]>(`/workspaces/${workspaceId}/members`);
}

export async function updateMemberRole(
  workspaceId: string,
  memberId: string,
  roleKey: string,
) {
  return patch<WorkspaceMemberSummary>(
    `/workspaces/${workspaceId}/members/${memberId}`,
    { roleKey },
  );
}

export async function removeMember(workspaceId: string, memberId: string) {
  return del<{ removed: boolean }>(
    `/workspaces/${workspaceId}/members/${memberId}`,
  );
}
