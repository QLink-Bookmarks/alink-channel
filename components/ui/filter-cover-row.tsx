import * as React from "react";
import {
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  ScrollView,
  View,
} from "react-native";
import Animated, {
  Easing,
  Extrapolation,
  ReduceMotion,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";

import { Icon } from "@/components/ui/icon";
import { PressableHitSlopArea } from "@/components/ui/icon-button";
import { TextClassContext } from "@/components/ui/text";
import { type FilterPillLevel, PILL_ROW_GAP, pickPillLevel } from "@/lib/filter-pill-level";
import { getThemeTokens } from "@/lib/theme";
import { cn } from "@/lib/utils";
import { useDisplaySettings } from "@/stores/display-settings";

import { useFilterCoverAutoClose } from "./use-filter-cover-auto-close";
import { useFilterCoverDismiss } from "./use-filter-cover-dismiss";

import { LinearGradient } from "expo-linear-gradient";
import { SlidersHorizontal, X } from "lucide-react-native/icons";

const isWeb = process.env.EXPO_OS === "web";

// The button (icon / X) is a 32px circle; its press area reaches 6px past every side (44 × 44).
const BUTTON_SIZE = 32;
const BUTTON_HIT_SLOP = 6;
const ROW_HEIGHT = BUTTON_SIZE + BUTTON_HIT_SLOP * 2;
// How many 1st chips the pill must leave whole (narrow screens drop the pill text first).
const PROTECTED_PRIMARY_CHIPS = 3;
// The mobile cover reaches a little into the left gutter so the 2nd set fits at 320px.
const FILL_BLEED = 4;
const FILL_PADDING_LEFT = 8;
// The wide cover fades in over its first 16px where it meets uncovered 1st chips.
const CONTENT_FADE_WIDTH = 16;
const CONTENT_PADDING_LEFT = 20;
// Room between the last 2nd item and the X button.
const COVER_PADDING_RIGHT = 8;
// The 1st chip row fades out over its last 16px when it scrolls.
const PRIMARY_FADE_WIDTH = 16;
// Pill: 10px before the label, the 30px icon box at the right end, 1px border on both sides.
const PILL_PADDING_LEFT = 10;
// Where the first pill piece starts (border + padding) and the space between pieces (gap-1).
const PILL_LABEL_X = PILL_PADDING_LEFT + 1;
const PILL_LABEL_GAP = 4;

// Motion (report-a2 「모션 표」).
const OPEN_MS = 240;
const OPEN_EASING = Easing.bezier(0.16, 1, 0.3, 1);
const CLOSE_DELAY_MS = 40;
const CLOSE_MS = 220;
const CLOSE_EASING = Easing.bezier(0.32, 0.72, 0, 1);
const FLY_IN_MS = 260;
const FLY_OUT_MS = 220;
const FLY_EASING = Easing.bezier(0.2, 0.8, 0.2, 1);
const REDUCED_MS = 120;
// The 2nd items show up late while opening and go early while closing (p in [this, 1]).
const COVER_CONTENT_FROM = 0.55;
// The X circle replaces the pill window once the cover is (almost) fully open.
const OPEN_CIRCLE_FROM = 0.98;

// Animated views take plain styles only (className is not applied to them on every target).
const PILL_LABEL_ROW_STYLE = { flexDirection: "row", alignItems: "center", gap: 4 } as const;
const OPEN_CIRCLE_POSITION_STYLE = { position: "absolute", right: 0, top: 0 } as const;
const ICON_LAYER_STYLE = { position: "absolute" } as const;

type FilterPillPartId = "star" | "sort";

type FilterPillPart = {
  // Pairs the pill piece with the chosen value inside the cover (담기 / 꺼내기 fly between them).
  id: FilterPillPartId;
  // The full piece, e.g. ★ or "제목 ↑".
  text: React.ReactNode;
  // The narrow piece used when the text would hide the 1st chips, e.g. ★ or a sort icon.
  mark: React.ReactNode;
};

type FilterPill = {
  parts: FilterPillPart[];
};

// "fill": the cover spans the whole row (mobile). "content": it is as wide as its content (wide).
type FilterCoverMode = "fill" | "content";

type FilterCoverRowProps = {
  // The 1st set: chips (`FilterChip`) scrolled sideways, or a plain label such as "12개 링크".
  primary: React.ReactNode;
  // Accessible name of the 1st chips as one single-choice group, e.g. "폴더", "액션 상태". Leave it
  // out when `primary` is not a set of chips.
  primaryLabel?: string;
  // The 2nd set shown in the cover: toggles (`FilterCoverPart`) and `SortCriterionChips`, placed
  // directly (a fragment), not wrapped in another view.
  cover: React.ReactNode;
  // Names the cover and the button: "정렬·필터" → "정렬·필터 열기" / "정렬·필터 닫기".
  coverLabel: string;
  // What the collapsed button shows; null when the 2nd set is at its default (icon only).
  pill: FilterPill | null;
  // The applied values in words, e.g. "제목 오름차순, 바로가기만"; null at the default.
  appliedLabel: string | null;
  coverMode: FilterCoverMode;
  className?: string;
  testID?: string;
};

// A piece's box, from the left of the cover content (before its sideways scroll).
type CoverPartRect = { x: number; y: number; width: number; height: number };
type CoverPartRectGetter = () => CoverPartRect | null;

type PieceLayout = { x: number; width: number; height: number };
type PillCopyLayout = { pieces: Map<FilterPillPartId, PieceLayout> };

type Ghost = {
  id: FilterPillPartId;
  content: React.ReactNode;
  width: number;
  height: number;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  fromScale: number;
  toScale: number;
};

type FilterCoverRowContextValue = {
  isOpen: boolean;
  registerPart: (id: FilterPillPartId, getRect: CoverPartRectGetter | null) => void;
  registerPrimaryChipLayout: (key: string, layout: { x: number; width: number } | null) => void;
};

const FilterCoverRowContext = React.createContext<FilterCoverRowContextValue | null>(null);

function getFilterCoverButtonLabel(
  coverLabel: string,
  isOpen: boolean,
  appliedLabel: string | null,
) {
  const base = `${coverLabel} ${isOpen ? "닫기" : "열기"}`;
  return appliedLabel ? `${base}, 적용 중: ${appliedLabel}` : base;
}

/** Right edge of the last chip that must stay whole, from the chips' own left edge. */
function getProtectedPrimaryRight(layouts: Iterable<{ x: number; width: number }>) {
  const sorted = [...layouts].sort((a, b) => a.x - b.x);
  if (sorted.length === 0) {
    return null;
  }
  const last = sorted[Math.min(PROTECTED_PRIMARY_CHIPS, sorted.length) - 1];
  return last.x + last.width;
}

/** The same color fully transparent, so a fade does not pass through grey. */
function toTransparent(color: string) {
  const match = color.match(/hsl\(\s*([0-9.]+)\s+([0-9.]+)%\s+([0-9.]+)%\s*\)/i);
  return match ? `hsla(${match[1]}, ${match[2]}%, ${match[3]}%, 0)` : "transparent";
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function emptyCopyLayout(): PillCopyLayout {
  return { pieces: new Map() };
}

/** Invisible copy of the pill at one level, measured for its width and its pieces' places. */
function PillMeasure({
  parts,
  level,
  layout,
  onWidth,
}: {
  parts: FilterPillPart[];
  level: FilterPillLevel;
  layout: PillCopyLayout;
  onWidth: (level: FilterPillLevel, width: number) => void;
}) {
  return (
    <View
      accessibilityElementsHidden
      aria-hidden
      className="absolute left-0 top-0 h-8 flex-row items-center rounded-full border border-transparent opacity-0"
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={{ paddingLeft: PILL_PADDING_LEFT }}
      onLayout={(event) => onWidth(level, event.nativeEvent.layout.width)}
    >
      <TextClassContext.Provider value="text-sm font-semibold">
        <View className="flex-row items-center gap-1">
          {parts.map((part) => (
            <View
              key={part.id}
              className="flex-row items-center"
              onLayout={(event) => {
                const { x, width, height } = event.nativeEvent.layout;
                layout.pieces.set(part.id, { x, width, height });
              }}
            >
              {level === "text" ? part.text : part.mark}
            </View>
          ))}
        </View>
      </TextClassContext.Provider>
      <View className="h-8 w-[30px]" />
    </View>
  );
}

function GhostPiece({ ghost, progress }: { ghost: Ghost; progress: { value: number } }) {
  const style = useAnimatedStyle(() => {
    const t = progress.value;
    return {
      transform: [
        { translateX: (ghost.toX - ghost.fromX) * t },
        { translateY: (ghost.toY - ghost.fromY) * t },
        { scale: ghost.fromScale + (ghost.toScale - ghost.fromScale) * t },
      ],
    };
  });
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: "absolute",
          flexDirection: "row",
          alignItems: "center",
          left: ghost.fromX - ghost.width / 2,
          top: ghost.fromY - ghost.height / 2,
          width: ghost.width,
          height: ghost.height,
        },
        style,
      ]}
    >
      <TextClassContext.Provider value="text-sm font-semibold text-primary">
        {ghost.content}
      </TextClassContext.Provider>
    </Animated.View>
  );
}

