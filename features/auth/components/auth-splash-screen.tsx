import * as React from "react";
import { View } from "react-native";

import { Text } from "@/components/ui/text";
import { useAgreementStatus } from "@/features/agreements/hooks/use-agreement-status";
import { WebLanding } from "@/features/landing/components/web-landing";
import { OnboardingGate } from "@/features/onboarding/components/onboarding-gate";
import { useAuthStore } from "@/stores/auth";
import { useInviteStore } from "@/stores/invite";
import { useOnboardingStore } from "@/stores/onboarding";
import { useShareIntentStore } from "@/stores/share-intent";

import { useOauthRedirect } from "../hooks/use-oauth-redirect";
import { LoginPrompt } from "./login-prompt";

import { type Href, useFocusEffect, useRouter } from "expo-router";

type AuthCheckStatus = "checking" | "authenticated" | "unauthenticated";

function AuthSplashScreen() {
  const router = useRouter();
  const hasHydrated = useAuthStore((state) => state.hasHydrated);
  const accessToken = useAuthStore((state) => state.accessToken);
  const inviteHasHydrated = useInviteStore((state) => state.hasHydrated);
  const shareHasHydrated = useShareIntentStore((state) => state.hasHydrated);
  const onboardingHasHydrated = useOnboardingStore((state) => state.hasHydrated);
  const onboardingCompleted = useOnboardingStore((state) => state.completed);
  const completeOnboarding = useOnboardingStore((state) => state.complete);

  // Single source for both the redirect below and the route guard in _layout, so
  // /agreements is always available exactly when we navigate to it (no race).
  const { needsAgreement, hasResolved, isError } = useAgreementStatus();

  // Native-only first-launch onboarding, shown once right after the splash
  // (before login). Rendered inline (no route) so web ships no onboarding code
  // at all — OnboardingGate is a no-op on web and never reached anyway.
  const isNative = process.env.EXPO_OS !== "web";
  const shouldOnboard = isNative && onboardingHasHydrated && !onboardingCompleted;

  // Handles the web OAuth `?code=` redirect for any provider (Kakao/Naver).
  // isProcessing is true mid-exchange, so we hold the checking screen instead of
  // flashing the landing/login while a token is being minted.
  const { isProcessing } = useOauthRedirect();

  const status: AuthCheckStatus = !hasHydrated
    ? "checking"
    : !accessToken
      ? "unauthenticated"
      : hasResolved
        ? "authenticated"
        : isError
          ? "unauthenticated"
          : "checking";

  useFocusEffect(
    React.useCallback(() => {
      if (shouldOnboard) {
        return;
      }
      if (status !== "authenticated") {
        return;
      }

      // Required-consent gate takes priority over every other destination.
      if (needsAgreement) {
        router.replace("/agreements" as Href);
        return;
      }

      // Both stores hydrate asynchronously (SecureStore on native, sessionStorage
      // on web). Wait for them before deciding where to go, otherwise a pending
      // invite that hasn't loaded yet gets missed and we wrongly land on /home —
      // a race whose outcome varied by device.
      if (!inviteHasHydrated || !shareHasHydrated) {
        return;
      }

      const pendingInvite = useInviteStore.getState().pending;
      if (pendingInvite) {
        router.replace(
          `/invite?token=${encodeURIComponent(pendingInvite.token)}&folderId=${encodeURIComponent(
            pendingInvite.folderId,
          )}` as Href,
        );
        return;
      }

      const pendingShare = useShareIntentStore.getState().pending;
      if (pendingShare) {
        useShareIntentStore.getState().clearPending();
        router.replace({ pathname: "/home", params: { linkUrl: pendingShare.url } });
        return;
      }

      router.replace("/home" as Href);
    }, [inviteHasHydrated, needsAgreement, router, shareHasHydrated, shouldOnboard, status]),
  );

  // On native, hold the checking screen until we know the onboarding state so
  // the login screen never flashes before onboarding shows.
  if (isNative && !onboardingHasHydrated) {
    return <CheckingScreen />;
  }
  if (shouldOnboard) {
    return <OnboardingGate onDone={completeOnboarding} />;
  }
  if (status === "unauthenticated" && !isProcessing) {
    // Web logged-out visitors get the marketing landing; native gets the login
    // screen directly (no landing shipped to the app).
    return isNative ? <LoginPrompt /> : <WebLanding />;
  }
  return <CheckingScreen />;
}

function CheckingScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-background px-6">
      <Text className="text-center text-2xl text-muted-foreground">인증 정보를 확인 중입니다…</Text>
    </View>
  );
}

export { AuthSplashScreen, CheckingScreen };
