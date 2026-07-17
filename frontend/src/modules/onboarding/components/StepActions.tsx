"use client";

import styles from "../onboarding.module.css";

type StepActionsProps = {
  onBack?: () => void;
  onSkip?: () => void;
  skipLabel?: string;
  submitLabel: string;
  submittingLabel?: string;
  submitting?: boolean;
};

export function StepActions({
  onBack,
  onSkip,
  skipLabel = "Bỏ qua",
  submitLabel,
  submittingLabel = "Đang lưu...",
  submitting = false,
}: StepActionsProps) {
  return (
    <div className={styles.actions}>
      <div>
        {onBack && (
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={onBack}
            disabled={submitting}
          >
            Quay lại
          </button>
        )}
      </div>
      <div className={styles.actionsRight}>
        {onSkip && (
          <button
            type="button"
            className={styles.linkButton}
            onClick={onSkip}
            disabled={submitting}
          >
            {skipLabel}
          </button>
        )}
        <button
          type="submit"
          className={styles.primaryButton}
          disabled={submitting}
        >
          {submitting ? submittingLabel : submitLabel}
        </button>
      </div>
    </div>
  );
}
