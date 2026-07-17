"use client";

import type { OnboardingStepId } from "../steps";
import { CompleteStep } from "./steps/CompleteStep";
import { FirstProjectStep } from "./steps/FirstProjectStep";
import { InviteTeamStep } from "./steps/InviteTeamStep";
import { ModulesStep } from "./steps/ModulesStep";
import { ProfileStep } from "./steps/ProfileStep";
import { RoleIntroStep } from "./steps/RoleIntroStep";
import { TemplateStep } from "./steps/TemplateStep";
import { UsagePurposeStep } from "./steps/UsagePurposeStep";
import { WelcomeStep } from "./steps/WelcomeStep";
import { WorkspaceNameStep } from "./steps/WorkspaceNameStep";
import { WorkspaceProfileStep } from "./steps/WorkspaceProfileStep";

const STEP_COMPONENTS: Record<OnboardingStepId, () => React.JSX.Element> = {
  workspace_name: WorkspaceNameStep,
  usage_purpose: UsagePurposeStep,
  workspace_profile: WorkspaceProfileStep,
  template: TemplateStep,
  modules: ModulesStep,
  first_project: FirstProjectStep,
  invite_team: InviteTeamStep,
  welcome: WelcomeStep,
  profile: ProfileStep,
  role_intro: RoleIntroStep,
  complete: CompleteStep,
};

export function StepRenderer({ step }: { step: OnboardingStepId }) {
  const Component = STEP_COMPONENTS[step];
  return <Component />;
}
