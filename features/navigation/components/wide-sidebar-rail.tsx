import * as React from "react";
import { ScrollView, View } from "react-native";

import {
  SidebarRail,
  SidebarRailButton,
  SidebarRailCTA,
  SidebarRailItem,
  SidebarRailSeparator,
  SidebarRailTooltip,
} from "@/components/layout/sidebar";
import { ActivityIndicator } from "@/components/ui/activity-indicator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Emoji } from "@/components/ui/emoji";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Text } from "@/components/ui/text";
import { ThemeSwitcher } from "@/components/ui/theme-switcher";
import { useMyProfileQuery } from "@/features/account/queries";
import { FolderRailFlyout } from "@/features/folders/components/folder-rail-flyout";
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

import { CircleAlert, Folder as FolderIcon, Menu, Palette, Plus, Users } from "lucide-react-native";

type PopoverSide = React.ComponentProps<typeof PopoverContent>["side"];

const RAIL_POPOVER_SIDE = (process.env.EXPO_OS === "web" ? "right" : "top") as PopoverSide;

type WideSidebarRailProps = {
  pathname: string;
  activeKey: WideSidebarKey | null;
  onExpand: () => void;
  onNavigate: (href: string) => void;
  onAddLinkPress: () => void;
  onAddFolderPress: (section: FolderSection) => void;
  onProfilePress: () => void;
};

function SelectedFolderRailItem({
  folderId,
  onNavigate,
}: {
  folderId: number;
  onNavigate: (href: string) => void;
}) {
  const folderQuery = useFolderQuery(folderId);
  const folder = folderQuery.folder;

  if (folder) {
    return (
      <SidebarRailItem
        active
        accessibilityLabel={`${folder.name}, 선택된 폴더`}
        emoji={folder.emoji ?? "📁"}
        label={folder.name}
        onPress={() => onNavigate(`/folders/${folder.id}`)}
      />
    );
  }

  if (folderQuery.isError) {
    return (
      <SidebarRailItem
        accessibilityLabel="선택한 폴더를 불러오지 못했어요, 다시 시도"
        icon={CircleAlert}
        label="불러오지 못했어요 · 눌러서 다시 시도"
        onPress={folderQuery.retry}
      />
    );
  }

  if (folderQuery.isLoading) {
    return (
      <SidebarRailTooltip label="선택한 폴더 불러오는 중">
        <SidebarRailButton
          accessibilityLabel="선택한 폴더 불러오는 중"
          aria-busy
        >
          <ActivityIndicator size="small" />
        </SidebarRailButton>
      </SidebarRailTooltip>
    );
  }

  return null;
}

function ThemeRailPopover() {
  const accent = useDisplaySettings((state) => state.display.accent);
  const theme = useDisplaySettings((state) => state.display.theme);
  const setAccent = useDisplaySettings((state) => state.setAccent);
  const setTheme = useDisplaySettings((state) => state.setTheme);

  return (
    <Popover>
      <SidebarRailTooltip label="모드 · 강조색">
        <PopoverTrigger asChild>
          <SidebarRailButton
            accessibilityLabel="모드와 강조색"
            icon={Palette}
          />
        </PopoverTrigger>
      </SidebarRailTooltip>
      <PopoverContent
        accessibilityLabel="모드와 강조색"
        align="end"
        className="w-60 gap-2 rounded-2xl p-2.5 shadow-qlink-lg"
        side={RAIL_POPOVER_SIDE}
        sideOffset={8}
      >
        <Text className="px-0.5 text-sm font-semibold text-muted-foreground">모드 · 강조색</Text>
        <ThemeSwitcher
          accent={accent}
          mode={theme}
          variant="switch"
          onAccentChange={setAccent}
          onModeChange={setTheme}
        />
      </PopoverContent>
    </Popover>
  );
}

