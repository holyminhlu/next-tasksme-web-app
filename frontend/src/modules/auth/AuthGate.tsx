"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, type ReactNode } from "react";
// Import the routing file directly (not the onboarding barrel) to avoid a
// runtime module cycle between the auth and onboarding modules.
import { decideWorkspaceRoute } from "@/modules/onboarding/routing";
import { useAuth } from "./AuthProvider";
import styles from "./auth.module.css";

type AuthGateProps = {
  children: ReactNode;
  /**
   * Require a selected workspace with completed onboarding. Redirects to
   * onboarding / workspace selection as needed (see decideWorkspaceRoute).
   */
  requireWorkspace?: boolean;
};

export function AuthGate({
  children,
  requireWorkspace = false,
}: AuthGateProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { status, selectedWorkspace, workspaces, selectWorkspace } = useAuth();
  const autoSelecting = useRef(false);

  const decision = useMemo(
    () =>
      status === "authenticated" && requireWorkspace
        ? decideWorkspaceRoute({ workspaces, selectedWorkspace, pathname })
        : null,
    [status, requireWorkspace, workspaces, selectedWorkspace, pathname],
  );

  useEffect(() => {
    if (status === "loading") {
      return;
    }

    if (status === "session-expired") {
      router.replace("/session-expired");
      return;
    }

    if (status === "unauthenticated") {
      const redirect = encodeURIComponent(
        `${pathname}${searchParams.toString() ? `?${searchParams.toString()}` : ""}`,
      );
      router.replace(`/login?redirect=${redirect}`);
      return;
    }

    if (!decision) {
      return;
    }

    if (decision.kind === "redirect") {
      router.replace(decision.to);
      return;
    }

    if (decision.kind === "select" && !autoSelecting.current) {
      autoSelecting.current = true;
      void selectWorkspace(decision.workspaceId).then((result) => {
        autoSelecting.current = false;
        if (!result.ok) {
          router.replace("/select-workspace");
        }
      });
    }
  }, [status, router, pathname, searchParams, decision, selectWorkspace]);

  if (status === "loading") {
    return <div className={styles.loading}>Loading session...</div>;
  }

  if (status !== "authenticated") {
    return <div className={styles.loading}>Redirecting...</div>;
  }

  if (decision && decision.kind !== "allow") {
    return <div className={styles.loading}>Redirecting...</div>;
  }

  return <>{children}</>;
}
