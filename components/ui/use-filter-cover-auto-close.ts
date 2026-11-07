import * as React from "react";
import { AccessibilityInfo } from "react-native";

// How long the cover stays open after the last press inside it. One constant so it can be tuned on
// a device (1.2s / 1.6s / 2.0s were compared in the design).
const FILTER_COVER_IDLE_MS = 1200;

type FilterCoverAutoCloseOptions = {
  isOpen: boolean;
  onAutoClose: () => void;
  idleMs?: number;
};

type FilterCoverAutoClose = {
  // A pointer (mouse, touch, pen) was released inside the cover: close after the idle time.
  arm: () => void;
  // A press or a drag started inside the cover: hold the timer without forgetting it was armed.
  pause: () => void;
  // The drag or scroll ended: restart the timer if it was armed.
  resume: () => void;
  // Forget the timer (the cover closed some other way).
  cancel: () => void;
  isScreenReaderEnabled: boolean;
};

// react-native-web always reports a screen reader. The web tells pointer presses from keyboard and
// assistive-technology clicks by the pointer type instead (use-filter-cover-dismiss.web.ts).
const DETECTS_SCREEN_READER = process.env.EXPO_OS !== "web";

function useScreenReaderEnabled() {
  const [isEnabled, setIsEnabled] = React.useState(false);
  React.useEffect(() => {
    if (!DETECTS_SCREEN_READER) {
      return;
    }
    let isMounted = true;
    void AccessibilityInfo.isScreenReaderEnabled()
      .then((enabled) => {
        if (isMounted) {
          setIsEnabled(enabled);
        }
      })
      .catch(() => {});
    const subscription = AccessibilityInfo.addEventListener("screenReaderChanged", setIsEnabled);
    return () => {
      isMounted = false;
      subscription?.remove();
    };
  }, []);
  return isEnabled;
}

/**
 * Closes the filter cover once nothing has been pressed inside it for `idleMs` after a pointer
 * press. Opening alone never arms it, and it never arms while a screen reader is on (VoiceOver
 * activation can arrive as a touch).
 */
function useFilterCoverAutoClose({
  isOpen,
  onAutoClose,
  idleMs = FILTER_COVER_IDLE_MS,
}: FilterCoverAutoCloseOptions): FilterCoverAutoClose {
  const isScreenReaderEnabled = useScreenReaderEnabled();
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const isArmedRef = React.useRef(false);
  const stateRef = React.useRef({ isOpen, isScreenReaderEnabled, onAutoClose, idleMs });
  stateRef.current = { isOpen, isScreenReaderEnabled, onAutoClose, idleMs };

  const clearTimer = React.useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const schedule = React.useCallback(() => {
    clearTimer();
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      isArmedRef.current = false;
      if (stateRef.current.isOpen) {
        stateRef.current.onAutoClose();
      }
    }, stateRef.current.idleMs);
  }, [clearTimer]);

  const arm = React.useCallback(() => {
    const state = stateRef.current;
    if (!state.isOpen || state.isScreenReaderEnabled) {
      return;
    }
    isArmedRef.current = true;
    schedule();
  }, [schedule]);

  const pause = React.useCallback(() => {
    clearTimer();
  }, [clearTimer]);

  const resume = React.useCallback(() => {
    const state = stateRef.current;
    if (!isArmedRef.current || !state.isOpen || state.isScreenReaderEnabled) {
      return;
    }
    schedule();
  }, [schedule]);

  const cancel = React.useCallback(() => {
    isArmedRef.current = false;
    clearTimer();
  }, [clearTimer]);

  React.useEffect(() => {
    if (!isOpen || isScreenReaderEnabled) {
      cancel();
    }
  }, [cancel, isOpen, isScreenReaderEnabled]);

  React.useEffect(() => cancel, [cancel]);

  return { arm, pause, resume, cancel, isScreenReaderEnabled };
}

export { FILTER_COVER_IDLE_MS, useFilterCoverAutoClose };
export type { FilterCoverAutoClose, FilterCoverAutoCloseOptions };
