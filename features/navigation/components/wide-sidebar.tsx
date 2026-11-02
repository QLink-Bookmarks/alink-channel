import * as React from "react";
import { type LayoutChangeEvent, ScrollView, View } from "react-native";

import { BrandHeader } from "@/components/layout/brand-header";
import {
  SIDEBAR_ITEM_HEIGHT,
  Sidebar,
  SidebarCTA,
  SidebarItem,
  SidebarRailItem,
} from "@/components/layout/sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Emoji } from "@/components/ui/emoji";
import { Kbd } from "@/components/ui/kbd";
import { Text } from "@/components/ui/text";
import { useMyProfileQuery } from "@/features/account/queries";
import { FolderSections } from "@/features/folders/components/folder-sections";
import { useUncategorizedCount } from "@/features/folders/hooks/use-uncategorized-count";
import { UNCATEGORIZED_FOLDER_ID } from "@/features/folders/lib/folder-pages";
import { useFolderQuery } from "@/features/folders/queries";
import type { Folder } from "@/features/folders/types";
import { useDisplaySettings } from "@/stores/display-settings";
import type { FolderSection } from "@/stores/folder-navigation";

import { useNewLinkShortcutLabel } from "../hooks/use-new-link-shortcut-label";
import { getFolderIdFromPath } from "../lib/folder-path";
import { WIDE_PRIMARY_ITEMS } from "../lib/wide-sidebar-items";
import type { WideSidebarKey } from "../types";
import { ThemePopoverButton } from "./theme-popover-button";

import { Menu, Users } from "lucide-react-native";

const SIDEBAR_PADDING = 12;
const MIN_VISIBLE_FOLDER_ROWS = 2;
const SIDEBAR_BORDER_WIDTH = 1;
const THEME_POPOVER_GAP = 8;
const THEME_POPOVER_SIDEBAR_CLEARANCE = SIDEBAR_PADDING + SIDEBAR_BORDER_WIDTH + THEME_POPOVER_GAP;

type BlockHeights = {
  viewport: number;
  top: number;
  folderArea: number;
  folderSections: number;
  uncategorized: number;
  bottom: number;
};

type WideSidebarProps = {
  pathname: string;
  activeKey: WideSidebarKey | null;
  folderListKey?: React.Key;
  onCollapse: () => void;
  onNavigate: (href: string) => void;
  onAddLinkPress: () => void;
  onAddFolderPress: (section: FolderSection) => void;
  onProfilePress: () => void;
};

function getFolderLabel(folder: Folder) {
  const parts = [folder.name, `링크 ${folder.linkCounts}개`];
  if (folder.isShared) {
    parts.push(`${folder.shareCounts}명 참여`);
  }
  return parts.join(", ");
}

