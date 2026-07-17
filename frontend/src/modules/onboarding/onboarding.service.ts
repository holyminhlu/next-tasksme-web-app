import { get, patch, post } from "@/lib/api/client";
import type {
  CreateFirstProjectInput,
  CreateFirstProjectResponse,
  CreateWorkspaceInput,
  CreateWorkspaceResponse,
  InvitationRecord,
  InviteMemberInput,
  ModulePresetKey,
  OnboardingRecord,
  UpdateModulesInput,
  UpdateOnboardingInput,
  WorkspaceModule,
} from "./onboarding.types";

export async function createWorkspace(input: CreateWorkspaceInput) {
  return post<CreateWorkspaceResponse>("/workspaces", input);
}

export async function getOnboarding(workspaceId: string) {
  return get<OnboardingRecord>(`/workspaces/${workspaceId}/onboarding`);
}

export async function updateOnboarding(
  workspaceId: string,
  input: UpdateOnboardingInput,
) {
  return patch<OnboardingRecord>(
    `/workspaces/${workspaceId}/onboarding`,
    input,
  );
}

export async function completeOnboarding(workspaceId: string) {
  return post<OnboardingRecord>(
    `/workspaces/${workspaceId}/onboarding/complete`,
  );
}

export async function listModules(workspaceId: string) {
  return get<WorkspaceModule[]>(`/workspaces/${workspaceId}/modules`);
}

export async function updateModules(
  workspaceId: string,
  input: UpdateModulesInput,
) {
  return patch<WorkspaceModule[]>(`/workspaces/${workspaceId}/modules`, input);
}

export async function applyModulePreset(
  workspaceId: string,
  presetKey: ModulePresetKey,
) {
  return post<WorkspaceModule[]>(`/workspaces/${workspaceId}/modules/presets`, {
    presetKey,
  });
}

export async function createFirstProject(
  workspaceId: string,
  input: CreateFirstProjectInput,
) {
  return post<CreateFirstProjectResponse>(
    `/workspaces/${workspaceId}/onboarding/first-project`,
    input,
  );
}

export async function inviteMember(
  workspaceId: string,
  input: InviteMemberInput,
) {
  return post<InvitationRecord>(
    `/workspaces/${workspaceId}/invitations`,
    input,
  );
}
