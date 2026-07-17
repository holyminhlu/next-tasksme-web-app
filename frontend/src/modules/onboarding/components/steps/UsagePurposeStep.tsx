"use client";

import { useState, type FormEvent } from "react";
import { USAGE_PURPOSES } from "../../constants";
import { useOnboarding } from "../../OnboardingProvider";
import { validateUsagePurpose } from "../../validation";
import { OnboardingShell } from "../OnboardingShell";
import { StepActions } from "../StepActions";
import styles from "../../onboarding.module.css";

export function UsagePurposeStep() {
  const { onboarding, advance, goBack, saving } = useOnboarding();
  const [purpose, setPurpose] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const validationError = validateUsagePurpose(purpose);
    if (validationError) {
      setError(validationError);
      return;
    }

    const result = await advance("usage_purpose", {
      workspace: { usagePurpose: purpose },
    });

    if (!result.ok) {
      setError(result.message ?? "Không lưu được mục đích sử dụng");
    }
  }

  return (
    <OnboardingShell
      onboardingType={onboarding.onboardingType}
      step="usage_purpose"
      title="Bạn dùng TaskMng cho việc gì?"
      description="Chúng tôi sẽ gợi ý cấu hình phù hợp với mục đích của bạn."
    >
      <form className={styles.form} onSubmit={handleSubmit}>
        {error && <div className={styles.error}>{error}</div>}

        <div className={styles.optionGrid} role="radiogroup" aria-label="Mục đích sử dụng">
          {USAGE_PURPOSES.map((option) => (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={purpose === option.value}
              className={`${styles.optionCard} ${
                purpose === option.value ? styles.optionCardSelected : ""
              }`}
              onClick={() => setPurpose(option.value)}
            >
              <strong>{option.label}</strong>
            </button>
          ))}
        </div>

        <StepActions
          onBack={() => goBack("usage_purpose")}
          submitLabel="Tiếp tục"
          submitting={saving}
        />
      </form>
    </OnboardingShell>
  );
}
