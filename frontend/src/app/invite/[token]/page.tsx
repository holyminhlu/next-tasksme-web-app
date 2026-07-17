"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import {
  AuthCard,
  FormError,
  PasswordField,
  authService,
  useAuth,
} from "@/modules/auth";
import type { InvitationPreview } from "@/modules/auth";
import styles from "@/modules/auth/auth.module.css";

export default function InvitePage() {
  const router = useRouter();
  const params = useParams<{ token: string }>();
  const token = params.token;
  const { status, user, selectWorkspace } = useAuth();

  const [preview, setPreview] = useState<InvitationPreview | null>(null);
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const needsAccount =
    status === "unauthenticated" || status === "session-expired";

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      const result = await authService.previewInvitation(token);

      if (cancelled) {
        return;
      }

      if (!result.success) {
        setError(result.error.message);
        setLoading(false);
        return;
      }

      setPreview(result.data);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [token]);

  async function handleAccept(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setMessage(null);

    if (needsAccount) {
      if (!fullName || !password) {
        setError("Full name and password are required for new accounts");
        setSubmitting(false);
        return;
      }

      if (password !== confirmPassword) {
        setError("Passwords do not match");
        setSubmitting(false);
        return;
      }
    }

    const result = await authService.acceptInvitation(
      {
        token,
        fullName: needsAccount ? fullName : undefined,
        password: needsAccount ? password : undefined,
        confirmPassword: needsAccount ? confirmPassword : undefined,
      },
      { authenticated: status === "authenticated" },
    );

    if (!result.success) {
      setError(result.error.message);
      setSubmitting(false);
      return;
    }

    if (needsAccount) {
      // The account was created, but there is no session yet. Sign in and
      // continue into the invited onboarding flow.
      setMessage("Invitation accepted. Sign in to continue setup...");
      setSubmitting(false);
      setTimeout(
        () =>
          router.replace(
            `/login?redirect=${encodeURIComponent("/onboarding")}`,
          ),
        1200,
      );
      return;
    }

    setMessage("Invitation accepted. Redirecting to setup...");
    await selectWorkspace(result.data.workspaceId);
    setSubmitting(false);
    setTimeout(() => router.replace("/onboarding"), 800);
  }

  if (loading) {
    return (
      <AuthCard title="Invitation" description="Loading invitation details...">
        <p className={styles.muted}>Please wait...</p>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Accept invitation"
      description={
        preview
          ? `Join ${preview.workspace.name} as ${preview.roleKey}.`
          : "Workspace invitation"
      }
      footer={
        <>
          <Link href="/login">Sign in</Link> · <Link href="/">Home</Link>
        </>
      }
    >
      {preview && (
        <div className={styles.workspaceList}>
          <div className={styles.workspaceOption}>
            <div>
              <strong>{preview.workspace.name}</strong>
              <span>
                Role: {preview.roleKey} · Invitation for{" "}
                <strong>{preview.email}</strong>
              </span>
            </div>
          </div>
          {user && user.email !== preview.email && (
            <p className={styles.error}>
              You are signed in as {user.email}, but this invitation was sent
              to {preview.email}. Sign out first to accept it with the invited
              email.
            </p>
          )}
        </div>
      )}

      <form className={styles.form} onSubmit={handleAccept}>
        <FormError message={error} />
        {message && <div className={styles.success}>{message}</div>}

        {needsAccount && preview && (
          <>
            <div className={styles.field}>
              <label htmlFor="invitedEmail">Email</label>
              <input
                id="invitedEmail"
                name="invitedEmail"
                type="email"
                value={preview.email}
                disabled
                readOnly
                aria-label="Invited email (locked)"
              />
            </div>

            <div className={styles.field}>
              <label htmlFor="fullName">Full name</label>
              <input
                id="fullName"
                name="fullName"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                required
                minLength={2}
              />
            </div>

            <PasswordField
              id="password"
              name="password"
              label="Password"
              value={password}
              onChange={setPassword}
              autoComplete="new-password"
              minLength={8}
            />

            <PasswordField
              id="confirmPassword"
              name="confirmPassword"
              label="Confirm password"
              value={confirmPassword}
              onChange={setConfirmPassword}
              autoComplete="new-password"
              minLength={8}
            />
          </>
        )}

        <button
          type="submit"
          className={styles.primaryButton}
          disabled={
            submitting ||
            !preview ||
            Boolean(user && preview && user.email !== preview.email)
          }
        >
          {submitting ? "Accepting..." : "Accept invitation"}
        </button>
      </form>
    </AuthCard>
  );
}
