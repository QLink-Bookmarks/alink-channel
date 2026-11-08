import { View } from "react-native";

import { IconButton } from "@/components/ui/icon-button";
import { cn } from "@/lib/utils";

import { DetailToolbarButton, RefreshButton } from "./link-detail-parts";

import { FolderPlus, Pencil, Share2, Star, X } from "lucide-react-native/icons";

type LinkDetailToolbarProps = {
  /** `panel`: the wide panel's top row with a close button. `screen`: the mobile header's right slot. */
  mode: "panel" | "screen";
  isFavorite: boolean;
  /** A link in someone else's shared folder offers `개인 폴더로 추가` instead of `수정`. */
  isMyOwnLink: boolean;
  /** While the 액션 row is being edited, `수정` and `새로고침` are off. */
  isEditing: boolean;
  isCopyPending: boolean;
  refreshing: boolean;
  refreshFailed: boolean;
  onToggleFavorite: () => void;
  onShare: () => void;
  onEdit: () => void;
  onCopy: () => void;
  onRefresh: () => void;
  onClose?: () => void;
};

// ★ (icon only), 공유, 수정 (or 개인 폴더로 추가), 새로고침; the wide panel adds 닫기 at the end.
function LinkDetailToolbar({
  mode,
  isFavorite,
  isMyOwnLink,
  isEditing,
  isCopyPending,
  refreshing,
  refreshFailed,
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
      <DetailToolbarButton
        compact={compact}
        icon={Share2}
        label="공유"
        testID="link-detail-share"
        onPress={onShare}
      />
      {isMyOwnLink ? (
        <DetailToolbarButton
          compact={compact}
          disabled={isEditing}
          icon={Pencil}
          label="수정"
          testID="link-detail-edit"
          onPress={onEdit}
        />
      ) : (
        <DetailToolbarButton
          compact={compact}
          disabled={isCopyPending}
          icon={FolderPlus}
          label="개인 폴더로 추가"
          testID="link-detail-copy"
          onPress={onCopy}
        />
      )}
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