function WideSidebarRail({
  pathname,
  activeKey,
  onExpand,
  onNavigate,
  onAddLinkPress,
  onAddFolderPress,
  onProfilePress,
}: WideSidebarRailProps) {
  const myProfileQuery = useMyProfileQuery();
  const avatarEmojiOverride = useDisplaySettings((state) => state.profile.avatarEmoji);
  const uncategorizedCount = useUncategorizedCount();
  const shortcutLabel = useNewLinkShortcutLabel();
  const currentFolderId = getFolderIdFromPath(pathname);
  const uncategorizedHref = `/folders/${UNCATEGORIZED_FOLDER_ID}`;
  const profileNickname = myProfileQuery.data?.nickname ?? "사용자";
  const profileAvatarEmoji = avatarEmojiOverride ?? myProfileQuery.data?.avatarEmoji ?? "🌸";
  const profileAvatarUrl = myProfileQuery.data?.avatarUrl ?? null;

  const handleFolderSelect = React.useCallback(
    (folder: Folder) => onNavigate(`/folders/${folder.id}`),
    [onNavigate],
  );

  return (
    <SidebarRail>
      <ScrollView
        className="flex-1"
        contentContainerClassName="flex-grow items-center gap-1.5 px-2 py-3"
        showsVerticalScrollIndicator={false}
      >
        <SidebarRailItem
          aria-expanded={false}
          icon={Menu}
          label="사이드바 펼치기"
          onPress={onExpand}
        />
        <View className="h-1.5 shrink-0" />
        <SidebarRailTooltip
          label="새 링크"
          shortcut={shortcutLabel ?? undefined}
        >
          <SidebarRailCTA
            accessibilityLabel={shortcutLabel ? `새 링크, 단축키 ${shortcutLabel}` : "새 링크"}
            icon={Plus}
            onPress={onAddLinkPress}
          />
        </SidebarRailTooltip>
        <View className="h-1.5 shrink-0" />
        {WIDE_PRIMARY_ITEMS.map((item) => (
          <SidebarRailItem
            key={item.key}
            active={activeKey === item.key}
            icon={item.icon}
            label={item.label}
            onPress={() => onNavigate(item.href)}
          />
        ))}
        <SidebarRailSeparator />
        <FolderRailFlyout
          currentFolderId={currentFolderId}
          icon={FolderIcon}
          section="mine"
          onAddPress={onAddFolderPress}
          onSelect={handleFolderSelect}
        />
        <FolderRailFlyout
          currentFolderId={currentFolderId}
          icon={Users}
          section="shared"
          onAddPress={onAddFolderPress}
          onSelect={handleFolderSelect}
        />
        <SidebarRailSeparator />
        <SidebarRailItem
          accessibilityLabel={
            uncategorizedCount == null ? "미분류" : `미분류, 링크 ${uncategorizedCount}개`
          }
          active={pathname === uncategorizedHref}
          emoji="🗂️"
          label="미분류"
          shortcut={uncategorizedCount}
          onPress={() => onNavigate(uncategorizedHref)}
        />
        {currentFolderId != null && currentFolderId !== UNCATEGORIZED_FOLDER_ID ? (
          <SelectedFolderRailItem
            key={currentFolderId}
            folderId={currentFolderId}
            onNavigate={onNavigate}
          />
        ) : null}
        <View className="min-h-3 flex-1" />
        <View className="w-14 shrink-0 items-center gap-1.5 border-t border-sidebar-border pt-2.5">
          <ThemeRailPopover />
          <SidebarRailItem
            accessibilityLabel={`프로필 ${profileNickname}`}
            label={profileNickname}
            onPress={onProfilePress}
          >
            <Avatar
              alt={`${profileNickname} avatar`}
              size="xs"
            >
              {profileAvatarUrl ? <AvatarImage source={{ uri: profileAvatarUrl }} /> : null}
              <AvatarFallback>
                <Emoji className="text-lg">{profileAvatarEmoji}</Emoji>
              </AvatarFallback>
            </Avatar>
          </SidebarRailItem>
        </View>
      </ScrollView>
    </SidebarRail>
  );
}

export { WideSidebarRail };
export type { WideSidebarRailProps };
