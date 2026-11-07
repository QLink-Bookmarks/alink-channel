import { AccessibilityInfo } from "react-native";

import { act, renderHook } from "@testing-library/react-native";

import { FILTER_COVER_IDLE_MS, useFilterCoverAutoClose } from "./use-filter-cover-auto-close";

type Props = { isOpen: boolean; onAutoClose: () => void };

function setup(screenReaderEnabled = false) {
  jest.spyOn(AccessibilityInfo, "isScreenReaderEnabled").mockResolvedValue(screenReaderEnabled);
  const onAutoClose = jest.fn();
  const view = renderHook((props: Props) => useFilterCoverAutoClose(props), {
    initialProps: { isOpen: true, onAutoClose },
  });
  return { ...view, onAutoClose };
}

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe("useFilterCoverAutoClose", () => {
  it("closes the idle time after a pointer release", async () => {
    const { result, onAutoClose } = setup();
    await act(async () => {});
    act(() => result.current.arm());
    act(() => jest.advanceTimersByTime(FILTER_COVER_IDLE_MS - 1));
    expect(onAutoClose).not.toHaveBeenCalled();
    act(() => jest.advanceTimersByTime(1));
    expect(onAutoClose).toHaveBeenCalledTimes(1);
  });

  it("never closes when nothing was pressed", async () => {
    const { onAutoClose } = setup();
    await act(async () => {});
    act(() => jest.advanceTimersByTime(FILTER_COVER_IDLE_MS * 3));
    expect(onAutoClose).not.toHaveBeenCalled();
  });

  it("restarts the wait on every press", async () => {
    const { result, onAutoClose } = setup();
    await act(async () => {});
    act(() => result.current.arm());
    act(() => jest.advanceTimersByTime(1000));
    act(() => result.current.arm());
    act(() => jest.advanceTimersByTime(1000));
    expect(onAutoClose).not.toHaveBeenCalled();
    act(() => jest.advanceTimersByTime(FILTER_COVER_IDLE_MS - 1000));
    expect(onAutoClose).toHaveBeenCalledTimes(1);
  });

  it("holds while pressed or dragged and restarts once released", async () => {
    const { result, onAutoClose } = setup();
    await act(async () => {});
    act(() => result.current.arm());
    act(() => jest.advanceTimersByTime(800));
    act(() => result.current.pause());
    act(() => jest.advanceTimersByTime(FILTER_COVER_IDLE_MS * 2));
    expect(onAutoClose).not.toHaveBeenCalled();
    act(() => result.current.resume());
    act(() => jest.advanceTimersByTime(FILTER_COVER_IDLE_MS));
    expect(onAutoClose).toHaveBeenCalledTimes(1);
  });

  it("does not start on a scroll alone", async () => {
    const { result, onAutoClose } = setup();
    await act(async () => {});
    act(() => result.current.resume());
    act(() => jest.advanceTimersByTime(FILTER_COVER_IDLE_MS * 2));
    expect(onAutoClose).not.toHaveBeenCalled();
  });

  it("forgets the timer when the cover closes another way", async () => {
    const { result, rerender, onAutoClose } = setup();
    await act(async () => {});
    act(() => result.current.arm());
    rerender({ isOpen: false, onAutoClose });
    act(() => jest.advanceTimersByTime(FILTER_COVER_IDLE_MS * 2));
    expect(onAutoClose).not.toHaveBeenCalled();
  });

  it("stays open while a screen reader is on", async () => {
    const { result, onAutoClose } = setup(true);
    await act(async () => {});
    expect(result.current.isScreenReaderEnabled).toBe(true);
    act(() => result.current.arm());
    act(() => jest.advanceTimersByTime(FILTER_COVER_IDLE_MS * 2));
    expect(onAutoClose).not.toHaveBeenCalled();
  });
});