function WideSidebar({
  pathname,
  activeKey,
  folderListKey,
  onCollapse,
  onNavigate,
  onAddLinkPress,
  onAddFolderPress,
  onProfilePress,
}: WideSidebarProps) {
  const accent = useDisplaySettings((state) => state.display.accent);
  const theme = useDisplaySettings((state) => state.display.theme);
  const avatarEmojiOverride = useDisplaySettings((state) => state.profile.avatarEmoji);
  const myProfileQuery = useMyProfileQuery();
  const uncategorizedCount = useUncategorizedCount();
  const shortcutLabel = useNewLinkShortcutLabel();
  const currentFolderId = getFolderIdFromPath(pathname);
  const currentFolderQuery = useFolderQuery(currentFolderId ?? UNCATEGORIZED_FOLDER_ID, {
    enabled: currentFolderId != null,
  });
  const [heights, setHeights] = React.useState<BlockHeights>({
    viewport: 0,
    top: 0,
    folderArea: 0,
    folderSections: 0,
    uncategorized: 0,
    bottom: 0,
  });
  const [folderAreaMinHeight, setFolderAreaMinHeight] = React.useState(0);

  const profileAvatarEmoji = avatarEmojiOverride ?? myProfileQuery.data?.avatarEmoji ?? "🌸";
  const profileNickname = myProfileQuery.data?.nickname ?? "사용자";
  const profileUsername = myProfileQuery.data?.username ?? "";
  const profileAvatarUrl = myProfileQuery.data?.avatarUrl ?? null;
  const uncategorizedHref = `/folders/${UNCATEGORIZED_FOLDER_ID}`;

  const handleBlockLayout = React.useCallback(
    (block: keyof BlockHeights) => (event: LayoutChangeEvent) => {
      const height = Math.round(event.nativeEvent.layout.height);
      setHeights((current) =>
        current[block] === height ? current : { ...current, [block]: height },
      );
    },
    [],
  );

  const handleFolderMinHeightChange = React.useCallback((minHeight: number) => {
    setFolderAreaMinHeight(minHeight);
  }, []);

  const isMeasured = heights.viewport > 0 && heights.top > 0 && heights.bottom > 0;
  const folderAreaChrome = Math.max(0, heights.folderArea - heights.folderSections);
  const requiredHeight =
    SIDEBAR_PADDING * 2 +
    heights.top +
    folderAreaMinHeight +
    folderAreaChrome +
    heights.uncategorized +
    heights.bottom;
  const contentHeight = isMeasured ? Math.max(heights.viewport, requiredHeight) : undefined;

  const renderFolderRow = React.useCallback(
    (folder: Folder) => {
      const href = `/folders/${folder.id}`;
      return (
        <SidebarItem
          accessibilityLabel={getFolderLabel(folder)}
          active={pathname === href}
          count={folder.linkCounts}
          emoji={folder.emoji ?? "📁"}
          label={folder.name}
          labelClassName="text-base"
          meta={folder.isShared ? String(folder.shareCounts) : undefined}
          metaIcon={folder.isShared ? Users : undefined}
          onPress={() => onNavigate(href)}
        />
      );
    },
    [onNavigate, pathname],
  );

  return (
    <Sidebar className="h-full w-full min-w-0 max-w-none p-0">
      <ScrollView
        className="flex-1"
        contentContainerClassName={contentHeight == null ? "h-full p-3" : "p-3"}
        contentContainerStyle={contentHeight == null ? undefined : { height: contentHeight }}
        showsVerticalScrollIndicator={false}
        onLayout={handleBlockLayout("viewport")}
      >
        <View
          className="shrink-0 gap-4 pb-2.5"
          onLayout={handleBlockLayout("top")}
        >
          <View className="flex-row items-center gap-0.5">
            <SidebarRailItem
              aria-expanded
              icon={Menu}
              label="사이드바 줄이기"
              onPress={onCollapse}
            />
            <BrandHeader
              accent={accent}
              className="pt-0"
              mode={theme}
            />
          </View>

          <SidebarCTA
            label={
              <>
                <Text className="text-2xl font-semibold leading-none text-primary-foreground">
                  +
                </Text>
                {shortcutLabel ? (
                  <Kbd
                    keyClassName="border-white/20 bg-white/20"
                    keyTextClassName="text-primary-foreground"
                    label="새 링크"
                    labelClassName="text-base font-semibold text-primary-foreground"
                    labelPosition="left"
                  >
                    {shortcutLabel}
                  </Kbd>
                ) : (
                  <Text className="text-base font-semibold text-primary-foreground">새 링크</Text>
                )}
              </>
            }
            onPress={onAddLinkPress}
          />

          <View className="gap-1">
            {WIDE_PRIMARY_ITEMS.map((item) => (
              <SidebarItem
                key={item.key}
                active={activeKey === item.key}
                icon={item.icon}
                label={item.label}
                labelClassName="text-base"
                onPress={() => onNavigate(item.href)}
              />
            ))}
          </View>
        </View>

        <View
          className="min-h-0 shrink border-t border-sidebar-border pt-1.5"
          onLayout={handleBlockLayout("folderArea")}
        >
          <View
            className="min-h-0 shrink"
            onLayout={handleBlockLayout("folderSections")}
          >
            <FolderSections
              currentFolder={currentFolderQuery.folder}
              listKey={folderListKey}
              minVisibleRows={MIN_VISIBLE_FOLDER_ROWS}
              rowHeight={SIDEBAR_ITEM_HEIGHT}
              surface="sidebar"
              renderRow={renderFolderRow}
              onAddPress={onAddFolderPress}
              onMinHeightChange={handleFolderMinHeightChange}
            />
          </View>
        </View>

        <View
          className="shrink-0 border-t border-sidebar-border pt-1.5"
          onLayout={handleBlockLayout("uncategorized")}
        >
          <SidebarItem
            accessibilityLabel={
              uncategorizedCount == null ? "미분류" : `미분류, 링크 ${uncategorizedCount}개`
            }
            active={pathname === uncategorizedHref}
            count={uncategorizedCount}
            emoji="🗂️"
            label="미분류"
            labelClassName="text-base"
            onPress={() => onNavigate(uncategorizedHref)}
          />
        </View>

        <View className="min-h-0 flex-1" />

        <View
          className="shrink-0 flex-row items-center gap-1 border-t border-sidebar-border pt-3"
          onLayout={handleBlockLayout("bottom")}
        >
          <Button
            className="h-auto min-h-0 min-w-0 flex-1 items-center justify-start gap-3 bg-transparent py-2 pl-5 pr-3 shadow-none web:hover:bg-sidebar-surface-2 sm:h-auto"
            variant="ghost"
            onPress={onProfilePress}
          >
            <Avatar
              alt={`${profileNickname} avatar`}
              size="xs"
            >
              {profileAvatarUrl ? <AvatarImage source={{ uri: profileAvatarUrl }} /> : null}
              <AvatarFallback>
                <Emoji className="text-xl">{profileAvatarEmoji}</Emoji>
              </AvatarFallback>
            </Avatar>
            <View className="min-w-0 flex-1 items-start">
              <Text
                numberOfLines={1}
                className="text-left text-base font-semibold text-sidebar-hover"
              >
                {profileNickname}
              </Text>
              <Text
                numberOfLines={1}
                className="text-left text-sm text-sidebar-muted"
              >
                {profileUsername}
              </Text>
            </View>
          </Button>
          <ThemePopoverButton sideOffset={THEME_POPOVER_SIDEBAR_CLEARANCE} />
        </View>
      </ScrollView>
    </Sidebar>
  );
}

export { WideSidebar };
export type { WideSidebarProps };
