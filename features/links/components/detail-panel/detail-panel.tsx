import * as React from "react";
import {
  Platform,
  Pressable,
  type StyleProp,
  View,
  type ViewStyle,
  useWindowDimensions,
} from "react-native";
import Animated, { SlideInRight, SlideOutRight } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FullWindowOverlay as RNFullWindowOverlay } from "react-native-screens";

import { EmptyState } from "@/components/ui/empty-state";
import { Icon } from "@/components/ui/icon";
import type { LinkDetail } from "@/features/links/types";
import { cn } from "@/lib/utils";

import { LinkDetailView } from "../link-detail-view";
import { getDetailPanelWidth } from "./detail-panel-width";

import { X } from "lucide-react-native/icons";

// View scope: 와이드뷰 전용. md >= 769px에서 사용한다.

const FullWindowOverlay = Platform.OS === "ios" ? RNFullWindowOverlay : React.Fragment;

function useNativeOverlayStyle(): StyleProp<ViewStyle> {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  if (process.env.EXPO_OS === "web") {
    return undefined;
  }
  return {
    width: getDetailPanelWidth(width),
    paddingTop: insets.top,
    paddingBottom: insets.bottom,
  };
}

function DetailPanelBody({
  className,
  detail,
  error,
  notFound,
  isLoading,
  style,
  onDeleted,
  onOpenChange,
}: {
  className?: string;
  style?: StyleProp<ViewStyle>;
  detail?: LinkDetail;
  error?: boolean;
  notFound?: boolean;
  isLoading?: boolean;
  onDeleted?: () => void;
  onOpenChange?: (open: boolean) => void;
}) {
  return (
    <View
      className={cn(
        "h-full w-[clamp(420px,34vw,560px)] max-w-[560px] border-l border-border bg-surface",
        process.env.EXPO_OS !== "web" && "bg-background",
        className,
      )}
      style={style}
      testID="detail-panel"
    >
      {isLoading ? (
        <EmptyState
          className="h-full"
          description="링크 상세 정보를 불러오는 중이다."
          title="불러오는 중"
        />
      ) : detail && !notFound ? (
        // A failed refresh keeps the detail on screen; the view shows the failure itself.
        <LinkDetailView
          detail={detail}
          mode="panel"
          onClose={() => onOpenChange?.(false)}
          onDeleted={onDeleted}
        />
      ) : notFound ? (
        <View className="h-full">
          <View className="flex-row justify-end px-5 pt-4">
            <Pressable
              accessibilityLabel="닫기"
              accessibilityRole="button"
              className="size-9 items-center justify-center rounded-xl border border-border bg-card web:transition-colors web:hover:border-primary"
              testID="link-detail-not-found-close"
              onPress={() => onOpenChange?.(false)}
            >
              <Icon
                as={X}
                size={16}
                className="text-muted-foreground"
              />
            </Pressable>
          </View>
          <EmptyState
            className="flex-1"
            emoji="🔍"
            description="이미 삭제됐거나 잘못된 주소일 수 있어요."
            title="찾으시는 링크가 없어요"
          />
        </View>
      ) : error ? (
        <EmptyState
          className="h-full"
          description="잠시 후 다시 시도해주세요."
          title="링크 상세를 불러오지 못했어요"
        />
      ) : (
        <EmptyState
          className="h-full"
          description="선택한 링크 정보를 찾을 수 없다."
          title="상세 없음"
        />
      )}
    </View>
  );
}

/**
 * Web: Esc closes the overlay, unless a dialog opened from the panel (folder move, edit,
 * delete confirmation, ...) is on top; that dialog handles its own Esc first.
 */
function useCloseOnEscape(enabled: boolean, onClose: () => void) {
  React.useEffect(() => {
    if (!enabled || process.env.EXPO_OS !== "web" || typeof document === "undefined") {
      return;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) {
        return;
      }
      if (document.querySelector('[role="dialog"], [role="alertdialog"]')) {
        return;
      }
      onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [enabled, onClose]);
}

function DetailPanel({
  className,
  open,
  detail,
  error,
  notFound,
  isLoading,
  mode = "inline",
  onDeleted,
  onOpenChange,
}: {
  className?: string;
  open: boolean;
  detail?: LinkDetail;
  error?: boolean;
  notFound?: boolean;
  isLoading?: boolean;
  mode?: "inline" | "overlay";
  onDeleted?: () => void;
  onOpenChange?: (open: boolean) => void;
}) {
  const handleClose = React.useCallback(() => onOpenChange?.(false), [onOpenChange]);
  useCloseOnEscape(open && mode === "overlay", handleClose);
  const nativeOverlayStyle = useNativeOverlayStyle();

  if (!open) {
    return null;
  }

  if (mode === "overlay") {
    return (
      <FullWindowOverlay>
        <View
          className={cn(
            "bottom-0 left-0 right-0 top-0 flex",
            Platform.select({
              web: "fixed",
              default: "absolute",
            }),
          )}
        >
          <Pressable
            className="absolute bottom-0 left-0 right-0 top-0 z-backdrop bg-overlay"
            onPress={() => onOpenChange?.(false)}
          />
          <View
            className="absolute bottom-0 left-0 right-0 top-0 z-sidePanel flex-row justify-end"
            pointerEvents="box-none"
          >
            <Animated.View
              entering={SlideInRight.duration(220)}
              exiting={SlideOutRight.duration(180)}
            >
              {/* The dimmed backdrop separates the layer, so the panel has no shadow. */}
              <DetailPanelBody
                className={className}
                style={nativeOverlayStyle}
                detail={detail}
                error={error}
                notFound={notFound}
                isLoading={isLoading}
                onDeleted={onDeleted}
                onOpenChange={onOpenChange}
              />
            </Animated.View>
          </View>
        </View>
      </FullWindowOverlay>
    );
  }

  return (
    <Animated.View
      entering={SlideInRight.duration(220)}
      exiting={SlideOutRight.duration(180)}
    >
      <DetailPanelBody
        className={className}
        detail={detail}
        error={error}
        notFound={notFound}
        isLoading={isLoading}
        onDeleted={onDeleted}
        onOpenChange={onOpenChange}
      />
    </Animated.View>
  );
}

export { DetailPanel };
