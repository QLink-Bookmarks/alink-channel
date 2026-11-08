import * as React from "react";
import { Pressable, View } from "react-native";
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import { Icon } from "@/components/ui/icon";
import { PressableHitSlopArea } from "@/components/ui/icon-button";
import { Text } from "@/components/ui/text";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { TriggerRef as TooltipTriggerRef } from "@rn-primitives/tooltip";

import { Pencil, Plus, RefreshCw } from "lucide-react-native/icons";

const isWeb = process.env.EXPO_OS === "web";

// 32px buttons reach 44px with 6px above and below.
const TOOLBAR_HIT_SLOP = { top: 6, bottom: 6, left: 1, right: 1 };
const ROW_BUTTON_HIT_SLOP = 6;

// The theme focus ring every press target of the detail shows on keyboard focus (web).
const FOCUS_RING_CLASS_NAME =
  "web:outline-none web:focus-visible:ring-[3px] web:focus-visible:ring-ring";

/**
 * Shows `label` as a hover tooltip on web. Native has no hover, so the child is returned as is
 * (it still carries its own accessible name).
 */
function HoverLabel({
  label,
  side = "bottom",
  shrink = false,
  children,
}: {
  label: string;
  side?: "top" | "bottom";
  /** Lets the wrapper shrink in a row on web (the tooltip root is an extra view there). */
  shrink?: boolean;
  children: React.ReactElement;
}) {
  const triggerRef = React.useRef<TooltipTriggerRef>(null);
  const isPressedRef = React.useRef(false);

  const handleOpenChange = React.useCallback((open: boolean) => {
    if (open && isPressedRef.current) {
      triggerRef.current?.close();
    }
  }, []);

  const handlePress = React.useCallback(() => {
    isPressedRef.current = true;
  }, []);

  const handleRelease = React.useCallback(() => {
    isPressedRef.current = false;
  }, []);

  if (!isWeb) {
    return children;
  }
  return (
    <Tooltip
      delayDuration={150}
      style={shrink ? { flexShrink: 1, minWidth: 0 } : undefined}
      onOpenChange={handleOpenChange}
    >
      <TooltipTrigger
        ref={triggerRef}
        asChild
        onBlur={handleRelease}
        onHoverIn={handleRelease}
        onHoverOut={handleRelease}
        onPointerLeave={handleRelease}
        onPress={handlePress}
      >
        {children}
      </TooltipTrigger>
      <TooltipContent side={side}>
        <Text>{label}</Text>
      </TooltipContent>
    </Tooltip>
  );
}

/**
 * A ghost command of the detail toolbar: icon and name, 32px high. `label` is left out for the
 * star, which shows only its icon and is named by `accessibilityLabel`.
 */
function DetailToolbarButton({
  label,
  accessibilityLabel,
  icon,
  iconNode,
  active = false,
  disabled = false,
  busy = false,
  compact = false,
  tooltip,
  className,
  testID,
  onPress,
}: {
  label?: string;
  accessibilityLabel?: string;
  /** Hover name on web, for a command that shows no name of its own. */
  tooltip?: string;
  icon?: React.ComponentProps<typeof Icon>["as"];
  /** Replaces the icon, e.g. the spinning refresh arrow. */
  iconNode?: React.ReactNode;
  active?: boolean;
  disabled?: boolean;
  busy?: boolean;
  /** Mobile header: a little less padding so every command fits on one line at 390px. */
  compact?: boolean;
  className?: string;
  testID?: string;
  onPress?: () => void;
}) {
  const button = (
    <Pressable
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityRole="button"
      accessibilityState={{ busy, disabled }}
      aria-disabled={disabled}
      className={cn(
        "group h-8 shrink-0 flex-row items-center rounded-[10px]",
        FOCUS_RING_CLASS_NAME,
        compact ? "gap-1 px-1.5" : "gap-[5px] px-2",
        !disabled && "active:bg-accent web:transition-colors web:hover:bg-accent",
        disabled && "opacity-40",
        busy && "web:cursor-progress",
        className,
      )}
      disabled={disabled || busy}
      hitSlop={TOOLBAR_HIT_SLOP}
      testID={testID}
      onPress={onPress}
    >
      <PressableHitSlopArea hitSlop={TOOLBAR_HIT_SLOP} />
      {iconNode ??
        (icon ? (
          <Icon
            as={icon}
            size={15}
            fill={active ? "currentColor" : "none"}
            className={cn(
              active
                ? "text-warning-icon"
                : "text-muted-foreground web:group-hover:text-foreground",
            )}
          />
        ) : null)}
      {label ? (
        <Text
          className="text-xs font-semibold text-muted-foreground web:group-hover:text-foreground"
          numberOfLines={1}
        >
          {label}
        </Text>
      ) : null}
    </Pressable>
  );
  return tooltip ? <HoverLabel label={tooltip}>{button}</HoverLabel> : button;
}

