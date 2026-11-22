import { View } from "react-native";

import { LoadErrorState } from "@/components/ui/load-error-state";
import { accountQueryKeys } from "@/features/account/queries";
import { useAgreementStatus } from "@/features/agreements/hooks/use-agreement-status";
import { CheckingScreen } from "@/features/auth/components/auth-splash-screen";
import { ImportFlowHost } from "@/features/imports/components/flow/import-flow-host";
import { ResourceAccess } from "@/features/navigation/components/resource-access";
import { ResponsiveShell } from "@/features/navigation/components/responsive-shell";
import { useWideViewState } from "@/lib/hooks/use-wide-view";
import { useAuthStore } from "@/stores/auth";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { useQueryClient } from "@tanstack/react-query";

import { type Href, Navigator, Redirect } from "expo-router";

export default function PagesLayout() {
  return (
    <Navigator>
      <ResourceAccess>
        <PrivatePagesLayout />
      </ResourceAccess>
    </Navigator>
  );
}

function PrivatePagesLayout() {
  const hasHydrated = useAuthStore((state) => state.hasHydrated);
  const accessToken = useAuthStore((state) => state.accessToken);
  const { needsAgreement, hasResolved, isError } = useAgreementStatus();
  const queryClient = useQueryClient();
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

  if (hasHydrated && accessToken && !hasResolved) {
    return isError ? (
      <LoadErrorState
        title="이 영역을 불러오지 못했어요"
        onRetry={() =>
          void queryClient.invalidateQueries({ queryKey: accountQueryKeys.myProfile() })
        }
      />
    ) : (
      <CheckingScreen />
    );
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
        <Navigator.Slot />
      </ResponsiveShell>
      <ImportFlowHost />
    </BottomSheetModalProvider>
  );
}
