import { ProtectedRoute } from "@/features/auth/components/protected-route";
import { QrScanScreen } from "@/features/qr-scan/components/qr-scan-screen";

import { Stack } from "expo-router";

export default function QrScanRoute() {
  return (
    <ProtectedRoute>
      <Stack.Screen
        options={{
          headerShown: true,
          title: "QR 스캔",
          headerBackTitle: " ",
          headerBackButtonDisplayMode: "minimal",
        }}
      />
      <QrScanScreen />
    </ProtectedRoute>
  );
}
