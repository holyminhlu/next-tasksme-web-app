"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "@/modules/auth";
import { hasPermission } from "@/modules/auth";
import { MODULE_LABELS } from "../../constants";
import * as onboardingService from "../../onboarding.service";
import type { WorkspaceModule } from "../../onboarding.types";
import { useOnboarding } from "../../OnboardingProvider";
import { OnboardingShell } from "../OnboardingShell";
import { StepActions } from "../StepActions";
import styles from "../../onboarding.module.css";

export function ModulesStep() {
  const { workspace, onboarding, advance, goBack, saving } = useOnboarding();
  const { permissions } = useAuth();
  const canManage = hasPermission(permissions, "modules:manage");

  const [modules, setModules] = useState<WorkspaceModule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const result = await onboardingService.listModules(workspace.id);

      if (cancelled) {
        return;
      }

      if (!result.success) {
        setError(result.error.message);
      } else {
        setModules(result.data);
      }
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [workspace.id]);

  function toggleModule(moduleKey: string) {
    setModules((current) =>
      current.map((module) =>
        module.moduleKey === moduleKey && !module.core
          ? { ...module, enabled: !module.enabled }
          : module,
      ),
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    if (canManage && modules.length > 0) {
      const result = await onboardingService.updateModules(workspace.id, {
        modules: modules.map((module) => ({
          moduleKey: module.moduleKey,
          enabled: module.enabled,
        })),
      });

      if (!result.success) {
        setError(result.error.message);
        setSubmitting(false);
        return;
      }
    }

    const advanceResult = await advance("modules");
    setSubmitting(false);

    if (!advanceResult.ok) {
      setError(advanceResult.message ?? "Không lưu được lựa chọn tính năng");
    }
  }

  return (
    <OnboardingShell
      onboardingType={onboarding.onboardingType}
      step="modules"
      title="Chọn tính năng bạn cần"
      description={
        canManage
          ? "Bật các tính năng phù hợp với cách làm việc của bạn. Có thể thay đổi sau trong phần cài đặt."
          : "Danh sách tính năng đang bật cho không gian làm việc này. Chỉ quản trị viên mới có thể thay đổi."
      }
    >
      <form className={styles.form} onSubmit={handleSubmit}>
        {error && <div className={styles.error}>{error}</div>}

        {loading ? (
          <p className={styles.muted}>Đang tải danh sách tính năng...</p>
        ) : (
          <div className={styles.optionGrid}>
            {modules.map((module) => {
              const label = MODULE_LABELS[module.moduleKey];
              const disabled = module.core || !canManage;

              return (
                <div
                  key={module.moduleKey}
                  className={`${styles.moduleRow} ${
                    disabled && !module.enabled ? styles.moduleRowDisabled : ""
                  }`}
                >
                  <div className={styles.moduleInfo}>
                    <strong>
                      {label?.name ?? module.name}
                      {module.core && (
                        <span className={styles.coreBadge}>Cốt lõi</span>
                      )}
                    </strong>
                    <span>{label?.description ?? module.description}</span>
                  </div>
                  <label className={styles.switch}>
                    <input
                      type="checkbox"
                      checked={module.enabled}
                      disabled={disabled}
                      onChange={() => toggleModule(module.moduleKey)}
                      aria-label={label?.name ?? module.name}
                    />
                    <span className={styles.switchTrack} />
                  </label>
                </div>
              );
            })}
          </div>
        )}

        <StepActions
          onBack={() => goBack("modules")}
          submitLabel="Tiếp tục"
          submitting={submitting || saving}
        />
      </form>
    </OnboardingShell>
  );
}
