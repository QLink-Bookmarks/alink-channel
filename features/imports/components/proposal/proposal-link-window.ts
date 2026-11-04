import * as React from "react";
import type { View } from "react-native";

const LINK_WINDOW_THRESHOLD = 150;
const OVERSCAN_PX = 800;
const ESTIMATED_ROW_HEIGHT = 58;
const INITIAL_ROWS = 40;
const ROW_SELECTOR = '[data-testid="import-link-row"]';

type LinkWindowRange = { start: number; end: number };

function toElement(node: unknown): HTMLElement | null {
  const element = node as HTMLElement | null;
  return element && typeof element.getBoundingClientRect === "function" ? element : null;
}

function findScrollParent(node: HTMLElement): HTMLElement | null {
  let current = node.parentElement;
  while (current) {
    const { overflowY } = window.getComputedStyle(current);
    if (overflowY === "auto" || overflowY === "scroll") {
      return current;
    }
    current = current.parentElement;
  }
  return null;
}

function getLinkWindowRange(input: {
  count: number;
  rowHeight: number;
  hiddenAbove: number;
  viewportHeight: number;
}): LinkWindowRange {
  const { count, rowHeight, hiddenAbove, viewportHeight } = input;
  const start = Math.max(0, Math.floor((hiddenAbove - OVERSCAN_PX) / rowHeight));
  const end = Math.min(
    count,
    Math.max(start + 1, Math.ceil((hiddenAbove + viewportHeight + OVERSCAN_PX) / rowHeight)),
  );
  return { start: Math.min(start, Math.max(0, count - 1)), end };
}

function useLinkWindow(count: number, windowKey: string) {
  const isWindowed = count > LINK_WINDOW_THRESHOLD && typeof window !== "undefined";
  const listRef = React.useRef<View | null>(null);
  const rowHeightRef = React.useRef(ESTIMATED_ROW_HEIGHT);
  const [range, setRange] = React.useState<LinkWindowRange>(() => ({
    start: 0,
    end: Math.min(count, INITIAL_ROWS),
  }));

  React.useLayoutEffect(() => {
    if (!isWindowed) {
      return;
    }
    const list = toElement(listRef.current);
    if (!list) {
      return;
    }
    const scroller = findScrollParent(list);
    let frame: number | null = null;

    const update = () => {
      frame = null;
      const row = list.querySelector<HTMLElement>(ROW_SELECTOR);
      const measured = row ? row.offsetHeight : 0;
      if (measured > 0) {
        rowHeightRef.current = measured;
      }
      const listTop = list.getBoundingClientRect().top;
      const viewTop = scroller ? scroller.getBoundingClientRect().top : 0;
      const viewportHeight = scroller ? scroller.clientHeight : window.innerHeight;
      const next = getLinkWindowRange({
        count,
        rowHeight: rowHeightRef.current,
        hiddenAbove: viewTop - listTop,
        viewportHeight,
      });
      setRange((current) =>
        current.start === next.start && current.end === next.end ? current : next,
      );
    };
    const schedule = () => {
      if (frame == null) {
        frame = requestAnimationFrame(update);
      }
    };

    update();
    const target: HTMLElement | Window = scroller ?? window;
    target.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    let observer: ResizeObserver | null = null;
    if (scroller && typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(schedule);
      observer.observe(scroller);
    }
    return () => {
      target.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      observer?.disconnect();
      if (frame != null) {
        cancelAnimationFrame(frame);
      }
    };
  }, [count, isWindowed, windowKey]);

  return {
    listRef,
    isWindowed,
    range: isWindowed ? range : { start: 0, end: count },
    rowHeight: rowHeightRef.current,
  };
}

export { LINK_WINDOW_THRESHOLD, getLinkWindowRange, useLinkWindow };
export type { LinkWindowRange };
