import type * as React from "react";
import type { View } from "react-native";

type SheetHostScrollLock = {
  ref?: React.RefCallback<View>;
  /** Call when the sheet stops moving. */
  settle?: () => void;
};

const NO_LOCK: SheetHostScrollLock = {};

function useSheetHostScrollLock(): SheetHostScrollLock {
  return NO_LOCK;
}

export { useSheetHostScrollLock };
export type { SheetHostScrollLock };
