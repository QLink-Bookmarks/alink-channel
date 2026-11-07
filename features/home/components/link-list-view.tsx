import * as React from "react";
import { RefreshControl, ScrollView, View } from "react-native";

import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadErrorState } from "@/components/ui/load-error-state";
import { Text } from "@/components/ui/text";
import { LinkCardGrid } from "@/features/links/components/link-card-grid/link-card-grid";
import { DEFAULT_LINK_SORT, readLinkSort, toLinkListParams } from "@/features/links/lib/link-sort";
import { useLinksQuery } from "@/features/links/queries";
import type { LinkListItem } from "@/features/links/types";
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
  const listVariant = useViewportListVariant();
  const memoryKey = useListMemoryKey(listVariant);
  const [storedSort, setSort] = useRememberedState<unknown>(memoryKey, "sort", DEFAULT_LINK_SORT);
  const sort = readLinkSort(storedSort);
  const [favoriteOnly, setFavoriteOnly] = useRememberedState(memoryKey, "favoriteOnly", false);
  const linksQuery = useLinksQuery({
    ...toLinkListParams(sort, favoriteOnly),
    folderId,
    size: 30,
  });

  const links = linksQuery.data?.contents ?? [];
  const isLoadError = linksQuery.isError && !linksQuery.data;
  const isEmpty = !linksQuery.isLoading && !isLoadError && links.length === 0;
  const totalLabel = meta ?? `${links.length}개 링크`;
  const { isRefreshing, handleRefresh } = usePullToRefresh(linksQuery.refetch);
  const { scrollViewRef, scrollViewProps } = useListScrollMemory({
    memoryKey,
    contentKey: [sort.key, sort.direction, favoriteOnly].join("|"),
    isLoading: linksQuery.isLoading,
    hasContent: links.length > 0,
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
      {...scrollViewProps}
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
          <Text className="text-sm text-muted-foreground">{totalLabel}</Text>
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
            isLoading={linksQuery.isLoading}
            links={links}
            skeletonCount={8}
            activeLinkId={activeLinkId}
            onCardPress={handleCardPress}
          />
        )}
      </View>
    </ScrollView>
  );
}

export { LinkListView };
export type { LinkListViewProps };
