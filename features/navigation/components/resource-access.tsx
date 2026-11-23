import * as React from "react";
import { View, type ViewStyle } from "react-native";

import { ActivityIndicator } from "@/components/ui/activity-indicator";
import { LoadErrorState } from "@/components/ui/load-error-state";
import { useAgreementStatus } from "@/features/agreements/hooks/use-agreement-status";
import { getFolderDetail } from "@/features/folders/api";
import { getLinkAccess } from "@/features/links/api";
import {
  isUnavailableResource,
  resourceReadOptions,
} from "@/features/navigation/lib/resource-read";
import { useWideViewState } from "@/lib/hooks/use-wide-view";
import { getNativeThemeVars } from "@/lib/theme-vars";
import { useAuthStore } from "@/stores/auth";
import { useToastStore } from "@/stores/toast-store";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { MemberResourceContext, PublicResourceContext } from "../hooks/use-public-resource";
import { readParamValue } from "../routes";
import { GuestResourceNavigation } from "./guest-resource-navigation";
import { MobileBottomTabs } from "./mobile-bottom-tabs";
import { PrivatePagesLayout } from "./private-pages-layout";

import {
  Navigator,
  useGlobalSearchParams,
  useIsFocused,
  usePathname,
  useRouter,
} from "expo-router";
import Head from "expo-router/head";

const DETAIL_PATH = /^\/(folders|links)\/(\d+)\/?$/;
const COLOR_SCHEME_QUERY = "(prefers-color-scheme: dark)";

function UnavailableResourceRedirect({ kind, id }: { kind: "folders" | "links"; id: number }) {
  const router = useRouter();
  const path = DETAIL_PATH.exec(usePathname());
  const isCurrentResource = path?.[1] === kind && Number(path[2]) === id;
  const hasHydrated = useAuthStore((state) => state.hasHydrated);
  const authToken = useAuthStore((state) => state.accessToken);
  const redirectedResource = React.useRef<string | null>(null);

  React.useEffect(() => {
    const sourceKey = `resource-unavailable:${kind}:${id}`;
    if (!isCurrentResource || !hasHydrated || redirectedResource.current === sourceKey) return;

    redirectedResource.current = sourceKey;
    if (!authToken && process.env.EXPO_OS !== "web") {
      router.replace("/login");
      return;
    }
    router.replace(authToken ? "/home" : "/");
    useToastStore.getState().showToast({
      variant: "warning",
      title: kind === "folders" ? "폴더를 찾을 수 없어요" : "찾으시는 링크가 없어요",
      description: "삭제되었거나 접근 권한이 없어요.",
      sourceKey,
    });
  }, [authToken, hasHydrated, id, isCurrentResource, kind, router]);

  return null;
}

function subscribeToSystemTheme(onChange: () => void) {
  const preference = window.matchMedia(COLOR_SCHEME_QUERY);
  preference.addEventListener("change", onChange);
  return () => preference.removeEventListener("change", onChange);
}

function useSystemTheme() {
  const isDark = React.useSyncExternalStore(
    subscribeToSystemTheme,
    () => window.matchMedia(COLOR_SCHEME_QUERY).matches,
    () => false,
  );
  return isDark ? "dark" : "light";
}

function ResourceAccess({ children }: { children: React.ReactNode }) {
  const { state } = Navigator.useContext();
  const slot = state.routes[state.index];
  const match = DETAIL_PATH.exec(usePathname());
  const kind = match?.[1];
  const id = Number(match?.[2]);
  if (
    process.env.EXPO_OS !== "web" ||
    (kind !== "folders" && kind !== "links") ||
    !Number.isSafeInteger(id) ||
    id <= 0
  ) {
    return <PrivatePagesLayout>{children}</PrivatePagesLayout>;
  }
  const slotId = (slot?.params as { id?: string } | undefined)?.id;
  if (slot?.name !== `${kind}/[id]` || Number(slotId) !== id) return null;
  return (
    <ResourceVisit
      key={`${kind}:${id}`}
      kind={kind}
      id={id}
    >
      {children}
    </ResourceVisit>
  );
}

