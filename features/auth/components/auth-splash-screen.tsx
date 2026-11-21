import { useAgreementStatus } from "@/features/agreements/hooks/use-agreement-status";
import { OnboardingGate } from "@/features/onboarding/components/onboarding-gate";
import { useOnboardingStore } from "@/stores/onboarding";

import { useAppEntry } from "../hooks/use-app-entry";
import { AgreementRetryScreen, CheckingScreen } from "./access-status-screen";
import { LoginPrompt } from "./login-prompt";

import { Redirect } from "expo-router";

function AppEntryScreen({ nativeRoot = false }: { nativeRoot?: boolean }) {
  const onboardingReady = useOnboardingStore((state) => state.hasHydrated);
  const onboardingCompleted = useOnboardingStore((state) => state.completed);
  const completeOnboarding = useOnboardingStore((state) => state.complete);
  const { hasHydrated, hasResolved, isAuthenticated, isError, needsAgreement, retry } =
    useAgreementStatus();
  const canEnter = !nativeRoot || (onboardingReady && onboardingCompleted);

  useAppEntry(canEnter && hasResolved && !needsAgreement);

  if (nativeRoot && !onboardingReady) return <CheckingScreen />;
  if (!canEnter) return <OnboardingGate onDone={completeOnboarding} />;
  if (!hasHydrated) return <CheckingScreen />;
  if (!isAuthenticated) return nativeRoot ? <LoginPrompt /> : <Redirect href="/login" />;
  if (isError) return <AgreementRetryScreen onRetry={retry} />;
  if (hasResolved && needsAgreement) return <Redirect href="/agreements" />;
  return <CheckingScreen />;
}

export { AppEntryScreen };
