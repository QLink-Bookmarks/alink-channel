import * as React from "react";

import { consumeReturnDestination } from "@/features/navigation/lib/return-destination";
import { useInviteStore } from "@/stores/invite";
import { useShareIntentStore } from "@/stores/share-intent";

import { type Href, useFocusEffect, useRouter } from "expo-router";

function useAppEntry(enabled: boolean) {
  const router = useRouter();
  const inviteReady = useInviteStore((state) => state.hasHydrated);
  const shareReady = useShareIntentStore((state) => state.hasHydrated);

  useFocusEffect(
    React.useCallback(() => {
      if (!enabled || !inviteReady || !shareReady) return;
      const invite = useInviteStore.getState().pending;
      if (invite) {
        router.replace({ pathname: "/invite", params: invite });
        return;
      }

      const share = useShareIntentStore.getState().pending;
      if (share) {
        useShareIntentStore.getState().clearPending();
        router.replace({ pathname: "/home", params: { pendingShareUrl: share.url } });
        return;
      }

      router.replace((consumeReturnDestination() ?? "/home") as Href);
    }, [enabled, inviteReady, router, shareReady]),
  );
}

export { useAppEntry };
