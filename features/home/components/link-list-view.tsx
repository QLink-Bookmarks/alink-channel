import * as React from "react";
import { RefreshControl, ScrollView, View } from "react-native";

import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadErrorState } from "@/components/ui/load-error-state";
import { PaginationFooter } from "@/components/ui/pagination-footer";
import { Text } from "@/components/ui/text";
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

import { LinkFilterRow } from "./link-filter-row";

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

function LinkListView({
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

  return (
    <ScrollView
      ref={scrollViewRef}
      {...pagination.scrollViewProps}
      className="flex-1"
      contentInsetAdjustmentBehavior="automatic"
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={handleRefresh}
        />
      }
    >
      <PageHeader
        title={title}
        emoji={emoji}
        icon={icon}
        actions={headerActions}
      />
      <View className="gap-5 px-6 pb-24 pt-4 md:pb-6 md:pt-0">
        <LinkFilterRow
          className="md:-mt-4"
          coverMode={listVariant === "wide" ? "content" : "fill"}
          favoriteOnly={favoriteOnly}
          sort={sort}
          testID="link-filter-row"
          onFavoriteOnlyChange={setFavoriteOnly}
          onSortChange={setSort}
        >
          {totalLabel != null ? (
            <Text className="text-sm text-muted-foreground">{totalLabel}</Text>
          ) : null}
        </LinkFilterRow>
        {isLoadError ? (
          <LoadErrorState
            title="링크를 불러오지 못했어요"
            isRetrying={linksQuery.isFetching}
            onRetry={() => {
              void linksQuery.refetch();
            }}
          />
        ) : isEmpty && favoriteOnly ? (
          <EmptyState
            emoji="📭"
            title="조건에 맞는 링크가 없어요"
            description="바로가기만 보는 중이에요."
          />
        ) : isEmpty ? (
          <EmptyState
            emoji="📭"
            title="아직 링크가 없어요"
            description="새 링크를 추가하면 이곳에 표시돼요."
          />
        ) : (
          <LinkCardGrid
            isLoading={linksQuery.isPending}
            links={links}
            skeletonCount={8}
            activeLinkId={activeLinkId}
            onCardPress={handleCardPress}
          />
        )}
        <PaginationFooter
          isLoading={linksQuery.isFetchingNextPage}
          isError={linksQuery.isFetchNextPageError}
          errorTitle="링크를 불러오지 못했어요"
          onRetry={pagination.retryNextPage}
        />
      </View>
    </ScrollView>
  );
}

export { LinkListView };
export type { LinkListViewProps };
