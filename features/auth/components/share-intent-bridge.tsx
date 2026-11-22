import * as React from "react";

import { useAgreementStatus } from "@/features/agreements/hooks/use-agreement-status";
import { type PendingShare, useShareIntentStore } from "@/stores/share-intent";

import { usePathname, useRootNavigationState, useRouter } from "expo-router";
import { useShareIntentContext } from "expo-share-intent";

function ShareIntentBridge() {
  const router = useRouter();
  const pathname = usePathname();
  const navigationReady = Boolean(useRootNavigationState()?.key);
  const { hasHydrated, hasResolved, needsAgreement } = useAgreementStatus();
  const shareReady = useShareIntentStore((state) => state.hasHydrated);
  const pendingShare = useShareIntentStore((state) => state.pending);
  const { hasShareIntent, shareIntent, resetShareIntent } = useShareIntentContext();
  const liveShareRef = React.useRef<PendingShare | null>(null);

  React.useEffect(() => {
    if (!hasShareIntent || !navigationReady || !hasHydrated || !shareReady) return;

    const url = shareIntent.webUrl ?? shareIntent.text;
    if (url) {
      const share: PendingShare = { url, live: true };
      liveShareRef.current = share;
      useShareIntentStore.getState().setPending(share);
    }
    resetShareIntent();
  }, [hasHydrated, hasShareIntent, navigationReady, resetShareIntent, shareIntent, shareReady]);

  React.useEffect(() => {
    const share = liveShareRef.current;
    if (!share || pendingShare !== share) return;
    if (!hasResolved || needsAgreement) return;
    if (["/", "/home", "/login", "/agreements", "/invite"].includes(pathname)) return;

    liveShareRef.current = null;
    router.push("/home");
  }, [hasResolved, needsAgreement, pathname, pendingShare, router]);

  return null;
}

export { ShareIntentBridge };
