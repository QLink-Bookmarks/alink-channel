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
  // react-native-web presses on Space only for role button; a radio needs it too (web only).
  const spaceKeyProps = React.useMemo(
    () =>
      isWeb && !disabled
        ? ({
            onKeyDown: (event: { key: string; preventDefault: () => void }) => {
              if (event.key === " " || event.key === "Spacebar") {
                event.preventDefault();
                onPress();
              }
            },
          } as Record<string, unknown>)
        : {},
    [disabled, onPress],
  );
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
        "h-11 justify-center",
        !disabled && "active:opacity-70",
        disabled && "opacity-50",
        isWeb && "group outline-none focus-visible:z-20",
      )}
      disabled={disabled}
      testID={testID}
      onLayout={handleLayout}
      onPress={onPress}
      {...spaceKeyProps}
    >
      <View
        className={cn(
          "h-8 flex-row items-center justify-center gap-1 rounded-full border px-2.5",
          selected ? "border-primary bg-primary" : "border-border bg-card",
          isWeb &&
            "transition-colors group-focus-visible:ring-2 group-focus-visible:ring-ring group-focus-visible:ring-offset-2 group-focus-visible:ring-offset-background",
          className,
        )}
      >
        <Text
          className={textClassName}
          numberOfLines={1}
        >
          {label}
        </Text>
        {hasCount ? <Text className={cn(textClassName, "opacity-75")}>{count}</Text> : null}
      </View>
    </Pressable>
  );
}

export { FilterChip };
export type { FilterChipProps };
