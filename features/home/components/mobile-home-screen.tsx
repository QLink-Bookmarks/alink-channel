import * as React from "react";
import { RefreshControl, ScrollView, type TextInput, View } from "react-native";

import { TopbarSearchField } from "@/components/layout/topbar-search-field";
import { EmptyState } from "@/components/ui/empty-state";
import { Icon } from "@/components/ui/icon";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { useFoldersQuery } from "@/features/folders/queries";
import { LinkCardGrid } from "@/features/links/components/link-card-grid/link-card-grid";
import { useLinksQuery } from "@/features/links/queries";
import type { LinkOrder } from "@/features/links/types";
import { useHomeSearchFocus } from "@/stores/home-search-focus";

import { OrderFilter } from "./order-filter";

import { type Href, useRouter } from "expo-router";
import { Search } from "lucide-react-native";

const ALL_VALUE = "all";
const UNCATEGORIZED_FOLDER_VALUE = "0";

function MobileHomeScreen() {
  const router = useRouter();
  const foldersQuery = useFoldersQuery({ size: 15 });
  const [selectedFolder, setSelectedFolder] = React.useState<string>(ALL_VALUE);
  const [order, setOrder] = React.useState<LinkOrder>("latest");
  const [favoriteOnly, setFavoriteOnly] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = React.useState("");
  const searchInputRef = React.useRef<TextInput>(null);
  // Bridge from AppHeader's search icon — bump the nonce in the shell, we focus our field here.
  const focusNonce = useHomeSearchFocus((state) => state.nonce);
  React.useEffect(() => {
    if (focusNonce === 0) {
      return;
    }
    searchInputRef.current?.focus();
  }, [focusNonce]);

  React.useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery.trim());
    }, 300);

    return () => {
      clearTimeout(timeout);
    };
  }, [searchQuery]);

  const folderContents = foldersQuery.data?.contents;

  const folderOptions = React.useMemo(
    () => [
      { label: "전체", value: ALL_VALUE },
      { label: "🗂️ 미분류", value: UNCATEGORIZED_FOLDER_VALUE },
      ...(folderContents ?? []).map((folder) => ({
        label: folder.emoji ? `${folder.emoji} ${folder.name}` : folder.name,
        value: String(folder.id),
      })),
    ],
    [folderContents],
  );

  const folderId =
    selectedFolder === ALL_VALUE
      ? undefined
      : Number.isNaN(Number(selectedFolder))
        ? undefined
        : Number(selectedFolder);
  const linksQuery = useLinksQuery({
    folderId,
    order,
    query: debouncedSearchQuery || undefined,
    size: 30,
    isFavorite: favoriteOnly ? true : undefined,
  });
  const links = linksQuery.data?.contents ?? [];
  const isLoading = linksQuery.isLoading;
  const isEmpty = !isLoading && links.length === 0;
  const isRefreshing =
    (linksQuery.isFetching && !linksQuery.isLoading) ||
    (foldersQuery.isFetching && !foldersQuery.isLoading);
  const handleRefresh = React.useCallback(() => {
    void Promise.all([linksQuery.refetch(), foldersQuery.refetch()]);
  }, [foldersQuery, linksQuery]);

  return (
    <ScrollView
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
      <View className="gap-4 px-4 pb-24 pt-2">
        <TopbarSearchField
          className="min-h-12"
          inputRef={searchInputRef}
          leftSlot={
            <Icon
              as={Search}
              className="size-5 text-muted-foreground"
            />
          }
          onChange={setSearchQuery}
          placeholder="링크 · 요약 · 태그 검색…"
          value={searchQuery}
        />

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
        >
          <SegmentedControl
            labelClassName="text-sm"
            options={folderOptions}
            selectionMode="single"
            value={selectedFolder}
            variant="chipsBadge"
            onValueChange={(next) => {
              if (typeof next === "string") {
                setSelectedFolder(next);
              }
            }}
          />
        </ScrollView>

        <View className="flex-row justify-end">
          <OrderFilter
            favoriteOnly={favoriteOnly}
            value={order}
            variant="chipsBadge"
            onFavoriteOnlyChange={setFavoriteOnly}
            onValueChange={setOrder}
          />
        </View>

        {isEmpty ? (
          <EmptyState
            emoji="📭"
            title="아직 링크가 없어요"
            description="새 링크를 추가하면 이곳에 표시돼요."
          />
        ) : (
          <LinkCardGrid
            isLoading={isLoading}
            links={links}
            skeletonCount={6}
            onCardPress={(item) => {
              router.push(`/links/${item.id}` as Href);
            }}
          />
        )}
      </View>
    </ScrollView>
  );
}

export { MobileHomeScreen };
