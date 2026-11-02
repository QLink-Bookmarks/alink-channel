import type { LayoutChangeEvent, NativeScrollEvent, NativeSyntheticEvent } from "react-native";

import { useListMemoryStore } from "@/stores/list-memory";
import { act, renderHook } from "@testing-library/react-native";

import {
  type ListScrollMemoryOptions,
  useListMemoryKey,
  useListScrollMemory,
  useRememberedState,
} from "./use-list-scroll-memory";

let mockPathname = "/home";

jest.mock("expo-router", () => ({
  usePathname: () => mockPathname,
}));

const KEY = "/folders/3::mobile";

function layout(height: number) {
  return { nativeEvent: { layout: { x: 0, y: 0, width: 390, height } } } as LayoutChangeEvent;
}

function scrollEvent(y: number) {
  return {
    nativeEvent: {
      contentOffset: { x: 0, y },
      contentInset: { top: 0, left: 0, bottom: 0, right: 0 },
    },
  } as NativeSyntheticEvent<NativeScrollEvent>;
}

function renderScrollMemory(initial: Partial<ListScrollMemoryOptions> = {}) {
  const scrollTo = jest.fn();
  const hook = renderHook((props: ListScrollMemoryOptions) => useListScrollMemory(props), {
    initialProps: {
      memoryKey: KEY,
      contentKey: "latest",
      isLoading: false,
      hasContent: true,
      ...initial,
    },
  });
  (hook.result.current.scrollViewRef as { current: unknown }).current = { scrollTo };
  return { ...hook, scrollTo };
}

function measure(result: ReturnType<typeof renderScrollMemory>["result"], content = 3000) {
  act(() => {
    result.current.scrollViewProps.onLayout(layout(800));
    result.current.scrollViewProps.onContentSizeChange(390, content);
  });
}

describe("useListMemoryKey", () => {
  it("uses the path without the query and the view type", () => {
    mockPathname = "/links";
    const { result } = renderHook(() => useListMemoryKey("wide"));
    expect(result.current).toBe("/links::wide");
  });
});

describe("useRememberedState", () => {
  beforeEach(() => {
    useListMemoryStore.getState().clear();
  });

  it("starts from the default and keeps the choice for the next visit", () => {
    const first = renderHook(() => useRememberedState("/todos::mobile", "filter", "all"));
    expect(first.result.current[0]).toBe("all");
    act(() => {
      first.result.current[1]("incomplete");
    });
    expect(first.result.current[0]).toBe("incomplete");
    first.unmount();

    const second = renderHook(() => useRememberedState("/todos::mobile", "filter", "all"));
    expect(second.result.current[0]).toBe("incomplete");
    const otherScreen = renderHook(() =>
      useRememberedState("/notifications::mobile", "filter", "all"),
    );
    expect(otherScreen.result.current[0]).toBe("all");
  });
});

describe("useListScrollMemory", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    useListMemoryStore.getState().clear();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("restores the saved position once the cached list is drawn", () => {
    useListMemoryStore.getState().savePosition(KEY, 900);
    const { result, scrollTo } = renderScrollMemory();

    measure(result);
    expect(scrollTo).toHaveBeenCalledTimes(1);
    expect(scrollTo).toHaveBeenCalledWith({ y: 900, animated: false });

    measure(result, 3200);
    expect(scrollTo).toHaveBeenCalledTimes(1);
  });

  it("waits for the first load to finish", () => {
    useListMemoryStore.getState().savePosition(KEY, 900);
    const { result, rerender, scrollTo } = renderScrollMemory({ isLoading: true });

    measure(result, 1200);
    expect(scrollTo).not.toHaveBeenCalled();

    rerender({ memoryKey: KEY, contentKey: "latest", isLoading: false, hasContent: true });
    measure(result, 3000);
    expect(scrollTo).toHaveBeenCalledWith({ y: 900, animated: false });
  });

  it("does not restore after the user scrolls first", () => {
    useListMemoryStore.getState().savePosition(KEY, 900);
    const { result, rerender, scrollTo } = renderScrollMemory({ isLoading: true });

    act(() => {
      result.current.scrollViewProps.onScrollBeginDrag();
    });
    rerender({ memoryKey: KEY, contentKey: "latest", isLoading: false, hasContent: true });
    measure(result);
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it("stays at the top for an empty list", () => {
    useListMemoryStore.getState().savePosition(KEY, 900);
    const { result, scrollTo } = renderScrollMemory({ hasContent: false });
    measure(result, 500);
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it("saves the position as the list scrolls, but not before restoring", () => {
    useListMemoryStore.getState().savePosition(KEY, 900);
    const { result } = renderScrollMemory({ isLoading: true });

    act(() => {
      result.current.scrollViewProps.onScroll(scrollEvent(-47));
    });
    expect(useListMemoryStore.getState().positions[KEY]).toBe(900);

    act(() => {
      result.current.scrollViewProps.onScrollBeginDrag();
      result.current.scrollViewProps.onScroll(scrollEvent(320));
    });
    expect(useListMemoryStore.getState().positions[KEY]).toBe(320);
  });

  it("goes to the bottom when the saved position is deeper than the list", () => {
    useListMemoryStore.getState().savePosition(KEY, 2500);
    const { result, scrollTo } = renderScrollMemory();
    measure(result, 1500);
    expect(scrollTo).toHaveBeenLastCalledWith({ y: 700, animated: false });

    act(() => {
      jest.advanceTimersByTime(600);
    });
    measure(result, 4000);
    expect(scrollTo).toHaveBeenCalledTimes(1);
  });

  it("keeps the list in bounds when it gets shorter after restoring", () => {
    useListMemoryStore.getState().savePosition(KEY, 2200);
    const { result, scrollTo } = renderScrollMemory();
    measure(result, 3000);
    act(() => {
      result.current.scrollViewProps.onScroll(scrollEvent(2200));
    });
    measure(result, 2600);
    expect(scrollTo).toHaveBeenLastCalledWith({ y: 1800, animated: false });
  });

  it("ignores a late scroll event that arrives after leaving the screen", () => {
    const { result, unmount } = renderScrollMemory();
    const { onScroll, onScrollBeginDrag } = result.current.scrollViewProps;
    act(() => {
      onScrollBeginDrag();
      onScroll(scrollEvent(1500));
    });
    unmount();

    onScroll(scrollEvent(0));
    expect(useListMemoryStore.getState().positions[KEY]).toBe(1500);
  });

  it("neither restores nor saves while the screen is searching", () => {
    useListMemoryStore.getState().savePosition(KEY, 900);
    const { result, scrollTo } = renderScrollMemory({ isEnabled: false });
    measure(result);
    expect(scrollTo).not.toHaveBeenCalled();

    act(() => {
      result.current.scrollViewProps.onScrollBeginDrag();
      result.current.scrollViewProps.onScroll(scrollEvent(320));
    });
    expect(useListMemoryStore.getState().positions[KEY]).toBe(900);
  });

  it("starts a different folder at the top", () => {
    useListMemoryStore.getState().savePosition(KEY, 900);
    const { result, rerender, scrollTo } = renderScrollMemory({
      memoryKey: "/folders/5::mobile",
    });
    measure(result);
    expect(scrollTo).not.toHaveBeenCalled();

    rerender({ memoryKey: KEY, contentKey: "latest", isLoading: false, hasContent: true });
    measure(result, 3100);
    expect(scrollTo).toHaveBeenCalledWith({ y: 900, animated: false });
  });
});
