import * as React from "react";
import { type LayoutChangeEvent, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

import { cn } from "@/lib/utils";

const CONTENT_FADE_DURATION_MS = 200;
const CONTENT_FADE_EASING = Easing.bezier(0.4, 0, 1, 1);
const DISMISS_EASING = Easing.bezier(0.32, 0, 0.67, 0);
const DISMISS_DISTANCE = 80;
const DISMISS_VELOCITY = 800;
const DEFAULT_SHEET_HEIGHT = 392;

type ShareSheetFrameProps = {
  isCompleting: boolean;
  isReducedMotion: boolean;
  isSwipeEnabled: boolean;
  hasRoundedCorners: boolean;
  overlay?: React.ReactNode;
  children: React.ReactNode;
  onSwipeDismiss: () => void;
};

function ShareSheetFrame({
  isCompleting,
  isReducedMotion,
  isSwipeEnabled,
  hasRoundedCorners,
  overlay,
  children,
  onSwipeDismiss,
}: ShareSheetFrameProps) {
  const translateY = useSharedValue(0);
  const contentOpacity = useSharedValue(1);
  const height = useSharedValue(DEFAULT_SHEET_HEIGHT);
  const isDismissing = useSharedValue(false);

  React.useEffect(() => {
    if (!isCompleting) {
      return;
    }
    contentOpacity.value = withTiming(0, {
      duration: CONTENT_FADE_DURATION_MS,
      easing: isReducedMotion ? Easing.linear : CONTENT_FADE_EASING,
      reduceMotion: ReduceMotion.Never,
    });
  }, [contentOpacity, isCompleting, isReducedMotion]);

  const handleLayout = React.useCallback(
    (event: LayoutChangeEvent) => {
      height.value = event.nativeEvent.layout.height;
    },
    [height],
  );

  const pan = React.useMemo(
    () =>
      Gesture.Pan()
        .enabled(isSwipeEnabled)
        .activeOffsetY(4)
        .failOffsetX([-20, 20])
        .onUpdate((event) => {
          translateY.value = Math.max(0, event.translationY);
        })
        .onEnd((event) => {
          const shouldDismiss =
            event.translationY > DISMISS_DISTANCE || event.velocityY > DISMISS_VELOCITY;
          if (shouldDismiss) {
            isDismissing.value = true;
            translateY.value = withTiming(
              height.value,
              { duration: 200, easing: DISMISS_EASING },
              (finished) => {
                if (finished) {
                  scheduleOnRN(onSwipeDismiss);
                }
              },
            );
            return;
          }
          translateY.value = withSpring(0, { damping: 20, stiffness: 260 });
        })
        .onFinalize(() => {
          if (!isDismissing.value && translateY.value > 0) {
            translateY.value = withSpring(0, { damping: 20, stiffness: 260 });
          }
        }),
    [height, isDismissing, isSwipeEnabled, onSwipeDismiss, translateY],
  );

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const contentStyle = useAnimatedStyle(() => ({ opacity: contentOpacity.value }));

  return (
    <View
      className="flex-1 bg-transparent"
      onLayout={handleLayout}
    >
      <GestureDetector gesture={pan}>
        <Animated.View
          className={cn(
            "absolute inset-0 overflow-hidden bg-background",
            hasRoundedCorners ? "rounded-t-[28px]" : "rounded-t-2xl",
          )}
          pointerEvents={isCompleting ? "none" : "auto"}
          style={sheetStyle}
          testID="share-sheet"
        >
          <Animated.View
            accessibilityElementsHidden={isCompleting}
            className="absolute inset-0"
            importantForAccessibility={isCompleting ? "no-hide-descendants" : "auto"}
            style={contentStyle}
            testID="share-sheet-content"
          >
            <View
              aria-hidden
              className="absolute left-1/2 top-1.5 z-10 -ml-[18px] h-[5px] w-9 rounded-full bg-muted-foreground/40"
            />
            {children}
          </Animated.View>
          {overlay}
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

export { CONTENT_FADE_DURATION_MS, ShareSheetFrame };
