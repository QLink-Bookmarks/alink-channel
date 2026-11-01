import * as React from "react";
import { Pressable, ScrollView, View } from "react-native";

import { Sheet } from "@/components/layout/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { FolderPickerList } from "@/features/folders/components/folder-picker-list";
import { mapLinkListItem } from "@/features/home/lib/link-card-mapper";
import { deleteLink, patchLink } from "@/features/links/api";
import { LinkCard } from "@/features/links/components/link-card/link-card";
import { LinkCardSkeleton } from "@/features/links/components/link-card/link-card-skeleton";
import { openLinkUrl } from "@/features/links/lib/open-link-url";
import { useSetLinkFavoriteMutation } from "@/features/links/mutations";
import type { LinkListItem } from "@/features/links/types";
import { reportError } from "@/lib/error-reporting";
import { useGridColumns } from "@/lib/hooks/use-grid-columns";
import { useWideView } from "@/lib/hooks/use-wide-view";
import { cn } from "@/lib/utils";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { ExternalLink, FolderOpen, Star, Trash2 } from "lucide-react-native/icons";

const GRID_GAP = 12;
const WIDE_MIN_CARD_WIDTH = 196;
const MOBILE_MIN_CARD_WIDTH = 280;

function HoverActionButton({
  icon,
  label,
  onPress,
  tone = "default",
}: {
  icon: React.ComponentProps<typeof Icon>["as"];
  label: string;
  onPress: () => void;
  tone?: "default" | "destructive";
}) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      className="size-7 items-center justify-center rounded-lg web:hover:bg-accent"
      onPress={onPress}
    >
      <Icon
        as={icon}
        size={13}
        className={tone === "destructive" ? "text-destructive" : "text-foreground"}
      />
    </Pressable>
  );
}

function BookmarkBadgeButton({
  isFavorite,
  onPress,
}: {
  isFavorite: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel={isFavorite ? "바로가기 해제" : "바로가기 추가"}
      accessibilityRole="button"
      className="size-6 items-center justify-center rounded-full border border-border bg-card web:hover:bg-accent"
      testID="link-card-favorite"
      onPress={onPress}
    >
      <Icon
        as={Star}
        size={12}
        fill={isFavorite ? "currentColor" : "none"}
        className={isFavorite ? "text-warning" : "text-muted-foreground"}
      />
    </Pressable>
  );
}

type LinkCardGridProps = {
  links: LinkListItem[];
  onCardPress: (item: LinkListItem) => void;
  activeLinkId?: number | null;
  className?: string;
  /** Shows card skeletons in the same grid instead of the links. */
  isLoading?: boolean;
  skeletonCount?: number;
};

/**
 * Link cards in as many columns as the container width allows: at least 196px per card on
 * wide, 280px on mobile (one column on phones). On wide, hovering a card shows its actions.
 */
