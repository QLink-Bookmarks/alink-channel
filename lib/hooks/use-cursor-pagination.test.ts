import type { LayoutChangeEvent, NativeScrollEvent, NativeSyntheticEvent } from "react-native";

import { act, renderHook } from "@testing-library/react-native";

import { useCursorPagination } from "./use-cursor-pagination";

function scrollEvent(y: number) {
  return {
    nativeEvent: {
      contentSize: { height: 1000 },
      contentOffset: { y },
      layoutMeasurement: { height: 500 },
    },
  } as NativeSyntheticEvent<NativeScrollEvent>;
}

it("loads near the end and requires an explicit retry after a next-page failure", () => {
  const fetchNextPage = jest.fn().mockResolvedValue(null);
  const initialProps = {
    fetchNextPage,
    hasNextPage: true,
    isFetching: false,
    isFetchNextPageError: false,
  };
  const { result, rerender } = renderHook(
    (query: typeof initialProps) => useCursorPagination(query),
    { initialProps },
  );

  act(() => result.current.scrollViewProps.onScroll(scrollEvent(250)));
  expect(fetchNextPage).not.toHaveBeenCalled();
  act(() => result.current.scrollViewProps.onScroll(scrollEvent(400)));
  expect(fetchNextPage).toHaveBeenCalledWith({ cancelRefetch: false });

  rerender({ ...initialProps, isFetching: true });
  act(() => result.current.scrollViewProps.onScroll(scrollEvent(490)));
  rerender({ ...initialProps, isFetchNextPageError: true });
  act(() => result.current.scrollViewProps.onScroll(scrollEvent(490)));
  expect(fetchNextPage).toHaveBeenCalledTimes(1);

  act(() => result.current.retryNextPage());
  expect(fetchNextPage).toHaveBeenCalledTimes(2);
  rerender({ ...initialProps, hasNextPage: false });
  act(() => result.current.loadNextPage());
  expect(fetchNextPage).toHaveBeenCalledTimes(2);
});

it("requests a new page while content fits and stops when the list grows", () => {
  jest.useFakeTimers();
  try {
    const fetchNextPage = jest.fn().mockResolvedValue(null);
    const initialProps = {
      fetchNextPage,
      hasNextPage: true,
      isFetching: false,
      isFetchNextPageError: false,
    };
    const { result, rerender } = renderHook(
      (query: typeof initialProps) => useCursorPagination(query),
      { initialProps },
    );
    act(() => {
      result.current.scrollViewProps.onLayout({
        nativeEvent: { layout: { height: 500 } },
      } as LayoutChangeEvent);
      result.current.scrollViewProps.onContentSizeChange(200, 300);
    });
    act(() => jest.advanceTimersByTime(50));
    expect(fetchNextPage).toHaveBeenCalledTimes(1);

    rerender({ ...initialProps, isFetching: true });
    act(() => result.current.scrollViewProps.onContentSizeChange(200, 600));
    rerender(initialProps);
    act(() => jest.advanceTimersByTime(50));
    expect(fetchNextPage).toHaveBeenCalledTimes(1);
  } finally {
    jest.useRealTimers();
  }
});
