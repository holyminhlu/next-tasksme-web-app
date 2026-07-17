"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { authService, useAuth, type AuthSession } from "@/modules/auth";
import {
  Badge,
  Button,
  ErrorState,
  FormField,
  Skeleton,
  Table,
  TextInput,
  useToast,
} from "@/modules/design-system";
import styles from "../../app-pages.module.css";

function formatDate(value: string | null): string {
  if (!value) {
    return "—";
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
}

function ChangePasswordCard() {
  const { toast } = useToast();
  const [currentPassword, setCurrentPassword] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    if (submitting) {
      return;
    }

    if (password !== confirmPassword) {
      setError("New password and confirmation do not match.");
      return;
    }

    setSubmitting(true);
    setError(null);

    const result = await authService.changePassword({
      currentPassword,
      password,
      confirmPassword,
    });

    setSubmitting(false);

    if (!result.success) {
      setError(result.error.message);
      return;
    }

    setCurrentPassword("");
    setPassword("");
    setConfirmPassword("");
    toast({
      title: "Password changed",
      description: "Your password has been updated.",
      tone: "success",
    });
  }

  return (
    <section className={styles.card} aria-labelledby="change-password-heading">
      <h2 id="change-password-heading" className={styles.cardTitle}>
        Change password
      </h2>
      <p className={styles.cardDescription}>
        Use a strong password you don&apos;t use anywhere else.
      </p>

      <form className={styles.form} onSubmit={handleSubmit}>
        {error && (
          <p className={styles.errorBanner} role="alert">
            {error}
          </p>
        )}
        <FormField label="Current password" required>
          {(props) => (
            <TextInput
              {...props}
              type="password"
              autoComplete="current-password"
              required
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
            />
          )}
        </FormField>
        <FormField
          label="New password"
          required
          hint="At least 8 characters, including a letter and a number."
        >
          {(props) => (
            <TextInput
              {...props}
              type="password"
              autoComplete="new-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          )}
        </FormField>
        <FormField label="Confirm new password" required>
          {(props) => (
            <TextInput
              {...props}
              type="password"
              autoComplete="new-password"
              required
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
            />
          )}
        </FormField>
        <div className={styles.formActions}>
          <Button
            type="submit"
            loading={submitting}
            disabled={!currentPassword || !password || !confirmPassword}
          >
            Change password
          </Button>
        </div>
      </form>
    </section>
  );
}

function SessionsCard() {
  const { toast } = useToast();
  const [sessions, setSessions] = useState<AuthSession[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const loadSessions = useCallback(async () => {
    const result = await authService.listSessions();

    if (!result.success) {
      setError(result.error.message);
      return;
    }

    setSessions(result.data);
    setError(null);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async fetch on mount
    void loadSessions();
  }, [loadSessions]);

  async function handleRevoke(sessionId: string) {
    setRevokingId(sessionId);
    const result = await authService.revokeSession(sessionId);
    setRevokingId(null);

    if (!result.success) {
      toast({
        title: "Could not revoke session",
        description: result.error.message,
        tone: "error",
      });
      return;
    }

    toast({ title: "Session revoked", tone: "success" });
    await loadSessions();
  }

  return (
    <section className={styles.card} aria-labelledby="sessions-heading">
      <h2 id="sessions-heading" className={styles.cardTitle}>
        Active sessions
      </h2>
      <p className={styles.cardDescription}>
        Devices currently signed in to your account.
      </p>

      {error ? (
        <ErrorState
          title="Could not load sessions"
          description={error}
          onRetry={() => void loadSessions()}
        />
      ) : sessions === null ? (
        <div className={styles.skeletonRows} aria-hidden>
          <Skeleton height={40} />
          <Skeleton height={40} />
          <Skeleton height={40} />
        </div>
      ) : (
        <Table aria-label="Active sessions">
          <thead>
            <tr>
              <th scope="col">Device</th>
              <th scope="col">IP address</th>
              <th scope="col">Last used</th>
              <th scope="col">Expires</th>
              <th scope="col">
                <span className={styles.muted}>Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {sessions.map((session) => (
              <tr key={session.id}>
                <td>
                  {session.userAgent ?? "Unknown device"}{" "}
                  {session.current && <Badge tone="primary">This device</Badge>}
                </td>
                <td>{session.ipAddress ?? "—"}</td>
                <td>{formatDate(session.lastUsedAt ?? session.createdAt)}</td>
                <td>{formatDate(session.expiresAt)}</td>
                <td>
                  {!session.current && (
                    <Button
                      size="sm"
                      variant="dangerOutline"
                      loading={revokingId === session.id}
                      onClick={() => void handleRevoke(session.id)}
                    >
                      Revoke
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </section>
  );
}

function LogoutAllCard() {
  const router = useRouter();
  const { logoutAll } = useAuth();
  const [submitting, setSubmitting] = useState(false);

  async function handleLogoutAll() {
    setSubmitting(true);
    await logoutAll();
    router.replace("/login");
  }

  return (
    <section className={styles.card} aria-labelledby="logout-all-heading">
      <h2 id="logout-all-heading" className={styles.cardTitle}>
        Sign out everywhere
      </h2>
      <p className={styles.cardDescription}>
        Ends every active session, including this one. You&apos;ll need to sign
        in again.
      </p>
      <Button
        variant="dangerOutline"
        loading={submitting}
        onClick={() => void handleLogoutAll()}
      >
        Sign out of all sessions
      </Button>
    </section>
  );
}

export default function SecuritySettingsPage() {
  return (
    <div className={styles.stack}>
      <ChangePasswordCard />
      <SessionsCard />
      <LogoutAllCard />
    </div>
  );
}
