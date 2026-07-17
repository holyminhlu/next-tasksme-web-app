"use client";

import { useState, type FormEvent } from "react";
import { hasPermission, useAuth } from "@/modules/auth";
import * as onboardingService from "../../onboarding.service";
import { useOnboarding } from "../../OnboardingProvider";
import {
  normalizeTaskTitles,
  validateFirstProject,
} from "../../validation";
import { nextStep, onboardingStepUrl } from "../../steps";
import { OnboardingShell } from "../OnboardingShell";
import { StepActions } from "../StepActions";
import styles from "../../onboarding.module.css";
import { useRouter } from "next/navigation";

export function FirstProjectStep() {
  const router = useRouter();
  const { workspace, onboarding, template, advance, goBack, saving, reload } =
    useOnboarding();
  const { permissions } = useAuth();
  const canCreate = hasPermission(permissions, "projects:create");

  const [name, setName] = useState(template?.projectName ?? "");
  const [taskTitles, setTaskTitles] = useState<string[]>(
    template && template.taskTitles.length > 0
      ? [...template.taskTitles]
      : [""],
  );
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function updateTask(index: number, value: string) {
    setTaskTitles((current) =>
      current.map((title, i) => (i === index ? value : title)),
    );
  }

  function removeTask(index: number) {
    setTaskTitles((current) => current.filter((_, i) => i !== index));
  }

  function addTask() {
    setTaskTitles((current) =>
      current.length >= 20 ? current : [...current, ""],
    );
  }

  async function handleSkip() {
    setError(null);
    const result = await advance("first_project");

    if (!result.ok) {
      setError(result.message ?? "Không thể bỏ qua bước này");
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!canCreate) {
      await handleSkip();
      return;
    }

    const validationError = validateFirstProject({ name, taskTitles });
    if (validationError) {
      setError(validationError);
      return;
    }

    setSubmitting(true);

    const result = await onboardingService.createFirstProject(workspace.id, {
      name: name.trim(),
      tasks: normalizeTaskTitles(taskTitles).map((title) => ({ title })),
    });

    if (!result.success) {
      setError(result.error.message);
      setSubmitting(false);
      return;
    }

    // The backend marks first_project completed and advances currentStep.
    await reload();
    setSubmitting(false);

    const next = nextStep(onboarding.onboardingType, "first_project");
    if (next) {
      router.push(onboardingStepUrl(next));
    }
  }

  return (
    <OnboardingShell
      onboardingType={onboarding.onboardingType}
      step="first_project"
      title="Tạo dự án đầu tiên"
      description={
        canCreate
          ? "Đặt tên dự án và thêm vài công việc để bắt đầu ngay."
          : "Bạn chưa có quyền tạo dự án trong không gian làm việc này. Hãy bỏ qua bước này."
      }
    >
      <form className={styles.form} onSubmit={handleSubmit}>
        {error && <div className={styles.error}>{error}</div>}

        {canCreate ? (
          <>
            <div className={styles.field}>
              <label htmlFor="projectName">Tên dự án</label>
              <input
                id="projectName"
                name="projectName"
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
                minLength={2}
                maxLength={120}
                placeholder="Ví dụ: Kế hoạch quý 3"
                autoFocus
              />
            </div>

            <div className={styles.field}>
              <label>Công việc đầu tiên (không bắt buộc)</label>
              <div className={styles.taskList}>
                {taskTitles.map((title, index) => (
                  <div key={index} className={styles.taskRow}>
                    <input
                      value={title}
                      onChange={(event) => updateTask(index, event.target.value)}
                      maxLength={200}
                      placeholder={`Công việc ${index + 1}`}
                      aria-label={`Công việc ${index + 1}`}
                    />
                    <button
                      type="button"
                      className={styles.removeTask}
                      onClick={() => removeTask(index)}
                      aria-label={`Xóa công việc ${index + 1}`}
                    >
                      ✕
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  className={styles.addTask}
                  onClick={addTask}
                >
                  + Thêm công việc
                </button>
              </div>
            </div>

            <StepActions
              onBack={() => goBack("first_project")}
              onSkip={handleSkip}
              skipLabel="Bỏ qua bước này"
              submitLabel="Tạo dự án"
              submittingLabel="Đang tạo..."
              submitting={submitting || saving}
            />
          </>
        ) : (
          <StepActions
            onBack={() => goBack("first_project")}
            onSkip={handleSkip}
            skipLabel="Bỏ qua bước này"
            submitLabel="Tiếp tục"
            submitting={saving}
          />
        )}
      </form>
    </OnboardingShell>
  );
}
