"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useEffect, useState } from "react";
import {
  AuthCard,
  FormError,
  PasswordField,
  SocialAuthPlaceholder,
  useAuth,
} from "@/modules/auth";
import styles from "@/modules/auth/auth.module.css";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, status } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (status === "authenticated") {
      router.replace("/dashboard");
    }
  }, [status, router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const result = await login({ email, password, rememberMe });

    if (!result.ok) {
      setError(result.message ?? "Login failed");
      setSubmitting(false);
      return;
    }

    const redirect = searchParams.get("redirect");
    router.replace(redirect && redirect.startsWith("/") ? redirect : "/dashboard");
  }

  return (
    <AuthCard
      title="Sign in"
      description="Access your TaskMng workspace with your email and password."
      footer={
        <>
          No account yet? <Link href="/register">Create one</Link>
        </>
      }
    >
      <form className={styles.form} onSubmit={handleSubmit}>
        <FormError message={error} />

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
        />

        <label className={styles.checkboxRow}>
          <input
            type="checkbox"
            checked={rememberMe}
            onChange={(event) => setRememberMe(event.target.checked)}
          />
          Remember me on this device
        </label>

        <button
          type="submit"
          className={styles.primaryButton}
          disabled={submitting}
        >
          {submitting ? "Signing in..." : "Sign in"}
        </button>

        <p className={styles.footer}>
          <Link href="/forgot-password">Forgot password?</Link>
        </p>

        <SocialAuthPlaceholder mode="login" />
      </form>
    </AuthCard>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className={styles.loading}>Loading...</div>}>
      <LoginForm />
    </Suspense>
  );
}
