import { ScrollView } from "react-native";

import { useAuthStore } from "@/stores/auth";

import { useOauthRedirect } from "../hooks/use-oauth-redirect.web";
import { CheckingScreen } from "./access-status-screen";
import { AppEntryScreen } from "./auth-splash-screen";

import { Redirect } from "expo-router";

function CallbackResult() {
  const result = useOauthRedirect();

  if (result === "login") return <AppEntryScreen />;
  if (result === "connect") return <Redirect href="/settings" />;
  if (result === "invalid") return <Redirect href="/" />;
  return <CheckingScreen />;
}

function OauthCallbackScreen() {
  const hasHydrated = useAuthStore((state) => state.hasHydrated);

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerClassName="flex-grow"
      contentInsetAdjustmentBehavior="automatic"
    >
      {hasHydrated ? <CallbackResult /> : <CheckingScreen />}
    </ScrollView>
  );
}

export { OauthCallbackScreen };
