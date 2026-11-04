import * as React from "react";
import { type LayoutChangeEvent, View } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";

import type { SectionMotion } from "../hooks/use-section-accordion";
import { isListMeasurable, useSyncMeasure } from "../hooks/use-sync-measure";
import {
  MODE_MOVING,
  SETTLED_MAX_HEIGHT,
  interpolateSectionHeight,
} from "../lib/section-accordion";

// 웹에서 NativeWind className은 Reanimated Animated.View에 적용되지 않아 클립과 shrink가 빠진다. 그래서 본문 레이아웃은 style로 둔다.
const BODY_STYLE = { flexShrink: 1, minHeight: 0, overflow: "hidden" } as const;
const LOCKED_BODY_STYLE = { flexShrink: 0 } as const;

type FolderSectionBodyProps<K extends string> = {
  sectionKey: K;
  motion: SectionMotion;
  isOpen: boolean;
  isShrinkLocked: boolean;
  isOpening: boolean;
  openingCap: number | undefined;
  openingTarget: number;
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
  isShrinkLocked,
  isOpening,
  openingCap,
  openingTarget,
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
        ? { position: "absolute" as const, top: 0, left: 0, right: 0, maxHeight: openingCap }
        : { flexShrink: 1, maxHeight: listMaxHeight };

  const handleBodyLayout = React.useCallback(
    (event: LayoutChangeEvent) => onVisibleLayout(sectionKey, event.nativeEvent.layout.height),
    [onVisibleLayout, sectionKey],
  );

  const innerRef = React.useRef<View>(null);
  const handleSyncMeasure = React.useCallback(
    (height: number) => onMeasure(sectionKey, height),
    [onMeasure, sectionKey],
  );
  useSyncMeasure(innerRef, isOpening, handleSyncMeasure);

  const handleInnerLayout = React.useCallback(
    (event: LayoutChangeEvent) => {
      if (isOpening && isListMeasurable(innerRef)) {
        onMeasure(sectionKey, event.nativeEvent.layout.height);
      }
    },
    [isOpening, onMeasure, sectionKey],
  );

  return (
    <Animated.View
      aria-hidden={!isOpen}
      pointerEvents={isOpen ? "auto" : "none"}
      style={[BODY_STYLE, isShrinkLocked ? LOCKED_BODY_STYLE : null, animatedStyle]}
      testID={`folder-section-body-${sectionKey}`}
      onLayout={handleBodyLayout}
    >
      <View
        ref={innerRef}
        className="min-h-0"
        style={innerStyle}
        testID={`folder-section-body-inner-${sectionKey}`}
        onLayout={handleInnerLayout}
      >
        {children}
      </View>
      {isOpening ? (
        <View
          className="shrink-0"
          style={{ height: openingTarget }}
        />
      ) : null}
    </Animated.View>
  );
}

export { FolderSectionBody };
