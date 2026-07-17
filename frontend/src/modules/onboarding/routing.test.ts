import { describe, expect, it } from "vitest";
import {
  decideWorkspaceRoute,
  isOnboardingIncomplete,
  resumeOnboardingUrl,
  type RoutableWorkspace,
} from "./routing";

function workspace(
  overrides: Partial<RoutableWorkspace> = {},
): RoutableWorkspace {
  return {
    id: "ws-1",
    onboardingStatus: "COMPLETED",
    currentStep: "complete",
    ...overrides,
  };
}

describe("isOnboardingIncomplete", () => {
  it("treats IN_PROGRESS as incomplete", () => {
    expect(
      isOnboardingIncomplete(workspace({ onboardingStatus: "IN_PROGRESS" })),
    ).toBe(true);
  });

  it("treats COMPLETED and missing onboarding records as complete", () => {
    expect(isOnboardingIncomplete(workspace())).toBe(false);
    expect(
      isOnboardingIncomplete(
        workspace({ onboardingStatus: null, currentStep: null }),
      ),
    ).toBe(false);
  });
});

describe("decideWorkspaceRoute", () => {
  it("sends users with zero workspaces to onboarding", () => {
    expect(
      decideWorkspaceRoute({
        workspaces: [],
        selectedWorkspace: null,
        pathname: "/dashboard",
      }),
    ).toEqual({ kind: "redirect", to: "/onboarding" });
  });

  it("resumes onboarding for an incomplete selected workspace", () => {
    const selected = workspace({
      onboardingStatus: "IN_PROGRESS",
      currentStep: "first_project",
    });

    expect(
      decideWorkspaceRoute({
        workspaces: [selected],
        selectedWorkspace: selected,
        pathname: "/dashboard",
      }),
    ).toEqual({ kind: "redirect", to: "/onboarding/first-project" });
  });

  it("falls back to the onboarding entry when the current step is unknown", () => {
    const selected = workspace({
      onboardingStatus: "IN_PROGRESS",
      currentStep: null,
    });

    expect(resumeOnboardingUrl(selected)).toBe("/onboarding");
  });

  it("auto-selects a single workspace via the backend endpoint", () => {
    const only = workspace({ id: "ws-9" });

    expect(
      decideWorkspaceRoute({
        workspaces: [only],
        selectedWorkspace: null,
        pathname: "/dashboard",
      }),
    ).toEqual({ kind: "select", workspaceId: "ws-9" });
  });

  it("sends users with multiple workspaces and no selection to the picker", () => {
    expect(
      decideWorkspaceRoute({
        workspaces: [workspace({ id: "a" }), workspace({ id: "b" })],
        selectedWorkspace: null,
        pathname: "/dashboard",
      }),
    ).toEqual({ kind: "redirect", to: "/select-workspace" });
  });

  it("allows access when a completed workspace is selected", () => {
    const selected = workspace();

    expect(
      decideWorkspaceRoute({
        workspaces: [selected],
        selectedWorkspace: selected,
        pathname: "/dashboard",
      }),
    ).toEqual({ kind: "allow" });
  });

  it("never redirects to the current pathname (loop protection)", () => {
    expect(
      decideWorkspaceRoute({
        workspaces: [],
        selectedWorkspace: null,
        pathname: "/onboarding",
      }),
    ).toEqual({ kind: "allow" });

    const selected = workspace({
      onboardingStatus: "IN_PROGRESS",
      currentStep: "modules",
    });

    expect(
      decideWorkspaceRoute({
        workspaces: [selected],
        selectedWorkspace: selected,
        pathname: "/onboarding/modules",
      }),
    ).toEqual({ kind: "allow" });
  });
});