function LinkCardGrid({
  links,
  onCardPress,
  activeLinkId,
  className,
  isLoading = false,
  skeletonCount = 6,
}: LinkCardGridProps) {
  const queryClient = useQueryClient();
  const [folderMoveLink, setFolderMoveLink] = React.useState<LinkListItem | null>(null);
  const [deleteTargetLink, setDeleteTargetLink] = React.useState<LinkListItem | null>(null);
  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteLink(id),
  });
  const folderMoveMutation = useMutation({
    mutationFn: ({ id, folderId }: { id: number; folderId: number | null }) =>
      patchLink(id, { folderId }),
  });
  const favoriteMutation = useSetLinkFavoriteMutation();
  const isWideView = useWideView();
  const { itemStyle, onLayout } = useGridColumns({
    gap: GRID_GAP,
    minItemWidth: isWideView ? WIDE_MIN_CARD_WIDTH : MOBILE_MIN_CARD_WIDTH,
  });

  const handleBookmark = React.useCallback(
    async (item: LinkListItem) => {
      const next = !item.isFavorite;
      try {
        await favoriteMutation.mutateAsync({
          linkId: item.id,
          payload: { isFavorite: next },
        });
        await queryClient.invalidateQueries({ queryKey: ["links", "list"] });
      } catch (error: unknown) {
        reportError(error, {
          area: "link-card-grid:toggle-favorite",
          extra: { linkId: item.id, next },
        });
      }
    },
    [favoriteMutation, queryClient],
  );

  const handleConfirmDelete = React.useCallback(async () => {
    if (!deleteTargetLink) {
      return;
    }
    try {
      await deleteMutation.mutateAsync(deleteTargetLink.id);
      setDeleteTargetLink(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["links", "list"] }),
        queryClient.invalidateQueries({ queryKey: ["folders"] }),
      ]);
    } catch (error: unknown) {
      reportError(error, {
        area: "link-card-grid:delete",
        extra: { linkId: deleteTargetLink.id },
      });
    }
  }, [deleteMutation, deleteTargetLink, queryClient]);

  const handleFolderMoveSelect = React.useCallback(
    async (selection: { id: number | null }) => {
      const target = folderMoveLink;
      setFolderMoveLink(null);
      if (!target || selection.id === (target.folderId ?? null)) {
        return;
      }
      try {
        await folderMoveMutation.mutateAsync({ id: target.id, folderId: selection.id });
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ["links", "list"] }),
          queryClient.invalidateQueries({ queryKey: ["folders"] }),
        ]);
      } catch (error: unknown) {
        reportError(error, {
          area: "link-card-grid:folder-move",
          extra: { folderId: selection.id, linkId: target.id },
        });
      }
    },
    [folderMoveLink, folderMoveMutation, queryClient],
  );

  return (
    <>
      <View
        className={cn("w-full flex-row flex-wrap", className)}
        style={{ gap: GRID_GAP }}
        testID="link-card-grid"
        onLayout={onLayout}
      >
        {isLoading
          ? Array.from({ length: skeletonCount }, (_, index) => (
              <View
                key={`skeleton-${index}`}
                style={itemStyle}
              >
                <LinkCardSkeleton />
              </View>
            ))
          : links.map((item) => {
              const mapped = mapLinkListItem(item);
              const bookmarkHoverAction =
                isWideView || item.isFavorite ? (
                  <BookmarkBadgeButton
                    isFavorite={item.isFavorite}
                    onPress={() => handleBookmark(item)}
                  />
                ) : undefined;
              const trailingHoverActions = isWideView ? (
                <>
                  <HoverActionButton
                    icon={ExternalLink}
                    label="원본 열기"
                    onPress={() => openLinkUrl(item.url)}
                  />
                  <HoverActionButton
                    icon={FolderOpen}
                    label="폴더 이동"
                    onPress={() => setFolderMoveLink(item)}
                  />
                  <HoverActionButton
                    icon={Trash2}
                    label="삭제"
                    tone="destructive"
                    onPress={() => setDeleteTargetLink(item)}
                  />
                </>
              ) : undefined;
              return (
                <View
                  key={mapped.id}
                  style={itemStyle}
                >
                  <LinkCard
                    active={activeLinkId === mapped.id}
                    bookmarkHoverAction={bookmarkHoverAction}
                    bookmarkPinned={item.isFavorite}
                    domain={mapped.domain}
                    faviconUrl={mapped.faviconUrl}
                    isVideo={mapped.isVideo}
                    statusLabel={mapped.statusLabel}
                    statusVariant={mapped.statusVariant}
                    tags={mapped.tags}
                    thumbnailUrl={mapped.thumbnailUrl}
                    title={mapped.title}
                    todoCounts={mapped.todoCounts}
                    trailingHoverActions={trailingHoverActions}
                    onImagePress={() => openLinkUrl(item.url)}
                    onPress={() => onCardPress(item)}
                  />
                </View>
              );
            })}
      </View>

      {isWideView ? (
        <Dialog
          open={Boolean(folderMoveLink)}
          onOpenChange={(open) => {
            if (!open) setFolderMoveLink(null);
          }}
        >
          <DialogContent className="max-h-[80vh] min-h-[24rem] min-w-[24rem] max-w-xl">
            <DialogHeader>
              <DialogTitle>폴더 이동</DialogTitle>
              <DialogDescription>이동할 폴더를 선택해주세요.</DialogDescription>
            </DialogHeader>
            <ScrollView
              className="flex-1"
              contentInsetAdjustmentBehavior="automatic"
              showsVerticalScrollIndicator={false}
            >
              <FolderPickerList
                selectedFolderId={folderMoveLink?.folderId ?? null}
                onSelect={handleFolderMoveSelect}
              />
            </ScrollView>
          </DialogContent>
        </Dialog>
      ) : (
        <Sheet
          open={Boolean(folderMoveLink)}
          fitContent
          onOpenChange={(open) => {
            if (!open) setFolderMoveLink(null);
          }}
        >
          <View className="gap-3">
            <Text className="text-lg font-semibold text-foreground">폴더 이동</Text>
            <FolderPickerList
              selectedFolderId={folderMoveLink?.folderId ?? null}
              onSelect={handleFolderMoveSelect}
            />
            <Button
              className="h-10 self-stretch"
              variant="outline"
              onPress={() => setFolderMoveLink(null)}
            >
              <Text>닫기</Text>
            </Button>
          </View>
        </Sheet>
      )}

      <AlertDialog
        open={Boolean(deleteTargetLink)}
        onOpenChange={(open) => {
          if (!open) setDeleteTargetLink(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>링크를 삭제할까요?</AlertDialogTitle>
            <AlertDialogDescription>
              삭제하면 이 링크를 다시 되돌릴 수 없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row justify-center">
            <AlertDialogCancel className="native:px-3 flex-1 justify-center sm:flex-none">
              <Text className="text-center">취소</Text>
            </AlertDialogCancel>
            <AlertDialogAction
              className="native:px-3 flex-1 justify-center sm:flex-none"
              variant="destructive"
              onPress={handleConfirmDelete}
            >
              <Text className="text-center">
                {deleteMutation.isPending ? "삭제 중..." : "삭제"}
              </Text>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export { LinkCardGrid };
export type { LinkCardGridProps };