function ResourceVisit({
  children,
  kind,
  id,
}: {
  children: React.ReactNode;
  kind: "folders" | "links";
  id: number;
}) {
  const hasHydrated = useAuthStore((state) => state.hasHydrated);
  const authToken = useAuthStore((state) => state.accessToken);
  const router = useRouter();
  const { isResolved: isWideViewResolved, isWideView } = useWideViewState();
  const linkId = readParamValue(useGlobalSearchParams().linkId);
  const systemTheme = useSystemTheme();
  const { hasResolved, needsAgreement } = useAgreementStatus();
  const waitingForAgreement = Boolean(authToken && !hasResolved);
  const readToken = needsAgreement ? null : authToken;
  const focused = useIsFocused();
  const visit = React.useId();
  const queryClient = useQueryClient();
  const [browserVisit, advanceBrowserVisit] = React.useReducer((value) => value + 1, 0);
  const [session, setSession] = React.useState({ authToken, version: 0 });
  const [revokedVisit, setRevokedVisit] = React.useState<string>();
  if (session.authToken !== authToken) {
    setSession({ authToken, version: session.version + 1 });
  }

  const listVisit = `${visit}:${session.version}:${browserVisit}:${needsAgreement}`;
  const resourceKey = ["resource-read", kind, id, listVisit] as const;
  const wasRevoked = revokedVisit === listVisit;
  const access = useQuery({
    enabled:
      hasHydrated &&
      focused &&
      !waitingForAgreement &&
      !wasRevoked &&
      session.authToken === authToken,
    queryKey: resourceKey,
    gcTime: 0,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    queryFn: async ({ signal }) => {
      const options = resourceReadOptions(readToken, signal);
      const response =
        kind === "folders" ? await getFolderDetail(id, options) : await getLinkAccess(id, options);
      if (!response.success || !response.data) throw new Error("Invalid resource response");
      if (!readToken && ("isShared" in response.data || "sourceType" in response.data)) {
        throw new Error("Unexpected authenticated resource response");
      }
      const data = response.data;
      if ("isShared" in data || "sourceType" in data) return { mode: "app" } as const;
      if ("folderId" in data) return { mode: "link", data } as const;
      return { mode: "folder", data } as const;
    },
  });

  const resource = access.data;
  const canUseApp = resource?.mode === "app";
  const revoke = React.useCallback(() => setRevokedVisit(listVisit), [listVisit]);
  const unavailable = wasRevoked || isUnavailableResource(access.error);
  const narrowFolderOverlay =
    focused &&
    kind === "folders" &&
    isWideViewResolved &&
    !isWideView &&
    !unavailable &&
    access.isSuccess &&
    resource?.mode !== "link" &&
    linkId;
  const overlayId = narrowFolderOverlay && /^\d+$/.test(linkId) ? Number(linkId) : 0;
  const openLinkScreen = Number.isSafeInteger(overlayId) && overlayId > 0;
  const clearInvalidMemberOverlay = Boolean(narrowFolderOverlay && canUseApp && !openLinkScreen);
  const publicTitle =
    !unavailable && access.isSuccess && resource?.mode !== "app"
      ? resource?.mode === "link"
        ? resource.data.title
        : resource?.data.name
      : undefined;

  React.useLayoutEffect(() => {
    if (!focused || canUseApp) return;
    document.title = publicTitle ? `${publicTitle} · ALink` : "ALink";
  }, [canUseApp, focused, publicTitle]);

  React.useEffect(() => {
    if (!wasRevoked) return;
    queryClient.removeQueries({ queryKey: ["resource-read", kind, id, listVisit], exact: true });
    queryClient.removeQueries({ queryKey: ["folder-read", id, listVisit] });
  }, [id, kind, listVisit, queryClient, wasRevoked]);

  React.useEffect(() => {
    if (!focused || canUseApp) return;
    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) advanceBrowserVisit();
    };
    const handleVisibility = () => {
      if (document.visibilityState === "visible") advanceBrowserVisit();
    };
    window.addEventListener("pageshow", handlePageShow);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.removeEventListener("pageshow", handlePageShow);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [canUseApp, focused]);

  React.useEffect(() => {
    if (openLinkScreen) router.replace(`/links/${overlayId}`);
    else if (clearInvalidMemberOverlay) router.setParams({ linkId: undefined });
  }, [clearInvalidMemberOverlay, openLinkScreen, overlayId, router]);

  if (!focused) return null;
  if (hasHydrated && unavailable) {
    return (
      <UnavailableResourceRedirect
        kind={kind}
        id={id}
      />
    );
  }
  if (openLinkScreen || clearInvalidMemberOverlay) return null;
  if (canUseApp && access.isSuccess) {
    return (
      <MemberResourceContext value={{ kind, id }}>
        <PrivatePagesLayout>{children}</PrivatePagesLayout>
      </MemberResourceContext>
    );
  }
  if (waitingForAgreement) {
    return <PrivatePagesLayout>{children}</PrivatePagesLayout>;
  }

  const guestTheme = authToken ? undefined : systemTheme;
  const renderRoute = (headerAction?: React.ReactNode) =>
    resource && resource.mode !== "app" ? (
      <PublicResourceContext
        value={{
          resource,
          visit: listVisit,
          isGuest: Boolean(guestTheme),
          linkReadToken: readToken,
          headerAction,
          revoke,
        }}
      >
        {children}
      </PublicResourceContext>
    ) : null;

  return (
    <View
      className={guestTheme === "dark" ? "dark flex-1" : "flex-1"}
      style={guestTheme ? (getNativeThemeVars(guestTheme, "gray") as ViewStyle) : undefined}
    >
      <Head>
        <meta
          name="robots"
          content="noindex"
        />
      </Head>
      {!hasHydrated || access.isPending ? (
        <ActivityIndicator
          size="large"
          className="flex-1 py-16"
        />
      ) : access.isError || !resource ? (
        <LoadErrorState
          title={kind === "folders" ? "폴더를 불러오지 못했어요" : "링크를 불러오지 못했어요"}
          isRetrying={access.isFetching}
          onRetry={() => void access.refetch()}
        />
      ) : guestTheme ? (
        <GuestResourceNavigation theme={guestTheme}>{renderRoute}</GuestResourceNavigation>
      ) : (
        <>
          {renderRoute()}
          {isWideView ? null : (
            <MobileBottomTabs
              activeTab={resource.mode === "folder" ? "folders" : null}
              onNavigate={router.replace}
            />
          )}
        </>
      )}
    </View>
  );
}

export { ResourceAccess, UnavailableResourceRedirect };
