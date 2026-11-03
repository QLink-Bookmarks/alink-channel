import * as React from "react";
import type { View } from "react-native";

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
    if (!isActive || !isListMeasurable(ref)) {
      return;
    }
    const node = ref.current as unknown as HTMLElement;
    onMeasure(node.getBoundingClientRect().height);
  }, [isActive, onMeasure, ref]);
}

export { isListMeasurable, useSyncMeasure };
