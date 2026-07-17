"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import {
  AuthCard,
  FormError,
  PasswordField,
  useAuth,
  validateRegisterForm,
} from "@/modules/auth";
import styles from "@/modules/auth/auth.module.css";

export default function RegisterPage() {
  const router = useRouter();
  const { register } = useAuth();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const validationError = validateRegisterForm({
      fullName,
      email,
      companyName,
      password,
      confirmPassword,
    });

    if (validationError) {
      setError(validationError);
      setSubmitting(false);
      return;
    }

    const result = await register({
      fullName,
      email,
      companyName,
      password,
      confirmPassword,
    });

    if (!result.ok) {
      setError(result.message ?? "Registration failed");
      setSubmitting(false);
      return;
    }

    router.replace(
      `/verify-email?email=${encodeURIComponent(email)}&registered=1`,
    );
  }

  return (
    <AuthCard
      title="Create account"
      description="Register your company and verify your email to get started."
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

        <div className={styles.field}>
          <label htmlFor="companyName">Company name</label>
          <input
            id="companyName"
            name="companyName"
            value={companyName}
            onChange={(event) => setCompanyName(event.target.value)}
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

        <button
          type="submit"
          className={styles.primaryButton}
          disabled={submitting}
        >
          {submitting ? "Creating account..." : "Create account"}
        </button>
      </form>
    </AuthCard>
  );
}
