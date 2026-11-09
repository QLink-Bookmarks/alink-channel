import * as React from "react";
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";

import {
  type ImportStatusTone,
  getImportStatusBadgeLabel,
  getImportStatusTone,
} from "../../lib/import-status-copy";
import type { ImportStatus } from "../../types";

import { LoaderCircle } from "lucide-react-native";

const TONE_VARIANTS = {
  success: "success",
  warning: "warning",
  danger: "overdue",
  muted: "private",
} as const;

const TONE_TEXT: Record<ImportStatusTone, string> = {
  success: "text-success",
  warning: "text-warning",
  danger: "text-destructive",
  muted: "text-foreground/70",
};

function SpinningIcon({ className }: { className: string }) {
  const reduceMotion = useReducedMotion();
  const rotation = useSharedValue(0);

  React.useEffect(() => {
    if (reduceMotion) {
      return;
    }
    rotation.value = withRepeat(
      withTiming(360, { duration: 1000, easing: Easing.linear }),
      -1,
      false,
    );
    return () => cancelAnimation(rotation);
  }, [reduceMotion, rotation]);

  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${rotation.value}deg` }] }));

  return (
    <Animated.View
      aria-hidden
      style={style}
    >
      <Icon
        as={LoaderCircle}
        size={12}
        className={className}
      />
    </Animated.View>
  );
}

type ImportStatusBadgeProps = {
  status: ImportStatus;
  isFillingThumbnails?: boolean;
  className?: string;
};

function ImportStatusBadge({
  status,
  isFillingThumbnails = false,
  className,
}: ImportStatusBadgeProps) {
  const tone = getImportStatusTone(status);
  return (
    <Badge
      variant={TONE_VARIANTS[tone]}
      className={cn(tone === "muted" && "border-border bg-card", className)}
    >
      {isFillingThumbnails ? <SpinningIcon className={TONE_TEXT[tone]} /> : null}
      <Text className={cn("text-sm", tone === "muted" && TONE_TEXT.muted)}>
        {getImportStatusBadgeLabel(status, isFillingThumbnails)}
      </Text>
    </Badge>
  );
}

export { ImportStatusBadge };
