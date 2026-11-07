import * as React from "react";
import {
  type LayoutChangeEvent,
  type LayoutRectangle,
  Pressable,
  ScrollView,
  View,
} from "react-native";

import { Icon } from "@/components/ui/icon";
import { PressableHitSlopArea } from "@/components/ui/icon-button";
import { TextClassContext } from "@/components/ui/text";
import { type FilterPillLevel, PILL_ROW_GAP, pickPillLevel } from "@/lib/filter-pill-level";
import { cn } from "@/lib/utils";

import { SlidersHorizontal, X } from "lucide-react-native/icons";

const isWeb = process.env.EXPO_OS === "web";

// The button is 32px; its press area reaches 6px past every side (44 × 44).
const BUTTON_HIT_SLOP = { top: 6, right: 6, bottom: 6, left: 6 };
// How many 1st chips the pill must leave whole (narrow screens drop the pill text first).
const PROTECTED_PRIMARY_CHIPS = 3;

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
  // The 2nd set shown in the cover: toggles (`FilterCoverPart`) and `SortCriterionChips`.
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

type FilterCoverRowContextValue = {
  isOpen: boolean;
  registerPartLayout: (id: FilterPillPartId, layout: LayoutRectangle | null) => void;
  registerPrimaryChipLayout: (key: string, layout: LayoutRectangle | null) => void;
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
function getProtectedPrimaryRight(layouts: Iterable<LayoutRectangle>) {
  const sorted = [...layouts].sort((a, b) => a.x - b.x);
  if (sorted.length === 0) {
    return null;
  }
  const last = sorted[Math.min(PROTECTED_PRIMARY_CHIPS, sorted.length) - 1];
  return last.x + last.width;
}

/**
 * One filter row: the 1st set on the left, and at the right end a button that opens the 2nd set as a
 * cover over the 1st. Collapsed, the button shows the applied 2nd values as a pill (`pill`), or only
 * its icon at the default.
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
  const [isOpen, setIsOpen] = React.useState(false);
  const [rowWidth, setRowWidth] = React.useState(0);
  const [pillTextWidth, setPillTextWidth] = React.useState<number | null>(null);
  const [primaryChipLayouts, setPrimaryChipLayouts] = React.useState<Map<string, LayoutRectangle>>(
    () => new Map(),
  );
  const partLayoutsRef = React.useRef(new Map<FilterPillPartId, LayoutRectangle>());
  const coverId = React.useId();

  const registerPartLayout = React.useCallback(
    (id: FilterPillPartId, layout: LayoutRectangle | null) => {
      if (layout) {
        partLayoutsRef.current.set(id, layout);
      } else {
        partLayoutsRef.current.delete(id);
      }
    },
    [],
  );

  const registerPrimaryChipLayout = React.useCallback(
    (key: string, layout: LayoutRectangle | null) => {
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
    () => ({ isOpen, registerPartLayout, registerPrimaryChipLayout }),
    [isOpen, registerPartLayout, registerPrimaryChipLayout],
  );

  const protectRight =
    coverMode === "fill" ? getProtectedPrimaryRight(primaryChipLayouts.values()) : null;
  const pillLevel: FilterPillLevel = pickPillLevel({
    rowWidth,
    protectRight,
    pillWidths: pillTextWidth == null ? {} : { text: pillTextWidth },
  });

  const handleRowLayout = React.useCallback((event: LayoutChangeEvent) => {
    setRowWidth(event.nativeEvent.layout.width);
  }, []);

  const handlePillMeasureLayout = React.useCallback((event: LayoutChangeEvent) => {
    setPillTextWidth(event.nativeEvent.layout.width);
  }, []);

  const handleToggle = React.useCallback(() => {
    setIsOpen((current) => !current);
  }, []);

  const handleClose = React.useCallback(() => {
    setIsOpen(false);
  }, []);

  const buttonLabel = getFilterCoverButtonLabel(coverLabel, isOpen, appliedLabel);
  const showsPill = !isOpen && pill != null && pill.parts.length > 0;
  const ariaControls = isWeb ? ({ "aria-controls": coverId } as Record<string, string>) : undefined;

  return (
    <FilterCoverRowContext.Provider value={contextValue}>
      <View
        className={cn("relative min-h-11 flex-row items-center", className)}
        style={{ gap: PILL_ROW_GAP }}
        testID={testID}
        onLayout={handleRowLayout}
      >
        <View
          accessibilityElementsHidden={isOpen}
          accessibilityLabel={primaryLabel}
          accessibilityRole={primaryLabel ? "radiogroup" : undefined}
          className="min-w-0 flex-1"
          importantForAccessibility={isOpen ? "no-hide-descendants" : "auto"}
        >
          <ScrollView
            horizontal
            className="grow-0"
            contentContainerClassName="items-center gap-1"
            showsHorizontalScrollIndicator={false}
          >
            {primary}
          </ScrollView>
        </View>

        {isOpen ? (
          <Pressable
            accessibilityLabel={coverLabel}
            accessible={false}
            className={cn(
              "absolute bottom-0 top-0 flex-row items-center bg-background",
              coverMode === "fill" ? "left-0" : "max-w-full",
            )}
            nativeID={coverId}
            role="group"
            style={{ right: 32 + PILL_ROW_GAP }}
            onPress={handleClose}
          >
            <ScrollView
              horizontal
              className="grow-0"
              contentContainerClassName="grow items-center justify-end gap-2"
              showsHorizontalScrollIndicator={false}
            >
              {cover}
            </ScrollView>
          </Pressable>
        ) : null}

        <Pressable
          accessibilityLabel={buttonLabel}
          accessibilityRole="button"
          accessibilityState={{ expanded: isOpen }}
          aria-expanded={isOpen}
          className={cn(
            "rounded-full py-1.5",
            isWeb && "outline-none focus-visible:ring-2 focus-visible:ring-ring",
          )}
          hitSlop={{ left: BUTTON_HIT_SLOP.left, right: BUTTON_HIT_SLOP.right }}
          testID={testID ? `${testID}-button` : undefined}
          onPress={handleToggle}
          {...ariaControls}
        >
          <PressableHitSlopArea
            hitSlop={{ left: BUTTON_HIT_SLOP.left, right: BUTTON_HIT_SLOP.right }}
          />
          <View
            className={cn(
              "h-8 min-w-8 flex-row items-center justify-center rounded-full border",
              showsPill
                ? "gap-1 border-primary bg-primary/10 pl-2.5 pr-1.5"
                : "border-border bg-card",
            )}
          >
            {showsPill ? (
              <TextClassContext.Provider value="text-sm font-semibold text-primary">
                <View className="flex-row items-center gap-1">
                  {pill.parts.map((part) => (
                    <React.Fragment key={part.id}>
                      {pillLevel === "text" ? part.text : part.mark}
                    </React.Fragment>
                  ))}
                </View>
              </TextClassContext.Provider>
            ) : null}
            <Icon
              as={isOpen ? X : SlidersHorizontal}
              className={showsPill ? "text-primary" : "text-muted-foreground"}
              size={16}
            />
          </View>
        </Pressable>

        {pill && pill.parts.length > 0 ? (
          // Measuring copy of the text pill: natural width, never seen or read.
          <View
            accessibilityElementsHidden
            aria-hidden
            className="absolute left-0 top-0 h-8 flex-row items-center gap-1 rounded-full border pl-2.5 pr-1.5 opacity-0"
            importantForAccessibility="no-hide-descendants"
            pointerEvents="none"
            onLayout={handlePillMeasureLayout}
          >
            <TextClassContext.Provider value="text-sm font-semibold">
              <View className="flex-row items-center gap-1">
                {pill.parts.map((part) => (
                  <React.Fragment key={part.id}>{part.text}</React.Fragment>
                ))}
              </View>
            </TextClassContext.Provider>
            <View className="size-4" />
          </View>
        ) : null}
      </View>
    </FilterCoverRowContext.Provider>
  );
}

/** Layout handler that records where the pill piece `id` sits inside the cover; no-op outside a row. */
function useFilterCoverPartLayout(id: FilterPillPartId) {
  const context = React.use(FilterCoverRowContext);
  const register = context?.registerPartLayout;
  React.useEffect(() => {
    return () => register?.(id, null);
  }, [id, register]);
  return React.useCallback(
    (event: LayoutChangeEvent) => {
      register?.(id, event.nativeEvent.layout);
    },
    [id, register],
  );
}

/** Layout handler a 1st chip uses so the row knows which chips the pill must leave whole. */
function useFilterRowPrimaryChipLayout() {
  const context = React.use(FilterCoverRowContext);
  const register = context?.registerPrimaryChipLayout;
  const key = React.useId();
  React.useEffect(() => {
    return () => register?.(key, null);
  }, [key, register]);
  if (!register) {
    return undefined;
  }
  return (event: LayoutChangeEvent) => {
    register(key, event.nativeEvent.layout);
  };
}

/** Whether the surrounding filter row has its cover open; false outside a row. */
function useFilterCoverOpen() {
  return React.use(FilterCoverRowContext)?.isOpen ?? false;
}

/**
 * A chosen value inside the cover that has a matching pill piece, such as the ★ toggle (`id="star"`).
 * `SortCriterionChips` registers its own "sort" piece.
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
  const handleLayout = useFilterCoverPartLayout(id);
  return (
    <View
      className={cn("flex-row items-center", className)}
      onLayout={handleLayout}
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
  useFilterCoverPartLayout,
  useFilterRowPrimaryChipLayout,
};
export type { FilterCoverMode, FilterCoverRowProps, FilterPill, FilterPillPart, FilterPillPartId };
