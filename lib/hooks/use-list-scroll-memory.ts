import * as React from "react";
import {
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollView,
  useWindowDimensions,
} from "react-native";

import { useListMemoryStore } from "@/stores/list-memory";

import {
  type ListVariant,
  ScrollRestorer,
  getListFilterKey,
  getListMemoryKey,
  getMaxScrollOffset,
} from "./list-scroll-memory-rules";
import { detectsUserScrollByOffset } from "./user-scroll-detection";

import { usePathname } from "expo-router";

const RESTORE_SETTLE_MS = 500;
const WIDE_LIST_MIN_WIDTH = 769;

type ListScrollMemoryOptions = {
  memoryKey: string;
  contentKey: string;
  isLoading: boolean;
  hasContent: boolean;
  isEnabled?: boolean;
};

type ListScrollViewProps = {
  scrollEventThrottle: number;
  onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  onScrollBeginDrag: () => void;
  onLayout: (event: LayoutChangeEvent) => void;
  onContentSizeChange: (width: number, height: number) => void;
};

function useListMemoryKey(variant: ListVariant) {
  const pathname = usePathname();
  return getListMemoryKey(pathname, variant);
}

function useViewportListVariant(): ListVariant {
  const { width } = useWindowDimensions();
  return width >= WIDE_LIST_MIN_WIDTH ? "wide" : "mobile";
}

function useRememberedState<T>(memoryKey: string, field: string, initialValue: T) {
  const filterKey = getListFilterKey(memoryKey, field);
  const stored = useListMemoryStore((state) => state.filters[filterKey]) as T | undefined;
  const saveFilter = useListMemoryStore((state) => state.saveFilter);
  const value = stored === undefined ? initialValue : stored;
  const setValue = React.useCallback(
    (next: T) => {
      saveFilter(filterKey, next);
    },
    [filterKey, saveFilter],
  );
  return [value, setValue] as const;
}

function useListScrollMemory({
  memoryKey,
  contentKey,
  isLoading,
  hasContent,
  isEnabled = true,
}: ListScrollMemoryOptions) {
  const scrollViewRef = React.useRef<ScrollView>(null);
  const restorerRef = React.useRef<{ key: string; restorer: ScrollRestorer } | null>(null);
  if (!restorerRef.current || restorerRef.current.key !== memoryKey) {
    restorerRef.current = {
      key: memoryKey,
      restorer: new ScrollRestorer(useListMemoryStore.getState().positions[memoryKey], contentKey),
    };
  }
  const measureRef = React.useRef({
    contentHeight: 0,
    viewportHeight: 0,
    bottomInset: 0,
    offsetY: 0,
  });
  const stateRef = React.useRef({ contentKey, isLoading, hasContent, isEnabled, memoryKey });
  stateRef.current = { contentKey, isLoading, hasContent, isEnabled, memoryKey };
  const settleTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearSettleTimer = React.useCallback(() => {
    if (settleTimerRef.current) {
      clearTimeout(settleTimerRef.current);
      settleTimerRef.current = null;
    }
  }, []);

  const attemptRestore = React.useCallback(() => {
    const entry = restorerRef.current;
    if (!entry || !entry.restorer.isActive) {
      return;
    }
    const { restorer } = entry;
    const measure = measureRef.current;
    const state = stateRef.current;
    if (!state.isEnabled) {
      restorer.cancel();
      return;
    }
    const target = restorer.next({
      contentKey: state.contentKey,
      isLoading: state.isLoading,
      hasContent: state.hasContent,
      contentHeight: measure.contentHeight,
      viewportHeight: measure.viewportHeight,
      bottomInset: measure.bottomInset,
    });
    if (target != null) {
      scrollViewRef.current?.scrollTo({ y: target, animated: false });
    }
    if (restorer.status === "settling" && !settleTimerRef.current) {
      settleTimerRef.current = setTimeout(() => {
        settleTimerRef.current = null;
        if (restorerRef.current === entry) {
          restorer.finish();
        }
      }, RESTORE_SETTLE_MS);
    }
  }, []);

  const keepWithinBounds = React.useCallback(() => {
    const restorer = restorerRef.current?.restorer;
    if (!restorer || restorer.isActive) {
      return;
    }
    const measure = measureRef.current;
    if (measure.viewportHeight <= 0 || measure.contentHeight <= 0) {
      return;
    }
    const maxOffset = getMaxScrollOffset(
      measure.contentHeight,
      measure.viewportHeight,
      measure.bottomInset,
    );
    if (measure.offsetY > maxOffset + 1) {
      scrollViewRef.current?.scrollTo({ y: maxOffset, animated: false });
    }
  }, []);

  React.useEffect(() => {
    attemptRestore();
  }, [attemptRestore, contentKey, hasContent, isEnabled, isLoading, memoryKey]);

  const isMountedRef = React.useRef(true);

  React.useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      clearSettleTimer();
    };
  }, [clearSettleTimer]);

  const handleScroll = React.useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!isMountedRef.current) {
      return;
    }
    const { contentOffset, contentInset } = event.nativeEvent;
    const offsetY = contentOffset.y;
    measureRef.current.offsetY = offsetY;
    if (contentInset && Number.isFinite(contentInset.bottom)) {
      measureRef.current.bottomInset = contentInset.bottom;
    }
    const restorer = restorerRef.current?.restorer;
    if (!restorer) {
      return;
    }
    if (restorer.isActive) {
      if (!detectsUserScrollByOffset || restorer.isOwnScroll(offsetY)) {
        return;
      }
      restorer.cancel();
    }
    if (!stateRef.current.isEnabled) {
      return;
    }
    useListMemoryStore.getState().savePosition(stateRef.current.memoryKey, offsetY);
  }, []);

  const handleScrollBeginDrag = React.useCallback(() => {
    restorerRef.current?.restorer.cancel();
  }, []);

  const handleLayout = React.useCallback(
    (event: LayoutChangeEvent) => {
      measureRef.current.viewportHeight = event.nativeEvent.layout.height;
      attemptRestore();
    },
    [attemptRestore],
  );

  const handleContentSizeChange = React.useCallback(
    (_width: number, height: number) => {
      measureRef.current.contentHeight = height;
      attemptRestore();
      keepWithinBounds();
    },
    [attemptRestore, keepWithinBounds],
  );

  const scrollViewProps = React.useMemo<ListScrollViewProps>(
    () => ({
      scrollEventThrottle: 16,
      onScroll: handleScroll,
      onScrollBeginDrag: handleScrollBeginDrag,
      onLayout: handleLayout,
      onContentSizeChange: handleContentSizeChange,
    }),
    [handleContentSizeChange, handleLayout, handleScroll, handleScrollBeginDrag],
  );

  return { scrollViewRef, scrollViewProps };
}

export { useListMemoryKey, useListScrollMemory, useRememberedState, useViewportListVariant };
export type { ListScrollMemoryOptions, ListScrollViewProps };
