import * as React from "react";
import { Pressable, View } from "react-native";

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
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { FolderPickerDialog } from "@/features/folders/components/folder-picker-dialog";
import {
  type FolderPickerSelection,
  UNCATEGORIZED_PICKER_OPTION,
} from "@/features/folders/components/folder-picker-list";
import { getMoveTargetFolderId } from "@/features/folders/lib/folder-pages";
import { mapLinkListItem } from "@/features/home/lib/link-card-mapper";
import { deleteLink, patchLink } from "@/features/links/api";
import { LinkCard } from "@/features/links/components/link-card/link-card";
import { LinkCardSkeleton } from "@/features/links/components/link-card/link-card-skeleton";
import { openLinkUrl } from "@/features/links/lib/open-link-url";
import { useSetLinkFavoriteMutation } from "@/features/links/mutations";
import { invalidateLinkListAndSearchQueries } from "@/features/links/queries";
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
        className={isFavorite ? "text-warning-icon" : "text-muted-foreground"}
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
  /** While searching: the query highlighted in each card's title. */
  highlightQuery?: string;
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
  highlightQuery,
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
        await invalidateLinkListAndSearchQueries(queryClient);
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
        invalidateLinkListAndSearchQueries(queryClient),
        queryClient.invalidateQueries({ queryKey: ["folders"] }),
      ]);
    } catch (error: unknown) {
      reportError(error, {
        area: "link-card-grid:delete",
        extra: { linkId: deleteTargetLink.id },
      });
    }
  }, [deleteMutation, deleteTargetLink, queryClient]);

  const handleFolderMoveConfirm = React.useCallback(
    async (selection: FolderPickerSelection) => {
      const target = folderMoveLink;
      if (!target) {
        return;
      }
      try {
        await folderMoveMutation.mutateAsync({
          id: target.id,
          folderId: getMoveTargetFolderId(selection.id),
        });
      } catch (error: unknown) {
        reportError(error, {
          area: "link-card-grid:folder-move",
          extra: { folderId: selection.id, linkId: target.id },
        });
        throw error;
      }
      void invalidateLinkListAndSearchQueries(queryClient);
      void queryClient.invalidateQueries({ queryKey: ["folders"] });
    },
    [folderMoveLink, folderMoveMutation, queryClient],
  );

  const handleFolderMoveOpenChange = React.useCallback((open: boolean) => {
    if (!open) {
      setFolderMoveLink(null);
    }
  }, []);

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
                    excerpt={mapped.excerpt}
                    faviconUrl={mapped.faviconUrl}
                    highlightQuery={highlightQuery}
                    isVideo={mapped.isVideo}
                    snippet={mapped.snippet}
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

      <FolderPickerDialog
        confirmLabel="확인"
        description="이동할 폴더를 선택해주세요."
        errorMessage="폴더를 옮기지 못했어요. 다시 시도해 주세요."
        initialFolderId={folderMoveLink?.folderId ?? null}
        noneOption={UNCATEGORIZED_PICKER_OPTION}
        open={Boolean(folderMoveLink)}
        pendingLabel="옮기는 중"
        presentation={isWideView ? "dialog" : "sheet"}
        title="폴더 이동"
        onConfirm={handleFolderMoveConfirm}
        onOpenChange={handleFolderMoveOpenChange}
      />

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
