import type { View } from "react-native";

import { renderHook } from "@testing-library/react-native";

import { MEASURE_FALLBACK_FRAMES, useSyncMeasure } from "./use-sync-measure.web";

function listNode(height: number, rows: { count: number }) {
  const node = {
    getBoundingClientRect: () => ({ height }),
    querySelector: () => ({
      firstElementChild: {
        get childElementCount() {
          return rows.count;
        },
      },
    }),
  };
  return { current: node as unknown as View };
}

const frames = new Map<number, FrameRequestCallback>();
let nextFrame = 1;

beforeEach(() => {
  frames.clear();
  jest.spyOn(global, "requestAnimationFrame").mockImplementation((callback) => {
    const id = nextFrame;
    nextFrame += 1;
    frames.set(id, callback);
    return id;
  });
  jest.spyOn(global, "cancelAnimationFrame").mockImplementation((id) => {
    frames.delete(id);
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});

function advanceFrames(count: number) {
  for (let index = 0; index < count; index += 1) {
    const due = [...frames.entries()];
    frames.clear();
    for (const [, callback] of due) {
      callback(index * 16);
    }
  }
}

describe("useSyncMeasure on web", () => {
  it("measures at once when the list already has rows", () => {
    const onMeasure = jest.fn();
    renderHook(() => useSyncMeasure(listNode(120, { count: 3 }), true, onMeasure));

    expect(onMeasure).toHaveBeenCalledWith(120);
  });

  it("measures as soon as the rows appear", () => {
    const rows = { count: 0 };
    const onMeasure = jest.fn();
    renderHook(() => useSyncMeasure(listNode(96, rows), true, onMeasure));
    expect(onMeasure).not.toHaveBeenCalled();

    rows.count = 2;
    advanceFrames(1);

    expect(onMeasure).toHaveBeenCalledTimes(1);
    expect(onMeasure).toHaveBeenCalledWith(96);
  });

  it("still measures a list that never gets rows, so the section can settle", () => {
    const onMeasure = jest.fn();
    renderHook(() => useSyncMeasure(listNode(8, { count: 0 }), true, onMeasure));

    advanceFrames(MEASURE_FALLBACK_FRAMES - 1);
    expect(onMeasure).not.toHaveBeenCalled();
    advanceFrames(1);

    expect(onMeasure).toHaveBeenCalledTimes(1);
    expect(onMeasure).toHaveBeenCalledWith(8);
    advanceFrames(MEASURE_FALLBACK_FRAMES);
    expect(onMeasure).toHaveBeenCalledTimes(1);
  });

  it("stops waiting when the section stops opening", () => {
    const onMeasure = jest.fn();
    const ref = listNode(8, { count: 0 });
    const { rerender } = renderHook(
      ({ isActive }: { isActive: boolean }) => useSyncMeasure(ref, isActive, onMeasure),
      { initialProps: { isActive: true } },
    );

    rerender({ isActive: false });
    advanceFrames(MEASURE_FALLBACK_FRAMES * 2);

    expect(onMeasure).not.toHaveBeenCalled();
  });
});
