import * as React from "react";
import { type LayoutChangeEvent, View } from "react-native";
import { useReducedMotion } from "react-native-reanimated";

import { cn } from "@/lib/utils";
import {
  type FolderScrollSurface,
  type FolderSection,
  type FolderSectionSurface,
  useFolderNavigation,
} from "@/stores/folder-navigation";

import { useFolderSectionData } from "../hooks/use-folder-section-data";
import { useSectionAccordion } from "../hooks/use-section-accordion";
import type { Folder } from "../types";
import { FolderSectionBody } from "./folder-section-body";
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

type FolderSectionsAvailableHeight = "container" | (() => number | undefined);

const NO_EDGES: FolderListEdges = { atTop: true, atBottom: true };

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
  availableHeight?: FolderSectionsAvailableHeight;
  reservesTransitionHeight?: boolean;
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
  availableHeight?: FolderSectionsAvailableHeight;
  reservesTransitionHeight?: boolean;
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
    availableHeight,
    reservesTransitionHeight = false,
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
  const [edgeState, setEdgeState] = React.useState<{ key: K | null; edges: FolderListEdges }>({
    key: openSection,
    edges: NO_EDGES,
  });
  const edges = edgeState.key === openSection ? edgeState.edges : NO_EDGES;
  const containerHeightRef = React.useRef<number | undefined>(undefined);
  const openIndex = openSection ? sections.findIndex((section) => section.key === openSection) : -1;
  const openDefinition = openIndex < 0 ? null : sections[openIndex];
  const openRowCount = openDefinition?.rows.length ?? 0;
  const openKey = openDefinition?.key ?? null;
  const headersHeight = sections.length * FOLDER_SECTION_HEADER_HEIGHT[size];

  const handleEdgesChange = React.useCallback(
    (next: FolderListEdges) => setEdgeState({ key: openKey, edges: next }),
    [openKey],
  );

  const minHeight = React.useMemo(() => {
    if (minVisibleRows == null || rowHeight == null) {
      return undefined;
    }
    if (openIndex < 0) {
      return headersHeight;
    }
    const rows = isListPending ? minVisibleRows : Math.max(1, openRowCount);
    return (
      headersHeight +
      Math.min(rows, minVisibleRows) * (rowHeight + FOLDER_LIST_ROW_GAP) +
      FOLDER_LIST_PADDING[size]
    );
  }, [headersHeight, isListPending, minVisibleRows, openIndex, openRowCount, rowHeight, size]);

  const getAvailableHeight = React.useCallback(
    () =>
      availableHeight === "container"
        ? containerHeightRef.current
        : availableHeight
          ? availableHeight()
          : undefined,
    [availableHeight],
  );

  const accordion = useSectionAccordion<K>({
    openKey,
    isReady: !isListDeferred,
    isReducedMotion,
    minHeight,
    headersHeight,
    listMaxHeight,
    reservesHeight: reservesTransitionHeight,
    getAvailableHeight,
  });
  const displayMinHeight = accordion.displayMinHeight;

  React.useEffect(() => {
    if (displayMinHeight != null) {
      onMinHeightChange?.(displayMinHeight);
    }
  }, [displayMinHeight, onMinHeightChange]);

  const handleContainerLayout = React.useCallback((event: LayoutChangeEvent) => {
    containerHeightRef.current = event.nativeEvent.layout.height;
  }, []);

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

  const sectionRowRenderers = React.useMemo(() => {
    const renderers = new Map<K, (row: T) => React.ReactElement>();
    for (const section of sections) {
      renderers.set(section.key, (row: T) => renderRow(row, section.key));
    }
    return renderers;
  }, [renderRow, sections]);

  function renderSectionList(section: FolderSectionDefinition<K, T>, isOpen: boolean) {
    const sectionRenderRow = sectionRowRenderers.get(section.key)!;
    const onEdgesChange = isOpen ? handleEdgesChange : noopEdges;
    if (props.renderList !== undefined) {
      return props.renderList(section, { onEdgesChange, renderRow: sectionRenderRow });
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
        renderRow={sectionRenderRow}
        onEdgesChange={onEdgesChange}
      />
    );
  }

  return (
    <View
      className={cn("min-h-0 shrink", className)}
      style={displayMinHeight == null ? undefined : { minHeight: displayMinHeight }}
      onLayout={availableHeight === "container" ? handleContainerLayout : undefined}
    >
      {sections.map((section, index) => {
        const isOpen = openSection === section.key;
        const isMounted = !isListDeferred && accordion.mounted.includes(section.key);
        return (
          <React.Fragment key={section.key}>
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
            {isMounted ? (
              <FolderSectionBody
                frozenHeight={accordion.frozen[section.key]}
                isOpening={accordion.opening === section.key}
                openingCap={accordion.openingCap}
                isOpen={isOpen}
                listMaxHeight={listMaxHeight}
                motion={accordion.motion}
                sectionKey={section.key}
                onMeasure={accordion.handleMeasure}
                onVisibleLayout={accordion.handleVisibleLayout}
              >
                {renderSectionList(section, isOpen)}
              </FolderSectionBody>
            ) : null}
          </React.Fragment>
        );
      })}
    </View>
  );
}

function noopEdges() {}

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
  availableHeight,
  reservesTransitionHeight = false,
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
      availableHeight={availableHeight}
      className={className}
      reservesTransitionHeight={reservesTransitionHeight}
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

const MemoFolderSections = React.memo(FolderSections);

export { MemoFolderSections as FolderSections, FolderSectionsView };
export type { FolderSectionDefinition, FolderSectionsAvailableHeight, FolderSectionsProps };
