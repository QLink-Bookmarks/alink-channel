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
  FOLDER_SECTION_LABELS,
  type FolderSectionCurrentFolder,
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
  FolderSectionLocalList,
} from "./folder-section-list";

const SECTION_TRANSITION_MS = 220;
const ALL_SECTIONS: FolderSection[] = ["mine", "shared"];

type FolderSectionDefinition<K extends string, T> = {
  key: K;
  label: string;
  rows: readonly T[];
  canAdd?: boolean;
  currentFolder?: FolderSectionCurrentFolder | null;
  emptyComponent?: React.ReactElement | null;
};

type FolderSectionListSlotProps<T> = {
  onEdgesChange: (edges: FolderListEdges) => void;
  renderRow: (row: T) => React.ReactElement;
};

type FolderSectionsViewListProps<K extends string, T> =
  | {
      renderList: (
        section: FolderSectionDefinition<K, T>,
        slot: FolderSectionListSlotProps<T>,
      ) => React.ReactElement;
      getRowKey?: (row: T) => string;
    }
  | { renderList?: undefined; getRowKey: (row: T) => string };

type FolderSectionsViewProps<K extends string, T> = FolderSectionsViewListProps<K, T> & {
  sections: readonly FolderSectionDefinition<K, T>[];
  openSection: K | null;
  size?: FolderSectionSize;
  tone?: FolderSectionTone;
  minVisibleRows?: number;
  rowHeight?: number;
  listMaxHeight?: number;
  listKey?: React.Key;
  className?: string;
  isAddDisabled?: boolean;
  isToggleDisabled?: boolean;
  hasLeadingDivider?: boolean;
  // renderList, isListDeferred and isListPending exist for the server-backed FolderSections wrapper.
  isListDeferred?: boolean;
  isListPending?: boolean;
  extraData?: unknown;
  renderRow: (row: T, section: K) => React.ReactElement;
  onToggle: (section: K) => void;
  onAddPress?: (section: K) => void;
  onMinHeightChange?: (minHeight: number) => void;
};

type FolderSectionsProps = {
  surface: FolderSectionSurface;
  visibleSections?: FolderSection[];
  size?: FolderSectionSize;
  tone?: FolderSectionTone;
  minVisibleRows?: number;
  rowHeight?: number;
  listMaxHeight?: number;
  listKey?: React.Key;
  currentFolder?: Folder | null;
  className?: string;
  isAddDisabled?: boolean;
  hasLeadingDivider?: boolean;
  extraData?: unknown;
  filterFolder?: (folder: Folder) => boolean;
  renderRow: (folder: Folder, section: FolderSection) => React.ReactElement;
  onAddPress: (section: FolderSection) => void;
  onMinHeightChange?: (minHeight: number) => void;
};

function getScrollSurface(surface: FolderSectionSurface): FolderScrollSurface | undefined {
  return surface === "sidebar" || surface === "mobileTab" ? surface : undefined;
}

