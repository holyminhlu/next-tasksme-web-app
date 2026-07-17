"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useState } from "react";
import {
  AuthCard,
  FormError,
  PasswordField,
  authService,
  validateResetPasswordForm,
} from "@/modules/auth";
import styles from "@/modules/auth/auth.module.css";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setMessage(null);

    if (!token) {
      setError("Reset token is missing. Use the link from your email.");
      setSubmitting(false);
      return;
    }

    const validationError = validateResetPasswordForm({
      password,
      confirmPassword,
    });

    if (validationError) {
      setError(validationError);
      setSubmitting(false);
      return;
    }

    const result = await authService.resetPassword({
      token,
      password,
      confirmPassword,
    });

    if (!result.success) {
      setError(result.error.message);
      setSubmitting(false);
      return;
    }

    setMessage("Password reset successfully. Redirecting to sign in...");
    setSubmitting(false);
    setTimeout(() => router.replace("/login"), 1500);
  }

  return (
    <AuthCard
      title="Reset password"
      description="Choose a new password for your account."
      footer={
        <>
          Back to <Link href="/login">sign in</Link>
        </>
      }
    >
      <form className={styles.form} onSubmit={handleSubmit}>
        <FormError message={error} />
        {message && <div className={styles.success}>{message}</div>}

        <PasswordField
          id="password"
          name="password"
          label="New password"
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
          minLength={8}
        />

        <PasswordField
          id="confirmPassword"
          name="confirmPassword"
          label="Confirm new password"
          value={confirmPassword}
          onChange={setConfirmPassword}
          autoComplete="new-password"
          minLength={8}
        />

        <button
          type="submit"
          className={styles.primaryButton}
          disabled={submitting || !token}
        >
          {submitting ? "Resetting..." : "Reset password"}
        </button>
      </form>
    </AuthCard>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className={styles.loading}>Loading...</div>}>
      <ResetPasswordForm />
    </Suspense>
  );
}
