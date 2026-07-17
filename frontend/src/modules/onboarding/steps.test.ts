import { describe, expect, it } from "vitest";
import {
  INVITED_STEPS,
  ORGANIZATION_STEPS,
  PERSONAL_STEPS,
  firstStep,
  isStepInFlow,
  nextStep,
  onboardingStepUrl,
  onboardingTypeForWorkspace,
  pathToStep,
  previousStep,
  stepProgress,
  stepToPath,
} from "./steps";

describe("onboarding step machine", () => {
  it("defines the personal flow in backend order", () => {
    expect([...PERSONAL_STEPS]).toEqual([
      "workspace_name",
      "usage_purpose",
      "template",
      "modules",
      "first_project",
      "complete",
    ]);
  });

  it("defines the organization flow in backend order", () => {
    expect([...ORGANIZATION_STEPS]).toEqual([
      "workspace_profile",
      "modules",
      "template",
      "first_project",
      "invite_team",
      "complete",
    ]);
  });

  it("defines the invited flow without workspace creation steps", () => {
    expect([...INVITED_STEPS]).toEqual([
      "welcome",
      "profile",
      "role_intro",
      "complete",
    ]);
    expect(isStepInFlow("INVITED_MEMBER", "modules")).toBe(false);
    expect(isStepInFlow("INVITED_MEMBER", "invite_team")).toBe(false);
    expect(isStepInFlow("INVITED_MEMBER", "workspace_name")).toBe(false);
  });

  it("derives the onboarding type from workspace type and role", () => {
    expect(onboardingTypeForWorkspace("PERSONAL", "owner")).toBe(
      "PERSONAL_OWNER",
    );
    expect(onboardingTypeForWorkspace("ORGANIZATION", "owner")).toBe(
      "ORGANIZATION_OWNER",
    );
    expect(onboardingTypeForWorkspace("ORGANIZATION", "manager")).toBe(
      "INVITED_MANAGER",
    );
    expect(onboardingTypeForWorkspace("ORGANIZATION", "member")).toBe(
      "INVITED_MEMBER",
    );
  });

  it("walks forward deterministically and stops at the end", () => {
    expect(firstStep("PERSONAL_OWNER")).toBe("workspace_name");
    expect(nextStep("PERSONAL_OWNER", "workspace_name")).toBe("usage_purpose");
    expect(nextStep("PERSONAL_OWNER", "first_project")).toBe("complete");
    expect(nextStep("PERSONAL_OWNER", "complete")).toBeNull();
    expect(nextStep("ORGANIZATION_OWNER", "first_project")).toBe("invite_team");
    expect(nextStep("PERSONAL_OWNER", "unknown_step")).toBeNull();
  });

  it("walks backward and stops at the beginning", () => {
    expect(previousStep("PERSONAL_OWNER", "usage_purpose")).toBe(
      "workspace_name",
    );
    expect(previousStep("PERSONAL_OWNER", "workspace_name")).toBeNull();
    expect(previousStep("INVITED_MEMBER", "profile")).toBe("welcome");
  });

  it("computes progress", () => {
    expect(stepProgress("PERSONAL_OWNER", "workspace_name")).toEqual({
      index: 0,
      total: 6,
      percent: 17,
    });
    expect(stepProgress("PERSONAL_OWNER", "complete").percent).toBe(100);
    expect(stepProgress("INVITED_MEMBER", "role_intro")).toEqual({
      index: 2,
      total: 4,
      percent: 75,
    });
  });

  it("maps steps to url paths and back", () => {
    expect(stepToPath("first_project")).toBe("first-project");
    expect(pathToStep("first-project")).toBe("first_project");
    expect(onboardingStepUrl("workspace_profile")).toBe(
      "/onboarding/workspace-profile",
    );
  });
});
