import * as React from "react";
import { ScrollView, View } from "react-native";

import { AppHeader } from "@/components/layout/app-header";
import { ActivityIndicator } from "@/components/ui/activity-indicator";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Text } from "@/components/ui/text";
import { FolderHeaderActions } from "@/features/folders/components/folder-header-actions";
import { UNCATEGORIZED_FOLDER_ID } from "@/features/folders/lib/folder-pages";
import { usePublicFolderLinksQuery } from "@/features/folders/public-queries";
import { useFolderQuery } from "@/features/folders/queries";
import type { PublicFolder } from "@/features/folders/types";
import {
  LinkListView,
  type LinkListViewProps,
  type PublicLinkListViewProps,
} from "@/features/home/components/link-list-view";
import { getLinkAccess } from "@/features/links/api";
import { DetailPanel } from "@/features/links/components/detail-panel/detail-panel";
import { LinkDetailResourceContent } from "@/features/links/components/link-detail-resource-content";
import { LinkDetailScreen } from "@/features/links/components/link-detail-screen";
import { useLinkCardSize } from "@/features/links/hooks/use-link-card-size";
import { getLinkCardPageSize } from "@/features/links/lib/link-card-size";
import { DEFAULT_LINK_SORT, toLinkListParams } from "@/features/links/lib/link-sort";
import type { LinkDetail, PublicLinkDetail } from "@/features/links/types";
import { requestLeave } from "@/stores/leave-guard";
import { useQuery } from "@tanstack/react-query";

import { useLinkOverlayState } from "../hooks/use-link-overlay-state";
import {
  type PublicResourceVisit,
  useMemberResourceAccess,
  usePublicResource,
} from "../hooks/use-public-resource";
import { useShellRouteState } from "../hooks/use-shell-route-state";
import { isUnavailableResource, resourceReadOptions } from "../lib/resource-read";
import { readParamValue } from "../routes";

import { useLocalSearchParams, useRouter } from "expo-router";
import { BookCopyIcon } from "lucide-react-native";

type PanelState = Omit<React.ComponentProps<typeof DetailPanel>, "mode" | "overlayWithinParent">;

function ResourceDetailViewport({
  isPublic,
  header,
  panel,
  children,
}: {
  isPublic: boolean;
  header?: React.ReactNode;
  panel?: PanelState;
  children?: React.ReactNode;
}) {
  return (
    <View
      className="relative flex-1"
      role={isPublic ? "main" : undefined}
      testID="resource-detail-viewport"
    >
      {header}
      {children}
      {panel ? (
        <DetailPanel
          {...panel}
          mode="overlay"
          overlayWithinParent={isPublic}
        />
      ) : null}
    </View>
  );
}

function FolderDetailRouteScreen() {
  const params = useLocalSearchParams<{ id?: string | string[]; linkId?: string | string[] }>();
  const router = useRouter();
  const route = useShellRouteState();
  const visit = usePublicResource();
  const folderId = Number(readParamValue(params.id));
  const hasMemberAccess = useMemberResourceAccess("folders", folderId);
  const linkId = readParamValue(params.linkId);
  const isPublic = visit !== null;

  function renderFolder({ headerTitle, headerAction, panel, list, status }: FolderPageState) {
    const handleBack = () =>
      requestLeave(() => {
        if (router.canGoBack()) router.back();
        else router.replace(isPublic ? "/" : "/home");
      });
    return (
      <ResourceDetailViewport
        isPublic={isPublic}
        panel={route.isWideView ? panel : undefined}
        header={
          route.isWideView ? null : (
            <AppHeader
              back
              title={headerTitle ?? route.routeTitle}
              titleAlign="start"
              titleAccessibilityRole="header"
              rightSlot={headerAction}
              onBack={handleBack}
            />
          )
        }
      >
        {list ? <LinkListView {...list} /> : status}
      </ResourceDetailViewport>
    );
  }

  if (visit) {
    if (visit.resource.mode !== "folder" || visit.resource.data.id !== folderId) return null;
    return (
      <PublicFolderController
        folder={visit.resource.data}
        visit={visit}
        linkId={linkId}
        renderFolder={renderFolder}
      />
    );
  }
  if (!hasMemberAccess) return null;
  return (
    <MemberFolderController
      folderId={folderId}
      linkId={linkId}
      isWide={route.isWideView}
      renderFolder={renderFolder}
    />
  );
}

