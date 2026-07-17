import { onboardingStepUrl } from "./steps";

/**
 * Minimal workspace shape needed for routing decisions.
 * Structurally compatible with WorkspaceSummary from the auth module.
 */
export type RoutableWorkspace = {
  id: string;
  onboardingStatus: string | null;
  currentStep: string | null;
};

export type AuthRouteDecision =
  | { kind: "allow" }
  | { kind: "redirect"; to: string }
  | { kind: "select"; workspaceId: string };

export type AuthRouteInput = {
  workspaces: RoutableWorkspace[];
  selectedWorkspace: RoutableWorkspace | null;
  pathname: string;
};

export function isOnboardingIncomplete(
  workspace: RoutableWorkspace,
): boolean {
  // Workspaces without an onboarding record (null status) are treated as
  // complete so users are never trapped in onboarding.
  return (
    workspace.onboardingStatus !== null &&
    workspace.onboardingStatus !== "COMPLETED"
  );
}

export function resumeOnboardingUrl(workspace: RoutableWorkspace): string {
  return workspace.currentStep
    ? onboardingStepUrl(workspace.currentStep)
    : "/onboarding";
}

/**
 * Deterministic routing decision for an authenticated user trying to reach a
 * workspace-scoped page (e.g. the dashboard).
 *
 * - zero workspaces          -> onboarding entry (usage-type selection)
 * - selected but incomplete  -> resume onboarding at the current step
 * - none selected, exactly 1 -> select it via the backend endpoint
 * - none selected, multiple  -> workspace picker
 * - selected and complete    -> allow
 *
 * A redirect is never issued to the pathname we are already on, which
 * prevents redirect loops.
 */
export function decideWorkspaceRoute(
  input: AuthRouteInput,
): AuthRouteDecision {
  const { workspaces, selectedWorkspace, pathname } = input;

  const redirect = (to: string): AuthRouteDecision =>
    pathname === to ? { kind: "allow" } : { kind: "redirect", to };

  if (workspaces.length === 0) {
    return redirect("/onboarding");
  }

  if (selectedWorkspace) {
    if (isOnboardingIncomplete(selectedWorkspace)) {
      return redirect(resumeOnboardingUrl(selectedWorkspace));
    }

    return { kind: "allow" };
  }

  if (workspaces.length === 1) {
    return { kind: "select", workspaceId: workspaces[0]!.id };
  }

  return redirect("/select-workspace");
}
