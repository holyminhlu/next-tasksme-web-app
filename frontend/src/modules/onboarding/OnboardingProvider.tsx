"use client";

import { useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useAuth, type WorkspaceSummary } from "@/modules/auth";
import { PROJECT_TEMPLATES } from "./constants";
import * as onboardingService from "./onboarding.service";
import type {
  OnboardingRecord,
  ProjectTemplate,
  UpdateOnboardingInput,
} from "./onboarding.types";
import {
  nextStep,
  onboardingStepUrl,
  previousStep,
  stepsForType,
  type OnboardingStepId,
} from "./steps";
import styles from "./onboarding.module.css";

const TEMPLATE_STORAGE_PREFIX = "taskmng:onboarding-template:";

type ActionResult = { ok: boolean; message?: string };

type OnboardingContextValue = {
  workspace: WorkspaceSummary;
  onboarding: OnboardingRecord;
  steps: readonly OnboardingStepId[];
  template: ProjectTemplate | null;
  selectTemplate: (key: string) => void;
  saving: boolean;
  /**
   * Marks `fromStep` complete, persists optional extra onboarding data and
   * navigates to the next step in the flow.
   */
  advance: (
    fromStep: string,
    extra?: Pick<UpdateOnboardingInput, "workspace">,
  ) => Promise<ActionResult>;
  goBack: (fromStep: string) => void;
  /** Completes onboarding on the backend and routes to the dashboard. */
  finish: () => Promise<ActionResult>;
  applyOnboarding: (record: OnboardingRecord) => void;
  reload: () => Promise<void>;
};

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

function readStoredTemplate(workspaceId: string): ProjectTemplate | null {
  if (typeof window === "undefined") {
    return null;
  }

  const key = window.sessionStorage.getItem(
    `${TEMPLATE_STORAGE_PREFIX}${workspaceId}`,
  );
  return PROJECT_TEMPLATES.find((template) => template.key === key) ?? null;
}

export function OnboardingProvider({
  workspace,
  children,
}: {
  workspace: WorkspaceSummary;
  children: ReactNode;
}) {
  const router = useRouter();
  const { refreshProfile } = useAuth();
  const [onboarding, setOnboarding] = useState<OnboardingRecord | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [template, setTemplate] = useState<ProjectTemplate | null>(null);

  const reload = useCallback(async () => {
    const result = await onboardingService.getOnboarding(workspace.id);

    if (!result.success) {
      setLoadError(result.error.message);
      setLoading(false);
      return;
    }

    setOnboarding(result.data);
    setLoadError(null);
    setLoading(false);
  }, [workspace.id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async data load
    setLoading(true);
    setTemplate(readStoredTemplate(workspace.id));
    void reload();
  }, [reload, workspace.id]);

  const selectTemplate = useCallback(
    (key: string) => {
      const found =
        PROJECT_TEMPLATES.find((item) => item.key === key) ?? null;
      setTemplate(found);

      if (typeof window !== "undefined") {
        window.sessionStorage.setItem(
          `${TEMPLATE_STORAGE_PREFIX}${workspace.id}`,
          key,
        );
      }
    },
    [workspace.id],
  );

  const applyOnboarding = useCallback((record: OnboardingRecord) => {
    setOnboarding(record);
  }, []);

  const advance = useCallback(
    async (
      fromStep: string,
      extra?: Pick<UpdateOnboardingInput, "workspace">,
    ): Promise<ActionResult> => {
      if (!onboarding) {
        return { ok: false, message: "Chưa tải được dữ liệu onboarding" };
      }

      const next = nextStep(onboarding.onboardingType, fromStep);

      if (!next) {
        return { ok: false, message: "Không có bước tiếp theo" };
      }

      setSaving(true);

      const result = await onboardingService.updateOnboarding(workspace.id, {
        ...extra,
        markStepCompleted: fromStep,
        currentStep: next,
      });

      setSaving(false);

      if (!result.success) {
        return { ok: false, message: result.error.message };
      }

      setOnboarding(result.data);
      router.push(onboardingStepUrl(next));
      return { ok: true };
    },
    [onboarding, router, workspace.id],
  );

  const goBack = useCallback(
    (fromStep: string) => {
      if (!onboarding) {
        return;
      }

      const previous = previousStep(onboarding.onboardingType, fromStep);
      if (previous) {
        router.push(onboardingStepUrl(previous));
      }
    },
    [onboarding, router],
  );

  const finish = useCallback(async (): Promise<ActionResult> => {
    setSaving(true);

    const result = await onboardingService.completeOnboarding(workspace.id);

    if (!result.success) {
      setSaving(false);
      return { ok: false, message: result.error.message };
    }

    setOnboarding(result.data);
    await refreshProfile();
    setSaving(false);
    router.replace("/dashboard");
    return { ok: true };
  }, [refreshProfile, router, workspace.id]);

  const value = useMemo<OnboardingContextValue | null>(() => {
    if (!onboarding) {
      return null;
    }

    return {
      workspace,
      onboarding,
      steps: stepsForType(onboarding.onboardingType),
      template,
      selectTemplate,
      saving,
      advance,
      goBack,
      finish,
      applyOnboarding,
      reload,
    };
  }, [
    workspace,
    onboarding,
    template,
    selectTemplate,
    saving,
    advance,
    goBack,
    finish,
    applyOnboarding,
    reload,
  ]);

  if (loading) {
    return <div className={styles.loading}>Đang tải thiết lập...</div>;
  }

  if (loadError || !value) {
    return (
      <div className={styles.loading}>
        <div>
          <p className={styles.error}>
            {loadError ?? "Không tải được dữ liệu onboarding"}
          </p>
        </div>
      </div>
    );
  }

  return (
    <OnboardingContext.Provider value={value}>
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding() {
  const context = useContext(OnboardingContext);

  if (!context) {
    throw new Error("useOnboarding must be used within OnboardingProvider");
  }

  return context;
}
