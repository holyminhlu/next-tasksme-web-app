import type { WorkspaceType } from "@/modules/auth";
import type { OnboardingType } from "./onboarding.types";

// Step ids mirror backend/src/modules/workspaces/modules.catalog.ts.
export const PERSONAL_STEPS = [
  "workspace_name",
  "usage_purpose",
  "template",
  "modules",
  "first_project",
  "complete",
] as const;

export const ORGANIZATION_STEPS = [
  "workspace_profile",
  "modules",
  "template",
  "first_project",
  "invite_team",
  "complete",
] as const;

export const INVITED_STEPS = [
  "welcome",
  "profile",
  "role_intro",
  "complete",
] as const;

export type OnboardingStepId =
  | (typeof PERSONAL_STEPS)[number]
  | (typeof ORGANIZATION_STEPS)[number]
  | (typeof INVITED_STEPS)[number];

export const ONBOARDING_FLOWS: Record<
  OnboardingType,
  readonly OnboardingStepId[]
> = {
  PERSONAL_OWNER: PERSONAL_STEPS,
  ORGANIZATION_OWNER: ORGANIZATION_STEPS,
  INVITED_MEMBER: INVITED_STEPS,
  INVITED_MANAGER: INVITED_STEPS,
};

export function onboardingTypeForWorkspace(
  type: WorkspaceType,
  roleKey: string,
): OnboardingType {
  if (roleKey === "owner") {
    return type === "PERSONAL" ? "PERSONAL_OWNER" : "ORGANIZATION_OWNER";
  }

  return roleKey === "manager" ? "INVITED_MANAGER" : "INVITED_MEMBER";
}

export function stepsForType(
  onboardingType: OnboardingType,
): readonly OnboardingStepId[] {
  return ONBOARDING_FLOWS[onboardingType];
}

export function isStepInFlow(
  onboardingType: OnboardingType,
  step: string,
): step is OnboardingStepId {
  return stepsForType(onboardingType).includes(step as OnboardingStepId);
}

export function firstStep(onboardingType: OnboardingType): OnboardingStepId {
  return stepsForType(onboardingType)[0]!;
}

export function nextStep(
  onboardingType: OnboardingType,
  step: string,
): OnboardingStepId | null {
  const steps = stepsForType(onboardingType);
  const index = steps.indexOf(step as OnboardingStepId);

  if (index === -1 || index === steps.length - 1) {
    return null;
  }

  return steps[index + 1]!;
}

export function previousStep(
  onboardingType: OnboardingType,
  step: string,
): OnboardingStepId | null {
  const steps = stepsForType(onboardingType);
  const index = steps.indexOf(step as OnboardingStepId);

  if (index <= 0) {
    return null;
  }

  return steps[index - 1]!;
}

export function stepProgress(
  onboardingType: OnboardingType,
  step: string,
): { index: number; total: number; percent: number } {
  const steps = stepsForType(onboardingType);
  const rawIndex = steps.indexOf(step as OnboardingStepId);
  const index = rawIndex === -1 ? 0 : rawIndex;
  const total = steps.length;
  const percent = Math.round(((index + 1) / total) * 100);

  return { index, total, percent };
}

export function stepToPath(step: string): string {
  return step.replace(/_/g, "-");
}

export function pathToStep(path: string): string {
  return path.replace(/-/g, "_");
}

export function onboardingStepUrl(step: string): string {
  return `/onboarding/${stepToPath(step)}`;
}
