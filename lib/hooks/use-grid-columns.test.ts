import type { LayoutChangeEvent } from "react-native";

import { act, renderHook } from "@testing-library/react-native";

import { getGridColumnCount, getGridItemWidth, useGridColumns } from "./use-grid-columns";

function layoutEvent(width: number) {
  return { nativeEvent: { layout: { x: 0, y: 0, width, height: 100 } } } as LayoutChangeEvent;
}

describe("getGridColumnCount", () => {
  it("fits as many minimum-width items as the container allows", () => {
    // 196px cards, 12px gap: 3 × 196 + 2 × 12 = 612.
    expect(getGridColumnCount(612, 196, 12)).toBe(3);
    expect(getGridColumnCount(611, 196, 12)).toBe(2);
  });

  it("gives two mobile columns at 768px and one on a phone", () => {
    // Mobile home: 280px minimum, 16px side padding.
    expect(getGridColumnCount(768 - 32, 280, 12)).toBe(2);
    expect(getGridColumnCount(390 - 32, 280, 12)).toBe(1);
  });

  it("never goes below one column", () => {
    expect(getGridColumnCount(100, 240, 12)).toBe(1);
    expect(getGridColumnCount(0, 240, 12)).toBe(1);
    expect(getGridColumnCount(Number.NaN, 240, 12)).toBe(1);
    expect(getGridColumnCount(500, 0, 12)).toBe(1);
  });
});

describe("getGridItemWidth", () => {
  it("shares the width minus the gaps and rounds down so the row never wraps", () => {
    expect(getGridItemWidth(612, 3, 12)).toBe(196);
    const width = getGridItemWidth(1000, 3, 12);
    expect(width * 3 + 24).toBeLessThanOrEqual(1000);
    expect(width).toBeCloseTo(325.33, 2);
  });
});

describe("useGridColumns", () => {
  it("starts with one full-width column until the container is measured", () => {
    const { result } = renderHook(() => useGridColumns({ minItemWidth: 196, gap: 12 }));
    expect(result.current.columns).toBe(1);
    expect(result.current.itemStyle).toEqual({ width: "100%" });
  });

  it("derives columns and item width from the measured container", () => {
    const { result } = renderHook(() => useGridColumns({ minItemWidth: 196, gap: 12 }));
    act(() => result.current.onLayout(layoutEvent(860)));
    expect(result.current.columns).toBe(4);
    expect(result.current.itemStyle).toEqual({ width: 206 });

    act(() => result.current.onLayout(layoutEvent(420)));
    expect(result.current.columns).toBe(2);
    expect(result.current.itemStyle).toEqual({ width: 204 });
  });

  it("follows a new minimum width", () => {
    const { result, rerender } = renderHook(
      ({ min }: { min: number }) => useGridColumns({ minItemWidth: min, gap: 12 }),
      { initialProps: { min: 196 } },
    );
    act(() => result.current.onLayout(layoutEvent(736)));
    expect(result.current.columns).toBe(3);
    rerender({ min: 280 });
    expect(result.current.columns).toBe(2);
  });
});
