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
  const { status, user, refreshProfile } = useAuth();

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

    setMessage("Invitation accepted. Redirecting...");
    await refreshProfile();
    setSubmitting(false);
    setTimeout(() => router.replace("/dashboard"), 1200);
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
          ? `Join ${preview.company.name} as ${preview.roleKey}.`
          : "Company invitation"
      }
      footer={
        <>
          <Link href="/login">Sign in</Link> · <Link href="/">Home</Link>
        </>
      }
    >
      {preview && (
        <p className={styles.muted}>
          Invited email: <strong>{preview.email}</strong>
          {user && user.email !== preview.email && (
            <> · Signed in as {user.email}</>
          )}
        </p>
      )}

      <form className={styles.form} onSubmit={handleAccept}>
        <FormError message={error} />
        {message && <div className={styles.success}>{message}</div>}

        {needsAccount && (
          <>
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
          disabled={submitting || !preview}
        >
          {submitting ? "Accepting..." : "Accept invitation"}
        </button>
      </form>
    </AuthCard>
  );
}
