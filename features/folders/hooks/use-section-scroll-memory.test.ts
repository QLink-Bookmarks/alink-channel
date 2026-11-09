import { getFolderScrollOffset, setFolderScrollOffset } from "@/stores/folder-navigation";
import { act, renderHook } from "@testing-library/react-native";

import { useSectionScrollMemory } from "./use-section-scroll-memory";

jest.mock("@/lib/device-storage", () => ({
  DeviceStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
}));

type Props = {
  contentHeight: number;
  viewportHeight: number;
  hasNextPage?: boolean;
  isFetchingNextPage?: boolean;
};

function renderMemory(scrollTo: jest.Mock, initialProps: Props, onFetchMore = jest.fn()) {
  return renderHook(
    ({ contentHeight, viewportHeight, hasNextPage = false, isFetchingNextPage = false }: Props) =>
      useSectionScrollMemory({
        surface: "sidebar",
        section: "mine",
        contentHeight,
        viewportHeight,
        hasNextPage,
        isFetchingNextPage,
        isFetchNextPageError: false,
        scrollTo,
        onFetchMore,
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
    act(() => first.result.current.recordScrollOffset(180, 600));
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

    act(() => result.current.recordScrollOffset(760, 760));
    expect(getFolderScrollOffset("sidebar", "mine")).toBe(1200);

    rerender({ contentHeight: 2000, viewportHeight: 480 });
    expect(scrollTo).toHaveBeenLastCalledWith(1200);
    act(() => result.current.recordScrollOffset(1200, 1520));

    rerender({ contentHeight: 2600, viewportHeight: 480 });
    expect(scrollTo).toHaveBeenCalledTimes(2);
    expect(getFolderScrollOffset("sidebar", "mine")).toBe(1200);
  });

  it("stops restoring when the user scrolls after a partial restore", () => {
    setFolderScrollOffset("sidebar", "mine", 1200);
    const scrollTo = jest.fn();
    const { result, rerender } = renderMemory(scrollTo, {
      contentHeight: 1240,
      viewportHeight: 480,
    });
    expect(scrollTo).toHaveBeenLastCalledWith(760);

    act(() => result.current.recordScrollOffset(760, 760));
    act(() => result.current.recordScrollOffset(500, 760));
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
    act(() => result.current.recordScrollOffset(180, 600));
    const recordLate = result.current.recordScrollOffset;
    unmount();

    recordLate(0, 600);
    expect(getFolderScrollOffset("sidebar", "mine")).toBe(180);
  });

  it("stops restoring when the user scrolls first", () => {
    setFolderScrollOffset("sidebar", "mine", 400);
    const scrollTo = jest.fn();
    const { result, rerender } = renderMemory(scrollTo, { contentHeight: 0, viewportHeight: 0 });

    act(() => result.current.recordScrollOffset(60, 600));
    rerender({ contentHeight: 900, viewportHeight: 300 });

    expect(scrollTo).not.toHaveBeenCalled();
    expect(getFolderScrollOffset("sidebar", "mine")).toBe(60);
  });

  describe("when the loading row of the next batch leaves", () => {
    const viewportHeight = 538;
    const rowsHeight = 1254;
    const loadingRowHeight = 52;

    it("keeps restoring when the browser holds a partial restore at the real bottom", () => {
      setFolderScrollOffset("sidebar", "mine", 1462);
      const scrollTo = jest.fn();
      const onFetchMore = jest.fn();
      const { result, rerender } = renderMemory(
        scrollTo,
        { contentHeight: rowsHeight, viewportHeight, hasNextPage: true },
        onFetchMore,
      );
      expect(onFetchMore).toHaveBeenCalledTimes(1);

      const staleHeight = rowsHeight + loadingRowHeight;
      rerender({
        contentHeight: staleHeight,
        viewportHeight,
        hasNextPage: true,
        isFetchingNextPage: true,
      });
      expect(scrollTo).not.toHaveBeenCalled();

      rerender({ contentHeight: staleHeight, viewportHeight });
      expect(scrollTo).toHaveBeenLastCalledWith(staleHeight - viewportHeight);

      const realMax = rowsHeight - viewportHeight;
      act(() => result.current.recordScrollOffset(realMax, realMax));
      expect(getFolderScrollOffset("sidebar", "mine")).toBe(1462);

      rerender({ contentHeight: rowsHeight, viewportHeight });
      rerender({ contentHeight: 2400, viewportHeight });
      expect(scrollTo).toHaveBeenLastCalledWith(1462);
      act(() => result.current.recordScrollOffset(1462, 2400 - viewportHeight));

      rerender({ contentHeight: 3000, viewportHeight });
      expect(scrollTo).toHaveBeenCalledTimes(2);
      expect(getFolderScrollOffset("sidebar", "mine")).toBe(1462);
    });

    it("takes the clamped scroll as progress even when more rows were drawn before its event", () => {
      setFolderScrollOffset("sidebar", "mine", 1460);
      const scrollTo = jest.fn();
      const staleHeight = rowsHeight + loadingRowHeight;
      const { result, rerender } = renderMemory(scrollTo, {
        contentHeight: staleHeight,
        viewportHeight,
      });
      expect(scrollTo).toHaveBeenLastCalledWith(staleHeight - viewportHeight);

      act(() => result.current.recordScrollOffset(rowsHeight - viewportHeight, 1336));
      expect(getFolderScrollOffset("sidebar", "mine")).toBe(1460);

      rerender({ contentHeight: 1874, viewportHeight });
      expect(scrollTo).toHaveBeenLastCalledWith(1336);
      act(() => result.current.recordScrollOffset(1336, 1336));
      rerender({ contentHeight: 2494, viewportHeight });
      expect(scrollTo).toHaveBeenLastCalledWith(1460);
    });

    it("treats a scroll well after the restore's own scroll as the user's", () => {
      setFolderScrollOffset("sidebar", "mine", 1460);
      const scrollTo = jest.fn();
      const now = jest.spyOn(Date, "now").mockReturnValue(1_000);
      const { result, rerender } = renderMemory(scrollTo, {
        contentHeight: rowsHeight,
        viewportHeight,
      });
      expect(scrollTo).toHaveBeenLastCalledWith(rowsHeight - viewportHeight);

      now.mockReturnValue(2_000);
      act(() => result.current.recordScrollOffset(300, rowsHeight - viewportHeight));
      now.mockRestore();
      expect(getFolderScrollOffset("sidebar", "mine")).toBe(300);
      rerender({ contentHeight: 2494, viewportHeight });
      expect(scrollTo).toHaveBeenCalledTimes(1);
    });

    it("ends a restore that landed during a fetch once the fetch ends, so later changes do not scroll back", () => {
      const saved = rowsHeight - viewportHeight + 40;
      setFolderScrollOffset("sidebar", "mine", saved);
      const scrollTo = jest.fn();
      const { result, rerender } = renderMemory(scrollTo, {
        contentHeight: rowsHeight + loadingRowHeight,
        viewportHeight,
        hasNextPage: true,
        isFetchingNextPage: true,
      });
      expect(scrollTo).toHaveBeenLastCalledWith(saved);
      act(() => result.current.recordScrollOffset(saved, saved + 12));

      rerender({ contentHeight: rowsHeight + 6 * 62, viewportHeight });
      const shrunkMax = rowsHeight - 2 * 62 - viewportHeight;
      rerender({ contentHeight: rowsHeight - 2 * 62, viewportHeight });
      act(() => result.current.recordScrollOffset(shrunkMax, shrunkMax));
      expect(getFolderScrollOffset("sidebar", "mine")).toBe(shrunkMax);

      rerender({ contentHeight: 2400, viewportHeight });
      expect(scrollTo).toHaveBeenCalledTimes(1);
      expect(getFolderScrollOffset("sidebar", "mine")).toBe(shrunkMax);
    });

    it("scrolls again when an earlier scroll did not move the list", () => {
      setFolderScrollOffset("sidebar", "mine", 600);
      const scrollTo = jest.fn();
      const { result, rerender } = renderMemory(scrollTo, {
        contentHeight: rowsHeight + loadingRowHeight,
        viewportHeight,
        hasNextPage: true,
        isFetchingNextPage: true,
      });
      expect(scrollTo).toHaveBeenCalledTimes(1);

      rerender({ contentHeight: rowsHeight + 6 * 62, viewportHeight });
      expect(scrollTo).toHaveBeenCalledTimes(2);
      expect(scrollTo).toHaveBeenLastCalledWith(600);
      act(() => result.current.recordScrollOffset(600, rowsHeight + 6 * 62 - viewportHeight));

      rerender({ contentHeight: 2400, viewportHeight });
      expect(scrollTo).toHaveBeenCalledTimes(2);
      expect(getFolderScrollOffset("sidebar", "mine")).toBe(600);
    });

    it("stops restoring when the user scrolls up from the held bottom", () => {
      setFolderScrollOffset("sidebar", "mine", 1462);
      const scrollTo = jest.fn();
      const staleHeight = rowsHeight + loadingRowHeight;
      const { result, rerender } = renderMemory(scrollTo, {
        contentHeight: staleHeight,
        viewportHeight,
      });
      const realMax = rowsHeight - viewportHeight;
      act(() => result.current.recordScrollOffset(realMax, realMax));
      act(() => result.current.recordScrollOffset(realMax - 300, realMax));
      expect(getFolderScrollOffset("sidebar", "mine")).toBe(realMax - 300);

      rerender({ contentHeight: 2400, viewportHeight });
      expect(scrollTo).toHaveBeenCalledTimes(1);
      expect(getFolderScrollOffset("sidebar", "mine")).toBe(realMax - 300);
    });

    it("stops restoring when the user scrolls down past the saved position while the next batch loads", () => {
      const saved = 600;
      setFolderScrollOffset("sidebar", "mine", saved);
      const scrollTo = jest.fn();
      const { result, rerender } = renderMemory(scrollTo, {
        contentHeight: rowsHeight + loadingRowHeight,
        viewportHeight,
        hasNextPage: true,
        isFetchingNextPage: true,
      });
      expect(scrollTo).toHaveBeenLastCalledWith(saved);
      act(() => result.current.recordScrollOffset(saved, 768));
      act(() => result.current.recordScrollOffset(700, 768));
      expect(getFolderScrollOffset("sidebar", "mine")).toBe(700);

      rerender({ contentHeight: rowsHeight, viewportHeight });
      rerender({ contentHeight: 2400, viewportHeight });
      expect(scrollTo).toHaveBeenCalledTimes(1);
      expect(getFolderScrollOffset("sidebar", "mine")).toBe(700);
    });
  });
});
