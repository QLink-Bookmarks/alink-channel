import * as React from "react";
import { type LayoutChangeEvent, View } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";

import { MODE_MOVING, type SectionMotion } from "../hooks/use-section-accordion";
import { SETTLED_MAX_HEIGHT, interpolateSectionHeight } from "../lib/section-accordion";

const BODY_STYLE = { flexShrink: 1, minHeight: 0, overflow: "hidden" } as const;

type FolderSectionBodyProps<K extends string> = {
  sectionKey: K;
  motion: SectionMotion;
  isOpen: boolean;
  isOpening: boolean;
  openingCap: number | undefined;
  frozenHeight: number | undefined;
  listMaxHeight?: number;
  children: React.ReactNode;
  onMeasure: (key: K, height: number) => void;
  onVisibleLayout: (key: K, height: number) => void;
};

function FolderSectionBody<K extends string>({
  sectionKey,
  motion,
  isOpen,
  isOpening,
  openingCap,
  frozenHeight,
  listMaxHeight,
  children,
  onMeasure,
  onVisibleLayout,
}: FolderSectionBodyProps<K>) {
  const animatedStyle = useAnimatedStyle(() => {
    if (motion.mode.value === MODE_MOVING) {
      return {
        maxHeight: interpolateSectionHeight(motion.plan.value, sectionKey, motion.progress.value),
      };
    }
    return { maxHeight: motion.settledKey.value === sectionKey ? SETTLED_MAX_HEIGHT : 0 };
  });

  const innerStyle =
    frozenHeight != null
      ? { height: frozenHeight, flexShrink: 0 }
      : isOpening
        ? { flexShrink: 0, maxHeight: openingCap }
        : { flexShrink: 1, maxHeight: listMaxHeight };

  const handleBodyLayout = React.useCallback(
    (event: LayoutChangeEvent) => onVisibleLayout(sectionKey, event.nativeEvent.layout.height),
    [onVisibleLayout, sectionKey],
  );

  const handleInnerLayout = React.useCallback(
    (event: LayoutChangeEvent) => {
      if (isOpening) {
        onMeasure(sectionKey, event.nativeEvent.layout.height);
      }
    },
    [isOpening, onMeasure, sectionKey],
  );

  return (
    <Animated.View
      aria-hidden={!isOpen}
      pointerEvents={isOpen ? "auto" : "none"}
      style={[BODY_STYLE, animatedStyle]}
      testID={`folder-section-body-${sectionKey}`}
      onLayout={handleBodyLayout}
    >
      <View
        className="min-h-0"
        style={innerStyle}
        testID={`folder-section-body-inner-${sectionKey}`}
        onLayout={handleInnerLayout}
      >
        {children}
      </View>
    </Animated.View>
  );
}

export { FolderSectionBody };
