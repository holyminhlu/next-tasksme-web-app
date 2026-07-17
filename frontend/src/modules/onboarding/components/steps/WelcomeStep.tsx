"use client";

import { useState, type FormEvent } from "react";
import { useAuth } from "@/modules/auth";
import { ROLE_LABELS } from "../../constants";
import { useOnboarding } from "../../OnboardingProvider";
import { OnboardingShell } from "../OnboardingShell";
import { StepActions } from "../StepActions";
import styles from "../../onboarding.module.css";

export function WelcomeStep() {
  const { workspace, onboarding, advance, saving } = useOnboarding();
  const { user } = useAuth();
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const result = await advance("welcome");

    if (!result.ok) {
      setError(result.message ?? "Không thể tiếp tục");
    }
  }

  return (
    <OnboardingShell
      onboardingType={onboarding.onboardingType}
      step="welcome"
      title={`Chào mừng${user?.fullName ? ` ${user.fullName}` : ""}!`}
      description="Bạn vừa tham gia một không gian làm việc mới. Hãy dành một phút để làm quen."
    >
      <form className={styles.form} onSubmit={handleSubmit}>
        {error && <div className={styles.error}>{error}</div>}

        <div className={styles.summaryList}>
          <div className={styles.summaryRow}>
            <span>Không gian làm việc</span>
            <strong>{workspace.name}</strong>
          </div>
          <div className={styles.summaryRow}>
            <span>Vai trò của bạn</span>
            <strong>{ROLE_LABELS[workspace.roleKey] ?? workspace.roleKey}</strong>
          </div>
        </div>

        <p className={styles.muted}>
          Trong các bước tiếp theo, bạn sẽ xem lại hồ sơ cá nhân và tìm hiểu
          những gì bạn có thể làm trong không gian làm việc này.
        </p>

        <StepActions submitLabel="Bắt đầu" submitting={saving} />
      </form>
    </OnboardingShell>
  );
}
