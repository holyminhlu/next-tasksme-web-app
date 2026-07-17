"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import {
  AuthCard,
  FormError,
  authService,
} from "@/modules/auth";
import styles from "@/modules/auth/auth.module.css";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setMessage(null);

    const result = await authService.forgotPassword({ email });

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
      title="Forgot password"
      description="Enter your email and we will send reset instructions if an account exists."
      footer={
        <>
          Remembered it? <Link href="/login">Back to sign in</Link>
        </>
      }
    >
      <form className={styles.form} onSubmit={handleSubmit}>
        <FormError message={error} />
        {message && <div className={styles.success}>{message}</div>}

        <div className={styles.field}>
          <label htmlFor="email">Email</label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
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
          {submitting ? "Sending..." : "Send reset link"}
        </button>
      </form>
    </AuthCard>
  );
}
