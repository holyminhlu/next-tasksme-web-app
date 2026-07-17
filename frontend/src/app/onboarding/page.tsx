"use client";

import { useRouter } from "next/navigation";
import { Suspense, useEffect, useRef } from "react";
import { AuthGate, useAuth } from "@/modules/auth";
import { UsageTypeSelector } from "@/modules/onboarding";
import {
  isOnboardingIncomplete,
  resumeOnboardingUrl,
} from "@/modules/onboarding/routing";
import styles from "@/modules/onboarding/onboarding.module.css";

/**
 * Onboarding entry point.
 *
 * - selected workspace with incomplete onboarding -> resume at current step
 * - selected workspace already completed          -> dashboard
 * - no workspace at all                           -> usage-type selection
 * - workspaces exist but none selected            -> auto-select single /
 *   otherwise send to the workspace picker
 */
function OnboardingEntry() {
  const router = useRouter();
  const { workspaces, selectedWorkspace, selectWorkspace } = useAuth();
  const autoSelecting = useRef(false);

  const showUsageType = workspaces.length === 0;

  useEffect(() => {
    if (selectedWorkspace) {
      router.replace(
        isOnboardingIncomplete(selectedWorkspace)
          ? resumeOnboardingUrl(selectedWorkspace)
          : "/dashboard",
      );
      return;
    }

    if (workspaces.length === 1 && !autoSelecting.current) {
      autoSelecting.current = true;
      void selectWorkspace(workspaces[0]!.id).then((result) => {
        autoSelecting.current = false;
        if (!result.ok) {
          router.replace("/select-workspace");
        }
      });
      return;
    }

    if (workspaces.length > 1) {
      router.replace("/select-workspace");
    }
  }, [selectedWorkspace, workspaces, selectWorkspace, router]);

  if (!showUsageType) {
    return <div className={styles.loading}>Đang chuyển hướng...</div>;
  }

  return <UsageTypeSelector />;
}

export default function OnboardingPage() {
  return (
    <Suspense fallback={<div className={styles.loading}>Đang tải...</div>}>
      <AuthGate>
        <OnboardingEntry />
      </AuthGate>
    </Suspense>
  );
}