/**
 * One filter row: the 1st set on the left, and at the right end a button that opens the 2nd set as a
 * cover over the 1st. Collapsed, the button shows the applied 2nd values as a pill (`pill`), or only
 * its icon at the default.
 *
 * Motion: the cover and the pill are two-layer windows (outer translateX d, inner −d) so they wipe
 * open from the right without clip paths; on close the chosen values fly into the pill (담기) and on
 * open back to their place (꺼내기). Reduced motion swaps all of it for a short cross-fade.
 */
function FilterCoverRow({
  primary,
  primaryLabel,
  cover,
  coverLabel,
  pill,
  appliedLabel,
  coverMode,
  className,
  testID,
}: FilterCoverRowProps) {
  const isReducedMotion = useReducedMotion();
  const theme = useDisplaySettings((state) => state.display.theme);
  const accent = useDisplaySettings((state) => state.display.accent);
  const pageColor = React.useMemo(() => getThemeTokens(theme, accent).background, [theme, accent]);

  const [isOpen, setIsOpen] = React.useState(false);
  const [rowSize, setRowSize] = React.useState({ width: 0, height: ROW_HEIGHT });
  const [coverContentWidth, setCoverContentWidth] = React.useState(0);
  const [pillWidths, setPillWidths] = React.useState<Partial<Record<FilterPillLevel, number>>>({});
  const [primaryChipLayouts, setPrimaryChipLayouts] = React.useState<
    Map<string, { x: number; width: number }>
  >(() => new Map());
  const [primaryFade, setPrimaryFade] = React.useState(false);
  const [ghosts, setGhosts] = React.useState<Ghost[]>([]);

  const rowRef = React.useRef<View>(null);
  const primaryRef = React.useRef<View>(null);
  const coverRef = React.useRef<View>(null);
  const buttonRef = React.useRef<View>(null);
  const partRectsRef = React.useRef(new Map<FilterPillPartId, CoverPartRectGetter>());
  const copyLayoutsRef = React.useRef<Record<FilterPillLevel, PillCopyLayout>>({
    text: emptyCopyLayout(),
    mark: emptyCopyLayout(),
  });
  const coverScrollXRef = React.useRef(0);
  const coverItemsLayoutRef = React.useRef<CoverPartRect | null>(null);
  const primaryMeasureRef = React.useRef({ viewport: 0, content: 0, offset: 0 });
  const ghostTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const coverId = React.useId();

  // Open progress (0 closed → 1 open), the reduced-motion fade, the pill label's opacity and the
  // ghosts' flight.
  const progress = useSharedValue(0);
  const fade = useSharedValue(0);
  const labelOpacity = useSharedValue(1);
  const flight = useSharedValue(0);
  // Pill width beyond the X circle, and how far the closed cover window sits to the right.
  const pillExtra = useSharedValue(0);
  const coverOffset = useSharedValue(0);

  const hasPill = pill != null && pill.parts.length > 0;
  const rowWidth = rowSize.width;
  const coverPaddingLeft = coverMode === "fill" ? FILL_PADDING_LEFT : CONTENT_PADDING_LEFT;
  const protectRight =
    coverMode === "fill" ? getProtectedPrimaryRight(primaryChipLayouts.values()) : null;
  const pillLevel: FilterPillLevel = pickPillLevel({ rowWidth, protectRight, pillWidths });
  const pillWidth = hasPill
    ? (pillWidths[pillLevel] ?? pillWidths.text ?? BUTTON_SIZE)
    : BUTTON_SIZE;

  const coverLeft =
    coverMode === "fill"
      ? -FILL_BLEED
      : rowWidth - BUTTON_SIZE - Math.min(coverContentWidth, rowWidth - BUTTON_SIZE + FILL_BLEED);
  const coverWidth = Math.max(0, rowWidth - BUTTON_SIZE - coverLeft);

  React.useEffect(() => {
    pillExtra.value = Math.max(0, pillWidth - BUTTON_SIZE);
    coverOffset.value = Math.max(0, coverWidth + BUTTON_SIZE - pillWidth);
  }, [coverOffset, coverWidth, pillExtra, pillWidth]);

  React.useEffect(
    () => () => {
      if (ghostTimerRef.current) {
        clearTimeout(ghostTimerRef.current);
      }
    },
    [],
  );

  const registerPart = React.useCallback(
    (id: FilterPillPartId, getRect: CoverPartRectGetter | null) => {
      if (getRect) {
        partRectsRef.current.set(id, getRect);
      } else {
        partRectsRef.current.delete(id);
      }
    },
    [],
  );

  const registerPrimaryChipLayout = React.useCallback(
    (key: string, layout: { x: number; width: number } | null) => {
      setPrimaryChipLayouts((current) => {
        const previous = current.get(key);
        if (layout && previous && previous.x === layout.x && previous.width === layout.width) {
          return current;
        }
        if (!layout && !previous) {
          return current;
        }
        const next = new Map(current);
        if (layout) {
          next.set(key, layout);
        } else {
          next.delete(key);
        }
        return next;
      });
    },
    [],
  );

  const contextValue = React.useMemo<FilterCoverRowContextValue>(
    () => ({ isOpen, registerPart, registerPrimaryChipLayout }),
    [isOpen, registerPart, registerPrimaryChipLayout],
  );

  /** Ghosts for the chosen values: cover → pill ("in", 담기) or pill → cover ("out", 꺼내기). */
  const buildGhosts = React.useCallback(
    (direction: "in" | "out"): Ghost[] => {
      if (!pill || rowWidth <= 0) {
        return [];
      }
      // Positions come from widths, not from onLayout x: react-native-web reports layout on resize
      // only, so a view that moves without resizing keeps a stale x.
      const copy = copyLayoutsRef.current[pillLevel];
      const items = coverItemsLayoutRef.current;
      if (!items) {
        return [];
      }
      // The items sit at the right end of the cover content (justify-end), centered vertically.
      const coverContentSpan = Math.max(coverWidth, coverContentWidth);
      const itemsX = Math.max(
        coverPaddingLeft,
        coverContentSpan - COVER_PADDING_RIGHT - items.width,
      );
      const itemsY = (rowSize.height - items.height) / 2;
      const centerY = rowSize.height / 2;
      const result: Ghost[] = [];
      let pieceX = PILL_LABEL_X;
      for (const part of pill.parts) {
        const piece = copy.pieces.get(part.id);
        const rect = partRectsRef.current.get(part.id)?.();
        const thisPieceX = pieceX;
        pieceX += (piece?.width ?? 0) + PILL_LABEL_GAP;
        if (!piece || !rect || rect.width <= 0 || piece.height <= 0) {
          continue;
        }
        const coverX = coverLeft + itemsX + rect.x - coverScrollXRef.current + rect.width / 2;
        const coverY = itemsY + rect.y + rect.height / 2;
        const pillX = rowWidth - pillWidth + thisPieceX + piece.width / 2;
        const scale = clamp(rect.height / piece.height, 1, 1.25);
        const content = pillLevel === "text" ? part.text : part.mark;
        const ghost = {
          id: part.id,
          content,
          width: piece.width,
          height: piece.height,
        };
        result.push(
          direction === "in"
            ? {
                ...ghost,
                fromX: coverX,
                fromY: coverY,
                toX: pillX,
                toY: centerY,
                fromScale: scale,
                toScale: 1,
              }
            : {
                ...ghost,
                fromX: pillX,
                fromY: centerY,
                toX: coverX,
                toY: coverY,
                fromScale: 1,
                toScale: scale,
              },
        );
      }
      return result;
    },
    [
      coverContentWidth,
      coverLeft,
      coverPaddingLeft,
      coverWidth,
      pill,
      pillLevel,
      pillWidth,
      rowSize.height,
      rowWidth,
    ],
  );

  const startFlight = React.useCallback(
    (direction: "in" | "out") => {
      if (ghostTimerRef.current) {
        clearTimeout(ghostTimerRef.current);
        ghostTimerRef.current = null;
      }
      const next = isReducedMotion ? [] : buildGhosts(direction);
      setGhosts(next);
      if (next.length === 0) {
        labelOpacity.value = withTiming(direction === "in" ? 1 : 0, {
          duration: REDUCED_MS,
          easing: Easing.linear,
          reduceMotion: ReduceMotion.Never,
        });
        return;
      }
      const duration = direction === "in" ? FLY_IN_MS : FLY_OUT_MS;
      const delay = direction === "in" ? CLOSE_DELAY_MS : 0;
      labelOpacity.value = 0;
      flight.value = 0;
      flight.value = withDelay(delay, withTiming(1, { duration, easing: FLY_EASING }));
      ghostTimerRef.current = setTimeout(() => {
        ghostTimerRef.current = null;
        setGhosts([]);
        if (direction === "in") {
          labelOpacity.value = 1;
        }
      }, delay + duration);
    },
    [buildGhosts, flight, isReducedMotion, labelOpacity],
  );

  const setOpen = React.useCallback(
    (next: boolean, options: { immediate?: boolean } = {}) => {
      if (next === isOpen) {
        return;
      }
      setIsOpen(next);
      if (options.immediate) {
        if (ghostTimerRef.current) {
          clearTimeout(ghostTimerRef.current);
          ghostTimerRef.current = null;
        }
        setGhosts([]);
        progress.value = next ? 1 : 0;
        fade.value = next ? 1 : 0;
        labelOpacity.value = next ? 0 : 1;
        return;
      }
      if (isReducedMotion) {
        const timing = {
          duration: REDUCED_MS,
          easing: Easing.linear,
          reduceMotion: ReduceMotion.Never,
        };
        progress.value = next ? 1 : 0;
        fade.value = withTiming(next ? 1 : 0, timing);
        labelOpacity.value = withTiming(next ? 0 : 1, timing);
        return;
      }
      fade.value = next ? 1 : 0;
      progress.value = next
        ? withTiming(1, { duration: OPEN_MS, easing: OPEN_EASING })
        : withDelay(CLOSE_DELAY_MS, withTiming(0, { duration: CLOSE_MS, easing: CLOSE_EASING }));
      startFlight(next ? "out" : "in");
    },
    [fade, isOpen, isReducedMotion, labelOpacity, progress, startFlight],
  );

  const autoClose = useFilterCoverAutoClose({
    isOpen,
    onAutoClose: () => {
      dismiss.keepFocusOutOfCover();
      setOpen(false);
    },
  });

  const dismiss = useFilterCoverDismiss({
    isOpen,
    rowRef,
    primaryRef,
    coverRef,
    buttonRef,
    autoClose,
    onDismiss: ({ focusButton, immediate }) => {
      setOpen(false, { immediate });
      if (focusButton) {
        buttonRef.current?.focus?.();
      }
    },
  });

  const handleRowLayout = React.useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setRowSize((current) =>
      current.width === width && current.height === height ? current : { width, height },
    );
  }, []);

  const handlePillWidth = React.useCallback((level: FilterPillLevel, width: number) => {
    setPillWidths((current) =>
      current[level] === width ? current : { ...current, [level]: width },
    );
  }, []);

  const updatePrimaryFade = React.useCallback(() => {
    const { viewport, content, offset } = primaryMeasureRef.current;
    const next = content > viewport + 1 && offset + viewport < content - 1;
    setPrimaryFade((current) => (current === next ? current : next));
  }, []);

  const handlePrimaryLayout = React.useCallback(
    (event: LayoutChangeEvent) => {
      primaryMeasureRef.current.viewport = event.nativeEvent.layout.width;
      updatePrimaryFade();
    },
    [updatePrimaryFade],
  );

  const handlePrimaryContentSize = React.useCallback(
    (width: number) => {
      primaryMeasureRef.current.content = width;
      updatePrimaryFade();
    },
    [updatePrimaryFade],
  );

  const handlePrimaryScroll = React.useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      primaryMeasureRef.current.offset = event.nativeEvent.contentOffset.x;
      updatePrimaryFade();
    },
    [updatePrimaryFade],
  );

  const { onScroll: onCoverScrollFromDismiss, ...coverScrollDragProps } = dismiss.coverScrollProps;
  const handleCoverScroll = React.useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      coverScrollXRef.current = event.nativeEvent.contentOffset.x;
      onCoverScrollFromDismiss?.(event);
    },
    [onCoverScrollFromDismiss],
  );

  // The 2nd items at their natural width (the scroll content around them stretches to the window).
  const handleCoverItemsLayout = React.useCallback(
    (event: LayoutChangeEvent) => {
      const layout = event.nativeEvent.layout;
      coverItemsLayoutRef.current = layout;
      const width = layout.width + coverPaddingLeft + COVER_PADDING_RIGHT;
      setCoverContentWidth((current) => (current === width ? current : width));
    },
    [coverPaddingLeft],
  );

  const handleToggle = React.useCallback(() => {
    setOpen(!isOpen);
  }, [isOpen, setOpen]);

  const handleCoverEmptyPress = React.useCallback(() => {
    setOpen(false);
  }, [setOpen]);

  // Cover: outer window slides right by d·(1−p), inner content slides back by the same, so only the
  // window's edge moves (it opens from the pill's left end).
  const coverWindowStyle = useAnimatedStyle(() => {
    const shift = coverOffset.value * (1 - progress.value);
    return {
      opacity: isReducedMotion ? fade.value : progress.value > 0.001 ? 1 : 0,
      transform: [{ translateX: shift }],
    };
  });
  const coverInnerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: -coverOffset.value * (1 - progress.value) }],
  }));
  const coverContentStyle = useAnimatedStyle(() => ({
    opacity: isReducedMotion
      ? 1
      : interpolate(progress.value, [COVER_CONTENT_FROM, 1], [0, 1], Extrapolation.CLAMP),
  }));

  // Pill: the same two layers, narrowing to the X circle from the left.
  const pillWindowStyle = useAnimatedStyle(() => {
    const shift = pillExtra.value * progress.value;
    return {
      opacity: isReducedMotion ? 1 - fade.value : progress.value >= OPEN_CIRCLE_FROM ? 0 : 1,
      transform: [{ translateX: shift }],
    };
  });
  const pillInnerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: -pillExtra.value * progress.value }],
  }));
  const pillLabelStyle = useAnimatedStyle(() => ({ opacity: labelOpacity.value }));
  const openCircleStyle = useAnimatedStyle(() => ({
    opacity: isReducedMotion ? fade.value : progress.value >= OPEN_CIRCLE_FROM ? 1 : 0,
  }));
  const filterIconStyle = useAnimatedStyle(() => {
    const t = isReducedMotion ? fade.value : progress.value;
    return {
      opacity: 1 - t,
      transform: isReducedMotion ? [] : [{ rotate: `${90 * t}deg` }, { scale: 1 - 0.4 * t }],
    };
  });
  const closeIconStyle = useAnimatedStyle(() => {
    const t = isReducedMotion ? fade.value : progress.value;
    return {
      opacity: t,
      transform: isReducedMotion
        ? []
        : [{ rotate: `${-90 * (1 - t)}deg` }, { scale: 0.6 + 0.4 * t }],
    };
  });

  const buttonLabel = getFilterCoverButtonLabel(coverLabel, isOpen, appliedLabel);
  const ariaControls = isWeb ? ({ "aria-controls": coverId } as Record<string, string>) : undefined;
  const hitSlop = {
    top: BUTTON_HIT_SLOP,
    right: BUTTON_HIT_SLOP,
    bottom: BUTTON_HIT_SLOP,
    left: BUTTON_HIT_SLOP,
  };
  const transparentPage = toTransparent(pageColor);
  const isPillTinted = hasPill && !isOpen;

  return (
    <FilterCoverRowContext.Provider value={contextValue}>
      <View
        ref={rowRef}
        className={cn("relative flex-row items-center", className)}
        style={{ minHeight: ROW_HEIGHT }}
        testID={testID}
        onLayout={handleRowLayout}
      >
        {/* 1st set */}
        <View
          ref={primaryRef}
          accessibilityElementsHidden={isOpen}
          accessibilityLabel={primaryLabel}
          accessibilityRole={primaryLabel ? "radiogroup" : undefined}
          className="min-w-0 flex-1"
          importantForAccessibility={isOpen ? "no-hide-descendants" : "auto"}
          style={{ marginRight: pillWidth + PILL_ROW_GAP }}
          onLayout={handlePrimaryLayout}
        >
          <ScrollView
            horizontal
            className="grow-0"
            contentContainerClassName="items-center gap-1"
            contentContainerStyle={{ paddingVertical: BUTTON_HIT_SLOP }}
            scrollEventThrottle={32}
            showsHorizontalScrollIndicator={false}
            onContentSizeChange={handlePrimaryContentSize}
            onScroll={handlePrimaryScroll}
          >
            {primary}
          </ScrollView>
          {primaryFade ? (
            <LinearGradient
              className="absolute bottom-0 right-0 top-0"
              colors={[transparentPage, pageColor]}
              end={{ x: 1, y: 0 }}
              pointerEvents="none"
              start={{ x: 0, y: 0 }}
              style={{ width: PRIMARY_FADE_WIDTH }}
            />
          ) : null}
        </View>

        {/* 2nd set: always laid out (so its pieces can be measured), shown only while open */}
        <View
          className="absolute bottom-0 top-0 overflow-hidden"
          pointerEvents="box-none"
          style={{ left: -FILL_BLEED, right: 0 }}
        >
          <Animated.View
            pointerEvents={isOpen ? "auto" : "none"}
            style={[
              {
                position: "absolute",
                top: 0,
                bottom: 0,
                overflow: "hidden",
                left: coverLeft + FILL_BLEED,
                width: coverWidth,
              },
              coverWindowStyle,
            ]}
          >
            <Animated.View style={[{ flex: 1 }, coverInnerStyle]}>
              <View
                ref={coverRef}
                accessibilityElementsHidden={!isOpen}
                accessibilityLabel={coverLabel}
                className="flex-1"
                importantForAccessibility={isOpen ? "auto" : "no-hide-descendants"}
                nativeID={coverId}
                role="group"
                {...dismiss.coverProps}
              >
                {coverMode === "content" ? (
                  <>
                    <LinearGradient
                      className="absolute bottom-0 left-0 top-0"
                      colors={[transparentPage, pageColor]}
                      end={{ x: 1, y: 0 }}
                      pointerEvents="none"
                      start={{ x: 0, y: 0 }}
                      style={{ width: CONTENT_FADE_WIDTH }}
                    />
                    <View
                      className="absolute bottom-0 right-0 top-0"
                      pointerEvents="none"
                      style={{ left: CONTENT_FADE_WIDTH, backgroundColor: pageColor }}
                    />
                  </>
                ) : (
                  <View
                    className="absolute inset-0"
                    pointerEvents="none"
                    style={{ backgroundColor: pageColor }}
                  />
                )}
                <ScrollView
                  horizontal
                  className="flex-1"
                  contentContainerClassName="grow"
                  scrollEventThrottle={32}
                  showsHorizontalScrollIndicator={false}
                  onScroll={handleCoverScroll}
                  {...coverScrollDragProps}
                >
                  <Animated.View style={[{ flexGrow: 1 }, coverContentStyle]}>
                    <Pressable
                      accessible={false}
                      className="grow flex-row items-center justify-end"
                      tabIndex={-1}
                      style={{
                        paddingLeft: coverPaddingLeft,
                        paddingRight: COVER_PADDING_RIGHT,
                        minHeight: ROW_HEIGHT,
                      }}
                      onPress={handleCoverEmptyPress}
                    >
                      <View
                        className="flex-row items-center gap-2"
                        onLayout={handleCoverItemsLayout}
                      >
                        {cover}
                      </View>
                    </Pressable>
                  </Animated.View>
                </ScrollView>
              </View>
            </Animated.View>
          </Animated.View>
        </View>

        {/* Button visuals: the pill window, the open X circle and the two icons */}
        <View
          accessibilityElementsHidden
          className="absolute right-0 overflow-hidden"
          importantForAccessibility="no-hide-descendants"
          pointerEvents="none"
          style={{ top: (rowSize.height - BUTTON_SIZE) / 2, width: pillWidth, height: BUTTON_SIZE }}
        >
          {/* Animated views take only `style`; their looks live on plain views inside. */}
          <Animated.View
            style={[
              {
                position: "absolute",
                right: 0,
                top: 0,
                width: pillWidth,
                height: BUTTON_SIZE,
                borderRadius: BUTTON_SIZE / 2,
                overflow: "hidden",
              },
              pillWindowStyle,
            ]}
          >
            <Animated.View style={[{ width: pillWidth, height: BUTTON_SIZE }, pillInnerStyle]}>
              <View
                className={cn(
                  "h-8 flex-row items-center rounded-full border",
                  isPillTinted ? "border-primary bg-primary/10" : "border-border bg-card",
                )}
                style={{ width: pillWidth, paddingLeft: PILL_PADDING_LEFT }}
              >
                {hasPill ? (
                  <Animated.View style={[PILL_LABEL_ROW_STYLE, pillLabelStyle]}>
                    <TextClassContext.Provider value="text-sm font-semibold text-primary">
                      {pill.parts.map((part) => (
                        <View
                          key={part.id}
                          className="flex-row items-center"
                        >
                          {pillLevel === "text" ? part.text : part.mark}
                        </View>
                      ))}
                    </TextClassContext.Provider>
                  </Animated.View>
                ) : null}
              </View>
            </Animated.View>
          </Animated.View>
          <Animated.View style={[OPEN_CIRCLE_POSITION_STYLE, openCircleStyle]}>
            <View className="size-8 rounded-full border border-border bg-card" />
          </Animated.View>
          <View className="absolute right-0 top-0 size-8 items-center justify-center">
            <Animated.View style={[ICON_LAYER_STYLE, filterIconStyle]}>
              <Icon
                as={SlidersHorizontal}
                className={isPillTinted ? "text-primary" : "text-muted-foreground"}
                size={16}
              />
            </Animated.View>
            <Animated.View style={[ICON_LAYER_STYLE, closeIconStyle]}>
              <Icon
                as={X}
                className="text-foreground"
                size={16}
              />
            </Animated.View>
          </View>
        </View>

        {/* Button press area: the visible pill or circle, reaching 6px past it */}
        <Pressable
          ref={buttonRef}
          accessibilityLabel={buttonLabel}
          accessibilityRole="button"
          accessibilityState={{ expanded: isOpen }}
          aria-expanded={isOpen}
          className={cn(
            "absolute right-0 h-8 rounded-full",
            isWeb && "outline-none focus-visible:ring-2 focus-visible:ring-ring",
          )}
          hitSlop={hitSlop}
          style={{
            top: (rowSize.height - BUTTON_SIZE) / 2,
            width: isOpen ? BUTTON_SIZE : pillWidth,
          }}
          testID={testID ? `${testID}-button` : undefined}
          onPress={handleToggle}
          {...ariaControls}
        >
          <PressableHitSlopArea hitSlop={hitSlop} />
        </Pressable>

        {ghosts.map((ghost) => (
          <GhostPiece
            key={ghost.id}
            ghost={ghost}
            progress={flight}
          />
        ))}

        {hasPill ? (
          <>
            <PillMeasure
              layout={copyLayoutsRef.current.text}
              level="text"
              parts={pill.parts}
              onWidth={handlePillWidth}
            />
            <PillMeasure
              layout={copyLayoutsRef.current.mark}
              level="mark"
              parts={pill.parts}
              onWidth={handlePillWidth}
            />
          </>
        ) : null}
      </View>
    </FilterCoverRowContext.Provider>
  );
}

