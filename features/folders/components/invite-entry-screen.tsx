import * as React from "react";
import { View } from "react-native";

import { OpenInAppBanner } from "@/components/layout/open-in-app-banner";
import { useAgreementStatus } from "@/features/agreements/hooks/use-agreement-status";
import {
  AgreementRetryScreen,
  CheckingScreen,
} from "@/features/auth/components/access-status-screen";
import { LoginPrompt } from "@/features/auth/components/login-prompt";
import { readParamValue } from "@/features/navigation/routes";
import { useInviteStore } from "@/stores/invite";

import { InviteAcceptScreen } from "./invite-accept-screen";

import { Redirect, useLocalSearchParams } from "expo-router";

function InviteEntryScreen() {
  const params = useLocalSearchParams<{
    folderId?: string | string[];
    token?: string | string[];
  }>();
  const inviteReady = useInviteStore((state) => state.hasHydrated);
  if (!inviteReady) return <CheckingScreen />;
  const folderId = readParamValue(params.folderId);
  const token = readParamValue(params.token);
  return (
    <InviteEntry
      key={JSON.stringify([folderId, token])}
      folderId={folderId}
      token={token}
    />
  );
}

function InviteEntry({
  folderId: paramFolderId,
  token: paramToken,
}: {
  folderId?: string;
  token?: string;
}) {
  const { hasHydrated, hasResolved, isAuthenticated, isError, needsAgreement, retry } =
    useAgreementStatus();
  const [pending] = React.useState(() => useInviteStore.getState().pending);
  const setPending = useInviteStore((state) => state.setPending);

  // Persist the invite the moment we land here so it survives the OAuth full-page
  // redirect on web (the /invite URL is replaced by the provider callback at root).
  React.useEffect(() => {
    if (paramToken && paramFolderId) {
      setPending({ token: paramToken, folderId: paramFolderId });
    }
  }, [paramFolderId, paramToken, setPending]);

  const token = paramToken ?? pending?.token ?? null;
  const folderId = paramFolderId ?? pending?.folderId ?? null;

  const handleInviteSettled = React.useCallback(() => {
    const { pending: current, clearPending } = useInviteStore.getState();
    if (current?.token === token && current?.folderId === folderId) clearPending();
  }, [folderId, token]);

  if (!hasHydrated || (isAuthenticated && !hasResolved && !isError)) return <CheckingScreen />;
  if (isError) return <AgreementRetryScreen onRetry={retry} />;
  if (needsAgreement) return <Redirect href="/agreements" />;

  return (
    <View className="flex-1 bg-background">
      <OpenInAppBanner
        folderId={folderId}
        token={token}
      />
      {isAuthenticated ? (
        <InviteAcceptScreen
          folderId={folderId}
          token={token}
          onAccepted={handleInviteSettled}
          onFailed={handleInviteSettled}
        />
      ) : (
        <LoginPrompt subtitle="초대를 수락하려면 먼저 로그인해 주세요 ✨" />
      )}
    </View>
  );
}

export { InviteEntryScreen };