/**
 * Detail refresh command. While `refreshing` the icon spins and the button is locked;
 * `failed` turns the icon red until a later refresh succeeds.
 */
function RefreshButton({
  refreshing,
  failed,
  disabled = false,
  compact = false,
  onPress,
}: {
  refreshing: boolean;
  failed: boolean;
  disabled?: boolean;
  compact?: boolean;
  onPress: () => void;
}) {
  const rotation = useSharedValue(0);

  React.useEffect(() => {
    if (refreshing) {
      rotation.value = 0;
      rotation.value = withRepeat(
        withTiming(360, { duration: 900, easing: Easing.linear }),
        -1,
        false,
      );
      return;
    }
    cancelAnimation(rotation);
    rotation.value = 0;
  }, [refreshing, rotation]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  const accessibilityLabel = refreshing
    ? "새로고침 중"
    : failed
      ? "새로고침 실패, 다시 시도"
      : "새로고침";

  return (
    <DetailToolbarButton
      accessibilityLabel={accessibilityLabel}
      busy={refreshing}
      compact={compact}
      disabled={disabled}
      iconNode={
        <Animated.View style={animatedStyle}>
          <Icon
            as={RefreshCw}
            size={15}
            className={cn(
              failed
                ? "text-destructive"
                : refreshing
                  ? "text-primary"
                  : "text-muted-foreground web:group-hover:text-foreground",
            )}
          />
        </Animated.View>
      }
      label="새로고침"
      testID="link-detail-refresh"
      onPress={onPress}
    />
  );
}

/** The 32px pencil at the right end of a `내 정리` row. */
function DetailRowEditButton({
  label,
  icon = Pencil,
  disabled = false,
  testID,
  onPress,
}: {
  label: string;
  icon?: React.ComponentProps<typeof Icon>["as"];
  disabled?: boolean;
  testID?: string;
  onPress?: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      aria-disabled={disabled}
      className={cn(
        "size-8 items-center justify-center rounded-[10px]",
        FOCUS_RING_CLASS_NAME,
        !disabled && "active:bg-accent web:transition-colors web:hover:bg-accent",
        disabled && "opacity-40",
      )}
      disabled={disabled}
      hitSlop={ROW_BUTTON_HIT_SLOP}
      testID={testID}
      onPress={onPress}
    >
      <PressableHitSlopArea hitSlop={ROW_BUTTON_HIT_SLOP} />
      <Icon
        as={icon}
        size={15}
        className="text-muted-foreground"
      />
    </Pressable>
  );
}

/** `+ 추가` in the value column of an empty row, or at the right of the 액션 header. */
function DetailRowAddButton({
  accessibilityLabel,
  disabled = false,
  align = "start",
  testID,
  onPress,
}: {
  accessibilityLabel: string;
  disabled?: boolean;
  /** `end` lines the text up with the row's right edge (the 액션 header). */
  align?: "start" | "end";
  testID?: string;
  onPress?: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      aria-disabled={disabled}
      className={cn(
        "group h-8 flex-row items-center gap-1 self-start rounded-[10px] px-2",
        FOCUS_RING_CLASS_NAME,
        align === "start" ? "-ml-2" : "-mr-2",
        !disabled && "active:bg-accent web:transition-colors web:hover:bg-accent",
        disabled && "opacity-40",
      )}
      disabled={disabled}
      hitSlop={ROW_BUTTON_HIT_SLOP}
      testID={testID}
      onPress={onPress}
    >
      <PressableHitSlopArea hitSlop={ROW_BUTTON_HIT_SLOP} />
      <Icon
        as={Plus}
        size={14}
        className="text-muted-foreground web:group-hover:text-foreground"
      />
      <Text className="text-[13px] font-semibold text-muted-foreground web:group-hover:text-foreground">
        추가
      </Text>
    </Pressable>
  );
}

/**
 * One row of `내 정리`: the label column, the value, and a 32px column at the right for the
 * pencil. The rows after the first are split by a hairline.
 */
function DetailRow({
  label,
  first = false,
  trailing,
  testID,
  children,
}: {
  label: string;
  first?: boolean;
  /** The pencil (or nothing, for an empty row whose `+ 추가` sits in the value). */
  trailing?: React.ReactNode;
  testID?: string;
  children: React.ReactNode;
}) {
  return (
    <View
      className={cn("flex-row items-start gap-3 py-2.5", !first && "border-t border-border-soft")}
      testID={testID}
    >
      <Text className="w-12 text-xs font-semibold leading-8 text-muted-foreground">{label}</Text>
      <View className="min-h-8 min-w-0 flex-1 justify-center">{children}</View>
      <View className="w-8">{trailing}</View>
    </View>
  );
}

export {
  DetailRow,
  DetailRowAddButton,
  DetailRowEditButton,
  DetailToolbarButton,
  FOCUS_RING_CLASS_NAME,
  HoverLabel,
  RefreshButton,
};
