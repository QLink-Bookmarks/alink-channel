import * as React from "react";
import { Pressable, View, useWindowDimensions } from "react-native";

import { useIsInsideSheet } from "@/components/layout/sheet";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";
import { type FolderSection, useFolderNavigation } from "@/stores/folder-navigation";

import { handleFolderPickerArrowKey } from "../lib/folder-picker-arrow-keys";
import { webKeyDownProps } from "../lib/web-key-down";
import type { Folder } from "../types";
import { CreateFolderDialog, type CreatedFolder } from "./create-folder-dialog";
import { FolderSections } from "./folder-sections";
import { NestedListBoundary } from "./nested-list-boundary";

import { Check } from "lucide-react-native/icons";

const ALL_SECTIONS: FolderSection[] = ["mine", "shared"];
const WIDE_LIST_MAX_HEIGHT = 340;
const SHEET_LIST_HEIGHT_RATIO = 0.4;
const DEFAULT_NONE_OPTION = { label: "없음" };
const UNCATEGORIZED_PICKER_OPTION = { label: "미분류", icon: "🗂️" };
const DEFAULT_FOLDER_EMOJI = "📁";

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

function getFolderLabel(folder: Folder): string {
  return folder.emoji ? `${folder.emoji} ${folder.name}` : folder.name;
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

function FolderPickerRow({
  label,
  emoji,
  leading,
  accessibilityLabel,
  selected,
  isLarge,
  onPress,
}: {
  label: string;
  emoji?: string;
  leading?: React.ReactNode;
  accessibilityLabel?: string;
  selected: boolean;
  isLarge: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityRole="radio"
      aria-checked={selected}
      {...webKeyDownProps(handleFolderPickerArrowKey)}
      className={cn(
        "flex-row items-center gap-3 rounded-xl web:transition-colors web:motion-reduce:transition-none",
        isLarge ? "min-h-12 px-2" : "min-h-10 px-3",
        selected ? "bg-accent" : "active:bg-muted web:hover:bg-muted",
      )}
      onPress={onPress}
    >
      {leading ? (
        <View
          aria-hidden
          className={cn("shrink-0 items-center", isLarge ? "w-6" : "w-[18px]")}
        >
          {leading}
        </View>
      ) : emoji ? (
        <Text
          aria-hidden
          className={cn("shrink-0 text-center", isLarge ? "w-6 text-base" : "w-[18px] text-sm")}
        >
          {emoji}
        </Text>
      ) : null}
      <Text
        className={cn(
          "min-w-0 flex-1 font-medium text-foreground",
          isLarge ? "text-base" : "text-sm",
        )}
        numberOfLines={1}
      >
        {label}
      </Text>
      <View
        className="size-[18px] shrink-0 items-center justify-center"
        testID={selected ? "folder-picker-selected-mark" : undefined}
      >
        {selected ? (
          <Icon
            as={Check}
            size={18}
            className="text-accent-foreground"
          />
        ) : null}
      </View>
    </Pressable>
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
