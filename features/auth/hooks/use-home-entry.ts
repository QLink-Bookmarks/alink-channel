import * as React from "react";

import {
  consumeReturnDestination,
  rememberReturnDestination,
} from "@/features/navigation/lib/return-destination";
import { readParamValue } from "@/features/navigation/routes";
import { useInviteStore } from "@/stores/invite";
import { useShareIntentStore } from "@/stores/share-intent";

import {
  type Href,
  useFocusEffect,
  useGlobalSearchParams,
  usePathname,
  useRouter,
} from "expo-router";

let deferNextHomeEntry = false;

function goHomeAfterInvite(router: Pick<ReturnType<typeof useRouter>, "replace">) {
  deferNextHomeEntry = true;
  router.replace("/home");
}

function useHomeEntry() {
  const router = useRouter();
  const isHome = usePathname() === "/home";
  const { linkId, linkUrl } = useGlobalSearchParams();
  const inviteReady = useInviteStore((state) => state.hasHydrated);
  const shareReady = useShareIntentStore((state) => state.hasHydrated);
  const [ready, setReady] = React.useState(false);
  const homeHrefRef = React.useRef("/home");

  React.useLayoutEffect(() => {
    const query = new URLSearchParams();
    const overlayId = readParamValue(linkId);
    const sharedUrl = readParamValue(linkUrl);
    if (overlayId) query.set("linkId", overlayId);
    if (sharedUrl) query.set("linkUrl", sharedUrl);
    const search = query.toString();
    homeHrefRef.current = search ? `/home?${search}` : "/home";
  }, [linkId, linkUrl]);

  useFocusEffect(
    React.useCallback(() => {
      if (!isHome || !inviteReady || !shareReady) return;

      let unsubscribe: (() => void) | undefined;
      let isNavigatingAway = false;
      const resume = () => {
        const invite = useInviteStore.getState().pending;
        if (invite) {
          rememberReturnDestination(homeHrefRef.current);
          isNavigatingAway = true;
          router.replace({ pathname: "/invite", params: invite });
          return;
        }

        const share = useShareIntentStore.getState().pending;
        if (share) {
          rememberReturnDestination(homeHrefRef.current);
          useShareIntentStore.getState().clearPending();
          router.setParams({ pendingShareUrl: share.url, linkId: undefined, linkUrl: undefined });
          return;
        }

        const destination = consumeReturnDestination();
        if (destination && destination !== "/home" && destination !== homeHrefRef.current) {
          isNavigatingAway = true;
          router.replace(destination as Href);
        }
      };

      const frame = requestAnimationFrame(() => {
        if (deferNextHomeEntry) {
          deferNextHomeEntry = false;
        } else {
          resume();
        }
        if (isNavigatingAway) return;
        setReady(true);
        unsubscribe = useShareIntentStore.subscribe((state, previous) => {
          if (!isNavigatingAway && state.pending?.live && state.pending !== previous.pending) {
            resume();
          }
        });
      });

      return () => {
        cancelAnimationFrame(frame);
        unsubscribe?.();
      };
    }, [inviteReady, isHome, router, shareReady]),
  );

  return !isHome || (inviteReady && shareReady && ready);
}

export { goHomeAfterInvite, useHomeEntry };
