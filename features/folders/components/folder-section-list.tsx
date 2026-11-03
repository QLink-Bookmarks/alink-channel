import * as React from "react";
import {
  FlatList,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  View,
} from "react-native";

import { ActivityIndicator } from "@/components/ui/activity-indicator";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";
import type { FolderScrollSurface, FolderSection } from "@/stores/folder-navigation";

import { useSectionScrollMemory } from "../hooks/use-section-scroll-memory";
import { shouldFetchMoreFolders } from "../lib/folder-pages";
import type { Folder, FolderListStatus } from "../types";
import {
  FOLDER_SECTION_LABELS,
  type FolderSectionSize,
  type FolderSectionTone,
} from "./folder-section-header";

import { CircleAlert, RotateCw } from "lucide-react-native/icons";

const EDGE_TOLERANCE = 1;
const FOLDER_LIST_ROW_GAP = 2;
const FOLDER_LIST_PADDING: Record<FolderSectionSize, number> = { compact: 8, large: 12 };
const SKELETON_ROWS: Record<FolderSection, number> = { mine: 5, shared: 3 };
const SKELETON_WIDTHS = ["w-3/5", "w-4/5", "w-1/2", "w-2/3", "w-3/5"];

const EMPTY_COPY: Record<FolderSection, { title: string; description: string }> = {
  mine: { title: "아직 만든 폴더가 없어요", description: "+로 첫 폴더를 만들어요." },
  shared: { title: "아직 공유 폴더가 없어요", description: "+로 함께 쓸 폴더를 만들어요." },
};

type FolderListEdges = {
  atTop: boolean;
  atBottom: boolean;
};

type FolderSectionListProps = {
  section: FolderSection;
  folders: Folder[];
  status: FolderListStatus;
  size?: FolderSectionSize;
  tone?: FolderSectionTone;
  scrollSurface?: FolderScrollSurface;
  className?: string;
  style?: React.ComponentProps<typeof FlatList>["style"];
  renderRow: (folder: Folder) => React.ReactElement;
  onFetchMore: () => void;
  onRetry: () => void;
  onEdgesChange?: (edges: FolderListEdges) => void;
};

