import * as React from "react";
import { View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { LinearGradient } from "@/components/ui/linear-gradient";
import { cn } from "@/lib/utils";

import { useShareTheme } from "./share-theme";

const THUMB_TRAVEL = 13.6;
const THUMB_EASING = Easing.bezier(0.16, 1, 0.3, 1);

function ShareToggleTrack({ checked }: { checked: boolean }) {
  const { mode, accent } = useShareTheme();
  const isReducedMotion = useReducedMotion();
  const offset = useSharedValue(checked ? THUMB_TRAVEL : 0);

  React.useEffect(() => {
    const target = checked ? THUMB_TRAVEL : 0;
    offset.value = isReducedMotion
      ? target
      : withTiming(target, { duration: 200, easing: THUMB_EASING });
  }, [checked, isReducedMotion, offset]);

  const thumbStyle = useAnimatedStyle(() => ({ transform: [{ translateX: offset.value }] }));

  return (
    <View
      aria-hidden
      className="h-[18.4px] w-8 shrink-0 justify-center overflow-hidden rounded-full"
    >
      {checked ? (
        <LinearGradient
          accent={accent}
          mode={mode}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, borderRadius: 9999 }}
        />
      ) : (
        <View className="absolute inset-0 rounded-full bg-input dark:bg-input/80" />
      )}
      <Animated.View
        className={cn(
          "ml-[1.2px] size-4 rounded-full bg-background shadow-sm shadow-black/15",
          checked ? "dark:bg-primary-foreground" : "dark:bg-foreground",
        )}
        style={thumbStyle}
      />
    </View>
  );
}

export { ShareToggleTrack };
