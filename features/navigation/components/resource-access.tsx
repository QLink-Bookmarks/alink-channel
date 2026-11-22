import * as React from "react";
import { ScrollView } from "react-native";

import { ActivityIndicator } from "@/components/ui/activity-indicator";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadErrorState } from "@/components/ui/load-error-state";
import { getFolderDetail } from "@/features/folders/api";
import { ReadOnlyFolderScreen } from "@/features/folders/components/read-only-folder-screen";
import { getLinkAccess } from "@/features/links/api";
import { ReadOnlyLinkScreen } from "@/features/links/components/read-only-link-screen";
import { resourceReadOptions } from "@/features/navigation/lib/resource-read";
import { useAuthStore } from "@/stores/auth";
import { useQuery } from "@tanstack/react-query";

import { isAxiosError } from "axios";
import { useIsFocused, usePathname } from "expo-router";
import Head from "expo-router/head";

const DETAIL_PATH = /^\/(folders|links)\/(\d+)\/?$/;

function ResourceAccess({ children }: { children: React.ReactNode }) {
  const match = DETAIL_PATH.exec(usePathname());
  const kind = match?.[1];
  const id = Number(match?.[2]);
  if (
    process.env.EXPO_OS !== "web" ||
    (kind !== "folders" && kind !== "links") ||
    !Number.isSafeInteger(id) ||
    id <= 0
  ) {
    return children;
  }
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
  const focused = useIsFocused();
  const visit = React.useId();
  const [browserVisit, advanceBrowserVisit] = React.useReducer((value) => value + 1, 0);
  const [session, setSession] = React.useState({ authToken, version: 0 });
  if (session.authToken !== authToken) {
    setSession({ authToken, version: session.version + 1 });
  }

  const access = useQuery({
    enabled: hasHydrated && focused && session.authToken === authToken,
    queryKey: ["resource-read", kind, id, visit, session.version, browserVisit],
    gcTime: 0,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    queryFn: async ({ signal }) => {
      const options = resourceReadOptions(authToken, signal);
      const response =
        kind === "folders" ? await getFolderDetail(id, options) : await getLinkAccess(id, options);
      if (!response.success || !response.data) throw new Error("Invalid resource response");
      if (!authToken && ("isShared" in response.data || "sourceType" in response.data)) {
        throw new Error("Unexpected authenticated resource response");
      }
      const data = response.data;
      if ("isShared" in data || "sourceType" in data) return { mode: "app" } as const;
      if ("todos" in data) return { mode: "link", data } as const;
      return { mode: "folder", data } as const;
    },
  });

  const resource = access.data;
  const canUseApp = resource?.mode === "app";
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

  if (!focused) return null;
  const unavailable = isAxiosError(access.error) && access.error.response?.status === 404;
  if (canUseApp && access.isSuccess) return children;
  if (unavailable && !authToken) return children;

  return (
    <>
      <Head>
        <meta
          name="robots"
          content="noindex"
        />
        {access.isSuccess && resource && resource.mode !== "app" ? (
          <title>{`${resource.mode === "link" ? resource.data.title : resource.data.name} · ALink`}</title>
        ) : null}
      </Head>
      {!hasHydrated || access.isPending ? (
        <ActivityIndicator
          size="large"
          className="flex-1 py-16"
        />
      ) : unavailable ? (
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          contentContainerClassName="flex-grow justify-center"
        >
          <EmptyState
            emoji={kind === "folders" ? "📁" : "🔍"}
            title={kind === "folders" ? "폴더를 찾을 수 없어요" : "찾으시는 링크가 없어요"}
            description="삭제되었거나 접근 권한이 없어요."
          />
        </ScrollView>
      ) : access.isError || !resource ? (
        <LoadErrorState
          title={kind === "folders" ? "폴더를 불러오지 못했어요" : "링크를 불러오지 못했어요"}
          isRetrying={access.isFetching}
          onRetry={() => void access.refetch()}
        />
      ) : resource.mode === "link" ? (
        <ReadOnlyLinkScreen link={resource.data} />
      ) : resource.mode === "folder" ? (
        <ReadOnlyFolderScreen
          folder={resource.data}
          authToken={authToken}
        />
      ) : null}
    </>
  );
}

export { ResourceAccess };
