"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Suspense } from "react";
import { BrandLogo } from "@/components/BrandLogo";
import { AuthGate, Can, useAuth } from "@/modules/auth";
import {
  isOnboardingIncomplete,
  resumeOnboardingUrl,
} from "@/modules/onboarding/routing";
import styles from "@/modules/auth/auth.module.css";

function AppHeader() {
  const router = useRouter();
  const { user, workspaces, selectedWorkspace, selectWorkspace, logout } =
    useAuth();

  const isOrganization = selectedWorkspace?.type === "ORGANIZATION";

  async function handleWorkspaceChange(workspaceId: string) {
    if (!workspaceId || workspaceId === selectedWorkspace?.id) {
      return;
    }

    const result = await selectWorkspace(workspaceId);

    if (result.ok) {
      const next = workspaces.find((workspace) => workspace.id === workspaceId);
      if (next && isOnboardingIncomplete(next)) {
        router.replace(resumeOnboardingUrl(next));
      }
    }
  }

  async function handleLogout() {
    await logout();
    router.replace("/login");
  }

  return (
    <header className={styles.appHeader}>
      <div className={styles.appNav}>
        <Link href="/dashboard" aria-label="Task SME dashboard">
          <BrandLogo size="compact" priority />
        </Link>
        <Link href="/dashboard">Dashboard</Link>
        {isOrganization && (
          <Can permission="members:read">
            <Link href="/members">Members</Link>
          </Can>
        )}
      </div>
      <div className={styles.appActions}>
        {workspaces.length > 0 && (
          <select
            className={styles.workspaceSelect}
            value={selectedWorkspace?.id ?? ""}
            onChange={(event) => handleWorkspaceChange(event.target.value)}
            aria-label="Active workspace"
          >
            <option value="" disabled>
              Select workspace
            </option>
            {workspaces.map((workspace) => (
              <option key={workspace.id} value={workspace.id}>
                {workspace.name}
                {workspace.type === "PERSONAL" ? " (personal)" : ""}
              </option>
            ))}
          </select>
        )}
        {workspaces.length > 1 && (
          <Link href="/select-workspace" className={styles.secondaryButton}>
            Switch workspace
          </Link>
        )}
        <span className={styles.muted}>{user?.email}</span>
        <button
          type="button"
          className={styles.secondaryButton}
          onClick={handleLogout}
        >
          Log out
        </button>
      </div>
    </header>
  );
}

function AppLayoutContent({ children }: { children: React.ReactNode }) {
  return (
    <div className={styles.appShell}>
      <AppHeader />
      <main className={styles.appMain}>{children}</main>
    </div>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className={styles.loading}>Loading...</div>}>
      <AuthGate requireWorkspace>
        <AppLayoutContent>{children}</AppLayoutContent>
      </AuthGate>
    </Suspense>
  );
}
