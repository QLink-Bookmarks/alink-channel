import * as React from "react";
import type { LayoutChangeEvent } from "react-native";

/**
 * Number of columns that fit in `containerWidth` when every item is at least `minItemWidth`
 * wide and items are `gap` apart. Always at least one column.
 */
function getGridColumnCount(containerWidth: number, minItemWidth: number, gap: number): number {
  if (!(containerWidth > 0) || !(minItemWidth > 0)) {
    return 1;
  }
  return Math.max(1, Math.floor((containerWidth + gap) / (minItemWidth + gap)));
}

/** Width of one item when `columns` items share `containerWidth` with `gap` between them. */
function getGridItemWidth(containerWidth: number, columns: number, gap: number): number {
  // Round down so sub-pixel rounding never pushes the last item onto a new row.
  return Math.max(0, Math.floor(((containerWidth - gap * (columns - 1)) / columns) * 100) / 100);
}

/**
 * Column layout from the container's own width (not the window), like
 * `grid-template-columns: repeat(auto-fill, minmax(minItemWidth, 1fr))`.
 * Attach `onLayout` to the grid container and give each item `itemStyle`.
 */
function useGridColumns({ minItemWidth, gap }: { minItemWidth: number; gap: number }) {
  const [containerWidth, setContainerWidth] = React.useState(0);

  const onLayout = React.useCallback((event: LayoutChangeEvent) => {
    const nextWidth = event.nativeEvent.layout.width;
    setContainerWidth((current) => (Math.abs(current - nextWidth) < 0.5 ? current : nextWidth));
  }, []);

  const columns = getGridColumnCount(containerWidth, minItemWidth, gap);
  const itemWidth = containerWidth > 0 ? getGridItemWidth(containerWidth, columns, gap) : null;
  const itemStyle = React.useMemo(
    () => (itemWidth == null ? { width: "100%" as const } : { width: itemWidth }),
    [itemWidth],
  );

  return { columns, containerWidth, itemStyle, itemWidth, onLayout };
}

export { getGridColumnCount, getGridItemWidth, useGridColumns };
