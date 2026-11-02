import { getFolderScrollOffset, setFolderScrollOffset } from "@/stores/folder-navigation";
import { act, renderHook } from "@testing-library/react-native";

import { useSectionScrollMemory } from "./use-section-scroll-memory";

jest.mock("@/lib/device-storage", () => ({
  DeviceStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
}));

type Props = { contentHeight: number; viewportHeight: number };

function renderMemory(scrollTo: jest.Mock, initialProps: Props) {
  return renderHook(
    ({ contentHeight, viewportHeight }: Props) =>
      useSectionScrollMemory({
        surface: "sidebar",
        section: "mine",
        contentHeight,
        viewportHeight,
        hasNextPage: false,
        isFetchingNextPage: false,
        isFetchNextPageError: false,
        scrollTo,
        onFetchMore: jest.fn(),
      }),
    { initialProps },
  );
}

beforeEach(() => {
  setFolderScrollOffset("sidebar", "mine", 0);
});

describe("useSectionScrollMemory", () => {
  it("records the offset while mounted and restores it once the list is measured", () => {
    const first = renderMemory(jest.fn(), { contentHeight: 900, viewportHeight: 300 });
    act(() => first.result.current.recordScrollOffset(180));
    expect(getFolderScrollOffset("sidebar", "mine")).toBe(180);
    first.unmount();

    const scrollTo = jest.fn();
    const second = renderMemory(scrollTo, { contentHeight: 0, viewportHeight: 0 });
    expect(scrollTo).not.toHaveBeenCalled();
    second.rerender({ contentHeight: 900, viewportHeight: 300 });
    expect(scrollTo).toHaveBeenCalledWith(180);
  });

  it("keeps restoring while the list renders more rows, and stops at the saved position", () => {
    setFolderScrollOffset("sidebar", "mine", 1200);
    const scrollTo = jest.fn();
    const { result, rerender } = renderMemory(scrollTo, {
      contentHeight: 1240,
      viewportHeight: 480,
    });
    expect(scrollTo).toHaveBeenLastCalledWith(760);

    act(() => result.current.recordScrollOffset(760));
    expect(getFolderScrollOffset("sidebar", "mine")).toBe(1200);

    rerender({ contentHeight: 2000, viewportHeight: 480 });
    expect(scrollTo).toHaveBeenLastCalledWith(1200);

    rerender({ contentHeight: 2600, viewportHeight: 480 });
    expect(scrollTo).toHaveBeenCalledTimes(2);
  });

  it("stops restoring when the user scrolls after a partial restore", () => {
    setFolderScrollOffset("sidebar", "mine", 1200);
    const scrollTo = jest.fn();
    const { result, rerender } = renderMemory(scrollTo, {
      contentHeight: 1240,
      viewportHeight: 480,
    });
    expect(scrollTo).toHaveBeenLastCalledWith(760);

    act(() => result.current.recordScrollOffset(500));
    expect(getFolderScrollOffset("sidebar", "mine")).toBe(500);

    rerender({ contentHeight: 2000, viewportHeight: 480 });
    rerender({ contentHeight: 2600, viewportHeight: 480 });
    expect(scrollTo).toHaveBeenCalledTimes(1);
    expect(getFolderScrollOffset("sidebar", "mine")).toBe(500);
  });

  it("ignores a late scroll event after the list unmounts", () => {
    const { result, unmount } = renderMemory(jest.fn(), {
      contentHeight: 900,
      viewportHeight: 300,
    });
    act(() => result.current.recordScrollOffset(180));
    const recordLate = result.current.recordScrollOffset;
    unmount();

    recordLate(0);
    expect(getFolderScrollOffset("sidebar", "mine")).toBe(180);
  });

  it("stops restoring when the user scrolls first", () => {
    setFolderScrollOffset("sidebar", "mine", 400);
    const scrollTo = jest.fn();
    const { result, rerender } = renderMemory(scrollTo, { contentHeight: 0, viewportHeight: 0 });

    act(() => result.current.recordScrollOffset(60));
    rerender({ contentHeight: 900, viewportHeight: 300 });

    expect(scrollTo).not.toHaveBeenCalled();
    expect(getFolderScrollOffset("sidebar", "mine")).toBe(60);
  });
});