type FolderPageState = {
  headerTitle?: string;
  headerAction?: React.ReactNode;
  panel?: PanelState;
  list?: LinkListViewProps | PublicLinkListViewProps;
  status?: React.ReactNode;
};
type RenderFolder = (props: FolderPageState) => React.ReactNode;

function MemberFolderController({
  folderId,
  linkId,
  isWide,
  renderFolder,
}: {
  folderId: number;
  linkId?: string;
  isWide: boolean;
  renderFolder: RenderFolder;
}) {
  const isUncategorized = folderId === UNCATEGORIZED_FOLDER_ID;
  const query = useFolderQuery(folderId, { enabled: !isUncategorized });
  const folder = query.folder;
  const basePath = `/folders/${folderId}`;
  const panel = useMemberPanel(basePath, isWide, linkId);
  const headerAction = folder ? (
    <FolderHeaderActions
      folder={folder}
      folderUpdatedAt={query.dataUpdatedAt}
      mode={isWide ? "wide" : "mobile"}
    />
  ) : undefined;
  const page: FolderPageState = {
    headerTitle: folder ? [folder.emoji, folder.name].filter(Boolean).join(" ") : undefined,
    headerAction,
    panel,
  };
  if (folder || isUncategorized) {
    page.list = {
      folderId,
      title: folder?.name ?? "미분류",
      emoji: folder ? (folder.emoji ?? undefined) : "🗂️",
      meta: folder ? `${folder.linkCounts}개 링크` : undefined,
      basePath,
      headerActions: isWide ? headerAction : undefined,
      activeLinkId: linkId ? Number(linkId) : undefined,
    };
  } else if (query.isError) {
    page.status = (
      <FolderNotice
        title="폴더를 불러오지 못했어요"
        emoji="⚠️"
        description="네트워크 연결을 확인한 뒤 다시 시도해주세요."
        onRetry={query.retry}
      />
    );
  } else if (query.isNotFound) {
    page.status = (
      <FolderNotice
        title="폴더를 찾을 수 없어요"
        emoji="📁"
        description="삭제된 폴더이거나 접근 권한이 없는 폴더예요."
      />
    );
  } else {
    page.status = (
      <ActivityIndicator
        size="large"
        className="flex-1 py-16"
      />
    );
  }
  return renderFolder(page);
}

function PublicFolderController({
  folder,
  visit,
  linkId,
  renderFolder,
}: {
  folder: PublicFolder;
  visit: PublicResourceVisit;
  linkId?: string;
  renderFolder: RenderFolder;
}) {
  const router = useRouter();
  const { isWideView, linkCardSize } = useLinkCardSize();
  const cardSize = visit.isGuest ? "small" : linkCardSize;
  const [sort, setSort] = React.useState(DEFAULT_LINK_SORT);
  const { orderKey, order } = toLinkListParams(sort, false);
  const links = usePublicFolderLinksQuery(folder.id, visit.visit, true, {
    orderKey,
    order,
    size: getLinkCardPageSize(cardSize, isWideView),
  });
  const overlayId = linkId && /^\d+$/.test(linkId) ? Number(linkId) : 0;
  const overlay = useQuery({
    enabled: isWideView && Number.isSafeInteger(overlayId) && overlayId > 0,
    gcTime: 0,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    queryKey: ["folder-read", folder.id, visit.visit, "link", overlayId],
    queryFn: async ({ signal }) => {
      const { success, data } = await getLinkAccess(
        overlayId,
        resourceReadOptions(visit.linkReadToken, signal),
      );
      if (!success || !data || data.folderId !== folder.id) return null;
      if (!visit.linkReadToken && "sourceType" in data) return null;
      return data;
    },
  });
  const revoke = visit.revoke;
  const wasWithdrawn = isUnavailableResource(links.error);
  React.useLayoutEffect(() => {
    if (wasWithdrawn) revoke();
  }, [revoke, wasWithdrawn]);
  if (wasWithdrawn) return null;

  const selected = overlay.data;
  const isListed = links.data?.pages.some(({ contents }) =>
    contents.some(({ id }) => id === overlayId),
  );
  const handleClose = () => router.replace(`/folders/${folder.id}`);
  return renderFolder({
    headerTitle: [folder.emoji, folder.name].filter(Boolean).join(" "),
    headerAction: visit.headerAction,
    panel: {
      open: Boolean(selected || isListed),
      isLoading: overlay.isPending,
      notFound: selected === null || isUnavailableResource(overlay.error),
      error: overlay.isError,
      onOpenChange: () => requestLeave(handleClose),
      onDeleted: handleClose,
      observeAuthenticatedDetail: true,
      detail: selected ?? undefined,
    },
    list: {
      publicList: {
        folder,
        links,
        sort,
        isWide: isWideView,
        linkCardSize: cardSize,
        activeLinkId: selected?.id,
        onSortChange: setSort,
      },
    },
  });
}

