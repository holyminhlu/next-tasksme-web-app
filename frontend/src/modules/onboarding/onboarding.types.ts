import type { WorkspaceType } from "@/modules/auth";

export type OnboardingType =
  | "PERSONAL_OWNER"
  | "ORGANIZATION_OWNER"
  | "INVITED_MEMBER"
  | "INVITED_MANAGER";

export type OnboardingStatus = "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED";

export type OnboardingRecord = {
  id: string;
  workspaceId: string;
  userId: string;
  onboardingType: OnboardingType;
  status: OnboardingStatus;
  currentStep: string;
  completedSteps: string[];
  completedAt: string | null;
};

export type WorkspaceRecord = {
  id: string;
  name: string;
  slug: string;
  type: WorkspaceType;
  usagePurpose: string | null;
  industryCode: string | null;
  companySize: string | null;
  timezone: string;
  locale: string;
  logoUrl: string | null;
};

export type CreateWorkspaceInput = {
  type: WorkspaceType;
  name?: string;
  usagePurpose?: string;
  industryCode?: string;
  companySize?: string;
  timezone?: string;
  locale?: string;
};

export type CreateWorkspaceResponse = WorkspaceRecord & {
  onboarding: {
    status: OnboardingStatus;
    currentStep: string;
    onboardingType: OnboardingType;
  };
};

export type UpdateOnboardingInput = {
  currentStep?: string;
  completedSteps?: string[];
  markStepCompleted?: string;
  workspace?: {
    name?: string;
    usagePurpose?: string | null;
    industryCode?: string | null;
    companySize?: string | null;
    timezone?: string;
    locale?: string;
  };
};

export type WorkspaceModule = {
  id: string;
  workspaceId: string;
  moduleKey: string;
  enabled: boolean;
  core: boolean;
  name: string;
  description: string | null;
};

export type UpdateModulesInput = {
  modules: Array<{ moduleKey: string; enabled: boolean }>;
};

export type ModulePresetKey = "personal" | "team" | "full";

export type FirstProjectTaskInput = {
  title: string;
  description?: string;
  priority?: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  dueDate?: string;
};

export type CreateFirstProjectInput = {
  name: string;
  description?: string;
  tasks?: FirstProjectTaskInput[];
};

export type CreateFirstProjectResponse = {
  project: { id: string; name: string };
  tasks: Array<{ id: string; title: string }>;
};

export type InviteMemberInput = {
  email: string;
  roleKey: string;
};

export type InvitationRecord = {
  id: string;
  email: string;
  roleKey: string;
  expiresAt: string;
  status: string;
};

export type ProjectTemplate = {
  key: string;
  name: string;
  description: string;
  projectName: string;
  taskTitles: string[];
};
