import * as React from "react";
import type { ScrollViewProps, View, ViewProps } from "react-native";

import { NavigationContext } from "@react-navigation/native";

import type { FilterCoverAutoClose } from "./use-filter-cover-auto-close";

type FilterCoverDismissOptions = {
  isOpen: boolean;
  rowRef: React.RefObject<View | null>;
  primaryRef: React.RefObject<View | null>;
  coverRef: React.RefObject<View | null>;
  buttonRef: React.RefObject<View | null>;
  autoClose: Pick<FilterCoverAutoClose, "arm" | "pause" | "resume">;
  // `focusButton`: move focus to the button (Esc). `immediate`: close without the animation.
  onDismiss: (options: { focusButton: boolean; immediate: boolean }) => void;
};

type FilterCoverDismiss = {
  // Spread on the cover: pointer presses inside it drive the auto close.
  coverProps: Pick<ViewProps, "onTouchStart" | "onTouchEnd" | "onTouchCancel">;
  // Spread on the cover's sideways ScrollView: scrolling holds and restarts the auto close.
  coverScrollProps: Pick<
    ScrollViewProps,
    "onScroll" | "onScrollBeginDrag" | "onScrollEndDrag" | "onMomentumScrollEnd"
  >;
  // Before an auto close: if focus is inside the cover (which is about to go), move it to the button.
  keepFocusOutOfCover: () => void;
};

/**
 * Native: touches inside the cover arm the auto close, and leaving the screen (another tab, a pushed
 * screen) closes the cover at once. There is no outside press, Esc or Tab here; X, the empty part of
 * the cover and the auto close cover the rest.
 */
function useFilterCoverDismiss({
  isOpen,
  autoClose,
  onDismiss,
}: FilterCoverDismissOptions): FilterCoverDismiss {
  // Outside a navigator (Storybook, unit tests) there is no screen to leave.
  const navigation = React.use(NavigationContext);
  const isScrollingRef = React.useRef(false);
  const stateRef = React.useRef({ isOpen, onDismiss });
  stateRef.current = { isOpen, onDismiss };

  React.useEffect(() => {
    if (!navigation) {
      return;
    }
    return navigation.addListener("blur", () => {
      if (stateRef.current.isOpen) {
        stateRef.current.onDismiss({ focusButton: false, immediate: true });
      }
    });
  }, [navigation]);

  const { arm, pause, resume } = autoClose;

  const coverProps = React.useMemo<FilterCoverDismiss["coverProps"]>(
    () => ({
      onTouchStart: () => {
        isScrollingRef.current = false;
        pause();
      },
      onTouchEnd: () => {
        // A drag that scrolled the cover only restarts a timer that was already running.
        if (isScrollingRef.current) {
          resume();
          return;
        }
        arm();
      },
      onTouchCancel: () => {
        resume();
      },
    }),
    [arm, pause, resume],
  );

  const coverScrollProps = React.useMemo<FilterCoverDismiss["coverScrollProps"]>(
    () => ({
      onScrollBeginDrag: () => {
        isScrollingRef.current = true;
        pause();
      },
      onScrollEndDrag: () => {
        resume();
      },
      onMomentumScrollEnd: () => {
        resume();
      },
    }),
    [pause, resume],
  );

  const keepFocusOutOfCover = React.useCallback(() => {}, []);

  return { coverProps, coverScrollProps, keepFocusOutOfCover };
}

export { useFilterCoverDismiss };
export type { FilterCoverDismiss, FilterCoverDismissOptions };
