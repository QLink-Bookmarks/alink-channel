import * as React from "react";
import { type LayoutRectangle, Pressable, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { type CoverPartRect, useFilterCoverPart } from "@/components/ui/filter-cover-row";
import { Icon } from "@/components/ui/icon";
import { PressableHitSlopArea } from "@/components/ui/icon-button";
import { Text } from "@/components/ui/text";
import {
  type ListSort,
  type SortCriterion,
  type SortDirection,
  getSortCriterionLabel,
  pressSortCriterion,
} from "@/lib/list-sort";
import { cn } from "@/lib/utils";

import { ArrowDown } from "lucide-react-native/icons";

const isWeb = process.env.EXPO_OS === "web";

// Items are 32px inside a 2px-padded group; the press area reaches 6px above and below (44px).
const ITEM_HIT_SLOP = { top: 6, bottom: 6 };
// Border (1) + padding (2) of the group, and the gap between items (gap-0.5).
const GROUP_INSET = 3;
const ITEM_GAP = 2;
// The arrow turns 180° with a slight overshoot (report-a2 --a2-arrow-ms / --a2-arrow-ease). With the
// system's reduce motion on, Reanimated skips the turn.
const ARROW_TURN_MS = 220;
const ARROW_TURN_EASING = Easing.bezier(0.34, 1.3, 0.64, 1);

type SortCriterionChipsProps<K extends string> = {
  criteria: SortCriterion<K>[];
  value: ListSort<K>;
  onValueChange: (next: ListSort<K>) => void;
  // Accessible name of the group.
  label?: string;
  className?: string;
  testID?: string;
};

function getArrowAngle(direction: SortDirection) {
  return direction === "asc" ? 180 : 0;
}

/**
 * ↓ for descending, ↑ (the same arrow turned 180°) for ascending. A change of direction turns the
 * arrow; a newly shown arrow starts in place.
 */
function SortDirectionArrow({
  direction,
  className,
}: {
  direction: SortDirection;
  className?: string;
}) {
  const angle = useSharedValue(getArrowAngle(direction));
  React.useEffect(() => {
    angle.value = withTiming(getArrowAngle(direction), {
      duration: ARROW_TURN_MS,
      easing: ARROW_TURN_EASING,
    });
  }, [angle, direction]);
  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${angle.value}deg` }] }));
  return (
    <Animated.View style={style}>
      <Icon
        as={ArrowDown}
        className={className}
        size={13}
        strokeWidth={2.5}
      />
    </Animated.View>
  );
}

type ItemLayouts = {
  group: LayoutRectangle | null;
  items: Map<string, LayoutRectangle>;
  labels: Map<string, LayoutRectangle>;
};

function SortCriterionItem<K extends string>({
  criterion,
  value,
  layouts,
  itemRef,
  onValueChange,
}: {
  criterion: SortCriterion<K>;
  value: ListSort<K>;
  layouts: ItemLayouts;
  itemRef: (node: View | null) => void;
  onValueChange: (next: ListSort<K>) => void;
}) {
  const isOn = value.key === criterion.key;
  const handlePress = React.useCallback(() => {
    onValueChange(pressSortCriterion(value, criterion));
  }, [criterion, onValueChange, value]);

  return (
    <Pressable
      ref={itemRef}
      accessibilityLabel={
        isOn ? getSortCriterionLabel(criterion.label, value.direction) : criterion.label
      }
      accessibilityRole="radio"
      accessibilityState={{ checked: isOn }}
      aria-checked={isOn}
      className={cn(
        "h-8 flex-row items-center justify-center rounded-xl px-3",
        isOn ? "bg-primary" : "bg-transparent active:bg-accent",
        isWeb && "outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
      )}
      // Roving focus (web): only the chosen criterion is a Tab stop; arrows move between them.
      tabIndex={isOn ? 0 : -1}
      hitSlop={ITEM_HIT_SLOP}
      onLayout={(event) => {
        layouts.items.set(criterion.key, event.nativeEvent.layout);
      }}
      onPress={handlePress}
    >
      <PressableHitSlopArea hitSlop={ITEM_HIT_SLOP} />
      <View
        className="flex-row items-center gap-1"
        onLayout={(event) => {
          layouts.labels.set(criterion.key, event.nativeEvent.layout);
        }}
      >
        <Text
          className={cn(
            "text-sm font-medium",
            isOn ? "text-primary-foreground" : "text-muted-foreground",
          )}
          numberOfLines={1}
        >
          {criterion.label}
        </Text>
        {isOn ? (
          <SortDirectionArrow
            className="text-primary-foreground"
            direction={value.direction}
          />
        ) : null}
      </View>
    </Pressable>
  );
}

const NEXT_KEYS: Record<string, number> = {
  ArrowRight: 1,
  ArrowDown: 1,
  ArrowLeft: -1,
  ArrowUp: -1,
};

/**
 * The sort criteria of a filter row's cover: one criterion is on at a time and shows its direction
 * arrow. Pressing an off criterion turns it on in its first direction; pressing the one that is on
 * reverses the direction. On the web it is one Tab stop: ←→↑↓, Home and End choose another criterion
 * (in its first direction) and move focus with it; Enter or Space on the chosen one reverses it.
 */
function SortCriterionChips<K extends string>({
  criteria,
  value,
  onValueChange,
  label = "정렬 기준",
  className,
  testID,
}: SortCriterionChipsProps<K>) {
  const layoutsRef = React.useRef<ItemLayouts>({
    group: null,
    items: new Map(),
    labels: new Map(),
  });
  const itemNodesRef = React.useRef(new Map<string, View>());
  const pendingFocusKeyRef = React.useRef<string | null>(null);
  const valueKeyRef = React.useRef<string>(value.key);
  valueKeyRef.current = value.key;
  const criteriaRef = React.useRef(criteria);
  criteriaRef.current = criteria;

  // The chosen criterion's name and arrow is the "sort" piece of the pill (담기 / 꺼내기).
  // Built from widths: react-native-web reports onLayout on resize only, so an item that moves
  // without resizing would keep a stale x.
  const getRect = React.useCallback((): CoverPartRect | null => {
    const { group, items, labels } = layoutsRef.current;
    const key = valueKeyRef.current;
    const labelBox = labels.get(key);
    const item = items.get(key);
    if (!group || !item || !labelBox) {
      return null;
    }
    let itemX = GROUP_INSET;
    for (const criterion of criteriaRef.current) {
      if (criterion.key === key) {
        break;
      }
      itemX += (items.get(criterion.key)?.width ?? 0) + ITEM_GAP;
    }
    return {
      x: group.x + itemX + (item.width - labelBox.width) / 2,
      y: group.y + GROUP_INSET + (item.height - labelBox.height) / 2,
      width: labelBox.width,
      height: labelBox.height,
    };
  }, []);
  useFilterCoverPart("sort", getRect);

  React.useEffect(() => {
    if (pendingFocusKeyRef.current === value.key) {
      pendingFocusKeyRef.current = null;
      itemNodesRef.current.get(value.key)?.focus?.();
    }
  }, [value.key]);

  const handleKeyDown = React.useCallback(
    (event: { key: string; preventDefault: () => void }) => {
      const index = criteria.findIndex((criterion) => criterion.key === value.key);
      let nextIndex: number | null = null;
      if (event.key in NEXT_KEYS) {
        nextIndex = (index + NEXT_KEYS[event.key] + criteria.length) % criteria.length;
      } else if (event.key === "Home") {
        nextIndex = 0;
      } else if (event.key === "End") {
        nextIndex = criteria.length - 1;
      }
      if (nextIndex == null || criteria.length === 0) {
        return;
      }
      event.preventDefault();
      const next = criteria[nextIndex];
      if (next.key === value.key) {
        return;
      }
      pendingFocusKeyRef.current = next.key;
      onValueChange({ key: next.key, direction: next.firstDirection });
    },
    [criteria, onValueChange, value.key],
  );

  const keyboardProps = isWeb ? ({ onKeyDown: handleKeyDown } as Record<string, unknown>) : {};

  return (
    <View
      accessibilityLabel={label}
      accessibilityRole="radiogroup"
      className={cn(
        "flex-row items-center gap-0.5 rounded-2xl border border-border bg-surface-elevated p-0.5",
        className,
      )}
      testID={testID}
      onLayout={(event) => {
        layoutsRef.current.group = event.nativeEvent.layout;
      }}
      {...keyboardProps}
    >
      {criteria.map((criterion) => (
        <SortCriterionItem
          key={criterion.key}
          criterion={criterion}
          itemRef={(node) => {
            if (node) {
              itemNodesRef.current.set(criterion.key, node);
            } else {
              itemNodesRef.current.delete(criterion.key);
            }
          }}
          layouts={layoutsRef.current}
          value={value}
          onValueChange={onValueChange}
        />
      ))}
    </View>
  );
}

export { SortCriterionChips, SortDirectionArrow };
export type { SortCriterionChipsProps };
