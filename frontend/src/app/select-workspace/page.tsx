"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Suspense, useState } from "react";
import {
  AuthCard,
  AuthGate,
  FormError,
  useAuth,
  type WorkspaceSummary,
} from "@/modules/auth";
import {
  isOnboardingIncomplete,
  resumeOnboardingUrl,
} from "@/modules/onboarding/routing";
import styles from "@/modules/auth/auth.module.css";

function SelectWorkspaceContent() {
  const router = useRouter();
  const { workspaces, selectWorkspace } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<string | null>(null);

  async function handleSelect(workspace: WorkspaceSummary) {
    setSubmitting(workspace.id);
    setError(null);

    const result = await selectWorkspace(workspace.id);

    if (!result.ok) {
      setError(result.message ?? "Could not select workspace");
      setSubmitting(null);
      return;
    }

    router.replace(
      isOnboardingIncomplete(workspace)
        ? resumeOnboardingUrl(workspace)
        : "/dashboard",
    );
  }

  return (
    <AuthCard
      title="Select workspace"
      description="Choose which workspace you want to use."
      footer={
        <>
          <Link href="/onboarding">Create a new workspace</Link>
        </>
      }
    >
      <FormError message={error} />

      {workspaces.length === 0 ? (
        <p className={styles.muted}>
          No workspaces are linked to your account.{" "}
          <Link href="/onboarding">Set up your first workspace</Link>.
        </p>
      ) : (
        <div className={styles.workspaceList}>
          {workspaces.map((workspace) => (
            <button
              key={workspace.id}
              type="button"
              className={styles.workspaceOption}
              disabled={submitting === workspace.id}
              onClick={() => handleSelect(workspace)}
            >
              <div>
                <strong>{workspace.name}</strong>
                <span>
                  {workspace.type === "PERSONAL" ? "Personal" : "Organization"}
                  {" · "}
                  {workspace.roleKey}
                  {isOnboardingIncomplete(workspace) && " · Setup incomplete"}
                </span>
              </div>
              <span>{submitting === workspace.id ? "..." : "Select"}</span>
            </button>
          ))}
        </div>
      )}
    </AuthCard>
  );
}

export default function SelectWorkspacePage() {
  return (
    <Suspense fallback={<div className={styles.loading}>Loading...</div>}>
      <AuthGate>
        <SelectWorkspaceContent />
      </AuthGate>
    </Suspense>
  );
}
