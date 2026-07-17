"use client";

import { useState, type FormEvent } from "react";
import { useOnboarding } from "../../OnboardingProvider";
import { validateWorkspaceName } from "../../validation";
import { OnboardingShell } from "../OnboardingShell";
import { StepActions } from "../StepActions";
import styles from "../../onboarding.module.css";

export function WorkspaceNameStep() {
  const { workspace, onboarding, advance, saving } = useOnboarding();
  const [name, setName] = useState(workspace.name);
  const [error, setError] = useState<string | null>(null);

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
      description="Tên này sẽ hiển thị trên bảng điều khiển của bạn. Bạn có thể đổi lại bất cứ lúc nào."
    >
      <form className={styles.form} onSubmit={handleSubmit}>
        {error && <div className={styles.error}>{error}</div>}

        <div className={styles.field}>
          <label htmlFor="workspaceName">Tên không gian làm việc</label>
          <input
            id="workspaceName"
            name="workspaceName"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            minLength={2}
            maxLength={120}
            autoFocus
          />
        </div>

        <p className={styles.hint}>
          Gợi ý: dùng tên của bạn hoặc mục tiêu chính, ví dụ &ldquo;Công việc của
          Minh&rdquo;.
        </p>

        <StepActions submitLabel="Tiếp tục" submitting={saving} />
      </form>
    </OnboardingShell>
  );
}
