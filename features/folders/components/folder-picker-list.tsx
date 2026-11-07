import * as React from "react";
import { View, useWindowDimensions } from "react-native";

import { useIsInsideSheet } from "@/components/layout/sheet";
import { cn } from "@/lib/utils";
import { type FolderSection, useFolderNavigation } from "@/stores/folder-navigation";

import type { Folder } from "../types";
import { CreateFolderDialog, type CreatedFolder } from "./create-folder-dialog";
import {
  DEFAULT_FOLDER_EMOJI,
  FolderPickerRow,
  UNCATEGORIZED_PICKER_OPTION,
  getFolderLabel,
} from "./folder-picker-row";
import { FolderSections } from "./folder-sections";
import { NestedListBoundary } from "./nested-list-boundary";

const ALL_SECTIONS: FolderSection[] = ["mine", "shared"];
const WIDE_LIST_MAX_HEIGHT = 340;
const SHEET_LIST_HEIGHT_RATIO = 0.4;
const DEFAULT_NONE_OPTION = { label: "없음 - ✨ AI 자동 분류" };

type FolderPickerId = number | null;

type FolderPickerSelection<Id = FolderPickerId> = {
  id: Id;
  label: string;
  emoji?: string | null;
};

type FolderPickerListProps = {
  selectedFolderId: number | null;
  noneOption?: { label: string; icon?: string } | null;
  filterFolder?: (folder: Folder) => boolean;
  visibleSections?: FolderSection[];
  listMaxHeight?: number;
  isAddDisabled?: boolean;
  isHeightFixed?: boolean;
  onSelect: (selection: FolderPickerSelection) => void;
  onAddDialogOpenChange?: (open: boolean) => void;
  className?: string;
};

function useFolderPickerListMaxHeight(listMaxHeight?: number) {
  const isInsideSheet = useIsInsideSheet();
  const { height } = useWindowDimensions();
  return (
    listMaxHeight ??
    (isInsideSheet ? Math.round(height * SHEET_LIST_HEIGHT_RATIO) : WIDE_LIST_MAX_HEIGHT)
  );
}

function FolderPickerList({
  selectedFolderId,
  noneOption = DEFAULT_NONE_OPTION,
  filterFolder,
  visibleSections = ALL_SECTIONS,
  listMaxHeight,
  isAddDisabled = false,
  isHeightFixed = false,
  onSelect,
  onAddDialogOpenChange,
  className,
}: FolderPickerListProps) {
  const isInsideSheet = useIsInsideSheet();
  const openSectionOn = useFolderNavigation((state) => state.openSectionOn);
  const [createSection, setCreateSection] = React.useState<FolderSection | null>(null);
  const [listKey, setListKey] = React.useState(0);
  const isLarge = isInsideSheet;
  const maxHeight = useFolderPickerListMaxHeight(listMaxHeight);

  const handleAddPress = React.useCallback(
    (section: FolderSection | null) => {
      setCreateSection(section);
      onAddDialogOpenChange?.(section != null);
    },
    [onAddDialogOpenChange],
  );

  const handleCreateOpenChange = React.useCallback(
    (open: boolean) => {
      if (!open) {
        handleAddPress(null);
      }
    },
    [handleAddPress],
  );

  const handleCreated = React.useCallback(
    (folder: CreatedFolder) => {
      const section: FolderSection = folder.isShared ? "shared" : "mine";
      if (visibleSections.includes(section)) {
        openSectionOn("picker", section);
      }
      setListKey((key) => key + 1);
    },
    [openSectionOn, visibleSections],
  );

  const renderRow = React.useCallback(
    (folder: Folder) => (
      <FolderPickerRow
        accessibilityLabel={getFolderLabel(folder)}
        emoji={folder.emoji ?? DEFAULT_FOLDER_EMOJI}
        isLarge={isLarge}
        label={folder.name}
        selected={selectedFolderId === folder.id}
        onPress={() => onSelect({ id: folder.id, label: folder.name, emoji: folder.emoji ?? null })}
      />
    ),
    [isLarge, onSelect, selectedFolderId],
  );

  return (
    <View
      className={cn("gap-1.5", className)}
      aria-label="폴더 선택"
      role="radiogroup"
    >
      {noneOption ? (
        <View className={cn(isLarge && "px-3")}>
          <FolderPickerRow
            emoji={noneOption.icon}
            isLarge={isLarge}
            label={noneOption.label}
            selected={selectedFolderId === null}
            onPress={() => onSelect({ id: null, label: noneOption.label })}
          />
        </View>
      ) : null}
      <NestedListBoundary>
        <FolderSections
          availableHeight={isHeightFixed ? "container" : undefined}
          className={isHeightFixed ? "min-h-0 flex-1" : undefined}
          extraData={selectedFolderId}
          filterFolder={filterFolder}
          hasLeadingDivider={noneOption != null}
          isAddDisabled={isAddDisabled}
          listKey={listKey}
          listMaxHeight={maxHeight}
          size={isLarge ? "large" : "compact"}
          surface="picker"
          tone="surface"
          visibleSections={visibleSections}
          renderRow={renderRow}
          onAddPress={handleAddPress}
        />
      </NestedListBoundary>
      <CreateFolderDialog
        defaultShared={createSection === "shared"}
        mode={isInsideSheet ? "mobile" : "wide"}
        open={createSection != null}
        stackBehavior="push"
        onCreated={handleCreated}
        onOpenChange={handleCreateOpenChange}
      />
    </View>
  );
}

export {
  FolderPickerList,
  FolderPickerRow,
  UNCATEGORIZED_PICKER_OPTION,
  getFolderLabel,
  useFolderPickerListMaxHeight,
};
export type { FolderPickerId, FolderPickerListProps, FolderPickerSelection };
