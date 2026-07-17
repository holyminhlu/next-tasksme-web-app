"use client";

import { useState, type FormEvent } from "react";
import { useAuth } from "@/modules/auth";
import { useOnboarding } from "../../OnboardingProvider";
import { OnboardingShell } from "../OnboardingShell";
import { StepActions } from "../StepActions";
import styles from "../../onboarding.module.css";

export function ProfileStep() {
  const { onboarding, advance, goBack, saving } = useOnboarding();
  const { user } = useAuth();
  const [notifyEmail, setNotifyEmail] = useState(true);
  const [notifyDigest, setNotifyDigest] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const result = await advance("profile");

    if (!result.ok) {
      setError(result.message ?? "Không thể tiếp tục");
    }
  }

  return (
    <OnboardingShell
      onboardingType={onboarding.onboardingType}
      step="profile"
      title="Hồ sơ và thông báo"
      description="Kiểm tra thông tin cá nhân và chọn cách bạn muốn nhận thông báo."
    >
      <form className={styles.form} onSubmit={handleSubmit}>
        {error && <div className={styles.error}>{error}</div>}

        <div className={styles.summaryList}>
          <div className={styles.summaryRow}>
            <span>Họ và tên</span>
            <strong>{user?.fullName}</strong>
          </div>
          <div className={styles.summaryRow}>
            <span>Email</span>
            <strong>{user?.email}</strong>
          </div>
        </div>

        <div className={styles.field}>
          <label>Thông báo</label>

          <div className={styles.moduleRow}>
            <div className={styles.moduleInfo}>
              <strong>Email khi được giao việc</strong>
              <span>Nhận email khi có công việc mới giao cho bạn</span>
            </div>
            <label className={styles.switch}>
              <input
                type="checkbox"
                checked={notifyEmail}
                onChange={(event) => setNotifyEmail(event.target.checked)}
                aria-label="Email khi được giao việc"
              />
              <span className={styles.switchTrack} />
            </label>
          </div>

          <div className={styles.moduleRow}>
            <div className={styles.moduleInfo}>
              <strong>Tóm tắt hằng tuần</strong>
              <span>Email tổng hợp tiến độ mỗi tuần</span>
            </div>
            <label className={styles.switch}>
              <input
                type="checkbox"
                checked={notifyDigest}
                onChange={(event) => setNotifyDigest(event.target.checked)}
                aria-label="Tóm tắt hằng tuần"
              />
              <span className={styles.switchTrack} />
            </label>
          </div>

          <p className={styles.hint}>
            Tùy chọn thông báo sẽ được đồng bộ với máy chủ trong phiên bản sau.
          </p>
        </div>

        <StepActions
          onBack={() => goBack("profile")}
          submitLabel="Tiếp tục"
          submitting={saving}
        />
      </form>
    </OnboardingShell>
  );
}
