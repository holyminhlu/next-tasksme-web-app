"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import {
  ArrowRight,
  BriefcaseBusiness,
  Check,
  UserRound,
} from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
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
      <div className={styles.welcomeShell}>
        <header className={styles.welcomeHeader}>
          <BrandLogo size="large" priority />
          <span className={styles.setupLabel}>Thiết lập ban đầu</span>
        </header>

        <main className={styles.welcomeMain}>
          <div className={styles.welcomeIntro}>
            <p className={styles.eyebrow}>Bắt đầu hành trình của bạn</p>
            <h1>Bạn sẽ dùng TaskMng như thế nào?</h1>
            <p>
              Chọn cách phù hợp nhất. Bạn luôn có thể tạo thêm không gian làm
              việc khác sau này.
            </p>
          </div>

          <form className={styles.welcomeForm} onSubmit={handleSubmit}>
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
                <span className={styles.usageTypeIcon} aria-hidden="true">
                  <UserRound size={30} />
                </span>
                <div>
                  <strong>Sử dụng cá nhân</strong>
                  <span>
                    Công việc cá nhân, học tập, freelance hoặc quản lý mục tiêu.
                  </span>
                </div>
                <span className={styles.optionCheck}>
                  {type === "PERSONAL" && <Check size={16} />}
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
                <span className={styles.usageTypeIcon} aria-hidden="true">
                  <BriefcaseBusiness size={30} />
                </span>
                <div>
                  <strong>Nhóm hoặc doanh nghiệp</strong>
                  <span>
                    Cộng tác cùng đồng nghiệp, phân quyền và quản lý dự án.
                  </span>
                </div>
                <span className={styles.optionCheck}>
                  {type === "ORGANIZATION" && <Check size={16} />}
                </span>
              </button>
            </div>

            <button
              type="submit"
              className={styles.primaryButton}
              disabled={submitting}
            >
              {submitting ? (
                "Đang tạo không gian làm việc..."
              ) : (
                <>
                  Tiếp tục <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>
        </main>
      </div>
    </div>
  );
}
