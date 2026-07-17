"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useEffect, useState } from "react";
import {
  AuthCard,
  FormError,
  authService,
} from "@/modules/auth";
import styles from "@/modules/auth/auth.module.css";

function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const emailParam = searchParams.get("email") ?? "";
  const justRegistered = searchParams.get("registered") === "1";

  const [email, setEmail] = useState(emailParam);
  const [message, setMessage] = useState<string | null>(
    justRegistered
      ? "Account created. Check your inbox for a verification link, or resend below."
      : null,
  );
  const [error, setError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(Boolean(token));
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) {
      return;
    }

    let cancelled = false;

    (async () => {
      setVerifying(true);
      setError(null);

      const result = await authService.verifyEmail({ token });

      if (cancelled) {
        return;
      }

      if (!result.success) {
        setError(result.error.message);
        setVerifying(false);
        return;
      }

      setMessage("Email verified successfully. You can now sign in.");
      setVerifying(false);
      setTimeout(() => router.replace("/login"), 1500);
    })();

    return () => {
      cancelled = true;
    };
  }, [token, router]);

  async function handleResend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setMessage(null);

    const result = await authService.resendVerification({ email });

    if (!result.success) {
      setError(result.error.message);
      setSubmitting(false);
      return;
    }

    setMessage(result.data.message);
    setSubmitting(false);
  }

  return (
    <AuthCard
      title="Verify email"
      description="Confirm your email address to activate your account."
      footer={
        <>
          Back to <Link href="/login">sign in</Link>
        </>
      }
    >
      {verifying ? (
        <p className={styles.muted}>Verifying your email...</p>
      ) : (
        <form className={styles.form} onSubmit={handleResend}>
          <FormError message={error} />
          {message && <div className={styles.success}>{message}</div>}

          <div className={styles.field}>
            <label htmlFor="email">Email</label>
            <input
              id="email"
              name="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </div>

          <button
            type="submit"
            className={styles.primaryButton}
            disabled={submitting}
          >
            {submitting ? "Sending..." : "Resend verification email"}
          </button>
        </form>
      )}
    </AuthCard>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div className={styles.loading}>Loading...</div>}>
      <VerifyEmailContent />
    </Suspense>
  );
}
