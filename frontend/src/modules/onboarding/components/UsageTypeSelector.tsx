"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useAuth, type WorkspaceType } from "@/modules/auth";
import * as onboardingService from "../onboarding.service";
import { onboardingStepUrl } from "../steps";
import {
  buildCreateWorkspacePayload,
  validateUsageType,
} from "../validation";
import styles from "../onboarding.module.css";

export function UsageTypeSelector() {
  const router = useRouter();
  const { selectWorkspace } = useAuth();
  const [type, setType] = useState<WorkspaceType | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const validationError = validateUsageType({ type });
    if (validationError || !type) {
      setError(validationError);
      return;
    }

    setSubmitting(true);

    const createResult = await onboardingService.createWorkspace(
      buildCreateWorkspacePayload(type),
    );

    if (!createResult.success) {
      setError(createResult.error.message);
      setSubmitting(false);
      return;
    }

    const selectResult = await selectWorkspace(createResult.data.id);

    if (!selectResult.ok) {
      setError(selectResult.message ?? "Không chọn được không gian làm việc");
      setSubmitting(false);
      return;
    }

    router.replace(onboardingStepUrl(createResult.data.onboarding.currentStep));
  }

  return (
    <div className={styles.page}>
      <div className={styles.shell}>
        <p className={styles.eyebrow}>TaskMng SME · Thiết lập ban đầu</p>

        <section className={styles.card}>
          <div className={styles.cardHeader}>
            <h1>Bạn sẽ dùng TaskMng như thế nào?</h1>
            <p>
              Lựa chọn này giúp chúng tôi thiết lập không gian làm việc phù hợp
              với bạn.
            </p>
          </div>

          <form className={styles.form} onSubmit={handleSubmit}>
            {error && <div className={styles.error}>{error}</div>}

            <div
              className={styles.usageTypeGrid}
              role="radiogroup"
              aria-label="Hình thức sử dụng"
            >
              <button
                type="button"
                role="radio"
                aria-checked={type === "PERSONAL"}
                className={`${styles.usageTypeCard} ${
                  type === "PERSONAL" ? styles.usageTypeCardSelected : ""
                }`}
                onClick={() => setType("PERSONAL")}
              >
                <span className={styles.usageTypeIcon} aria-hidden>
                  👤
                </span>
                <strong>Sử dụng cá nhân</strong>
                <span>
                  Quản lý công việc, dự án và mục tiêu của riêng bạn.
                </span>
              </button>

              <button
                type="button"
                role="radio"
                aria-checked={type === "ORGANIZATION"}
                className={`${styles.usageTypeCard} ${
                  type === "ORGANIZATION" ? styles.usageTypeCardSelected : ""
                }`}
                onClick={() => setType("ORGANIZATION")}
              >
                <span className={styles.usageTypeIcon} aria-hidden>
                  🏢
                </span>
                <strong>Cho công ty / đội nhóm</strong>
                <span>
                  Cộng tác cùng đồng nghiệp, phân quyền và quản lý thành viên.
                </span>
              </button>
            </div>

            <button
              type="submit"
              className={styles.primaryButton}
              disabled={submitting}
            >
              {submitting ? "Đang tạo không gian làm việc..." : "Tiếp tục"}
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
