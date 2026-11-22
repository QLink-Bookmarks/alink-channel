import * as React from "react";

import { isLinkNotFound } from "@/features/links/lib/is-link-not-found";
import { useLinkDetailQuery } from "@/features/links/queries";

import { type Href, useRouter } from "expo-router";

function useLinkOverlayState({
  isWideView,
  overlayBaseHref,
  overlayLinkId,
}: {
  isWideView: boolean;
  overlayBaseHref: string;
  overlayLinkId?: string;
}) {
  const router = useRouter();
  const linkDetailQuery = useLinkDetailQuery(overlayLinkId);
  const notFound = linkDetailQuery.isError && isLinkNotFound(linkDetailQuery.error);

  const handleOpenChange = React.useCallback(
    (open: boolean) => {
      if (open || !isWideView) {
        return;
      }

      router.replace(overlayBaseHref as Href);
    },
    [isWideView, overlayBaseHref, router],
  );

  return {
    detail: notFound ? undefined : linkDetailQuery.data,
    error: linkDetailQuery.isError,
    handleOpenChange,
    isLoading: linkDetailQuery.isLoading,
    isOpen: isWideView && Boolean(overlayLinkId),
    notFound,
  };
}

export { useLinkOverlayState };
