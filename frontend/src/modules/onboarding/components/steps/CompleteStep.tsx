"use client";

import { useState } from "react";
import { ROLE_LABELS } from "../../constants";
import { useOnboarding } from "../../OnboardingProvider";
import { OnboardingShell } from "../OnboardingShell";
import styles from "../../onboarding.module.css";

const TYPE_LABELS: Record<string, string> = {
  PERSONAL: "Cá nhân",
  ORGANIZATION: "Tổ chức",
};

export function CompleteStep() {
  const { workspace, onboarding, finish, saving } = useOnboarding();
  const [error, setError] = useState<string | null>(null);

  async function handleFinish() {
    setError(null);
    const result = await finish();

    if (!result.ok) {
      setError(result.message ?? "Không thể hoàn tất thiết lập");
    }
  }

  return (
    <OnboardingShell
      onboardingType={onboarding.onboardingType}
      step="complete"
      title="Mọi thứ đã sẵn sàng!"
      description="Bạn đã hoàn tất các bước thiết lập ban đầu."
    >
      <div className={styles.form}>
        {error && <div className={styles.error}>{error}</div>}

        <div className={styles.celebrate}>
          <span className={styles.celebrateIcon} aria-hidden>
            🎉
          </span>
        </div>

        <div className={styles.summaryList}>
          <div className={styles.summaryRow}>
            <span>Không gian làm việc</span>
            <strong>{workspace.name}</strong>
          </div>
          <div className={styles.summaryRow}>
            <span>Loại</span>
            <strong>{TYPE_LABELS[workspace.type] ?? workspace.type}</strong>
          </div>
          <div className={styles.summaryRow}>
            <span>Vai trò</span>
            <strong>{ROLE_LABELS[workspace.roleKey] ?? workspace.roleKey}</strong>
          </div>
        </div>

        <button
          type="button"
          className={styles.primaryButton}
          onClick={handleFinish}
          disabled={saving}
        >
          {saving ? "Đang hoàn tất..." : "Vào bảng điều khiển"}
        </button>
      </div>
    </OnboardingShell>
  );
}
