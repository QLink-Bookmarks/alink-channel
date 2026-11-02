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

import { useFolderSectionData } from "../hooks/use-folder-section-data";
import type { Folder } from "../types";
import {
  FOLDER_SECTION_HEADER_HEIGHT,
  FolderSectionHeader,
  type FolderSectionHeaderShadow,
  type FolderSectionSize,
  type FolderSectionTone,
} from "./folder-section-header";
import {
  FOLDER_LIST_PADDING,
  FOLDER_LIST_ROW_GAP,
  type FolderListEdges,
  FolderSectionList,
} from "./folder-section-list";

const SECTION_TRANSITION_MS = 220;
const ALL_SECTIONS: FolderSection[] = ["mine", "shared"];

type FolderSectionsProps = {
  surface: FolderSectionSurface;
  visibleSections?: FolderSection[];
  size?: FolderSectionSize;
  tone?: FolderSectionTone;
  minVisibleRows?: number;
  rowHeight?: number;
  listMaxHeight?: number;
  listKey?: React.Key;
  className?: string;
  isAddDisabled?: boolean;
  filterFolder?: (folder: Folder) => boolean;
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
  tone = "sidebar",
  minVisibleRows,
  rowHeight,
  listMaxHeight,
  listKey,
  className,
  isAddDisabled = false,
  filterFolder,
  renderRow,
  onAddPress,
  onMinHeightChange,
}: FolderSectionsProps) {
  const isReducedMotion = useReducedMotion();
  const storedOpenSection = useFolderNavigation((state) => state.openSection[surface]);
  const hasHydrated = useFolderNavigation((state) => state.hasHydrated);
  const toggleSection = useFolderNavigation((state) => state.toggleSection);
  const { sections: allSections, status, fetchMore, retry } = useFolderSectionData();
  const sections = React.useMemo(
    () =>
      filterFolder
        ? {
            mine: allSections.mine.filter(filterFolder),
            shared: allSections.shared.filter(filterFolder),
          }
        : allSections,
    [allSections, filterFolder],
  );
  const [edges, setEdges] = React.useState<FolderListEdges>({ atTop: true, atBottom: true });

  const isSingleSection = visibleSections.length === 1;
  const openSection = isSingleSection
    ? visibleSections[0]
    : storedOpenSection && visibleSections.includes(storedOpenSection)
      ? storedOpenSection
      : null;
  const isInitialError = status.isInitialError;

  React.useEffect(() => {
    setEdges({ atTop: true, atBottom: true });
  }, [openSection]);

  const handleToggle = React.useCallback(
    (section: FolderSection) => {
      if (isSingleSection) {
        return;
      }
      toggleSection(surface, section);
    },
    [isSingleSection, surface, toggleSection],
  );

  const renderSectionRow = React.useCallback(
    (folder: Folder) => renderRow(folder, folder.isShared ? "shared" : "mine"),
    [renderRow],
  );

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
                tone={tone}
                isAddDisabled={isAddDisabled}
                isToggleDisabled={isSingleSection}
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
                  tone={tone}
                  renderRow={renderSectionRow}
                  onEdgesChange={setEdges}
                  onFetchMore={fetchMore}
                  onRetry={retry}
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
