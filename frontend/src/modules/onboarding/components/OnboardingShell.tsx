import type { ReactNode } from "react";
import { Check } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { STEP_TITLES } from "../constants";
import type { OnboardingType } from "../onboarding.types";
import { ONBOARDING_FLOWS, stepProgress } from "../steps";
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
  const steps = ONBOARDING_FLOWS[onboardingType];

  return (
    <div className={styles.page}>
      <div className={styles.shell}>
        <aside className={styles.onboardingAside}>
          <BrandLogo size="default" priority />

          <div className={styles.progressWrap}>
            <div className={styles.progressMeta}>
              <span>Thiết lập không gian</span>
              <strong>{progress.percent}%</strong>
            </div>
            <div className={styles.progressTrack}>
              <div
                className={styles.progressFill}
                style={{ width: `${progress.percent}%` }}
              />
            </div>
          </div>

          <ol className={styles.stepList}>
            {steps.map((stepId, index) => {
              const isDone = index < progress.index;
              const isCurrent = index === progress.index;
              return (
                <li
                  key={stepId}
                  className={`${styles.stepItem} ${
                    isCurrent ? styles.stepItemCurrent : ""
                  } ${isDone ? styles.stepItemDone : ""}`}
                >
                  <span className={styles.stepDot}>
                    {isDone ? <Check size={14} /> : index + 1}
                  </span>
                  <span>{STEP_TITLES[stepId] ?? stepId}</span>
                </li>
              );
            })}
          </ol>
        </aside>

        <main className={styles.onboardingMain}>
          <p className={styles.eyebrow}>
            Bước {progress.index + 1} / {progress.total}
          </p>
          <div className={styles.cardHeader}>
            <h1>{title}</h1>
            {description && <p>{description}</p>}
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}