function FolderSectionsView<K extends string, T>(props: FolderSectionsViewProps<K, T>) {
  const {
    sections,
    openSection,
    size = "compact",
    tone = "sidebar",
    minVisibleRows,
    rowHeight,
    listMaxHeight,
    listKey,
    className,
    isAddDisabled = false,
    isToggleDisabled = false,
    hasLeadingDivider = false,
    isListDeferred = false,
    isListPending = false,
    extraData,
    renderRow,
    onToggle,
    onAddPress,
    onMinHeightChange,
  } = props;
  const isReducedMotion = useReducedMotion();
  const [edges, setEdges] = React.useState<FolderListEdges>({ atTop: true, atBottom: true });
  const openIndex = openSection ? sections.findIndex((section) => section.key === openSection) : -1;
  const openDefinition = openIndex < 0 ? null : sections[openIndex];
  const openRowCount = openDefinition?.rows.length ?? 0;

  React.useEffect(() => {
    setEdges({ atTop: true, atBottom: true });
  }, [openSection]);

  const openKey = openDefinition?.key ?? null;
  const renderOpenRow = React.useCallback(
    (row: T) => renderRow(row, openKey as K),
    [openKey, renderRow],
  );

  const minHeight = React.useMemo(() => {
    if (minVisibleRows == null || rowHeight == null) {
      return undefined;
    }
    const headersHeight = sections.length * FOLDER_SECTION_HEADER_HEIGHT[size];
    if (openIndex < 0) {
      return headersHeight;
    }
    const rows = isListPending ? minVisibleRows : Math.max(1, openRowCount);
    return (
      headersHeight +
      Math.min(rows, minVisibleRows) * (rowHeight + FOLDER_LIST_ROW_GAP) +
      FOLDER_LIST_PADDING[size]
    );
  }, [isListPending, minVisibleRows, openIndex, openRowCount, rowHeight, sections.length, size]);

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

  function renderOpenList(section: FolderSectionDefinition<K, T>) {
    if (props.renderList !== undefined) {
      return props.renderList(section, { onEdgesChange: setEdges, renderRow: renderOpenRow });
    }
    return (
      <FolderSectionLocalList
        key={listKey}
        emptyComponent={section.emptyComponent}
        extraData={extraData}
        getRowKey={props.getRowKey}
        label={section.label}
        rows={section.rows}
        size={size}
        renderRow={renderOpenRow}
        onEdgesChange={setEdges}
      />
    );
  }

  return (
    <View
      className={cn("min-h-0 shrink", className)}
      style={minHeight == null ? undefined : { minHeight }}
    >
      {sections.map((section, index) => {
        const isOpen = openSection === section.key;
        return (
          <React.Fragment key={section.key}>
            <Animated.View
              layout={
                isReducedMotion ? undefined : LinearTransition.duration(SECTION_TRANSITION_MS)
              }
            >
              <FolderSectionHeader
                canAdd={section.canAdd ?? true}
                hasDivider={index > 0 || hasLeadingDivider}
                isOpen={isOpen}
                label={section.label}
                section={section.key}
                shadow={getHeaderShadow(index)}
                currentFolder={section.currentFolder ?? null}
                size={size}
                tone={tone}
                isAddDisabled={isAddDisabled}
                isToggleDisabled={isToggleDisabled}
                onAddPress={onAddPress}
                onToggle={onToggle}
              />
            </Animated.View>
            {isOpen && !isListDeferred ? (
              <Animated.View
                entering={isReducedMotion ? undefined : FadeIn.duration(SECTION_TRANSITION_MS)}
                exiting={
                  isReducedMotion || process.env.EXPO_OS === "web"
                    ? undefined
                    : FadeOut.duration(SECTION_TRANSITION_MS)
                }
                style={{ flexShrink: 1, minHeight: 0, maxHeight: listMaxHeight }}
              >
                {renderOpenList(section)}
              </Animated.View>
            ) : null}
          </React.Fragment>
        );
      })}
    </View>
  );
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
  currentFolder = null,
  className,
  isAddDisabled = false,
  hasLeadingDivider = false,
  extraData,
  filterFolder,
  renderRow,
  onAddPress,
  onMinHeightChange,
}: FolderSectionsProps) {
  const storedOpenSection = useFolderNavigation((state) => state.openSection[surface]);
  const hasHydrated = useFolderNavigation((state) => state.hasHydrated);
  const toggleSection = useFolderNavigation((state) => state.toggleSection);
  const { sections: allSections, status, fetchMore, retry } = useFolderSectionData();
  const folderSections = React.useMemo(
    () =>
      filterFolder
        ? {
            mine: allSections.mine.filter(filterFolder),
            shared: allSections.shared.filter(filterFolder),
          }
        : allSections,
    [allSections, filterFolder],
  );

  const isSingleSection = visibleSections.length === 1;
  const openSection = isSingleSection
    ? visibleSections[0]
    : storedOpenSection && visibleSections.includes(storedOpenSection)
      ? storedOpenSection
      : null;
  const currentFolderSection: FolderSection | null =
    currentFolder && hasHydrated && !status.isInitialLoading
      ? currentFolder.isShared
        ? "shared"
        : "mine"
      : null;

  const sections = React.useMemo(
    () =>
      visibleSections.map(
        (section): FolderSectionDefinition<FolderSection, Folder> => ({
          key: section,
          label: FOLDER_SECTION_LABELS[section],
          rows: folderSections[section],
          currentFolder: currentFolderSection === section ? currentFolder : null,
        }),
      ),
    [currentFolder, currentFolderSection, folderSections, visibleSections],
  );

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

  const renderList = (
    section: FolderSectionDefinition<FolderSection, Folder>,
    slot: FolderSectionListSlotProps<Folder>,
  ) => (
    <FolderSectionList
      key={listKey}
      extraData={extraData}
      folders={section.rows}
      scrollSurface={getScrollSurface(surface)}
      section={section.key}
      size={size}
      status={status}
      tone={tone}
      renderRow={renderSectionRow}
      onEdgesChange={slot.onEdgesChange}
      onFetchMore={fetchMore}
      onRetry={retry}
    />
  );

  return (
    <FolderSectionsView
      className={className}
      hasLeadingDivider={hasLeadingDivider}
      isAddDisabled={isAddDisabled}
      isListDeferred={!hasHydrated}
      isListPending={status.isInitialLoading || status.isInitialError}
      isToggleDisabled={isSingleSection}
      listMaxHeight={listMaxHeight}
      minVisibleRows={minVisibleRows}
      openSection={openSection}
      rowHeight={rowHeight}
      sections={sections}
      size={size}
      tone={tone}
      renderList={renderList}
      renderRow={renderRow}
      onAddPress={onAddPress}
      onMinHeightChange={onMinHeightChange}
      onToggle={handleToggle}
    />
  );
}

export { FolderSections, FolderSectionsView };
export type { FolderSectionDefinition, FolderSectionsProps };
