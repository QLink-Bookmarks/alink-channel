import * as React from "react";
import { Pressable, View } from "react-native";

import { useFilterCoverPartLayout } from "@/components/ui/filter-cover-row";
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

type SortCriterionChipsProps<K extends string> = {
  criteria: SortCriterion<K>[];
  value: ListSort<K>;
  onValueChange: (next: ListSort<K>) => void;
  // Accessible name of the group.
  label?: string;
  className?: string;
  testID?: string;
};

/** ↓ for descending, ↑ (the same arrow turned 180°) for ascending. */
function SortDirectionArrow({
  direction,
  className,
}: {
  direction: SortDirection;
  className?: string;
}) {
  return (
    <View style={{ transform: [{ rotate: direction === "asc" ? "180deg" : "0deg" }] }}>
      <Icon
        as={ArrowDown}
        className={className}
        size={13}
        strokeWidth={2.5}
      />
    </View>
  );
}

function SortCriterionItem<K extends string>({
  criterion,
  value,
  onValueChange,
}: {
  criterion: SortCriterion<K>;
  value: ListSort<K>;
  onValueChange: (next: ListSort<K>) => void;
}) {
  const isOn = value.key === criterion.key;
  const handlePartLayout = useFilterCoverPartLayout("sort");
  const handlePress = React.useCallback(() => {
    onValueChange(pressSortCriterion(value, criterion));
  }, [criterion, onValueChange, value]);

  return (
    <Pressable
      accessibilityLabel={
        isOn ? getSortCriterionLabel(criterion.label, value.direction) : criterion.label
      }
      accessibilityRole="radio"
      accessibilityState={{ checked: isOn }}
      aria-checked={isOn}
      className={cn(
        "h-8 flex-row items-center justify-center rounded-xl px-3",
        isOn ? "bg-primary" : "bg-transparent",
        isWeb && "outline-none focus-visible:ring-2 focus-visible:ring-ring",
      )}
      hitSlop={ITEM_HIT_SLOP}
      onPress={handlePress}
    >
      <PressableHitSlopArea hitSlop={ITEM_HIT_SLOP} />
      <View
        className="flex-row items-center gap-1"
        onLayout={isOn ? handlePartLayout : undefined}
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

/**
 * The sort criteria of a filter row's cover: one criterion is on at a time and shows its direction
 * arrow. Pressing an off criterion turns it on in its first direction; pressing the one that is on
 * reverses the direction.
 */
function SortCriterionChips<K extends string>({
  criteria,
  value,
  onValueChange,
  label = "정렬 기준",
  className,
  testID,
}: SortCriterionChipsProps<K>) {
  return (
    <View
      accessibilityLabel={label}
      accessibilityRole="radiogroup"
      className={cn(
        "flex-row items-center gap-0.5 rounded-2xl border border-border bg-surface-elevated p-0.5",
        className,
      )}
      testID={testID}
    >
      {criteria.map((criterion) => (
        <SortCriterionItem
          key={criterion.key}
          criterion={criterion}
          value={value}
          onValueChange={onValueChange}
        />
      ))}
    </View>
  );
}

export { SortCriterionChips, SortDirectionArrow };
export type { SortCriterionChipsProps };
