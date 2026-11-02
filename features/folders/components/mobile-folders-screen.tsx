import * as React from "react";
import { ScrollView, View } from "react-native";

import { ActivityIndicator } from "@/components/ui/activity-indicator";
import { EmptyState } from "@/components/ui/empty-state";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Text } from "@/components/ui/text";
import { useCreateFolderSheet } from "@/stores/create-folder-sheet";

import { useUncategorizedCount } from "../hooks/use-uncategorized-count";
import { UNCATEGORIZED_FOLDER_ID, splitFoldersBySection } from "../lib/folder-pages";
import { useFolderPagesQuery } from "../queries";
import type { Folder, FolderOrder } from "../types";
import { CreateFolderDialog } from "./create-folder-dialog";
import { FolderTile } from "./folder-tile";

import { type Href, useRouter } from "expo-router";

type FilterValue = "all" | "mine" | "shared";

const FILTER_OPTIONS = [
  { label: "전체", value: "all" },
  { label: "내 폴더", value: "mine" },
  { label: "공유 폴더", value: "shared" },
] as const;

const ORDER_OPTIONS: { label: string; value: FolderOrder }[] = [
  { label: "최신순", value: "latest" },
  { label: "오래된순", value: "earliest" },
  { label: "가나다순", value: "laxico" },
];

function MobileFoldersScreen() {
  const router = useRouter();
  const [order, setOrder] = React.useState<FolderOrder>("latest");
  const folderPagesQuery = useFolderPagesQuery({ order });
  const uncategorizedCount = useUncategorizedCount();
  const [filter, setFilter] = React.useState<FilterValue>("all");
  const isCreateOpen = useCreateFolderSheet((state) => state.isOpen);
  const openCreateSheet = useCreateFolderSheet((state) => state.open);
  const setCreateOpen = useCreateFolderSheet((state) => state.setOpen);
  const [createShared, setCreateShared] = React.useState(false);

  const handleCreateMine = React.useCallback(() => {
    setCreateShared(false);
    openCreateSheet();
  }, [openCreateSheet]);

  const handleCreateShared = React.useCallback(() => {
    setCreateShared(true);
    openCreateSheet();
  }, [openCreateSheet]);

  const { mine: myFolders, shared: sharedFolders } = splitFoldersBySection(
    folderPagesQuery.data?.pages.slice(0, 1),
  );

  const showMine = filter !== "shared";
  const showShared = filter !== "mine";

  const handleFolderPress = React.useCallback(
    (folder: Folder) => {
      router.push(`/folders/${folder.id}` as Href);
    },
    [router],
  );

  const handleUncategorizedPress = React.useCallback(() => {
    router.push(`/folders/${UNCATEGORIZED_FOLDER_ID}` as Href);
  }, [router]);

  return (
    <>
      <ScrollView
        className="flex-1"
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
      >
        <View className="gap-5 px-4 pb-24 pt-4">
          <View className="items-start gap-2">
            <SegmentedControl
              labelClassName="text-xs"
              options={[...FILTER_OPTIONS]}
              selectionMode="single"
              size="sm"
              value={filter}
              variant="chipsBadge"
              onValueChange={(next) => {
                if (typeof next === "string") {
                  setFilter(next as FilterValue);
                }
              }}
            />
            <SegmentedControl
              labelClassName="text-xs"
              options={ORDER_OPTIONS}
              selectionMode="single"
              size="sm"
              value={order}
              variant="chipsBadge"
              onValueChange={(next) => {
                if (typeof next === "string") {
                  setOrder(next as FolderOrder);
                }
              }}
            />
          </View>

          {folderPagesQuery.isLoading ? (
            <ActivityIndicator
              size="large"
              className="py-16"
            />
          ) : (
            <View className="gap-6">
              {showMine ? (
                <FolderSection
                  title="내 폴더"
                  count={myFolders.length}
                  folders={myFolders}
                  addLabel="새 폴더"
                  uncategorizedCount={uncategorizedCount}
                  showUncategorized
                  onAddPress={handleCreateMine}
                  onFolderPress={handleFolderPress}
                  onUncategorizedPress={handleUncategorizedPress}
                />
              ) : null}
              {showShared ? (
                <FolderSection
                  title="공유 폴더"
                  count={sharedFolders.length}
                  folders={sharedFolders}
                  addLabel="폴더 공유 시작"
                  onAddPress={handleCreateShared}
                  onFolderPress={handleFolderPress}
                />
              ) : null}
              {!showMine && !showShared ? (
                <EmptyState
                  emoji="📁"
                  title="표시할 폴더가 없어요"
                  description="필터를 바꿔서 확인해보세요."
                />
              ) : null}
            </View>
          )}
        </View>
      </ScrollView>

      <CreateFolderDialog
        mode="mobile"
        open={isCreateOpen}
        defaultShared={createShared}
        onOpenChange={setCreateOpen}
      />
    </>
  );
}

type FolderSectionProps = {
  title: string;
  count: number;
  folders: Folder[];
  addLabel: string;
  showUncategorized?: boolean;
  uncategorizedCount?: string;
  onAddPress: () => void;
  onFolderPress: (folder: Folder) => void;
  onUncategorizedPress?: () => void;
};

function FolderSection({
  title,
  count,
  folders,
  addLabel,
  showUncategorized,
  uncategorizedCount,
  onAddPress,
  onFolderPress,
  onUncategorizedPress,
}: FolderSectionProps) {
  return (
    <View className="gap-3">
      <View className="flex-row items-center gap-2 px-1">
        <Text className="text-sm font-semibold text-foreground">{title}</Text>
        {count > 0 ? (
          <View className="min-w-5 items-center rounded-full bg-muted px-2 py-0.5">
            <Text className="text-xs font-semibold text-muted-foreground">{count}</Text>
          </View>
        ) : null}
      </View>
      <View className="-mx-1.5 w-full flex-row flex-wrap">
        {folders.map((folder) => (
          <View
            key={folder.id}
            className="w-1/2 px-1.5 pb-3"
          >
            <FolderTile
              className="w-full"
              count={folder.linkCounts}
              emoji={folder.emoji}
              name={folder.name}
              onPress={() => onFolderPress(folder)}
            />
          </View>
        ))}
        {showUncategorized ? (
          <View className="w-1/2 px-1.5 pb-3">
            <FolderTile
              className="w-full"
              count={uncategorizedCount}
              emoji="🗂️"
              name="미분류"
              onPress={onUncategorizedPress}
            />
          </View>
        ) : null}
        <View className="w-1/2 px-1.5 pb-3">
          <FolderTile
            add
            className="w-full"
            name={addLabel}
            onPress={onAddPress}
          />
        </View>
      </View>
    </View>
  );
}

export { MobileFoldersScreen };
