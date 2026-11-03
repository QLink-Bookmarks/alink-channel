import type * as React from "react";
import type { View } from "react-native";

function useSyncMeasure(
  _ref: React.RefObject<View | null>,
  _isActive: boolean,
  _onMeasure: (height: number) => void,
) {}

function isListMeasurable(_ref: React.RefObject<View | null>) {
  return true;
}

export { isListMeasurable, useSyncMeasure };
