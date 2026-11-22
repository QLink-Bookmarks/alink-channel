import "../global.css";

import * as React from "react";
import { Platform, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider, initialWindowMetrics } from "react-native-safe-area-context";

import { AppErrorBoundary } from "@/components/error/app-error-boundary";
import { ToastViewport } from "@/components/ui/toast-viewport";
import { useMySettingsQuery } from "@/features/account/queries";
import { useScreenTracking } from "@/features/analytics";
import { ShareIntentBridge } from "@/features/auth/components/share-intent-bridge";
import { useSocialSdks } from "@/features/auth/hooks/use-social-sdks";
import { useDocumentTitle } from "@/features/navigation/hooks/use-document-title";
import { PushNotificationsBridge } from "@/features/notifications/components/push-notifications-bridge";
import { AnimatedSplash } from "@/features/splash/components/animated-splash";
import { getNavTheme } from "@/lib/theme";
import { getNativeThemeVars } from "@/lib/theme-vars";
import { QueryProvider } from "@/providers/query-provider";
import { useAuthStore } from "@/stores/auth";
import { useDisplaySettings } from "@/stores/display-settings";
import { ThemeProvider } from "@react-navigation/native";
import { PortalHost } from "@rn-primitives/portal";

import { Stack } from "expo-router";
import { ShareIntentProvider } from "expo-share-intent";
import { useColorScheme, vars } from "nativewind";

const StorybookEnabled = process.env.EXPO_PUBLIC_STORYBOOK_ENABLED === "true";

export const unstable_settings = {
  initialRouteName: StorybookEnabled ? "(storybook)/index" : "index",
};

function SettingsHydrator() {
  const settingsQuery = useMySettingsQuery();
  const hydrateFromServer = useDisplaySettings((state) => state.hydrateFromServer);
  const settingsData = settingsQuery.data;

  React.useEffect(() => {
    if (settingsData) {
      hydrateFromServer(settingsData);
    }
  }, [hydrateFromServer, settingsData]);

  return null;
}

function DisplayThemeBridge() {
  const theme = useDisplaySettings((state) => state.display.theme);
  const accent = useDisplaySettings((state) => state.display.accent);
  const { setColorScheme } = useColorScheme();

  // Web: drive everything from the document so :root[data-accent] CSS variables apply.
  React.useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }
    document.documentElement.classList.toggle("dark", theme === "dark");
    document.documentElement.setAttribute("data-accent", accent);
  }, [accent, theme]);

  // Native: a parent `className="dark"` does not propagate to children, so we must
  // tell NativeWind's color-scheme store directly.
  React.useEffect(() => {
    setColorScheme(theme);
  }, [setColorScheme, theme]);

  return null;
}

function NativeThemeVarsView({ children }: { children: React.ReactNode }) {
  const theme = useDisplaySettings((state) => state.display.theme);
  const accent = useDisplaySettings((state) => state.display.accent);
  const themeVars = React.useMemo(() => vars(getNativeThemeVars(theme, accent)), [accent, theme]);

  if (Platform.OS === "web") {
    return <>{children}</>;
  }

  return <View style={[{ flex: 1 }, themeVars]}>{children}</View>;
}

function AnalyticsBridge() {
  useScreenTracking();
  return null;
}

function DocumentTitleBridge() {
  useDocumentTitle();
  return null;
}

function AppStack() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={StorybookEnabled}>
        <Stack.Screen name="(storybook)/index" />
      </Stack.Protected>

      <Stack.Screen name="index" />
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="invite" />
      <Stack.Screen name="privacy" />
      <Stack.Screen
        name="agreements"
        options={{ gestureEnabled: false }}
      />
      <Stack.Screen name="qr-scan" />
      <Stack.Screen name="(pages)" />
    </Stack>
  );
}

function AuthenticatedBridges() {
  const accessToken = useAuthStore((state) => state.accessToken);
  const hasHydrated = useAuthStore((state) => state.hasHydrated);
  if (!hasHydrated || !accessToken) return null;
  return (
    <>
      <SettingsHydrator />
      <PushNotificationsBridge />
    </>
  );
}

export default function RootLayout() {
  const theme = useDisplaySettings((state) => state.display.theme);
  const accent = useDisplaySettings((state) => state.display.accent);

  useSocialSdks();

  return (
    <ShareIntentProvider>
      <GestureHandlerRootView className={theme === "dark" ? "dark flex-1" : "flex-1"}>
        <NativeThemeVarsView>
          <SafeAreaProvider initialMetrics={initialWindowMetrics}>
            <QueryProvider>
              <AuthenticatedBridges />
              <DisplayThemeBridge />
              <AppErrorBoundary>
                <ThemeProvider value={getNavTheme(theme, accent)}>
                  <AnalyticsBridge />
                  <DocumentTitleBridge />
                  <ShareIntentBridge />
                  <AppStack />
                  <PortalHost />
                  <ToastViewport />
                </ThemeProvider>
              </AppErrorBoundary>
            </QueryProvider>
          </SafeAreaProvider>
        </NativeThemeVarsView>
        <AnimatedSplash />
      </GestureHandlerRootView>
    </ShareIntentProvider>
  );
}
