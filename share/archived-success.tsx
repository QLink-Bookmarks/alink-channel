import * as React from "react";
import { AccessibilityInfo, type LayoutChangeEvent, View } from "react-native";
import Animated, {
  Easing,
  ReduceMotion,
  type SharedValue,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";

import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";

import { useShareTheme } from "./share-theme";

const AnimatedPath = Animated.createAnimatedComponent(Path);

const WORD = "Archived";
const ACCESSIBILITY_LABEL = "저장됨";

const PILL_HEIGHT = 56;
const RING_RADIUS = 14.75;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;
const RING_PATH = `M16 ${16 - RING_RADIUS}a${RING_RADIUS} ${RING_RADIUS} 0 1 1 0 ${RING_RADIUS * 2}a${RING_RADIUS} ${RING_RADIUS} 0 1 1 0 ${-RING_RADIUS * 2}`;
const TICK_PATH = "M9.5 16.5l4.4 4.3 8.6-9.1";
const TICK_LENGTH = Math.hypot(4.4, 4.3) + Math.hypot(8.6, 9.1);

const TIMING = {
  chipStart: 140,
  chipDuration: 320,
  ringStart: 200,
  ringDuration: 420,
  tickStart: 540,
  tickDuration: 280,
  growStart: 760,
  growDuration: 500,
  letterStart: 760,
  letterStagger: 45,
  letterRise: 220,
  exitStart: 2050,
  exitDuration: 200,
  finish: 2250,
} as const;

const REDUCED_TIMING = {
  fadeInStart: 120,
  fadeDuration: 200,
  fadeOutStart: 1100,
  finish: 1300,
} as const;

const CHIP_SPRING = { damping: 15, stiffness: 260, mass: 1 } as const;
const LETTER_SPRING = { damping: 12, stiffness: 320, mass: 1 } as const;

const EASE_CHIP = Easing.bezier(0.34, 1.56, 0.64, 1);
const EASE_RING = Easing.bezier(0.65, 0, 0.35, 1);
const EASE_OUT_EXPO = Easing.bezier(0.16, 1, 0.3, 1);
const EASE_LETTER = Easing.bezier(0.2, 0.7, 0.3, 1);
const EASE_EXIT = Easing.bezier(0.4, 0, 1, 1);

type ArchivedSuccessProps = {
  onFinished: () => void;
};

function ArchivedSuccess({ onFinished }: ArchivedSuccessProps) {
  const isReducedMotion = useReducedMotion();
  const [isReduced] = React.useState(isReducedMotion);
  const { mode, tokens } = useShareTheme();
  const surfaceColor = mode === "dark" ? tokens.surfaceElevated : tokens.card;
  const surfaceClassName = mode === "dark" ? "bg-surface-elevated" : "bg-card";

  const onFinishedRef = React.useRef(onFinished);
  React.useEffect(() => {
    onFinishedRef.current = onFinished;
  }, [onFinished]);

  const overlayOpacity = useSharedValue(isReduced ? 0 : 1);
  const overlayScale = useSharedValue(1);
  const chipOpacity = useSharedValue(isReduced ? 1 : 0);
  const chipScale = useSharedValue(isReduced ? 1 : 0.5);
  const ring = useSharedValue(isReduced ? 1 : 0);
  const tick = useSharedValue(isReduced ? 1 : 0);
  const grow = useSharedValue(isReduced ? 1 : 0);
  const pillWidth = useSharedValue(0);
  const letterOrigin = useSharedValue(0);
  const badgeCenter = React.useRef(0);
  const wordLeft = React.useRef(0);

  React.useEffect(() => {
    if (isReduced) {
      const fade = {
        duration: REDUCED_TIMING.fadeDuration,
        easing: Easing.linear,
        reduceMotion: ReduceMotion.Never,
      };
      overlayOpacity.value = withSequence(
        ReduceMotion.Never,
        withDelay(REDUCED_TIMING.fadeInStart, withTiming(1, fade), ReduceMotion.Never),
        withDelay(
          REDUCED_TIMING.fadeOutStart - REDUCED_TIMING.fadeInStart - REDUCED_TIMING.fadeDuration,
          withTiming(0, fade),
          ReduceMotion.Never,
        ),
      );
    } else {
      chipOpacity.value = withDelay(
        TIMING.chipStart,
        withTiming(1, { duration: TIMING.chipDuration, easing: EASE_CHIP }),
      );
      chipScale.value = withDelay(TIMING.chipStart, withSpring(1, CHIP_SPRING));
      ring.value = withDelay(
        TIMING.ringStart,
        withTiming(1, { duration: TIMING.ringDuration, easing: EASE_RING }),
      );
      tick.value = withDelay(
        TIMING.tickStart,
        withTiming(1, { duration: TIMING.tickDuration, easing: EASE_OUT_EXPO }),
      );
      grow.value = withDelay(
        TIMING.growStart,
        withTiming(1, { duration: TIMING.growDuration, easing: EASE_OUT_EXPO }),
      );
      overlayOpacity.value = withDelay(
        TIMING.exitStart,
        withTiming(0, { duration: TIMING.exitDuration, easing: EASE_EXIT }),
      );
      overlayScale.value = withDelay(
        TIMING.exitStart,
        withTiming(0.96, { duration: TIMING.exitDuration, easing: EASE_EXIT }),
      );
    }

    AccessibilityInfo.announceForAccessibility(ACCESSIBILITY_LABEL);

    const timer = setTimeout(
      () => onFinishedRef.current(),
      isReduced ? REDUCED_TIMING.finish : TIMING.finish,
    );
    return () => clearTimeout(timer);
  }, [chipOpacity, chipScale, grow, isReduced, overlayOpacity, overlayScale, ring, tick]);

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: overlayOpacity.value,
    transform: [{ scale: overlayScale.value }],
  }));

  const chipStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, Math.max(0, chipOpacity.value)),
    transform: [{ scale: chipScale.value }],
  }));

  const rowStyle = useAnimatedStyle(() => {
    const travel = Math.max(0, pillWidth.value - PILL_HEIGHT);
    return { transform: [{ translateX: (travel / 2) * (1 - grow.value) }] };
  });

  const bodyStyle = useAnimatedStyle(() => {
    const travel = Math.max(0, pillWidth.value - PILL_HEIGHT);
    return {
      transform: [{ translateX: -(travel * (1 - grow.value)) / 2 }, { scaleX: grow.value }],
    };
  });

  const endCapStyle = useAnimatedStyle(() => {
    const travel = Math.max(0, pillWidth.value - PILL_HEIGHT);
    return { transform: [{ translateX: -travel * (1 - grow.value) }] };
  });

  const ringProps = useAnimatedProps(() => ({
    strokeDashoffset: RING_LENGTH * (1 - ring.value),
    strokeOpacity: ring.value > 0 ? 1 : 0,
  }));

  const tickProps = useAnimatedProps(() => ({
    strokeDashoffset: TICK_LENGTH * (1 - tick.value),
    strokeOpacity: tick.value > 0 ? 1 : 0,
  }));

  const updateLetterOrigin = React.useCallback(() => {
    letterOrigin.value = badgeCenter.current - wordLeft.current;
  }, [letterOrigin]);

  const handleRowLayout = React.useCallback(
    (event: LayoutChangeEvent) => {
      pillWidth.value = event.nativeEvent.layout.width;
    },
    [pillWidth],
  );

  const handleBadgeLayout = React.useCallback(
    (event: LayoutChangeEvent) => {
      const { x, width } = event.nativeEvent.layout;
      badgeCenter.current = x + width / 2;
      updateLetterOrigin();
    },
    [updateLetterOrigin],
  );

  const handleWordLayout = React.useCallback(
    (event: LayoutChangeEvent) => {
      wordLeft.current = event.nativeEvent.layout.x;
      updateLetterOrigin();
    },
    [updateLetterOrigin],
  );

  return (
    <View
      accessible
      accessibilityLabel={ACCESSIBILITY_LABEL}
      className="pointer-events-none absolute inset-0 items-center justify-center"
    >
      <Animated.View style={overlayStyle}>
        <Animated.View style={chipStyle}>
          <Animated.View
            style={rowStyle}
            onLayout={handleRowLayout}
          >
            <View className="h-14 flex-row items-center gap-2.5 pl-3 pr-5">
              <View
                className="absolute inset-0"
                style={{
                  shadowColor: "#000000",
                  shadowOffset: { width: 0, height: 10 },
                  shadowOpacity: mode === "dark" ? 0.5 : 0.18,
                  shadowRadius: 15,
                }}
              >
                <View
                  className={cn("absolute left-0 top-0 h-14 w-14 rounded-full", surfaceClassName)}
                />
                <View className="absolute bottom-0 left-7 right-7 top-0">
                  <Animated.View style={[{ flex: 1, backgroundColor: surfaceColor }, bodyStyle]} />
                </View>
                <View className="absolute right-0 top-0 h-14 w-14">
                  <Animated.View
                    style={[
                      { flex: 1, borderRadius: PILL_HEIGHT / 2, backgroundColor: surfaceColor },
                      endCapStyle,
                    ]}
                  />
                </View>
              </View>
              <View
                className={cn("z-10 h-8 w-8 rounded-full", surfaceClassName)}
                onLayout={handleBadgeLayout}
              >
                <Svg
                  height={32}
                  viewBox="0 0 32 32"
                  width={32}
                >
                  <AnimatedPath
                    animatedProps={ringProps}
                    d={RING_PATH}
                    fill="none"
                    stroke={tokens.success}
                    strokeDasharray={[RING_LENGTH, RING_LENGTH]}
                    strokeLinecap="round"
                    strokeWidth={2.5}
                  />
                  <AnimatedPath
                    animatedProps={tickProps}
                    d={TICK_PATH}
                    fill="none"
                    stroke={tokens.success}
                    strokeDasharray={[TICK_LENGTH, TICK_LENGTH]}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2.75}
                  />
                </Svg>
              </View>
              <View
                className="flex-row"
                onLayout={handleWordLayout}
              >
                {WORD.split("").map((letter, index) => (
                  <ArchivedLetter
                    key={`${letter}-${index}`}
                    index={index}
                    isReduced={isReduced}
                    letter={letter}
                    origin={letterOrigin}
                  />
                ))}
              </View>
            </View>
          </Animated.View>
        </Animated.View>
      </Animated.View>
    </View>
  );
}

