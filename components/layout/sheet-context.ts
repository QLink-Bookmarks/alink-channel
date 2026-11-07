import * as React from "react";
import type { SharedValue } from "react-native-reanimated";

/**
 * Signals to descendants that they're rendered inside a BottomSheetModal so they can
 * swap to BottomSheet-aware primitives (e.g. BottomSheetTextInput) — without this swap,
 * the sheet's gesture handler swallows touch events on Android and the Korean IME
 * breaks composition mid-syllable.
 */
const SheetContext = React.createContext<boolean>(false);

function useIsInsideSheet() {
  return React.useContext(SheetContext);
}

type SheetMotion = {
  position: SharedValue<number>;
  target: SharedValue<number | null>;
};

const SheetMotionContext = React.createContext<SheetMotion | null>(null);

function useSheetMotion() {
  return React.use(SheetMotionContext);
}

export { SheetContext, SheetMotionContext, useIsInsideSheet, useSheetMotion };
export type { SheetMotion };
