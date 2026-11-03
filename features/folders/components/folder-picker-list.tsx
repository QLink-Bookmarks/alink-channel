import * as React from "react";
import { Pressable, View, useWindowDimensions } from "react-native";

import { useIsInsideSheet } from "@/components/layout/sheet";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";
import { type FolderSection, useFolderNavigation } from "@/stores/folder-navigation";

import type { Folder } from "../types";
import { CreateFolderDialog, type CreatedFolder } from "./create-folder-dialog";
import { FolderSections } from "./folder-sections";
import { NestedListBoundary } from "./nested-list-boundary";

import { Check } from "lucide-react-native/icons";

const ALL_SECTIONS: FolderSection[] = ["mine", "shared"];
const WIDE_LIST_MAX_HEIGHT = 340;
const SHEET_LIST_HEIGHT_RATIO = 0.4;
const DEFAULT_NONE_OPTION = { label: "없음 - ✨ AI 자동 분류" };
const UNCATEGORIZED_PICKER_OPTION = { label: "미분류", icon: "🗂️" };

type FolderPickerSelection = { id: number | null; label: string; emoji?: string | null };

type FolderPickerListProps = {
  selectedFolderId: number | null;
  noneOption?: { label: string; icon?: string } | null;
  filterFolder?: (folder: Folder) => boolean;
  visibleSections?: FolderSection[];
  listMaxHeight?: number;
  isAddDisabled?: boolean;
  onSelect: (selection: FolderPickerSelection) => void;
  onAddDialogOpenChange?: (open: boolean) => void;
  className?: string;
};

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
  onSelect,
  onAddDialogOpenChange,
  className,
}: FolderPickerListProps) {
  const isInsideSheet = useIsInsideSheet();
  const { height } = useWindowDimensions();
  const openSectionOn = useFolderNavigation((state) => state.openSectionOn);
  const [createSection, setCreateSection] = React.useState<FolderSection | null>(null);
  const [listKey, setListKey] = React.useState(0);
  const isLarge = isInsideSheet;
  const maxHeight =
    listMaxHeight ??
    (isInsideSheet ? Math.round(height * SHEET_LIST_HEIGHT_RATIO) : WIDE_LIST_MAX_HEIGHT);

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
      <View className="py-[3px]">
        <FolderPickerRow
          isLarge={isLarge}
          label={getFolderLabel(folder)}
          selected={selectedFolderId === folder.id}
          onPress={() =>
            onSelect({ id: folder.id, label: folder.name, emoji: folder.emoji ?? null })
          }
        />
      </View>
    ),
    [isLarge, onSelect, selectedFolderId],
  );

  return (
    <View className={cn("gap-1.5", className)}>
      {noneOption ? (
        <View className={cn(isLarge && "px-3")}>
          <FolderPickerRow
            icon={noneOption.icon}
            isLarge={isLarge}
            label={noneOption.label}
            selected={selectedFolderId === null}
            onPress={() => onSelect({ id: null, label: noneOption.label })}
          />
        </View>
      ) : null}
      <NestedListBoundary>
        <FolderSections
          filterFolder={filterFolder}
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
  icon,
  selected,
  isLarge,
  onPress,
}: {
  label: string;
  icon?: string;
  selected: boolean;
  isLarge: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="radio"
      aria-checked={selected}
      className={cn(
        "flex-row items-center gap-2 rounded-xl border px-4 web:transition-colors web:hover:border-primary/60 web:motion-reduce:transition-none",
        isLarge ? "min-h-[52px] py-3" : "py-[11px]",
        selected ? "border-primary bg-accent" : "border-border bg-card",
      )}
      onPress={onPress}
    >
      <View className="min-w-0 flex-1 flex-row items-center gap-2">
        {icon ? <Text aria-hidden>{icon}</Text> : null}
        <Text
          className={cn(
            "min-w-0 flex-1 font-semibold",
            isLarge ? "text-sm" : "text-[13px]",
            selected ? "text-accent-foreground" : "text-foreground",
          )}
          numberOfLines={1}
        >
          {label}
        </Text>
      </View>
      <View
        className="size-[18px] shrink-0 items-center justify-center"
        testID={selected ? "folder-picker-selected-mark" : undefined}
      >
        {selected ? (
          <Icon
            as={Check}
            size={18}
            className="text-primary"
          />
        ) : null}
      </View>
    </Pressable>
  );
}

export { FolderPickerList, UNCATEGORIZED_PICKER_OPTION, getFolderLabel };
export type { FolderPickerListProps, FolderPickerSelection };
