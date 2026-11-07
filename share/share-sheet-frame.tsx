import * as React from "react";
import { type LayoutChangeEvent, Pressable, View, useWindowDimensions } from "react-native";
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

import {
  DEFAULT_SHEET_HEIGHT,
  type SheetPlacement,
  clampSheetHeight,
  getAvailableSheetHeight,
} from "./share-sheet-height";
import { FADE_DURATION_MS, PUSH_DURATION_MS, PUSH_EASING } from "./share-step-layer";

const CONTENT_FADE_DURATION_MS = 200;
const CONTENT_FADE_EASING = Easing.bezier(0.4, 0, 1, 1);
const DISMISS_DURATION_MS = 200;
const DISMISS_EASING = Easing.bezier(0.32, 0, 0.67, 0);
const DISMISS_DISTANCE = 80;
const DISMISS_VELOCITY = 800;
const SPRING_BACK = { damping: 20, stiffness: 260 } as const;
const FACE_FALLBACK_MS = 300;

type ShareSheetFrameProps = {
  contentHeight: number | undefined;
  isCompleting: boolean;
  isReducedMotion: boolean;
  isSwipeEnabled: boolean;
  isDismissEnabled: boolean;
  hasRoundedCorners: boolean;
  overlay?: React.ReactNode;
  children: React.ReactNode;
  onAvailableHeightChange?: (height: number) => void;
  onDismiss: () => void;
};

function ShareSheetFrame({
  contentHeight,
  isCompleting,
  isReducedMotion,
  isSwipeEnabled,
  isDismissEnabled,
  hasRoundedCorners,
  overlay,
  children,
  onAvailableHeightChange,
  onDismiss,
}: ShareSheetFrameProps) {
  const { height: windowHeight } = useWindowDimensions();
  const containerRef = React.useRef<View>(null);
  const [placement, setPlacement] = React.useState<SheetPlacement | null>(null);
  const availableHeight = placement
    ? getAvailableSheetHeight(placement, windowHeight)
    : DEFAULT_SHEET_HEIGHT;
  const visibleTarget = clampSheetHeight(contentHeight, availableHeight);
  const isMeasured = contentHeight != null && placement != null;
  const [hasFallbackElapsed, setHasFallbackElapsed] = React.useState(false);
  const isShown = isMeasured || hasFallbackElapsed;

  const available = useSharedValue(DEFAULT_SHEET_HEIGHT);
  const visible = useSharedValue(visibleTarget);
  const drag = useSharedValue(0);
  const faceOpacity = useSharedValue(0);
  const contentOpacity = useSharedValue(1);
  const isDismissing = useSharedValue(false);
  const hasShownRef = React.useRef(false);

  React.useEffect(() => {
    available.value = availableHeight;
    if (placement) {
      onAvailableHeightChange?.(availableHeight);
    }
  }, [available, availableHeight, onAvailableHeightChange, placement]);

  React.useEffect(() => {
    const timer = setTimeout(() => setHasFallbackElapsed(true), FACE_FALLBACK_MS);
    return () => clearTimeout(timer);
  }, []);

  React.useEffect(() => {
    if (!isShown) {
      return;
    }
    if (!hasShownRef.current) {
      hasShownRef.current = true;
      visible.value = visibleTarget;
      faceOpacity.value = 1;
      return;
    }
    visible.value = withTiming(visibleTarget, {
      duration: isReducedMotion ? FADE_DURATION_MS : PUSH_DURATION_MS,
      easing: isReducedMotion ? Easing.linear : PUSH_EASING,
      reduceMotion: ReduceMotion.Never,
    });
  }, [faceOpacity, isReducedMotion, isShown, visible, visibleTarget]);

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

  const handleLayout = React.useCallback((event: LayoutChangeEvent) => {
    const { height } = event.nativeEvent.layout;
    containerRef.current?.measureInWindow((_x, y) => {
      setPlacement((current) =>
        current?.top === y && current.height === height ? current : { top: y, height },
      );
    });
  }, []);

  const handleBackdropPress = React.useCallback(() => {
    if (!isDismissEnabled || isDismissing.value) {
      return;
    }
    isDismissing.value = true;
    drag.value = withTiming(
      visible.value,
      { duration: DISMISS_DURATION_MS, easing: DISMISS_EASING },
      (finished) => {
        if (finished) {
          scheduleOnRN(onDismiss);
        }
      },
    );
  }, [drag, isDismissEnabled, isDismissing, onDismiss, visible]);

  const pan = React.useMemo(
    () =>
      Gesture.Pan()
        .enabled(isSwipeEnabled)
        .activeOffsetY(4)
        .failOffsetX([-20, 20])
        .onUpdate((event) => {
          if (isDismissing.value) {
            return;
          }
          drag.value = Math.max(0, event.translationY);
        })
        .onEnd((event) => {
          if (isDismissing.value) {
            return;
          }
          const shouldDismiss =
            event.translationY > DISMISS_DISTANCE || event.velocityY > DISMISS_VELOCITY;
          if (shouldDismiss) {
            isDismissing.value = true;
            drag.value = withTiming(
              visible.value,
              { duration: DISMISS_DURATION_MS, easing: DISMISS_EASING },
              (finished) => {
                if (finished) {
                  scheduleOnRN(onDismiss);
                }
              },
            );
            return;
          }
          drag.value = withSpring(0, SPRING_BACK);
        })
        .onFinalize(() => {
          if (!isDismissing.value && drag.value > 0) {
            drag.value = withSpring(0, SPRING_BACK);
          }
        }),
    [drag, isDismissing, isSwipeEnabled, onDismiss, visible],
  );

  const sheetStyle = useAnimatedStyle(() => ({
    opacity: faceOpacity.value,
    transform: [{ translateY: available.value - visible.value + drag.value }],
  }));

  const contentStyle = useAnimatedStyle(() => ({ opacity: contentOpacity.value }));

  return (
    <View
      ref={containerRef}
      className="flex-1 bg-transparent"
      collapsable={false}
      onLayout={handleLayout}
    >
      <Pressable
        accessible={false}
        className="absolute inset-0 bg-black/[0.02]"
        collapsable={false}
        disabled={!isDismissEnabled}
        testID="share-sheet-backdrop"
        onPress={handleBackdropPress}
      />
      <GestureDetector gesture={pan}>
        <Animated.View
          className={cn(
            "absolute inset-0 overflow-hidden bg-background",
            hasRoundedCorners ? "rounded-t-[28px]" : "rounded-t-2xl",
          )}
          accessibilityElementsHidden={!isShown}
          importantForAccessibility={isShown ? "auto" : "no-hide-descendants"}
          pointerEvents={isCompleting || !isShown ? "none" : "auto"}
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
          {overlay ? (
            <View
              className="absolute left-0 right-0 top-0"
              pointerEvents="none"
              style={{ height: visibleTarget }}
            >
              {overlay}
            </View>
          ) : null}
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

export { CONTENT_FADE_DURATION_MS, FACE_FALLBACK_MS, ShareSheetFrame };
