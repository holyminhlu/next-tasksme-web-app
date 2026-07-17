export const MODULE_CATALOG = [
  {
    key: "tasks",
    name: "Tasks",
    description: "Create and track tasks",
    core: true,
  },
  {
    key: "projects",
    name: "Projects",
    description: "Organize work into projects",
    core: true,
  },
  {
    key: "members",
    name: "Members",
    description: "Invite and manage teammates",
    core: false,
  },
  {
    key: "calendar",
    name: "Calendar",
    description: "Schedule and due-date views",
    core: false,
  },
  {
    key: "files",
    name: "Files",
    description: "Attach and browse files",
    core: false,
  },
  {
    key: "reports",
    name: "Reports",
    description: "Progress and workload reports",
    core: false,
  },
] as const;

export type ModuleKey = (typeof MODULE_CATALOG)[number]["key"];

export const MODULE_PRESET_KEYS = ["personal", "team", "full"] as const;

export type ModulePresetKey = (typeof MODULE_PRESET_KEYS)[number];

export const MODULE_PRESETS: Record<
  ModulePresetKey,
  { label: string; enabledKeys: ModuleKey[] }
> = {
  personal: {
    label: "Personal productivity",
    enabledKeys: ["tasks", "projects"],
  },
  team: {
    label: "Team collaboration",
    enabledKeys: ["tasks", "projects", "members", "calendar"],
  },
  full: {
    label: "Full workspace",
    enabledKeys: ["tasks", "projects", "members", "calendar", "files", "reports"],
  },
};

export const PERSONAL_ONBOARDING_STEPS = [
  "workspace_name",
  "usage_purpose",
  "template",
  "modules",
  "first_project",
  "complete",
] as const;

export const ORGANIZATION_ONBOARDING_STEPS = [
  "workspace_profile",
  "modules",
  "template",
  "first_project",
  "invite_team",
  "complete",
] as const;

export const INVITED_ONBOARDING_STEPS = [
  "welcome",
  "profile",
  "role_intro",
  "complete",
] as const;

export function initialOnboardingStep(
  onboardingType:
    | "PERSONAL_OWNER"
    | "ORGANIZATION_OWNER"
    | "INVITED_MEMBER"
    | "INVITED_MANAGER",
): string {
  switch (onboardingType) {
    case "PERSONAL_OWNER":
      return PERSONAL_ONBOARDING_STEPS[0];
    case "ORGANIZATION_OWNER":
      return ORGANIZATION_ONBOARDING_STEPS[0];
    case "INVITED_MEMBER":
    case "INVITED_MANAGER":
      return INVITED_ONBOARDING_STEPS[0];
  }
}

export function defaultModulesForWorkspaceType(
  type: "PERSONAL" | "ORGANIZATION",
): Array<{ moduleKey: ModuleKey; enabled: boolean; core: boolean }> {
  const enabledKeys = new Set(
    type === "PERSONAL"
      ? MODULE_PRESETS.personal.enabledKeys
      : MODULE_PRESETS.team.enabledKeys,
  );

  return MODULE_CATALOG.map((module) => ({
    moduleKey: module.key,
    enabled: module.core || enabledKeys.has(module.key),
    core: module.core,
  }));
}
