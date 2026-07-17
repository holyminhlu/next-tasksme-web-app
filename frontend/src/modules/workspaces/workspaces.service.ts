import { get, patch, post } from "@/lib/api/client";
import type {
  TransferOwnershipInput,
  TransferOwnershipResponse,
  UpdateWorkspaceInput,
  WorkspaceDetails,
} from "./workspaces.types";

export async function getWorkspace(workspaceId: string) {
  return get<WorkspaceDetails>(`/workspaces/${workspaceId}`);
}

export async function updateWorkspace(
  workspaceId: string,
  input: UpdateWorkspaceInput,
) {
  return patch<WorkspaceDetails>(`/workspaces/${workspaceId}`, input);
}

export async function transferOwnership(
  workspaceId: string,
  input: TransferOwnershipInput,
) {
  return post<TransferOwnershipResponse>(
    `/workspaces/${workspaceId}/transfer-ownership`,
    input,
  );
}