/**
 * Registers where the pill piece `id` sits inside the cover, through a function the row calls when a
 * flight starts. No-op outside a row.
 */
function useFilterCoverPart(id: FilterPillPartId, getRect: CoverPartRectGetter | null) {
  const register = React.use(FilterCoverRowContext)?.registerPart;
  React.useEffect(() => {
    if (!register || !getRect) {
      return;
    }
    register(id, getRect);
    return () => register(id, null);
  }, [getRect, id, register]);
}

/** Layout handler a 1st chip uses so the row knows which chips the pill must leave whole. */
function useFilterRowPrimaryChipLayout() {
  const register = React.use(FilterCoverRowContext)?.registerPrimaryChipLayout;
  const key = React.useId();
  React.useEffect(() => {
    return () => register?.(key, null);
  }, [key, register]);
  return React.useMemo(() => {
    if (!register) {
      return undefined;
    }
    return (event: LayoutChangeEvent) => {
      const { x, width } = event.nativeEvent.layout;
      register(key, { x, width });
    };
  }, [key, register]);
}

/** Whether the surrounding filter row has its cover open; false outside a row. */
function useFilterCoverOpen() {
  return React.use(FilterCoverRowContext)?.isOpen ?? false;
}

/**
 * A chosen value inside the cover that has a matching pill piece, such as the ★ toggle (`id="star"`).
 * Place it directly in `cover`. `SortCriterionChips` registers its own "sort" piece.
 */
function FilterCoverPart({
  id,
  children,
  className,
}: {
  id: FilterPillPartId;
  children: React.ReactNode;
  className?: string;
}) {
  const rectRef = React.useRef<CoverPartRect | null>(null);
  const getRect = React.useCallback(() => rectRef.current, []);
  useFilterCoverPart(id, getRect);
  return (
    <View
      className={cn("flex-row items-center", className)}
      onLayout={(event) => {
        rectRef.current = event.nativeEvent.layout;
      }}
    >
      {children}
    </View>
  );
}

export {
  FilterCoverPart,
  FilterCoverRow,
  getFilterCoverButtonLabel,
  useFilterCoverOpen,
  useFilterCoverPart,
  useFilterRowPrimaryChipLayout,
};
export type {
  CoverPartRect,
  FilterCoverMode,
  FilterCoverRowProps,
  FilterPill,
  FilterPillPart,
  FilterPillPartId,
};