type ArchivedLetterProps = {
  index: number;
  isReduced: boolean;
  letter: string;
  origin: SharedValue<number>;
};

function ArchivedLetter({ index, isReduced, letter, origin }: ArchivedLetterProps) {
  const center = useSharedValue(0);
  const travel = useSharedValue(isReduced ? 1 : 0);
  const lift = useSharedValue(0);
  const scale = useSharedValue(isReduced ? 1 : 0.2);
  const opacity = useSharedValue(isReduced ? 1 : 0);

  React.useEffect(() => {
    if (isReduced) {
      return;
    }
    const delay = TIMING.letterStart + TIMING.letterStagger * index;
    const rise = { duration: TIMING.letterRise, easing: EASE_LETTER };
    travel.value = withDelay(delay, withTiming(1, rise));
    opacity.value = withDelay(delay, withTiming(1, rise));
    lift.value = withDelay(delay, withSequence(withTiming(-9, rise), withSpring(0, LETTER_SPRING)));
    scale.value = withDelay(
      delay,
      withSequence(withTiming(1.14, rise), withSpring(1, LETTER_SPRING)),
    );
  }, [index, isReduced, lift, opacity, scale, travel]);

  const letterStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { translateX: (origin.value - center.value) * (1 - travel.value) },
      { translateY: lift.value },
      { scale: scale.value },
    ],
  }));

  const handleLayout = React.useCallback(
    (event: LayoutChangeEvent) => {
      const { x, width } = event.nativeEvent.layout;
      center.value = x + width / 2;
    },
    [center],
  );

  return (
    <Animated.View
      style={[{ transformOrigin: "50% 80%" }, letterStyle]}
      onLayout={handleLayout}
    >
      <Text className="text-xl font-semibold text-foreground">{letter}</Text>
    </Animated.View>
  );
}

export { ArchivedSuccess };
export type { ArchivedSuccessProps };
