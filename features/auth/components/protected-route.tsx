import * as React from "react";

import { useAgreementStatus } from "@/features/agreements/hooks/use-agreement-status";
import { rememberReturnDestination } from "@/features/navigation/lib/return-destination";
import { readParamValue } from "@/features/navigation/routes";

import { AgreementRetryScreen, CheckingScreen } from "./access-status-screen";

import { useFocusEffect, useGlobalSearchParams, usePathname, useRouter } from "expo-router";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { linkId, linkUrl } = useGlobalSearchParams();
  const { hasHydrated, hasResolved, isAuthenticated, isError, needsAgreement, retry } =
    useAgreementStatus();
  const nextRoute = !hasHydrated
    ? null
    : !isAuthenticated
      ? "/login"
      : hasResolved && needsAgreement
        ? "/agreements"
        : null;

  useFocusEffect(
    React.useCallback(() => {
      if (!nextRoute) return;
      const query = new URLSearchParams();
      const overlayId = readParamValue(linkId);
      const sharedUrl = readParamValue(linkUrl);
      if (overlayId) query.set("linkId", overlayId);
      if (sharedUrl) query.set("linkUrl", sharedUrl);
      const search = query.toString();
      rememberReturnDestination(search ? `${pathname}?${search}` : pathname);
      router.replace(nextRoute);
    }, [linkId, linkUrl, nextRoute, pathname, router]),
  );

  if (isError) return <AgreementRetryScreen onRetry={retry} />;
  if (!hasResolved || needsAgreement) return <CheckingScreen />;
  return children;
}

export { ProtectedRoute };
