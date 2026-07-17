import type { ReactNode } from "react";
import { STEP_TITLES } from "../constants";
import type { OnboardingType } from "../onboarding.types";
import { stepProgress } from "../steps";
import styles from "../onboarding.module.css";

type OnboardingShellProps = {
  onboardingType: OnboardingType;
  step: string;
  title: string;
  description?: string;
  children: ReactNode;
};

export function OnboardingShell({
  onboardingType,
  step,
  title,
  description,
  children,
}: OnboardingShellProps) {
  const progress = stepProgress(onboardingType, step);

  return (
    <div className={styles.page}>
      <div className={styles.shell}>
        <p className={styles.eyebrow}>TaskMng SME · Thiết lập ban đầu</p>

        <div className={styles.progressWrap}>
          <div className={styles.progressMeta}>
            <span>
              Bước <strong>{progress.index + 1}</strong> / {progress.total}
              {" · "}
              {STEP_TITLES[step] ?? step}
            </span>
            <span>{progress.percent}%</span>
          </div>
          <div className={styles.progressTrack}>
            <div
              className={styles.progressFill}
              style={{ width: `${progress.percent}%` }}
            />
          </div>
        </div>

        <section className={styles.card}>
          <div className={styles.cardHeader}>
            <h1>{title}</h1>
            {description && <p>{description}</p>}
          </div>
          {children}
        </section>
      </div>
    </div>
  );
}