function FolderSectionList({
  section,
  folders,
  status,
  size = "compact",
  tone = "sidebar",
  scrollSurface,
  className,
  style,
  renderRow,
  onFetchMore,
  onRetry,
  onEdgesChange,
}: FolderSectionListProps) {
  const listRef = React.useRef<FlatList<Folder>>(null);
  const offsetRef = React.useRef(0);
  const edgesRef = React.useRef<FolderListEdges>({ atTop: true, atBottom: true });
  const [contentHeight, setContentHeight] = React.useState(0);
  const [viewportHeight, setViewportHeight] = React.useState(0);
  const { hasNextPage, isFetchingNextPage, isFetchNextPageError, isInitialError } = status;
  const isListReady = !status.isInitialLoading && !isInitialError;

  const scrollTo = React.useCallback((offset: number) => {
    listRef.current?.scrollToOffset({ offset, animated: false });
  }, []);

  const { recordScrollOffset, stopRestore } = useSectionScrollMemory({
    surface: scrollSurface,
    section,
    contentHeight,
    viewportHeight,
    hasNextPage,
    isFetchingNextPage,
    isFetchNextPageError,
    scrollTo,
    onFetchMore,
  });

  const updateEdges = React.useCallback(
    (nextContentHeight: number, nextViewportHeight: number) => {
      const offset = offsetRef.current;
      const edges = {
        atTop: offset <= EDGE_TOLERANCE,
        atBottom: offset + nextViewportHeight >= nextContentHeight - EDGE_TOLERANCE,
      };
      if (edges.atTop === edgesRef.current.atTop && edges.atBottom === edgesRef.current.atBottom) {
        return;
      }
      edgesRef.current = edges;
      onEdgesChange?.(edges);
    },
    [onEdgesChange],
  );

  React.useEffect(() => {
    updateEdges(contentHeight, viewportHeight);
  }, [contentHeight, updateEdges, viewportHeight]);

  React.useEffect(() => {
    if (!isListReady) {
      return;
    }
    const shouldFetch = shouldFetchMoreFolders(
      { hasOpenSection: true, hasNextPage, isFetchingNextPage, isFetchNextPageError },
      { endReached: false, contentHeight, viewportHeight },
    );
    if (shouldFetch) {
      onFetchMore();
    }
  }, [
    contentHeight,
    folders.length,
    hasNextPage,
    isFetchNextPageError,
    isFetchingNextPage,
    isListReady,
    onFetchMore,
    viewportHeight,
  ]);

  const handleScroll = React.useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
      offsetRef.current = contentOffset.y;
      recordScrollOffset(contentOffset.y);
      updateEdges(contentSize.height, layoutMeasurement.height);
    },
    [recordScrollOffset, updateEdges],
  );

  const handleEndReached = React.useCallback(() => {
    if (!isListReady) {
      return;
    }
    const shouldFetch = shouldFetchMoreFolders(
      { hasOpenSection: true, hasNextPage, isFetchingNextPage, isFetchNextPageError },
      { endReached: true },
    );
    if (shouldFetch) {
      onFetchMore();
    }
  }, [hasNextPage, isFetchNextPageError, isFetchingNextPage, isListReady, onFetchMore]);

  const handleLayout = React.useCallback((event: LayoutChangeEvent) => {
    setViewportHeight(event.nativeEvent.layout.height);
  }, []);

  const handleContentSizeChange = React.useCallback((_width: number, height: number) => {
    setContentHeight(height);
  }, []);

  const renderItem = React.useCallback(
    ({ item }: { item: Folder }) => renderRow(item),
    [renderRow],
  );

  const sectionLabel = FOLDER_SECTION_LABELS[section];
  const isLarge = size === "large";

  return (
    <FlatList
      ref={listRef}
      accessibilityLabel={`${sectionLabel} 목록`}
      className={cn("min-h-0 shrink grow-0", className)}
      contentContainerClassName={cn("gap-0.5 pb-1.5 pt-0.5", isLarge && "px-3 pb-2.5")}
      contentInsetAdjustmentBehavior="automatic"
      data={isListReady ? folders : []}
      keyExtractor={(folder) => String(folder.id)}
      renderItem={renderItem}
      scrollEventThrottle={16}
      style={style}
      showsVerticalScrollIndicator={false}
      initialNumToRender={20}
      nestedScrollEnabled
      onContentSizeChange={handleContentSizeChange}
      onEndReached={handleEndReached}
      onEndReachedThreshold={0.5}
      onLayout={handleLayout}
      onScroll={handleScroll}
      onScrollBeginDrag={stopRestore}
      ListEmptyComponent={
        status.isInitialLoading ? (
          <FolderListSkeleton
            rows={SKELETON_ROWS[section]}
            size={size}
          />
        ) : isInitialError ? (
          <FolderListError
            size={size}
            tone={tone}
            onRetry={onRetry}
          />
        ) : hasNextPage || isFetchNextPageError ? null : (
          <FolderListEmpty
            section={section}
            size={size}
            tone={tone}
          />
        )
      }
      ListFooterComponent={
        isListReady ? (
          <FolderListFooter
            isFetchingNextPage={isFetchingNextPage}
            isFetchNextPageError={isFetchNextPageError}
            size={size}
            tone={tone}
            onRetry={onRetry}
          />
        ) : null
      }
    />
  );
}

function FolderListSkeleton({ rows, size }: { rows: number; size: FolderSectionSize }) {
  const isLarge = size === "large";
  return (
    <View
      accessibilityLabel="폴더를 불러오는 중"
      accessibilityRole="progressbar"
      accessibilityState={{ busy: true }}
    >
      {SKELETON_WIDTHS.slice(0, rows).map((width, index) => (
        <View
          key={`skeleton-${index}`}
          className={cn(
            "flex-row items-center",
            isLarge ? "h-[60px] gap-3 px-2" : "h-10 gap-2.5 px-3",
          )}
        >
          <Skeleton className={isLarge ? "size-10 rounded-2xl" : "size-[18px]"} />
          <Skeleton className={cn(isLarge ? "h-3.5" : "h-2.5", width)} />
        </View>
      ))}
    </View>
  );
}

