import * as React from "react";
import { Pressable, View, useWindowDimensions } from "react-native";

import { SidebarItem, SidebarRailButton } from "@/components/layout/sidebar";
import { Icon } from "@/components/ui/icon";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Text } from "@/components/ui/text";
import type { FolderSection } from "@/stores/folder-navigation";
import type { TriggerRef } from "@rn-primitives/popover";

import { useFolderSectionData } from "../hooks/use-folder-section-data";
import type { Folder } from "../types";
import { FOLDER_SECTION_LABELS } from "./folder-section-header";
import { FolderSectionList } from "./folder-section-list";

import type { LucideIcon } from "lucide-react-native";
import { Plus } from "lucide-react-native/icons";

const HOVER_CLOSE_DELAY_MS = 150;
const FLYOUT_MAX_LIST_HEIGHT = 420;
const FLYOUT_VERTICAL_MARGIN = 160;

type OpenMode = "hover" | "press";
type PopoverSide = React.ComponentProps<typeof PopoverContent>["side"];

const FLYOUT_SIDE = (process.env.EXPO_OS === "web" ? "right" : "bottom") as PopoverSide;

type FolderRailFlyoutProps = {
  section: FolderSection;
  icon: LucideIcon;
  currentFolderId?: number;
  onSelect: (folder: Folder) => void;
  onAddPress: (section: FolderSection) => void;
};

function focusFirstFlyoutItem(content: unknown, listLabel: string, addLabel: string) {
  if (process.env.EXPO_OS !== "web" || !content) {
    return;
  }
  const element = content as HTMLElement;
  const target =
    element.querySelector<HTMLElement>(`[aria-label="${listLabel}"] [role="button"]`) ??
    element.querySelector<HTMLElement>(`[aria-label="${addLabel}"]`);
  target?.focus();
}

function FolderRailFlyout({
  section,
  icon,
  currentFolderId,
  onSelect,
  onAddPress,
}: FolderRailFlyoutProps) {
  const { height: windowHeight } = useWindowDimensions();
  const { sections, status, fetchMore, retry } = useFolderSectionData();
  const triggerRef = React.useRef<TriggerRef>(null);
  const contentRef = React.useRef<View>(null);
  const modeRef = React.useRef<OpenMode>("press");
  const keepOpenRef = React.useRef(false);
  const closeTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isOpen, setIsOpen] = React.useState(false);

  const label = FOLDER_SECTION_LABELS[section];
  const listLabel = `${label} 목록`;
  const addLabel = `${label}에 폴더 추가`;
  const listMaxHeight = Math.max(
    160,
    Math.min(FLYOUT_MAX_LIST_HEIGHT, windowHeight - FLYOUT_VERTICAL_MARGIN),
  );

  const cancelClose = React.useCallback(() => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  const scheduleHoverClose = React.useCallback(() => {
    if (modeRef.current !== "hover") {
      return;
    }
    cancelClose();
    closeTimerRef.current = setTimeout(() => {
      if (modeRef.current === "hover") {
        triggerRef.current?.close();
      }
    }, HOVER_CLOSE_DELAY_MS);
  }, [cancelClose]);

  React.useEffect(() => cancelClose, [cancelClose]);

  const handleOpenChange = React.useCallback(
    (open: boolean) => {
      if (!open && keepOpenRef.current) {
        keepOpenRef.current = false;
        triggerRef.current?.open();
        return;
      }
      if (!open) {
        cancelClose();
      }
      setIsOpen(open);
    },
    [cancelClose],
  );

  const handleHoverIn = React.useCallback(() => {
    cancelClose();
    if (!isOpen) {
      modeRef.current = "hover";
      triggerRef.current?.open();
    }
  }, [cancelClose, isOpen]);

  const handlePress = React.useCallback(() => {
    cancelClose();
    if (isOpen && modeRef.current === "hover") {
      keepOpenRef.current = true;
    }
    modeRef.current = "press";
  }, [cancelClose, isOpen]);

  const handleOpenAutoFocus = React.useCallback(
    (event: Event) => {
      event.preventDefault();
      if (modeRef.current === "hover") {
        return;
      }
      requestAnimationFrame(() => focusFirstFlyoutItem(contentRef.current, listLabel, addLabel));
    },
    [addLabel, listLabel],
  );

  const handleCloseAutoFocus = React.useCallback((event: Event) => {
    if (modeRef.current === "hover") {
      event.preventDefault();
    }
  }, []);

  const handleAddPress = React.useCallback(() => {
    triggerRef.current?.close();
    onAddPress(section);
  }, [onAddPress, section]);

  const renderRow = React.useCallback(
    (folder: Folder) => (
      <SidebarItem
        accessibilityLabel={`${folder.name}, 링크 ${folder.linkCounts}개`}
        active={folder.id === currentFolderId}
        count={folder.linkCounts}
        emoji={folder.emoji ?? "📁"}
        label={folder.name}
        className="web:hover:bg-muted"
        onPress={() => {
          triggerRef.current?.close();
          onSelect(folder);
        }}
      />
    ),
    [currentFolderId, onSelect],
  );

  return (
    <Popover onOpenChange={handleOpenChange}>
      <PopoverTrigger
        ref={triggerRef}
        asChild
        accessibilityLabel={label}
        aria-expanded={isOpen}
        onHoverIn={handleHoverIn}
        onHoverOut={scheduleHoverClose}
        onPress={handlePress}
      >
        <SidebarRailButton
          className={isOpen ? "bg-sidebar-surface-2" : undefined}
          icon={icon}
        />
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[264px] overflow-hidden rounded-2xl p-0 shadow-qlink-lg"
        side={FLYOUT_SIDE}
        sideOffset={8}
        onCloseAutoFocus={handleCloseAutoFocus}
        onOpenAutoFocus={handleOpenAutoFocus}
      >
        <View
          ref={contentRef}
          accessibilityLabel={`${label} 펼친 목록`}
          className="bg-popover"
          onPointerEnter={cancelClose}
          onPointerLeave={scheduleHoverClose}
        >
          <View className="h-12 flex-row items-center border-b border-border-soft pl-3.5 pr-1">
            <Text className="flex-1 text-sm font-semibold text-muted-foreground">{label}</Text>
            <Pressable
              accessibilityLabel={addLabel}
              accessibilityRole="button"
              className="group size-11 items-center justify-center"
              onPress={handleAddPress}
            >
              <View className="size-6 items-center justify-center rounded-md group-active:bg-muted web:group-hover:bg-muted">
                <Icon
                  as={Plus}
                  className="size-3.5 text-muted-foreground web:group-hover:text-primary"
                />
              </View>
            </Pressable>
          </View>
          <FolderSectionList
            className="px-1.5 pt-1.5"
            folders={sections[section]}
            section={section}
            status={status}
            style={{ maxHeight: listMaxHeight }}
            renderRow={renderRow}
            onFetchMore={fetchMore}
            onRetry={retry}
          />
        </View>
      </PopoverContent>
    </Popover>
  );
}

export { FolderRailFlyout };
export type { FolderRailFlyoutProps };
