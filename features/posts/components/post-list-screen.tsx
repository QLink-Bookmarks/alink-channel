import * as React from "react";
import { FlatList, Pressable, View } from "react-native";

import { PageHeader } from "@/components/layout/page-header";
import { ActivityIndicator } from "@/components/ui/activity-indicator";
import { EmptyState } from "@/components/ui/empty-state";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { formatPostDate } from "@/features/posts/lib";
import { usePostsQuery } from "@/features/posts/queries";
import type { PostListItem, PostType } from "@/features/posts/types";

import { type Href, useRouter } from "expo-router";
import { ChevronRight } from "lucide-react-native/icons";

type PostListScreenProps = {
  mode: "wide" | "mobile";
  type: PostType;
  basePath: string;
  title: string;
  emptyEmoji: string;
  emptyTitle: string;
  emptyDescription: string;
};

function PostListScreen({
  mode,
  type,
  basePath,
  title,
  emptyEmoji,
  emptyTitle,
  emptyDescription,
}: PostListScreenProps) {
  const router = useRouter();
  const query = usePostsQuery(type);

  const posts = React.useMemo(
    () => query.data?.pages.flatMap((page) => page.contents) ?? [],
    [query.data],
  );

  const handlePressItem = React.useCallback(
    (id: number) => {
      router.push(`${basePath}/${id}` as Href);
    },
    [basePath, router],
  );

  const renderItem = React.useCallback(
    ({ item }: { item: PostListItem }) => (
      <Pressable
        className="flex-row items-center justify-between gap-3 px-4 py-4 active:bg-accent web:hover:bg-accent md:px-6"
        onPress={() => handlePressItem(item.id)}
      >
        <View className="min-w-0 flex-1 gap-1">
          <Text
            numberOfLines={1}
            className="text-base font-semibold text-foreground"
          >
            {item.title}
          </Text>
          <Text className="text-xs text-muted-foreground">
            {item.author} · {formatPostDate(item.createdAt)}
          </Text>
        </View>
        <Icon
          as={ChevronRight}
          size={18}
          className="text-muted-foreground"
        />
      </Pressable>
    ),
    [handlePressItem],
  );

  if (query.isLoading) {
    return (
      <ActivityIndicator
        size="large"
        className="flex-1 py-16"
      />
    );
  }

  if (query.isError) {
    return (
      <View className="flex-1">
        <EmptyState
          className="flex-1"
          emoji="⚠️"
          title={`${title}을 불러오지 못했어요`}
          description="잠시 후 다시 시도해주세요."
        />
      </View>
    );
  }

  return (
    <FlatList
      data={posts}
      keyExtractor={(item) => String(item.id)}
      renderItem={renderItem}
      contentInsetAdjustmentBehavior="automatic"
      showsVerticalScrollIndicator={false}
      contentContainerClassName="mx-auto w-full pb-12 md:max-w-3xl"
      ListHeaderComponent={
        mode === "wide" ? (
          <PageHeader
            className="px-4 md:px-6"
            title={title}
          />
        ) : null
      }
      ItemSeparatorComponent={() => <View className="h-px bg-border" />}
      ListEmptyComponent={
        <EmptyState
          className="py-16"
          emoji={emptyEmoji}
          title={emptyTitle}
          description={emptyDescription}
        />
      }
      onEndReachedThreshold={0.4}
      onEndReached={() => {
        if (query.hasNextPage && !query.isFetchingNextPage) {
          void query.fetchNextPage();
        }
      }}
      ListFooterComponent={
        query.isFetchingNextPage ? (
          <ActivityIndicator
            size="small"
            className="py-6"
          />
        ) : null
      }
    />
  );
}

export { PostListScreen };
export type { PostListScreenProps };