function getToneText(size: FolderSectionSize, tone: FolderSectionTone) {
  if (size === "large") {
    return { strong: "text-lg text-foreground", muted: "text-sm text-muted-foreground" };
  }
  if (tone === "surface") {
    return { strong: "text-sm text-foreground", muted: "text-xs text-muted-foreground" };
  }
  return { strong: "text-sm text-sidebar-hover", muted: "text-xs text-sidebar-muted" };
}

function FolderListError({
  size,
  tone,
  onRetry,
}: {
  size: FolderSectionSize;
  tone: FolderSectionTone;
  onRetry: () => void;
}) {
  const isLarge = size === "large";
  const text = getToneText(size, tone);
  return (
    <View
      accessibilityRole="alert"
      className={cn("items-start gap-2 pb-3 pt-2.5", isLarge ? "px-2" : "px-3")}
    >
      <View className="flex-row items-center gap-1.5">
        <Icon
          as={CircleAlert}
          className="size-[15px] text-destructive"
        />
        <Text className={cn("font-semibold", text.strong)}>폴더를 불러오지 못했어요</Text>
      </View>
      <Text className={cn(text.muted, "web:break-keep")}>
        연결 상태를 확인하고 다시 시도해 주세요.
      </Text>
      <Button
        className={isLarge ? "h-11 px-4" : undefined}
        size="sm"
        variant="outline"
        onPress={onRetry}
      >
        <Icon
          as={RotateCw}
          className="size-3.5 text-foreground"
        />
        <Text>다시 시도</Text>
      </Button>
    </View>
  );
}

function FolderListEmpty({
  section,
  size,
  tone,
}: {
  section: FolderSection;
  size: FolderSectionSize;
  tone: FolderSectionTone;
}) {
  const isLarge = size === "large";
  const text = getToneText(size, tone);
  const copy = EMPTY_COPY[section];
  return (
    <View className={cn("gap-0.5 pb-2 pt-1.5", isLarge ? "px-2" : "px-3")}>
      <Text className={cn("font-semibold", text.strong)}>{copy.title}</Text>
      <Text className={text.muted}>{copy.description}</Text>
    </View>
  );
}

function FolderListFooter({
  isFetchingNextPage,
  isFetchNextPageError,
  size,
  tone,
  onRetry,
}: {
  isFetchingNextPage: boolean;
  isFetchNextPageError: boolean;
  size: FolderSectionSize;
  tone: FolderSectionTone;
  onRetry: () => void;
}) {
  const isLarge = size === "large";
  const text = getToneText(size, tone);
  if (isFetchingNextPage) {
    return (
      <View
        accessibilityLabel="폴더를 더 불러오는 중"
        accessibilityRole="progressbar"
        className={cn("items-center justify-center", isLarge ? "h-[52px]" : "h-10")}
      >
        <ActivityIndicator size="small" />
      </View>
    );
  }
  if (isFetchNextPageError) {
    return (
      <View
        accessibilityRole="alert"
        className={cn(
          "flex-row items-center justify-between gap-1",
          isLarge ? "h-[52px] pl-2" : "h-10 pl-3",
        )}
      >
        <Text className={text.muted}>더 불러오지 못했어요</Text>
        <Button
          className={isLarge ? "h-11" : undefined}
          size={isLarge ? "sm" : "xs"}
          variant="ghost"
          onPress={onRetry}
        >
          <Icon
            as={RotateCw}
            className={cn("text-primary", isLarge ? "size-3.5" : "size-3")}
          />
          <Text className={cn("font-semibold text-primary", isLarge ? "text-sm" : "text-xs")}>
            다시 시도
          </Text>
        </Button>
      </View>
    );
  }
  return null;
}

export { FOLDER_LIST_PADDING, FOLDER_LIST_ROW_GAP, FolderSectionList };
export type { FolderListEdges, FolderSectionListProps };
