import { View } from "react-native";

import { CheckingScreen } from "@/features/auth/components/access-status-screen";
import { ProtectedRoute } from "@/features/auth/components/protected-route";
import { useHomeEntry } from "@/features/auth/hooks/use-home-entry";
import { ImportFlowHost } from "@/features/imports/components/flow/import-flow-host";
import { useWideViewState } from "@/lib/hooks/use-wide-view";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";

import { ResponsiveShell } from "./responsive-shell";

import { Navigator } from "expo-router";

function PrivatePagesLayout() {
  return (
    <ProtectedRoute>
      <PagesShell />
    </ProtectedRoute>
  );
}

function PagesShell() {
  const { isResolved: isWideViewResolved } = useWideViewState();
  const isHomeEntryReady = useHomeEntry();
  if (!isHomeEntryReady) return <CheckingScreen />;
  if (!isWideViewResolved) return <View className="flex-1 bg-background" />;

  return (
    <BottomSheetModalProvider>
      <ResponsiveShell>
        <Navigator.Slot />
      </ResponsiveShell>
      <ImportFlowHost />
    </BottomSheetModalProvider>
  );
}

export { PrivatePagesLayout };
