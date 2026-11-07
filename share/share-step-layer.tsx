import * as React from "react";
import { type LayoutChangeEvent, useWindowDimensions } from "react-native";
import Animated, {
  Easing,
  ReduceMotion,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

type ShareStepPosition = -1 | 0 | 1;

const PUSH_DURATION_MS = 340;
const FADE_DURATION_MS = 200;
const PUSH_EASING = Easing.bezier(0.32, 0.72, 0, 1);
const BEHIND_SHIFT_RATIO = 0.28;

type ShareStepLayerProps = {
  position: ShareStepPosition;
  isReducedMotion: boolean;
  paddingBottom: number;
  height?: number;
  maxHeight: number;
  testID?: string;
  onHeightChange?: (height: number) => void;
  children: React.ReactNode;
};

function ShareStepLayer({
  position,
  isReducedMotion,
  paddingBottom,
  height,
  maxHeight,
  testID,
  children,
  onHeightChange,
}: ShareStepLayerProps) {
  const { width } = useWindowDimensions();
  const progress = useSharedValue<number>(position);

  React.useEffect(() => {
    progress.value = withTiming(position, {
      duration: isReducedMotion ? FADE_DURATION_MS : PUSH_DURATION_MS,
      easing: isReducedMotion ? Easing.linear : PUSH_EASING,
      reduceMotion: ReduceMotion.Never,
    });
  }, [isReducedMotion, position, progress]);

  const animatedStyle = useAnimatedStyle(() => {
    if (isReducedMotion) {
      return {
        opacity: interpolate(Math.abs(progress.value), [0, 1], [1, 0], "clamp"),
        transform: [{ translateX: 0 }],
      };
    }
    return {
      opacity: interpolate(progress.value, [-1, 0, 1], [0, 1, 1], "clamp"),
      transform: [
        {
          translateX: interpolate(
            progress.value,
            [-1, 0, 1],
            [-width * BEHIND_SHIFT_RATIO, 0, width],
            "clamp",
          ),
        },
      ],
    };
  }, [isReducedMotion, width]);

  const isActive = position === 0;

  const handleLayout = React.useCallback(
    (event: LayoutChangeEvent) => onHeightChange?.(event.nativeEvent.layout.height),
    [onHeightChange],
  );

  return (
    <Animated.View
      accessibilityElementsHidden={!isActive}
      className="absolute left-0 right-0 top-0 px-4 pt-5"
      importantForAccessibility={isActive ? "auto" : "no-hide-descendants"}
      pointerEvents={isActive ? "auto" : "none"}
      style={[height == null ? { maxHeight } : { height }, { paddingBottom }, animatedStyle]}
      testID={testID}
      onLayout={handleLayout}
    >
      {children}
    </Animated.View>
  );
}

export { FADE_DURATION_MS, PUSH_DURATION_MS, PUSH_EASING, ShareStepLayer };
export type { ShareStepPosition };
