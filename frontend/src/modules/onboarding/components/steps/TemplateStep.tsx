"use client";

import { useState, type FormEvent } from "react";
import { PROJECT_TEMPLATES } from "../../constants";
import { useOnboarding } from "../../OnboardingProvider";
import { OnboardingShell } from "../OnboardingShell";
import { StepActions } from "../StepActions";
import styles from "../../onboarding.module.css";

export function TemplateStep() {
  const { onboarding, template, selectTemplate, advance, goBack, saving } =
    useOnboarding();
  const [selectedKey, setSelectedKey] = useState<string>(
    template?.key ?? "blank",
  );
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    selectTemplate(selectedKey);

    const result = await advance("template");

    if (!result.ok) {
      setError(result.message ?? "Không lưu được lựa chọn mẫu");
    }
  }

  return (
    <OnboardingShell
      onboardingType={onboarding.onboardingType}
      step="template"
      title="Chọn mẫu khởi đầu"
      description="Bắt đầu với dự án mẫu hoặc một không gian trống hoàn toàn."
    >
      <form className={styles.form} onSubmit={handleSubmit}>
        {error && <div className={styles.error}>{error}</div>}

        <div
          className={styles.optionGrid}
          role="radiogroup"
          aria-label="Mẫu khởi đầu"
        >
          {PROJECT_TEMPLATES.map((option) => (
            <button
              key={option.key}
              type="button"
              role="radio"
              aria-checked={selectedKey === option.key}
              className={`${styles.optionCard} ${
                selectedKey === option.key ? styles.optionCardSelected : ""
              }`}
              onClick={() => setSelectedKey(option.key)}
            >
              <strong>{option.name}</strong>
              <span>{option.description}</span>
              {option.taskTitles.length > 0 && (
                <span>Gồm {option.taskTitles.length} công việc mẫu</span>
              )}
            </button>
          ))}
        </div>

        <StepActions
          onBack={() => goBack("template")}
          submitLabel="Tiếp tục"
          submitting={saving}
        />
      </form>
    </OnboardingShell>
  );
}
