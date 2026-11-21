import * as React from "react";

import { useAgreementStatus } from "@/features/agreements/hooks/use-agreement-status";
import { useShareIntentStore } from "@/stores/share-intent";

import { usePathname, useRootNavigationState, useRouter } from "expo-router";
import { useShareIntentContext } from "expo-share-intent";

function ShareIntentBridge() {
  const router = useRouter();
  const pathname = usePathname();
  const navigationReady = Boolean(useRootNavigationState()?.key);
  const { hasHydrated, hasResolved, needsAgreement } = useAgreementStatus();
  const shareReady = useShareIntentStore((state) => state.hasHydrated);
  const { hasShareIntent, shareIntent, resetShareIntent } = useShareIntentContext();

  React.useEffect(() => {
    if (!hasShareIntent || !navigationReady || !hasHydrated || !shareReady) return;

    const url = shareIntent.webUrl ?? shareIntent.text;
    if (url) {
      useShareIntentStore.getState().setPending({ url });
      if (
        hasResolved &&
        !needsAgreement &&
        !["/", "/app", "/login", "/agreements", "/invite"].includes(pathname)
      ) {
        router.push("/app");
      }
    }
    resetShareIntent();
  }, [
    hasHydrated,
    hasResolved,
    hasShareIntent,
    navigationReady,
    needsAgreement,
    pathname,
    resetShareIntent,
    router,
    shareIntent,
    shareReady,
  ]);

  return null;
}

export { ShareIntentBridge };
