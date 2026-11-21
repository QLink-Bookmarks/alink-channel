import * as React from "react";
import type {
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
} from "react-native";

import type { ListScrollViewProps } from "./use-list-scroll-memory";

const END_REACHED_DISTANCE = 160;

type CursorQuery = {
  data?: unknown;
  hasNextPage: boolean;
  isFetching: boolean;
  isFetchNextPageError: boolean;
  fetchNextPage: (options: { cancelRefetch: boolean }) => Promise<unknown>;
};

type PaginationOptions = {
  enabled?: boolean;
  scroll?: {
    contentKey: string;
    ref: React.RefObject<ScrollView | null>;
    props: ListScrollViewProps;
  };
};

function useCursorPagination(
  query: CursorQuery,
  { enabled = true, scroll }: PaginationOptions = {},
) {
  const { data, hasNextPage, isFetching, isFetchNextPageError, fetchNextPage } = query;
  const [viewportHeight, setViewportHeight] = React.useState(0);
  const [contentHeight, setContentHeight] = React.useState(0);
  const previousContentKey = React.useRef(scroll?.contentKey);
  const contentKey = scroll?.contentKey;
  const scrollRef = scroll?.ref;
  const memoryProps = scroll?.props;

  React.useLayoutEffect(() => {
    if (previousContentKey.current !== contentKey) {
      previousContentKey.current = contentKey;
      scrollRef?.current?.scrollTo({ y: 0, animated: false });
    }
  }, [contentKey, scrollRef]);

  const requestNextPage = React.useCallback(
    (allowRetry: boolean) => {
      if (enabled && hasNextPage && !isFetching && (allowRetry || !isFetchNextPageError)) {
        void fetchNextPage({ cancelRefetch: false });
      }
    },
    [enabled, fetchNextPage, hasNextPage, isFetching, isFetchNextPageError],
  );

  const loadNextPage = React.useCallback(() => requestNextPage(false), [requestNextPage]);
  const retryNextPage = React.useCallback(() => requestNextPage(true), [requestNextPage]);

  React.useEffect(() => {
    if (viewportHeight > 0 && contentHeight > 0 && contentHeight <= viewportHeight + 1) {
      const frame = requestAnimationFrame(() => {
        const node = process.env.EXPO_OS === "web" ? scrollRef?.current?.getScrollableNode() : null;
        if (!node || node.scrollHeight <= node.clientHeight + 1) {
          loadNextPage();
        }
      });
      return () => cancelAnimationFrame(frame);
    }
  }, [contentHeight, data, loadNextPage, scrollRef, viewportHeight]);

  return {
    loadNextPage,
    retryNextPage,
    scrollViewProps: {
      scrollEventThrottle: memoryProps?.scrollEventThrottle ?? 16,
      onScrollBeginDrag: memoryProps?.onScrollBeginDrag,
      onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => {
        memoryProps?.onScroll(event);
        const { contentSize, contentOffset, layoutMeasurement, contentInset } = event.nativeEvent;
        const distance =
          contentSize.height +
          (contentInset?.bottom ?? 0) -
          contentOffset.y -
          layoutMeasurement.height;
        if (
          contentOffset.y > 0 &&
          layoutMeasurement.height > 0 &&
          distance <= END_REACHED_DISTANCE
        ) {
          loadNextPage();
        }
      },
      onLayout: (event: LayoutChangeEvent) => {
        memoryProps?.onLayout(event);
        setViewportHeight(event.nativeEvent.layout.height);
      },
      onContentSizeChange: (width: number, height: number) => {
        memoryProps?.onContentSizeChange(width, height);
        setContentHeight(height);
      },
    },
  };
}

export { useCursorPagination };
