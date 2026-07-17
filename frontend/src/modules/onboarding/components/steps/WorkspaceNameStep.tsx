"use client";

import { useState, type FormEvent } from "react";
import {
  LayoutDashboard,
  PencilLine,
  Sparkles,
} from "lucide-react";
import { useOnboarding } from "../../OnboardingProvider";
import { validateWorkspaceName } from "../../validation";
import { OnboardingShell } from "../OnboardingShell";
import { StepActions } from "../StepActions";
import styles from "../../onboarding.module.css";

export function WorkspaceNameStep() {
  const { workspace, onboarding, advance, saving } = useOnboarding();
  const [name, setName] = useState(workspace.name);
  const [error, setError] = useState<string | null>(null);
  const suggestions = [
    workspace.name,
    "Không gian cá nhân",
    "Công việc của tôi",
    "Mục tiêu của tôi",
  ].filter((item, index, items) => items.indexOf(item) === index);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const validationError = validateWorkspaceName(name);
    if (validationError) {
      setError(validationError);
      return;
    }

    const result = await advance("workspace_name", {
      workspace: { name: name.trim() },
    });

    if (!result.ok) {
      setError(result.message ?? "Không lưu được tên không gian làm việc");
    }
  }

  return (
    <OnboardingShell
      onboardingType={onboarding.onboardingType}
      step="workspace_name"
      title="Đặt tên không gian làm việc"
      description="Đây là nơi tập trung dự án, công việc và mục tiêu của bạn. Hãy chọn một cái tên gần gũi, dễ nhận biết."
    >
      <form className={styles.form} onSubmit={handleSubmit}>
        {error && <div className={styles.error}>{error}</div>}

        <div className={styles.workspaceNameLayout}>
          <div className={styles.workspaceNameEditor}>
            <div className={styles.field}>
              <label htmlFor="workspaceName">
                <PencilLine size={16} aria-hidden="true" />
                Tên không gian làm việc
              </label>
              <div className={styles.inputWithIcon}>
                <LayoutDashboard size={20} aria-hidden="true" />
                <input
                  id="workspaceName"
                  name="workspaceName"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Ví dụ: Không gian của Minh"
                  required
                  minLength={2}
                  maxLength={120}
                  autoFocus
                />
                <span className={styles.characterCount}>{name.length}/120</span>
              </div>
            </div>

            <div className={styles.suggestionGroup}>
              <span>
                <Sparkles size={15} aria-hidden="true" />
                Gợi ý nhanh
              </span>
              <div className={styles.suggestionList}>
                {suggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    className={`${styles.suggestionChip} ${
                      name === suggestion ? styles.suggestionChipActive : ""
                    }`}
                    onClick={() => setName(suggestion)}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          </div>

        </div>

        <StepActions submitLabel="Lưu tên và tiếp tục" submitting={saving} />
      </form>
    </OnboardingShell>
  );
}
