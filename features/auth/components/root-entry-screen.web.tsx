import * as React from "react";
import { View } from "react-native";

import { WebLanding } from "@/features/landing/components/web-landing";
import { useAuthStore } from "@/stores/auth";

import { useOauthRedirect } from "../hooks/use-oauth-redirect.web";
import { hasOauthCallback } from "../lib/oauth-callback";
import { CheckingScreen } from "./access-status-screen";
import { AppEntryScreen } from "./auth-splash-screen";

function OauthEntry() {
  const { isProcessing, shouldEnterApp } = useOauthRedirect();
  React.useEffect(() => {
    document.documentElement.removeAttribute("data-oauth-entry");
  }, []);
  if (isProcessing) return <CheckingScreen />;
  return shouldEnterApp ? <AppEntryScreen /> : <WebLanding />;
}

function RootEntryScreen() {
  const hasHydrated = useAuthStore((state) => state.hasHydrated);
  const [isCallback, setIsCallback] = React.useState(false);
  React.useEffect(() => {
    setIsCallback(hasOauthCallback(window.location));
  }, []);

  if (isCallback) return hasHydrated ? <OauthEntry /> : <CheckingScreen />;
  return (
    <View
      nativeID="web-landing"
      className="flex-1"
    >
      <WebLanding />
    </View>
  );
}

export { RootEntryScreen };
