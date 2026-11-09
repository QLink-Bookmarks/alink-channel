import * as React from "react";
import { Pressable, View } from "react-native";

import { Fab } from "@/components/layout/fab";
import { Emoji } from "@/components/ui/emoji";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { useShellActions } from "@/features/navigation/hooks/use-shell-actions";
import { useCreateFolderSheet } from "@/stores/create-folder-sheet";
import {
  type FolderSection,
  setFolderScrollOffset,
  useFolderNavigation,
} from "@/stores/folder-navigation";

import { useUncategorizedCount } from "../hooks/use-uncategorized-count";
import { UNCATEGORIZED_FOLDER_ID } from "../lib/folder-pages";
import type { Folder } from "../types";
import { CreateFolderDialog, type CreatedFolder } from "./create-folder-dialog";
import { FolderSections } from "./folder-sections";

import { type Href, useRouter } from "expo-router";
import { ChevronRight, Plus } from "lucide-react-native/icons";

function getFolderRowLabel(folder: Folder) {
  const parts = [folder.name, `링크 ${folder.linkCounts}개`];
  if (folder.isShared) {
    parts.push(`${folder.shareCounts}명 참여`);
  }
  return parts.join(", ");
}

function MobileFolderRow({
  folder,
  onPress,
}: {
  folder: Folder;
  onPress: (folder: Folder) => void;
}) {
  return (
    <Pressable
      accessibilityLabel={getFolderRowLabel(folder)}
      accessibilityRole="button"
      className="group min-h-[60px] flex-row items-center gap-3 rounded-2xl p-2 active:bg-muted web:transition-colors web:hover:bg-muted web:motion-reduce:transition-none"
      onPress={() => onPress(folder)}
    >
      <View className="size-10 items-center justify-center rounded-2xl bg-muted web:group-hover:bg-accent">
        <Emoji className="text-xl">{folder.emoji ?? "📁"}</Emoji>
      </View>
      <View className="min-w-0 flex-1 gap-0.5">
        <Text
          className="text-base font-semibold text-foreground"
          numberOfLines={1}
        >
          {folder.name}
        </Text>
        {folder.isShared ? (
          <Text className="text-xs text-muted-foreground">{folder.shareCounts}명 참여</Text>
        ) : null}
      </View>
      <Text className="shrink-0 text-sm tabular-nums text-muted-foreground">
        {folder.linkCounts}개
      </Text>
      <Icon
        as={ChevronRight}
        className="size-4 shrink-0 text-muted-foreground"
      />
    </Pressable>
  );
}

function MobileFoldersScreen() {
  const router = useRouter();
  const shellActions = useShellActions();
  const uncategorizedCount = useUncategorizedCount();
  const isCreateOpen = useCreateFolderSheet((state) => state.isOpen);
  const openCreateSheet = useCreateFolderSheet((state) => state.open);
  const setCreateOpen = useCreateFolderSheet((state) => state.setOpen);
  const openFolderSection = useFolderNavigation((state) => state.openSectionOn);
  const [createShared, setCreateShared] = React.useState(false);
  const [listKey, setListKey] = React.useState(0);

  const handleAddPress = React.useCallback(
    (section: FolderSection) => {
      setCreateShared(section === "shared");
      openCreateSheet();
    },
    [openCreateSheet],
  );

  const handleFolderCreated = React.useCallback(
    (folder: CreatedFolder) => {
      const section: FolderSection = folder.isShared ? "shared" : "mine";
      setFolderScrollOffset("mobileTab", section, 0);
      openFolderSection("mobileTab", section);
      setListKey((key) => key + 1);
    },
    [openFolderSection],
  );

  const handleFolderPress = React.useCallback(
    (folder: Folder) => {
      router.push(`/folders/${folder.id}` as Href);
    },
    [router],
  );

  const handleUncategorizedPress = React.useCallback(() => {
    router.push(`/folders/${UNCATEGORIZED_FOLDER_ID}` as Href);
  }, [router]);

  const renderRow = React.useCallback(
    (folder: Folder) => (
      <MobileFolderRow
        folder={folder}
        onPress={handleFolderPress}
      />
    ),
    [handleFolderPress],
  );

  return (
    <View className="flex-1 bg-background">
      {/* 루트 ScrollView 예외: 두 제목줄을 스크롤 밖에 고정하고 섹션마다 위치를 기억하려고, 열린 섹션의 FlatList가 스크롤을 맡는다(#10 5번 설계). */}
      <FolderSections
        availableHeight="container"
        className="flex-1"
        listKey={listKey}
        size="large"
        surface="mobileTab"
        renderRow={renderRow}
        onAddPress={handleAddPress}
      />
      <View className="h-[72px] shrink-0 flex-row border-t border-border bg-background">
        <Pressable
          accessibilityLabel={
            uncategorizedCount == null ? "미분류" : `미분류, 링크 ${uncategorizedCount}개`
          }
          accessibilityRole="button"
          className="min-w-0 flex-1 flex-row items-center gap-3 pl-5 pr-3 active:bg-muted web:hover:bg-muted"
          onPress={handleUncategorizedPress}
        >
          <View className="size-10 items-center justify-center rounded-2xl bg-muted">
            <Emoji className="text-xl">🗂️</Emoji>
          </View>
          <Text className="min-w-0 flex-1 text-base font-semibold text-foreground">미분류</Text>
          {uncategorizedCount == null ? null : (
            <Text className="shrink-0 text-sm tabular-nums text-muted-foreground">
              {uncategorizedCount}개
            </Text>
          )}
        </Pressable>
        <View className="w-[88px] shrink-0 justify-end pb-2 pr-6">
          {shellActions ? (
            <Fab
              className="self-end"
              icon={Plus}
              label="새 링크"
              onPress={shellActions.openNewLink}
            />
          ) : null}
        </View>
      </View>

      <CreateFolderDialog
        mode="mobile"
        open={isCreateOpen}
        defaultShared={createShared}
        onCreated={handleFolderCreated}
        onOpenChange={setCreateOpen}
      />
    </View>
  );
}

export { MobileFoldersScreen };
