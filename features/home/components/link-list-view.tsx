import * as React from "react";
import { RefreshControl, ScrollView, View } from "react-native";

import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { LinkCardGrid } from "@/features/links/components/link-card-grid/link-card-grid";
import { useLinksQuery } from "@/features/links/queries";
import type { LinkListItem, LinkOrder } from "@/features/links/types";

import { OrderFilter } from "./order-filter";

import { type Href, useRouter } from "expo-router";
import type { LucideIcon } from "lucide-react-native";

type LinkListViewProps = {
  folderId?: number;
  title: string;
  emoji?: string;
  icon?: LucideIcon;
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
  const [order, setOrder] = React.useState<LinkOrder>("latest");
  const [favoriteOnly, setFavoriteOnly] = React.useState(false);
  const linksQuery = useLinksQuery({
    folderId,
    order,
    size: 30,
    isFavorite: favoriteOnly ? true : undefined,
  });

  const links = linksQuery.data?.contents ?? [];
  const isEmpty = !linksQuery.isLoading && links.length === 0;
  const totalLabel = meta ?? `${links.length}개 링크`;

  const handleCardPress = React.useCallback(
    (item: LinkListItem) => {
      router.replace(`${basePath}?linkId=${item.id}` as Href);
    },
    [basePath, router],
  );

  return (
    <ScrollView
      className="flex-1"
      contentInsetAdjustmentBehavior="automatic"
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={linksQuery.isFetching && !linksQuery.isLoading}
          onRefresh={() => {
            void linksQuery.refetch();
          }}
        />
      }
    >
      <PageHeader
        title={title}
        emoji={emoji}
        icon={icon}
        meta={totalLabel}
        actions={headerActions}
      />
      <View className="gap-5 px-6 pb-6 pt-4 md:pt-0">
        <OrderFilter
          favoriteOnly={favoriteOnly}
          value={order}
          onFavoriteOnlyChange={setFavoriteOnly}
          onValueChange={setOrder}
        />
        {isEmpty ? (
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
