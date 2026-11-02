import * as React from "react";
import { View } from "react-native";
import Animated, {
  FadeIn,
  FadeOut,
  LinearTransition,
  useReducedMotion,
} from "react-native-reanimated";

import { cn } from "@/lib/utils";
import {
  type FolderScrollSurface,
  type FolderSection,
  type FolderSectionSurface,
  useFolderNavigation,
} from "@/stores/folder-navigation";

import { splitFoldersBySection } from "../lib/folder-pages";
import { useFolderPagesQuery } from "../queries";
import type { Folder } from "../types";
import {
  FOLDER_SECTION_HEADER_HEIGHT,
  FolderSectionHeader,
  type FolderSectionHeaderShadow,
  type FolderSectionSize,
} from "./folder-section-header";
import {
  FOLDER_LIST_PADDING,
  FOLDER_LIST_ROW_GAP,
  type FolderListEdges,
  type FolderListStatus,
  FolderSectionList,
} from "./folder-section-list";

const SECTION_TRANSITION_MS = 220;
const ALL_SECTIONS: FolderSection[] = ["mine", "shared"];

type FolderSectionsProps = {
  surface: FolderSectionSurface;
  visibleSections?: FolderSection[];
  size?: FolderSectionSize;
  minVisibleRows?: number;
  rowHeight?: number;
  listMaxHeight?: number;
  listKey?: React.Key;
  className?: string;
  renderRow: (folder: Folder, section: FolderSection) => React.ReactElement;
  onAddPress: (section: FolderSection) => void;
  onMinHeightChange?: (minHeight: number) => void;
};

function getScrollSurface(surface: FolderSectionSurface): FolderScrollSurface | undefined {
  return surface === "sidebar" || surface === "mobileTab" ? surface : undefined;
}

function FolderSections({
  surface,
  visibleSections = ALL_SECTIONS,
  size = "compact",
  minVisibleRows,
  rowHeight,
  listMaxHeight,
  listKey,
  className,
  renderRow,
  onAddPress,
  onMinHeightChange,
}: FolderSectionsProps) {
  const isReducedMotion = useReducedMotion();
  const storedOpenSection = useFolderNavigation((state) => state.openSection[surface]);
  const hasHydrated = useFolderNavigation((state) => state.hasHydrated);
  const toggleSection = useFolderNavigation((state) => state.toggleSection);
  const pagesQuery = useFolderPagesQuery();
  const { fetchNextPage, refetch } = pagesQuery;
  const [edges, setEdges] = React.useState<FolderListEdges>({ atTop: true, atBottom: true });

  const openSection =
    storedOpenSection && visibleSections.includes(storedOpenSection) ? storedOpenSection : null;
  const sections = React.useMemo(
    () => splitFoldersBySection(pagesQuery.data?.pages),
    [pagesQuery.data?.pages],
  );

  const hasPages = Boolean(pagesQuery.data);
  const isInitialError = !hasPages && pagesQuery.isError && !pagesQuery.isFetching;
  const status: FolderListStatus = {
    isInitialLoading: !hasPages && !isInitialError,
    isInitialError,
    hasNextPage: pagesQuery.hasNextPage,
    isFetchingNextPage: pagesQuery.isFetchingNextPage,
    isFetchNextPageError: pagesQuery.isFetchNextPageError && !pagesQuery.isFetchingNextPage,
  };

  React.useEffect(() => {
    setEdges({ atTop: true, atBottom: true });
  }, [openSection]);

  const handleToggle = React.useCallback(
    (section: FolderSection) => toggleSection(surface, section),
    [surface, toggleSection],
  );

  const renderSectionRow = React.useCallback(
    (folder: Folder) => renderRow(folder, folder.isShared ? "shared" : "mine"),
    [renderRow],
  );

  const handleFetchMore = React.useCallback(() => {
    void fetchNextPage({ cancelRefetch: false });
  }, [fetchNextPage]);

  const handleRetry = React.useCallback(() => {
    if (isInitialError) {
      void refetch({ cancelRefetch: false });
      return;
    }
    void fetchNextPage({ cancelRefetch: false });
  }, [fetchNextPage, isInitialError, refetch]);

  const openIndex = openSection ? visibleSections.indexOf(openSection) : -1;
  const minHeight = React.useMemo(() => {
    if (minVisibleRows == null || rowHeight == null) {
      return undefined;
    }
    const headersHeight = visibleSections.length * FOLDER_SECTION_HEADER_HEIGHT[size];
    if (!openSection) {
      return headersHeight;
    }
    const loadedRows = Math.max(1, sections[openSection].length);
    const rows = status.isInitialLoading || isInitialError ? minVisibleRows : loadedRows;
    return (
      headersHeight +
      Math.min(rows, minVisibleRows) * (rowHeight + FOLDER_LIST_ROW_GAP) +
      FOLDER_LIST_PADDING[size]
    );
  }, [
    isInitialError,
    minVisibleRows,
    openSection,
    rowHeight,
    sections,
    size,
    status.isInitialLoading,
    visibleSections.length,
  ]);

  React.useEffect(() => {
    if (minHeight != null) {
      onMinHeightChange?.(minHeight);
    }
  }, [minHeight, onMinHeightChange]);

  function getHeaderShadow(index: number): FolderSectionHeaderShadow {
    if (openIndex < 0) {
      return null;
    }
    if (index === openIndex && !edges.atTop) {
      return "top";
    }
    if (index === openIndex + 1 && !edges.atBottom) {
      return "bottom";
    }
    return null;
  }

  return (
    <View
      className={cn("min-h-0 shrink", className)}
      style={minHeight == null ? undefined : { minHeight }}
    >
      {visibleSections.map((section, index) => {
        const isOpen = openSection === section;
        return (
          <React.Fragment key={section}>
            <Animated.View
              layout={
                isReducedMotion ? undefined : LinearTransition.duration(SECTION_TRANSITION_MS)
              }
            >
              <FolderSectionHeader
                hasDivider={index > 0}
                isOpen={isOpen}
                section={section}
                shadow={getHeaderShadow(index)}
                size={size}
                onAddPress={onAddPress}
                onToggle={handleToggle}
              />
            </Animated.View>
            {isOpen && hasHydrated ? (
              <Animated.View
                entering={isReducedMotion ? undefined : FadeIn.duration(SECTION_TRANSITION_MS)}
                exiting={
                  isReducedMotion || process.env.EXPO_OS === "web"
                    ? undefined
                    : FadeOut.duration(SECTION_TRANSITION_MS)
                }
                style={{ flexShrink: 1, minHeight: 0, maxHeight: listMaxHeight }}
              >
                <FolderSectionList
                  key={listKey}
                  folders={sections[section]}
                  scrollSurface={getScrollSurface(surface)}
                  section={section}
                  size={size}
                  status={status}
                  renderRow={renderSectionRow}
                  onEdgesChange={setEdges}
                  onFetchMore={handleFetchMore}
                  onRetry={handleRetry}
                />
              </Animated.View>
            ) : null}
          </React.Fragment>
        );
      })}
    </View>
  );
}

export { FolderSections };
export type { FolderSectionsProps };
