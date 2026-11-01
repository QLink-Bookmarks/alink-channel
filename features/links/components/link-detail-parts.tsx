import * as React from "react";
import { Pressable } from "react-native";
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

import { RefreshCw } from "lucide-react-native/icons";

const isWeb = process.env.EXPO_OS === "web";

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
  if (!isWeb) {
    return children;
  }
  return (
    <Tooltip
      delayDuration={150}
      style={shrink ? { flexShrink: 1, minWidth: 0 } : undefined}
    >
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side={side}>
        <Text>{label}</Text>
      </TooltipContent>
    </Tooltip>
  );
}

/** Label-free 40px action button of the link detail, with a hover name and an accessible name. */
function DetailActionButton({
  label,
  icon,
  tone = "default",
  active = false,
  disabled = false,
  className,
  testID,
  onPress,
}: {
  label: string;
  icon: React.ComponentProps<typeof Icon>["as"];
  tone?: "default" | "destructive";
  active?: boolean;
  disabled?: boolean;
  className?: string;
  testID?: string;
  onPress?: () => void;
}) {
  return (
    <HoverLabel label={label}>
      <Pressable
        accessibilityLabel={label}
        accessibilityRole="button"
        accessibilityState={{ disabled }}
        className={cn(
          "size-10 shrink-0 items-center justify-center rounded-xl border border-border bg-card",
          "active:border-primary web:transition-colors web:hover:border-primary",
          disabled && "opacity-50",
          className,
        )}
        disabled={disabled}
        testID={testID}
        onPress={onPress}
      >
        <Icon
          as={icon}
          size={17}
          fill={active ? "currentColor" : "none"}
          className={cn(
            tone === "destructive" ? "text-destructive" : "text-foreground",
            active && "text-warning",
          )}
        />
      </Pressable>
    </HoverLabel>
  );
}

/**
 * Detail refresh button. While `refreshing` the icon spins and the button is locked;
 * `failed` turns it red until a later refresh succeeds.
 */
function RefreshButton({
  refreshing,
  failed,
  onPress,
}: {
  refreshing: boolean;
  failed: boolean;
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

  const label = refreshing ? "새로고침 중" : failed ? "새로고침 실패, 다시 시도" : "새로고침";

  return (
    <HoverLabel label={label}>
      <Pressable
        accessibilityLabel={label}
        accessibilityRole="button"
        accessibilityState={{ busy: refreshing, disabled: refreshing }}
        className={cn(
          "size-9 items-center justify-center rounded-xl",
          "active:bg-accent web:transition-colors web:hover:bg-accent",
          refreshing && "web:cursor-progress",
        )}
        disabled={refreshing}
        testID="link-detail-refresh"
        onPress={onPress}
      >
        <Animated.View style={animatedStyle}>
          <Icon
            as={RefreshCw}
            size={16}
            className={cn(
              failed ? "text-destructive" : refreshing ? "text-primary" : "text-muted-foreground",
            )}
          />
        </Animated.View>
      </Pressable>
    </HoverLabel>
  );
}

export { DetailActionButton, HoverLabel, RefreshButton };
