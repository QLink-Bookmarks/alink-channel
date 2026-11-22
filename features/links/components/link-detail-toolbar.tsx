import { View } from "react-native";

import { IconButton } from "@/components/ui/icon-button";
import { cn } from "@/lib/utils";

import { DetailToolbarButton, RefreshButton } from "./link-detail-parts";

import { FolderPlus, Pencil, Share2, Star, X } from "lucide-react-native/icons";

type LinkDetailToolbarProps = {
  /** `panel`: the wide panel's top row with a close button. `screen`: the mobile header's right slot. */
  mode: "panel" | "screen";
  isFavorite: boolean;
  canEdit: boolean;
  canCopy: boolean;
  /** While the 액션 row is being edited, `수정` and `새로고침` are off. */
  isEditing: boolean;
  isCopyPending: boolean;
  refreshing: boolean;
  refreshFailed: boolean;
  visibility?: React.ReactNode;
  onToggleFavorite: () => void;
  onShare: () => void;
  onEdit: () => void;
  onCopy: () => void;
  onRefresh: () => void;
  onClose?: () => void;
};

function LinkDetailToolbar({
  mode,
  isFavorite,
  canEdit,
  canCopy,
  isEditing,
  isCopyPending,
  refreshing,
  refreshFailed,
  visibility,
  onToggleFavorite,
  onShare,
  onEdit,
  onCopy,
  onRefresh,
  onClose,
}: LinkDetailToolbarProps) {
  const compact = mode === "screen";
  const star = (
    <DetailToolbarButton
      accessibilityLabel={isFavorite ? "바로가기 해제" : "바로가기 추가"}
      active={isFavorite}
      compact={compact}
      icon={Star}
      testID="link-detail-favorite"
      tooltip={mode === "panel" ? "바로가기" : undefined}
      onPress={onToggleFavorite}
    />
  );

  return (
    <View
      className={cn("flex-row items-center", mode === "panel" ? "-mx-2 h-12" : "min-w-0")}
      testID="link-detail-toolbar"
    >
      {star}
      {visibility}
      <DetailToolbarButton
        compact={compact}
        icon={Share2}
        label="공유"
        testID="link-detail-share"
        onPress={onShare}
      />
      {canEdit ? (
        <DetailToolbarButton
          compact={compact}
          disabled={isEditing}
          icon={Pencil}
          label="수정"
          testID="link-detail-edit"
          onPress={onEdit}
        />
      ) : null}
      {canCopy ? (
        <DetailToolbarButton
          accessibilityLabel="개인 폴더로 추가"
          compact={compact}
          disabled={isCopyPending}
          icon={FolderPlus}
          label={canEdit ? undefined : "개인 폴더로 추가"}
          testID="link-detail-copy"
          tooltip={canEdit && !compact ? "개인 폴더로 추가" : undefined}
          onPress={onCopy}
        />
      ) : null}
      <RefreshButton
        compact={compact}
        disabled={isEditing}
        failed={refreshFailed}
        refreshing={refreshing}
        onPress={onRefresh}
      />
      {mode === "panel" ? (
        <>
          <View className="min-w-0 flex-1" />
          <IconButton
            accessibilityLabel="닫기"
            hitSlop={4}
            icon={X}
            size="sm"
            testID="link-detail-close"
            variant="ghost"
            onPress={onClose}
          />
        </>
      ) : null}
    </View>
  );
}

export { LinkDetailToolbar };
export type { LinkDetailToolbarProps };
