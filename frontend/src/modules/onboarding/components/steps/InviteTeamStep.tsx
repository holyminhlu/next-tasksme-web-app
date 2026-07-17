"use client";

import { useState, type FormEvent } from "react";
import { hasPermission, useAuth } from "@/modules/auth";
import { ROLE_LABELS } from "../../constants";
import * as onboardingService from "../../onboarding.service";
import type { InvitationRecord } from "../../onboarding.types";
import { useOnboarding } from "../../OnboardingProvider";
import { validateInviteEmail } from "../../validation";
import { OnboardingShell } from "../OnboardingShell";
import styles from "../../onboarding.module.css";

const INVITABLE_ROLES = ["admin", "manager", "member"] as const;

export function InviteTeamStep() {
  const { workspace, onboarding, advance, goBack, saving } = useOnboarding();
  const { permissions } = useAuth();
  const canInvite = hasPermission(permissions, "members:invite");

  const [email, setEmail] = useState("");
  const [roleKey, setRoleKey] = useState<string>("member");
  const [sent, setSent] = useState<InvitationRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const validationError = validateInviteEmail(email);
    if (validationError) {
      setError(validationError);
      return;
    }

    setSubmitting(true);

    const result = await onboardingService.inviteMember(workspace.id, {
      email: email.trim().toLowerCase(),
      roleKey,
    });

    setSubmitting(false);

    if (!result.success) {
      setError(result.error.message);
      return;
    }

    setSent((current) => [...current, result.data]);
    setEmail("");
  }

  async function handleContinue() {
    setError(null);
    const result = await advance("invite_team");

    if (!result.ok) {
      setError(result.message ?? "Không thể chuyển sang bước tiếp theo");
    }
  }

  return (
    <OnboardingShell
      onboardingType={onboarding.onboardingType}
      step="invite_team"
      title="Mời đồng nghiệp tham gia"
      description={
        canInvite
          ? "Gửi lời mời qua email. Bạn cũng có thể mời thêm thành viên sau."
          : "Bạn chưa có quyền mời thành viên trong không gian làm việc này."
      }
    >
      <div className={styles.form}>
        {error && <div className={styles.error}>{error}</div>}

        {canInvite && (
          <form className={styles.form} onSubmit={handleInvite}>
            <div className={styles.fieldRow}>
              <div className={styles.field}>
                <label htmlFor="inviteEmail">Email đồng nghiệp</label>
                <input
                  id="inviteEmail"
                  name="inviteEmail"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="ten@congty.vn"
                />
              </div>

              <div className={styles.field}>
                <label htmlFor="inviteRole">Vai trò</label>
                <select
                  id="inviteRole"
                  name="inviteRole"
                  value={roleKey}
                  onChange={(event) => setRoleKey(event.target.value)}
                >
                  {INVITABLE_ROLES.map((role) => (
                    <option key={role} value={role}>
                      {ROLE_LABELS[role] ?? role}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <button
              type="submit"
              className={styles.secondaryButton}
              disabled={submitting}
            >
              {submitting ? "Đang gửi..." : "Gửi lời mời"}
            </button>
          </form>
        )}

        {sent.length > 0 && (
          <div className={styles.inviteList}>
            {sent.map((invitation) => (
              <div key={invitation.id} className={styles.inviteRow}>
                <strong>{invitation.email}</strong>
                <span>
                  {ROLE_LABELS[invitation.roleKey] ?? invitation.roleKey} · Đã
                  gửi
                </span>
              </div>
            ))}
          </div>
        )}

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={() => goBack("invite_team")}
            disabled={saving}
          >
            Quay lại
          </button>
          <div className={styles.actionsRight}>
            <button
              type="button"
              className={styles.primaryButton}
              onClick={handleContinue}
              disabled={saving}
            >
              {saving
                ? "Đang lưu..."
                : sent.length > 0
                  ? "Tiếp tục"
                  : "Bỏ qua và tiếp tục"}
            </button>
          </div>
        </div>
      </div>
    </OnboardingShell>
  );
}