function LinkDetailRouteScreen() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const linkId = readParamValue(params.id);
  const hasMemberAccess = useMemberResourceAccess("links", Number(linkId));
  const route = useShellRouteState();
  const visit = usePublicResource();
  const isPublic = visit !== null;

  const router = useRouter();
  function renderLink({ list, panel, status, detail }: LinkPageState) {
    const handleBack = () => {
      if (router.canGoBack()) router.back();
      else if (detail && !("sourceType" in detail)) router.replace(`/folders/${detail.folderId}`);
      else router.replace("/home");
    };
    return (
      <ResourceDetailViewport
        isPublic={isPublic}
        panel={route.isWideView ? panel : undefined}
        header={
          status && !route.isWideView ? (
            <AppHeader
              back
              title={route.routeTitle}
              onBack={handleBack}
            />
          ) : undefined
        }
      >
        {list ? <LinkListView {...list} /> : null}
        {status}
        {detail && !route.isWideView ? (
          <LinkDetailResourceContent
            detail={detail}
            mode="screen"
            headerAction={visit?.headerAction}
            onClose={handleBack}
            onDeleted={() => router.replace("/home")}
          />
        ) : null}
      </ResourceDetailViewport>
    );
  }

  if (visit) {
    if (visit.resource.mode !== "link" || visit.resource.data.id !== Number(linkId)) return null;
    const detail = visit.resource.data;
    return renderLink({
      detail,
      panel: {
        open: true,
        detail,
        onOpenChange: () =>
          router.canGoBack() ? router.back() : router.replace(`/folders/${detail.folderId}`),
      },
    });
  }
  if (!hasMemberAccess) return null;
  return (
    <MemberLinkController
      linkId={linkId}
      isWide={route.isWideView}
      renderLink={renderLink}
    />
  );
}

type LinkPageState = {
  list?: LinkListViewProps;
  panel?: PanelState;
  status?: React.ReactNode;
  detail?: LinkDetail | PublicLinkDetail;
};
type RenderLink = (props: LinkPageState) => React.ReactNode;

function MemberLinkController({
  linkId,
  isWide,
  renderLink,
}: {
  linkId?: string;
  isWide: boolean;
  renderLink: RenderLink;
}) {
  const panel = useMemberPanel("/links", isWide, linkId);
  if (!isWide) {
    return (
      <LinkDetailScreen
        linkId={linkId}
        render={renderLink}
      />
    );
  }
  return renderLink({
    panel,
    list: {
      title: "전체 보기",
      icon: BookCopyIcon,
      basePath: "/links",
      activeLinkId: linkId ? Number(linkId) : undefined,
    },
  });
}

function useMemberPanel(baseHref: string, isWideView: boolean, linkId?: string): PanelState {
  const overlay = useLinkOverlayState({
    isWideView,
    overlayBaseHref: baseHref,
    overlayLinkId: isWideView ? linkId : undefined,
  });
  return {
    open: overlay.isOpen,
    detail: overlay.detail,
    error: overlay.error,
    isLoading: overlay.isLoading,
    notFound: overlay.notFound,
    onDeleted: () => overlay.handleOpenChange(false),
    onOpenChange: (open) => requestLeave(() => overlay.handleOpenChange(open)),
  };
}

function FolderNotice({
  title,
  emoji,
  description,
  onRetry,
}: {
  title: string;
  emoji: string;
  description: string;
  onRetry?: () => void;
}) {
  return (
    <ScrollView
      className="flex-1"
      contentInsetAdjustmentBehavior="automatic"
      contentContainerClassName="flex-grow justify-center"
      showsVerticalScrollIndicator={false}
    >
      <EmptyState
        emoji={emoji}
        title={title}
        description={description}
        actions={
          onRetry ? (
            <Button
              variant="outline"
              onPress={onRetry}
            >
              <Text>다시 시도</Text>
            </Button>
          ) : undefined
        }
      />
    </ScrollView>
  );
}

export { FolderDetailRouteScreen, LinkDetailRouteScreen };
