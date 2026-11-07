import * as React from "react";
import { Pressable, View } from "react-native";

import { useFilterRowPrimaryChipLayout } from "@/components/ui/filter-cover-row";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";

const isWeb = process.env.EXPO_OS === "web";

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
 * `SegmentedControl`'s `chipsBadge` item (32px), but the press area is 44px tall and it is announced
 * as a radio with its checked state.
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

  return (
    <Pressable
      accessibilityLabel={accessibleName}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected, disabled }}
      aria-checked={selected}
      className={cn(
        "rounded-full py-1.5",
        isWeb && "outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
      disabled={disabled}
      testID={testID}
      onLayout={handleLayout}
      onPress={onPress}
    >
      {({ pressed }) => (
        <View
          className={cn(
            "h-8 flex-row items-center justify-center gap-1 rounded-full border px-2.5",
            selected ? "border-primary bg-primary" : "border-border bg-card",
            pressed && "opacity-70",
            disabled && "opacity-50",
          )}
        >
          <Text
            className={cn(
              "text-sm font-medium",
              selected ? "text-primary-foreground" : "text-muted-foreground",
            )}
            numberOfLines={1}
          >
            {label}
          </Text>
          {hasCount ? (
            <Text
              className={cn(
                "text-sm font-medium opacity-75",
                selected ? "text-primary-foreground" : "text-muted-foreground",
              )}
            >
              {count}
            </Text>
          ) : null}
        </View>
      )}
    </Pressable>
  );
}

export { FilterChip };
export type { FilterChipProps };
