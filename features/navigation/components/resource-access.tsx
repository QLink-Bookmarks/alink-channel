import * as React from "react";
import { AppState, Appearance, View, type ViewStyle } from "react-native";

import { ActivityIndicator } from "@/components/ui/activity-indicator";
import { LoadErrorState } from "@/components/ui/load-error-state";
import { useAgreementStatus } from "@/features/agreements/hooks/use-agreement-status";
import { getFolderDetail } from "@/features/folders/api";
import type { Folder } from "@/features/folders/types";
import { getLinkAccess } from "@/features/links/api";
import {
  RESOURCE_DETAIL_PATH,
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
import { vars } from "nativewind";

const isWeb = process.env.EXPO_OS === "web";
const COLOR_SCHEME_QUERY = "(prefers-color-scheme: dark)";

const MemberFolderDetailContext = React.createContext<{ folder: Folder; updatedAt: number } | null>(
  null,
);

function UnavailableResourceRedirect({ kind, id }: { kind: "folders" | "links"; id: number }) {
  const router = useRouter();
  const path = RESOURCE_DETAIL_PATH.exec(usePathname());
  const isCurrentResource = path?.[1] === kind && Number(path[2]) === id;
  const hasHydrated = useAuthStore((state) => state.hasHydrated);
  const authToken = useAuthStore((state) => state.accessToken);
  const redirectedResource = React.useRef<string | null>(null);

  React.useEffect(() => {
    const sourceKey = `resource-unavailable:${kind}:${id}`;
    if (!isCurrentResource || !hasHydrated || redirectedResource.current === sourceKey) return;

    redirectedResource.current = sourceKey;
    router.replace(authToken ? "/home" : isWeb ? "/" : "/login");
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
  if (!isWeb) {
    const subscription = Appearance.addChangeListener(onChange);
    return () => subscription.remove();
  }
  const preference = window.matchMedia(COLOR_SCHEME_QUERY);
  preference.addEventListener("change", onChange);
  return () => preference.removeEventListener("change", onChange);
}

function getIsSystemDark() {
  return isWeb
    ? window.matchMedia(COLOR_SCHEME_QUERY).matches
    : Appearance.getColorScheme() === "dark";
}

function ResourceAccess({ children }: { children: React.ReactNode }) {
  const { state } = Navigator.useContext();
  const slot = state.routes[state.index];
  const match = RESOURCE_DETAIL_PATH.exec(usePathname());
  const kind = match?.[1];
  const id = Number(match?.[2]);
  if ((kind !== "folders" && kind !== "links") || !Number.isSafeInteger(id) || id <= 0) {
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
  const isSystemDark = React.useSyncExternalStore(
    subscribeToSystemTheme,
    getIsSystemDark,
    () => false,
  );
  const { hasResolved, needsAgreement } = useAgreementStatus();
  const waitingForAgreement = Boolean(authToken && !hasResolved);
  const readToken = needsAgreement ? null : authToken;
  const focused = useIsFocused();
  const visit = React.useId();
  const queryClient = useQueryClient();
  const [visibilityVisit, advanceVisibilityVisit] = React.useReducer((value) => value + 1, 0);
  const [session, setSession] = React.useState({ authToken, version: 0 });
  const [revokedVisit, setRevokedVisit] = React.useState<string>();
  if (session.authToken !== authToken) {
    setSession({ authToken, version: session.version + 1 });
  }

  const listVisit = `${visit}:${session.version}:${visibilityVisit}:${needsAgreement}`;
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
      if ("isShared" in data) return { mode: "app", folder: data } as const;
      if ("sourceType" in data) return { mode: "app" } as const;
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
    if (!isWeb || !focused || canUseApp) return;
    document.title = publicTitle ? `${publicTitle} · ALink` : "ALink";
  }, [canUseApp, focused, publicTitle]);

  React.useEffect(() => {
    if (!wasRevoked) return;
    queryClient.removeQueries({ queryKey: ["resource-read", kind, id, listVisit], exact: true });
    queryClient.removeQueries({ queryKey: ["folder-read", id, listVisit] });
  }, [id, kind, listVisit, queryClient, wasRevoked]);

  React.useEffect(() => {
    if (!focused || canUseApp) return;
    if (!isWeb) {
      let wasBackgrounded = AppState.currentState === "background";
      const subscription = AppState.addEventListener("change", (state) => {
        if (state === "background") wasBackgrounded = true;
        if (state === "active" && wasBackgrounded) {
          wasBackgrounded = false;
          advanceVisibilityVisit();
        }
      });
      return () => subscription.remove();
    }
    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) advanceVisibilityVisit();
    };
    const handleVisibility = () => {
      if (document.visibilityState === "visible") advanceVisibilityVisit();
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

  const guestTheme = authToken ? undefined : isSystemDark ? "dark" : "light";
  const guestThemeStyle = React.useMemo(() => {
    if (!guestTheme) return undefined;
    const themeVars = getNativeThemeVars(guestTheme, "gray");
    return isWeb ? (themeVars as ViewStyle) : vars(themeVars);
  }, [guestTheme]);

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
    const memberFolder = resource.folder
      ? { folder: resource.folder, updatedAt: access.dataUpdatedAt }
      : null;
    return (
      <MemberResourceContext value={{ kind, id }}>
        <MemberFolderDetailContext value={memberFolder}>
          <PrivatePagesLayout>{children}</PrivatePagesLayout>
        </MemberFolderDetailContext>
      </MemberResourceContext>
    );
  }
  if (waitingForAgreement) {
    return <PrivatePagesLayout>{children}</PrivatePagesLayout>;
  }

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
      className={guestTheme === "dark" ? "dark flex-1 bg-background" : "flex-1 bg-background"}
      style={guestThemeStyle}
    >
      {isWeb ? (
        <Head>
          <meta
            name="robots"
            content="noindex"
          />
        </Head>
      ) : null}
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

export { MemberFolderDetailContext, ResourceAccess, UnavailableResourceRedirect };
