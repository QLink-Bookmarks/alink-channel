import * as React from "react";
import { View } from "react-native";

import { OpenInAppBanner } from "@/components/layout/open-in-app-banner";
import { readParamValue } from "@/features/navigation/routes";
import { useAuthStore } from "@/stores/auth";
import { useShareIntentStore } from "@/stores/share-intent";

import { CheckingScreen } from "./access-status-screen";
import { AppEntryScreen } from "./auth-splash-screen";
import { LoginPrompt } from "./login-prompt";

import { useLocalSearchParams } from "expo-router";

function LoginRouteScreen() {
  const hasHydrated = useAuthStore((state) => state.hasHydrated);
  const accessToken = useAuthStore((state) => state.accessToken);
  const shareReady = useShareIntentStore((state) => state.hasHydrated);
  const params = useLocalSearchParams<{ sharedUrl?: string | string[] }>();
  const paramUrl = readParamValue(params.sharedUrl);
  const sharedUrl =
    process.env.EXPO_OS !== "web" && paramUrl && /^https?:\/\/\S+$/i.test(paramUrl)
      ? paramUrl
      : null;
  const [stagedUrl, setStagedUrl] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (sharedUrl && shareReady && sharedUrl !== stagedUrl) {
      useShareIntentStore.getState().setPending({ url: sharedUrl });
      setStagedUrl(sharedUrl);
    }
  }, [sharedUrl, shareReady, stagedUrl]);

  if (!hasHydrated || (sharedUrl && stagedUrl !== sharedUrl)) {
    return <CheckingScreen />;
  }
  if (accessToken) return <AppEntryScreen />;

  return (
    <View className="flex-1 bg-background">
      <OpenInAppBanner />
      <LoginPrompt />
    </View>
  );
}

export { LoginRouteScreen };
