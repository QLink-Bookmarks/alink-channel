import * as React from "react";
import { RefreshControl } from "react-native";

import { PublicFolderList } from "@/features/folders/components/public-folder-list";
import { LinkCardGrid } from "@/features/links/components/link-card-grid/link-card-grid";
import { useLinkCardSize } from "@/features/links/hooks/use-link-card-size";
import { getLinkCardPageSize } from "@/features/links/lib/link-card-size";
import { DEFAULT_LINK_SORT, readLinkSort, toLinkListParams } from "@/features/links/lib/link-sort";
import { useLinkPagesQuery } from "@/features/links/queries";
import type { LinkListItem } from "@/features/links/types";
import { useCursorPagination } from "@/lib/hooks/use-cursor-pagination";
import {
  useListMemoryKey,
  useListScrollMemory,
  useRememberedState,
  useViewportListVariant,
} from "@/lib/hooks/use-list-scroll-memory";
import { usePullToRefresh } from "@/lib/hooks/use-pull-to-refresh";

import { LinkListBody, type LinkListBodyProps } from "./link-list-body";

import { type Href, useRouter } from "expo-router";
import type { LucideIcon } from "lucide-react-native";

type LinkListViewProps = {
  folderId?: number;
  title: string;
  emoji?: string;
  icon?: LucideIcon;
  // The count line, e.g. "12개 링크"; the loaded count is used when left out.
  meta?: string;
  basePath: string;
  activeLinkId?: number | null;
  headerActions?: React.ReactNode;
};

function renderLinkListBody(props: LinkListBodyProps) {
  return <LinkListBody {...props} />;
}

type PublicLinkListViewProps = {
  publicList: Omit<React.ComponentProps<typeof PublicFolderList>, "render">;
};

function LinkListView(props: LinkListViewProps | PublicLinkListViewProps) {
  return "publicList" in props ? (
    <PublicFolderList
      {...props.publicList}
      render={renderLinkListBody}
    />
  ) : (
    <MemberLinkList {...props} />
  );
}

function MemberLinkList({
  folderId,
  title,
  emoji,
  icon,
  meta,
  basePath,
  activeLinkId,
  headerActions,
}: LinkListViewProps) {
  const router = useRouter();
  const { isWideView, linkCardSize } = useLinkCardSize();
  const listVariant = useViewportListVariant();
  const memoryKey = useListMemoryKey(listVariant);
  const [storedSort, setSort] = useRememberedState<unknown>(memoryKey, "sort", DEFAULT_LINK_SORT);
  const sort = React.useMemo(() => readLinkSort(storedSort), [storedSort]);
  const [favoriteOnly, setFavoriteOnly] = useRememberedState(memoryKey, "favoriteOnly", false);
  const linksQuery = useLinkPagesQuery({
    ...toLinkListParams(sort, favoriteOnly),
    folderId,
    size: getLinkCardPageSize(linkCardSize, isWideView),
  });

  const { links } = linksQuery;
  const isLoadError = linksQuery.isError && !linksQuery.data;
  const isEmpty = linksQuery.isSuccess && !linksQuery.hasNextPage && links.length === 0;
  const totalLabel =
    meta ?? (linksQuery.isSuccess && !linksQuery.hasNextPage ? `${links.length}개 링크` : null);
  const { isRefreshing, handleRefresh } = usePullToRefresh(linksQuery.refetch);
  const contentKey = JSON.stringify([folderId, sort.key, sort.direction, favoriteOnly]);
  const { scrollViewRef, scrollViewProps } = useListScrollMemory({
    memoryKey,
    contentKey,
    isLoading: linksQuery.isPending,
    hasContent: links.length > 0,
  });
  const pagination = useCursorPagination(linksQuery, {
    scroll: { contentKey, ref: scrollViewRef, props: scrollViewProps },
  });

  const handleCardPress = React.useCallback(
    (item: LinkListItem) => {
      if (listVariant === "wide") {
        router.replace(`${basePath}?linkId=${item.id}` as Href);
        return;
      }
      router.push(`/links/${item.id}` as Href);
    },
    [basePath, listVariant, router],
  );

  return renderLinkListBody({
    title,
    emoji,
    icon,
    headerActions,
    scrollRef: scrollViewRef,
    scrollProps: {
      ...pagination.scrollViewProps,
      refreshControl: (
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={handleRefresh}
        />
      ),
    },
    meta: totalLabel,
    filter: {
      coverMode: listVariant === "wide" ? "content" : "fill",
      favoriteOnly,
      sort,
      onFavoriteOnlyChange: setFavoriteOnly,
      onSortChange: setSort,
    },
    isLoadError,
    isEmpty,
    isRetrying: linksQuery.isFetching,
    emptyTitle: favoriteOnly ? "조건에 맞는 링크가 없어요" : "아직 링크가 없어요",
    emptyDescription: favoriteOnly
      ? "바로가기만 보는 중이에요."
      : "새 링크를 추가하면 이곳에 표시돼요.",
    onRetry: () => void linksQuery.refetch(),
    pagination: {
      isLoading: linksQuery.isFetchingNextPage,
      isError: linksQuery.isFetchNextPageError,
      onRetry: pagination.retryNextPage,
    },
    children: (
      <LinkCardGrid
        isLoading={linksQuery.isPending}
        links={links}
        skeletonCount={8}
        activeLinkId={activeLinkId}
        onCardPress={handleCardPress}
      />
    ),
  });
}

export { LinkListView };
export type { LinkListViewProps, PublicLinkListViewProps };
