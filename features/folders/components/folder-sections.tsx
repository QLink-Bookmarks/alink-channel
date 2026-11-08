import * as React from "react";

import {
  type FolderScrollSurface,
  type FolderSection,
  type FolderSectionSurface,
  useFolderNavigation,
} from "@/stores/folder-navigation";

import { useFolderSectionData } from "../hooks/use-folder-section-data";
import type { Folder } from "../types";
import {
  FOLDER_SECTION_LABELS,
  type FolderSectionSize,
  type FolderSectionTone,
} from "./folder-section-header";
import { FolderSectionList } from "./folder-section-list";
import {
  type FolderSectionDefinition,
  type FolderSectionListSlotProps,
  type FolderSectionsAvailableHeight,
  FolderSectionsView,
} from "./folder-sections-view";

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
  currentFolder?: Folder | null;
  className?: string;
  availableHeight?: FolderSectionsAvailableHeight;
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
      isRevealing={slot.isRevealing}
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
export type { FolderSectionDefinition, FolderSectionsProps };
