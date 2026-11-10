import { View } from "react-native";

import { OpenInAppBanner } from "@/components/layout/open-in-app-banner";
import { useAuthStore } from "@/stores/auth";

import { CheckingScreen } from "./auth-splash-screen";
import { LoginPrompt } from "./login-prompt";

import { type Href, Redirect } from "expo-router";

// Dedicated /login route. Native reaches login both at "/" (auth splash) and
// here; web sends landing visitors here from the "웹으로 시작하기" CTA. Already
// signed in? Bounce to root so the splash routes to the right place.
function LoginRouteScreen() {
  const hasHydrated = useAuthStore((state) => state.hasHydrated);
  const accessToken = useAuthStore((state) => state.accessToken);

  if (process.env.EXPO_OS === "web" && !hasHydrated) {
    return <CheckingScreen />;
  }
  if (hasHydrated && accessToken) {
    return <Redirect href={"/" as Href} />;
  }

  return (
    <View className="flex-1 bg-background">
      <OpenInAppBanner />
      <LoginPrompt />
    </View>
  );
}

export { LoginRouteScreen };
