import * as React from "react";
import type { View } from "react-native";

const MEASURE_FALLBACK_FRAMES = 6;

function isListMeasurable(ref: React.RefObject<View | null>) {
  const node = ref.current as unknown as HTMLElement | null;
  const list = node?.querySelector('[aria-label$="목록"]');
  return Boolean(node) && !(list && list.firstElementChild?.childElementCount === 0);
}

function useSyncMeasure(
  ref: React.RefObject<View | null>,
  isActive: boolean,
  onMeasure: (height: number) => void,
) {
  React.useLayoutEffect(() => {
    if (!isActive) {
      return;
    }
    const measure = () => {
      const node = ref.current as unknown as HTMLElement | null;
      if (node) {
        onMeasure(node.getBoundingClientRect().height);
      }
    };
    if (isListMeasurable(ref)) {
      measure();
      return;
    }
    let frames = 0;
    let frame = requestAnimationFrame(function retry() {
      frames += 1;
      if (isListMeasurable(ref) || frames >= MEASURE_FALLBACK_FRAMES) {
        measure();
        return;
      }
      frame = requestAnimationFrame(retry);
    });
    return () => cancelAnimationFrame(frame);
  }, [isActive, onMeasure, ref]);
}

export { MEASURE_FALLBACK_FRAMES, isListMeasurable, useSyncMeasure };
