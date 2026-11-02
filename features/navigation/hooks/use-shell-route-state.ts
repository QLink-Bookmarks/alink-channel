import * as React from "react";

import { useWideViewState } from "@/lib/hooks/use-wide-view";

import {
  getBackHref,
  getMobileTabActiveItem,
  getOverlayBaseHref,
  getOverlayLinkId,
  getRedirectHref,
  getRouteTitle,
  getWideSidebarActiveItem,
  isKnownShellPath,
  isMobileTabRootPath,
  normalizePathname,
} from "../routes";
import type { RouteParams } from "../types";

import { useGlobalSearchParams, usePathname } from "expo-router";

function useShellRouteState() {
  const pathname = normalizePathname(usePathname());
  const searchParams = useGlobalSearchParams() as RouteParams;
  const { isResolved: isWideViewResolved, isWideView } = useWideViewState();

  return React.useMemo(() => {
    const routeTitle = getRouteTitle(pathname, searchParams, isWideView);
    const overlayLinkId = getOverlayLinkId(pathname, searchParams, isWideView);
    const redirectHref = isWideViewResolved
      ? getRedirectHref({
          isWideView,
          pathname,
          searchParams,
        })
      : undefined;
    const wideSidebarKey = getWideSidebarActiveItem(pathname);
    const mobileTabKey = getMobileTabActiveItem(pathname);
    const backHref = getBackHref(pathname);
    const showBackButton =
      !isWideView &&
      !isMobileTabRootPath(pathname) &&
      (pathname.startsWith("/folders") ||
        pathname.startsWith("/links") ||
        pathname.startsWith("/announcements") ||
        pathname.startsWith("/feedbacks") ||
        pathname.startsWith("/notifications") ||
        pathname.startsWith("/todos") ||
        pathname.startsWith("/settings"));

    return {
      pathname,
      searchParams,
      isWideView,
      routeTitle,
      overlayLinkId,
      overlayBaseHref: getOverlayBaseHref(pathname),
      redirectHref,
      wideSidebarKey,
      mobileTabKey,
      backHref,
      showBackButton,
      isKnownShellPath: isKnownShellPath(pathname),
    };
  }, [isWideView, isWideViewResolved, pathname, searchParams]);
}

export { useShellRouteState };
