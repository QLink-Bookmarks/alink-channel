import { View } from "react-native";

import { useAgreementStatus } from "@/features/agreements/hooks/use-agreement-status";
import { CheckingScreen } from "@/features/auth/components/auth-splash-screen";
import { ImportFlowHost } from "@/features/imports/components/flow/import-flow-host";
import { ResponsiveShell } from "@/features/navigation/components/responsive-shell";
import { useWideViewState } from "@/lib/hooks/use-wide-view";
import { useAuthStore } from "@/stores/auth";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";

import { type Href, Redirect, Slot } from "expo-router";

export default function PagesLayout() {
  const hasHydrated = useAuthStore((state) => state.hasHydrated);
  const accessToken = useAuthStore((state) => state.accessToken);
  const { needsAgreement, hasResolved } = useAgreementStatus();
  const { isResolved: isWideViewResolved } = useWideViewState();

  // Logged-out visitors who deep-link into an app page (anything but root) land
  // on /login — the marketing landing only lives at "/".
  if (hasHydrated && !accessToken) {
    return <Redirect href={"/login" as Href} />;
  }
  // Signed in but required consent still pending → force the agreements gate.
  if (hasHydrated && accessToken && hasResolved && needsAgreement) {
    return <Redirect href={"/agreements" as Href} />;
  }

  if (!isWideViewResolved) {
    return <View className="flex-1 bg-background" />;
  }
  if (process.env.EXPO_OS === "web" && !hasHydrated) {
    return <CheckingScreen />;
  }

  return (
    <BottomSheetModalProvider>
      <ResponsiveShell>
        <Slot />
      </ResponsiveShell>
      <ImportFlowHost />
    </BottomSheetModalProvider>
  );
}
