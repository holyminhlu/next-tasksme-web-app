"use client";

import { useParams, useRouter } from "next/navigation";
import { Suspense, useEffect } from "react";
import { AuthGate, useAuth } from "@/modules/auth";
import {
  OnboardingProvider,
  StepRenderer,
  isStepInFlow,
  onboardingStepUrl,
  pathToStep,
  stepsForType,
  useOnboarding,
  type OnboardingStepId,
} from "@/modules/onboarding";
import styles from "@/modules/onboarding/onboarding.module.css";

/**
 * Guards the requested step against the loaded onboarding record:
 * unknown steps and steps ahead of the backend's currentStep redirect back
 * to the step the user should actually be on.
 */
function StepGuard({ requestedStep }: { requestedStep: string }) {
  const router = useRouter();
  const { onboarding } = useOnboarding();

  const step = pathToStep(requestedStep);
  const flow = stepsForType(onboarding.onboardingType);
  const inFlow = isStepInFlow(onboarding.onboardingType, step);
  const requestedIndex = flow.indexOf(step as OnboardingStepId);
  const currentIndex = flow.indexOf(
    onboarding.currentStep as OnboardingStepId,
  );
  const completed = onboarding.status === "COMPLETED";
  const ahead = inFlow && currentIndex !== -1 && requestedIndex > currentIndex;

  useEffect(() => {
    if (completed) {
      router.replace("/dashboard");
      return;
    }

    if (!inFlow || ahead) {
      router.replace(onboardingStepUrl(onboarding.currentStep));
    }
  }, [completed, inFlow, ahead, onboarding.currentStep, router]);

  if (completed || !inFlow || ahead) {
    return <div className={styles.loading}>Đang chuyển hướng...</div>;
  }

  return <StepRenderer step={step as OnboardingStepId} />;
}

function OnboardingStepContent() {
  const router = useRouter();
  const params = useParams<{ step: string }>();
  const { selectedWorkspace } = useAuth();

  useEffect(() => {
    if (!selectedWorkspace) {
      router.replace("/onboarding");
    }
  }, [selectedWorkspace, router]);

  if (!selectedWorkspace) {
    return <div className={styles.loading}>Đang chuyển hướng...</div>;
  }

  return (
    <OnboardingProvider workspace={selectedWorkspace}>
      <StepGuard requestedStep={params.step} />
    </OnboardingProvider>
  );
}

export default function OnboardingStepPage() {
  return (
    <Suspense fallback={<div className={styles.loading}>Đang tải...</div>}>
      <AuthGate>
        <OnboardingStepContent />
      </AuthGate>
    </Suspense>
  );
}
