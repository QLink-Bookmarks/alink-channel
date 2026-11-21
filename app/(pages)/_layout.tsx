import { View } from "react-native";

import { ProtectedRoute } from "@/features/auth/components/protected-route";
import { ImportFlowHost } from "@/features/imports/components/flow/import-flow-host";
import { ResponsiveShell } from "@/features/navigation/components/responsive-shell";
import { useWideViewState } from "@/lib/hooks/use-wide-view";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";

import { Navigator } from "expo-router";

export default function PagesLayout() {
  return (
    <Navigator>
      <ProtectedRoute>
        <PagesShell />
      </ProtectedRoute>
    </Navigator>
  );
}

function PagesShell() {
  const { isResolved: isWideViewResolved } = useWideViewState();
  if (!isWideViewResolved) {
    return <View className="flex-1 bg-background" />;
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
