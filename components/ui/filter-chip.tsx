import * as React from "react";
import { Pressable } from "react-native";

import { useFilterRowPrimaryChipLayout } from "@/components/ui/filter-cover-row";
import { PressableHitSlopArea } from "@/components/ui/icon-button";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";

const isWeb = process.env.EXPO_OS === "web";

// The chip is 32px tall; its press area reaches 6px above and below (44px). The filter row leaves
// that room around its chips.
const CHIP_HIT_SLOP = { top: 6, bottom: 6 };

type FilterChipProps = {
  label: string;
  // Shown after the label (e.g. "진행 중 3"); leave it out, or pass null while it is unknown.
  count?: number | null;
  selected: boolean;
  onPress: () => void;
  disabled?: boolean;
  className?: string;
  testID?: string;
};

/**
 * A 1st-set chip of a filter row: one choice of a single-choice group. Looks like
 * `SegmentedControl`'s `chipsBadge` item (32px) with a 44px press area, and is announced as a radio
 * with its checked state.
 */
function FilterChip({
  label,
  count,
  selected,
  onPress,
  disabled,
  className,
  testID,
}: FilterChipProps) {
  const handleLayout = useFilterRowPrimaryChipLayout();
  const hasCount = count != null;
  const accessibleName = hasCount ? `${label} ${count}` : label;
  const textClassName = cn(
    "text-sm font-medium",
    selected ? "text-primary-foreground" : "text-muted-foreground",
  );

  return (
    <Pressable
      accessibilityLabel={accessibleName}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected, disabled }}
      aria-checked={selected}
      className={cn(
        "h-8 flex-row items-center justify-center gap-1 rounded-full border px-2.5",
        selected ? "border-primary bg-primary" : "border-border bg-card",
        !disabled && "active:opacity-70",
        disabled && "opacity-50",
        isWeb && "outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring",
        className,
      )}
      disabled={disabled}
      hitSlop={CHIP_HIT_SLOP}
      testID={testID}
      onLayout={handleLayout}
      onPress={onPress}
    >
      <PressableHitSlopArea hitSlop={CHIP_HIT_SLOP} />
      <Text
        className={textClassName}
        numberOfLines={1}
      >
        {label}
      </Text>
      {hasCount ? <Text className={cn(textClassName, "opacity-75")}>{count}</Text> : null}
    </Pressable>
  );
}

export { FilterChip };
export type { FilterChipProps };
