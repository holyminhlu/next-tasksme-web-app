"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import {
  AuthCard,
  FormError,
  PasswordField,
  SocialAuthPlaceholder,
  useAuth,
  validateRegisterForm,
} from "@/modules/auth";
import styles from "@/modules/auth/auth.module.css";

export default function RegisterPage() {
  const router = useRouter();
  const { register } = useAuth();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const validationError = validateRegisterForm({
      fullName,
      email,
      password,
      confirmPassword,
      acceptTerms,
    });

    if (validationError) {
      setError(validationError);
      setSubmitting(false);
      return;
    }

    const result = await register({
      fullName,
      email,
      password,
      confirmPassword,
    });

    if (!result.ok) {
      setError(result.message ?? "Registration failed");
      setSubmitting(false);
      return;
    }

    if (result.requiresEmailVerification) {
      router.replace(
        `/verify-email?email=${encodeURIComponent(email)}&registered=1`,
      );
      return;
    }

    router.replace(`/login?registered=1&email=${encodeURIComponent(email)}`);
  }

  return (
    <AuthCard
      title="Create account"
      description="Sign up with your email. You will set up your workspace after verifying your email."
      footer={
        <>
          Already have an account? <Link href="/login">Sign in</Link>
        </>
      }
    >
      <form className={styles.form} onSubmit={handleSubmit}>
        <FormError message={error} />

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

        <label className={styles.checkboxRow}>
          <input
            type="checkbox"
            checked={acceptTerms}
            onChange={(event) => setAcceptTerms(event.target.checked)}
            required
          />
          <span>
            I agree to the <Link href="/terms">Terms of Service</Link> and{" "}
            <Link href="/privacy">Privacy Policy</Link>
          </span>
        </label>

        <button
          type="submit"
          className={styles.primaryButton}
          disabled={submitting}
        >
          {submitting ? "Creating account..." : "Create account"}
        </button>

        <SocialAuthPlaceholder mode="register" />
      </form>
    </AuthCard>
  );
}
