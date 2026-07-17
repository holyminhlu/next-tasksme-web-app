"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { get } from "@/lib/api/client";
import {
  Can,
  useAuth,
  type WorkspaceMemberSummary,
} from "@/modules/auth";
import { onboardingService } from "@/modules/onboarding";
import styles from "@/modules/auth/auth.module.css";

const INVITABLE_ROLES = ["admin", "manager", "member"] as const;

export default function MembersPage() {
  const router = useRouter();
  const { selectedWorkspace } = useAuth();

  const [members, setMembers] = useState<WorkspaceMemberSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<string>("member");
  const [submitting, setSubmitting] = useState(false);

  const isPersonal = selectedWorkspace?.type === "PERSONAL";

  useEffect(() => {
    // Members are an organization feature; personal workspaces have none.
    if (isPersonal) {
      router.replace("/dashboard");
    }
  }, [isPersonal, router]);

  useEffect(() => {
    if (!selectedWorkspace || isPersonal) {
      return;
    }

    let cancelled = false;

    (async () => {
      setLoading(true);
      const result = await get<WorkspaceMemberSummary[]>(
        `/workspaces/${selectedWorkspace.id}/members`,
      );

      if (cancelled) {
        return;
      }

      if (!result.success) {
        setError(result.error.message);
      } else {
        setMembers(result.data);
        setError(null);
      }
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedWorkspace, isPersonal]);

  async function handleInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedWorkspace) {
      return;
    }

    setSubmitting(true);
    setError(null);
    setMessage(null);

    const result = await onboardingService.inviteMember(selectedWorkspace.id, {
      email: inviteEmail.trim().toLowerCase(),
      roleKey: inviteRole,
    });

    setSubmitting(false);

    if (!result.success) {
      setError(result.error.message);
      return;
    }

    setMessage(`Invitation sent to ${result.data.email}`);
    setInviteEmail("");
  }

  if (!selectedWorkspace || isPersonal) {
    return <div className={styles.loading}>Redirecting...</div>;
  }

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <h1>Members</h1>
        <p>People in {selectedWorkspace.name}</p>
      </div>

      <div className={styles.form}>
        {error && <div className={styles.error}>{error}</div>}
        {message && <div className={styles.success}>{message}</div>}

        <Can permission="members:invite">
          <form className={styles.form} onSubmit={handleInvite}>
            <div className={styles.field}>
              <label htmlFor="inviteEmail">Invite by email</label>
              <input
                id="inviteEmail"
                name="inviteEmail"
                type="email"
                value={inviteEmail}
                onChange={(event) => setInviteEmail(event.target.value)}
                required
                placeholder="teammate@company.com"
              />
            </div>

            <div className={styles.field}>
              <label htmlFor="inviteRole">Role</label>
              <select
                id="inviteRole"
                name="inviteRole"
                value={inviteRole}
                onChange={(event) => setInviteRole(event.target.value)}
              >
                {INVITABLE_ROLES.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              className={styles.primaryButton}
              disabled={submitting}
            >
              {submitting ? "Sending..." : "Send invitation"}
            </button>
          </form>
        </Can>

        {loading ? (
          <p className={styles.muted}>Loading members...</p>
        ) : (
          <div className={styles.workspaceList}>
            {members.map((member) => (
              <div key={member.id} className={styles.workspaceOption}>
                <div>
                  <strong>{member.user.fullName}</strong>
                  <span>{member.user.email}</span>
                </div>
                <span>{member.role.key}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
