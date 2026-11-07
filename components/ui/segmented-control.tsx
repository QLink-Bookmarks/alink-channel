import * as React from "react";
import { Platform, type StyleProp, TouchableOpacity, View, type ViewStyle } from "react-native";

import { Text } from "@/components/ui/text";
import { type ThemeTokens, getThemeTokens } from "@/lib/theme";
import { cn } from "@/lib/utils";
import { useDisplaySettings } from "@/stores/display-settings";

type SegmentedOption = {
  label: string;
  value: string;
  disabled?: boolean;
};

type SegmentedVariant = "chips" | "chipsBadge" | "chipsRound" | "pills" | "cells" | "track";
type SegmentedSelectionMode = "single" | "multiple";

type SegmentedControlProps = React.ComponentProps<typeof View> & {
  value: string | string[];
  options: SegmentedOption[];
  variant?: SegmentedVariant;
  selectionMode?: SegmentedSelectionMode;
  block?: boolean;
  size?: "md" | "sm";
  labelClassName?: string;
  onValueChange?: (value: string | string[]) => void;
};

const MIN_TOUCH_SIZE = 44;

function isChipVariantName(variant: SegmentedVariant) {
  return variant === "chips" || variant === "chipsRound" || variant === "chipsBadge";
}

function getItemMinHeight(variant: SegmentedVariant, size: "md" | "sm") {
  if (variant === "track") {
    return 32;
  }
  if (isChipVariantName(variant)) {
    return size === "sm" ? 28 : 32;
  }
  return size === "sm" ? 32 : 36;
}

/** Space between the container's edge and its items: padding plus the 1px border. */
function getContainerInset(variant: SegmentedVariant) {
  if (variant === "track") {
    return 4;
  }
  return isChipVariantName(variant) ? 1 : 5;
}

/**
 * Vertical hit slop that makes every item at least 44pt tall to touch without changing the
 * layout; the container gets the part that falls outside its own bounds. Native only — web
 * ignores `hitSlop`. Touches outside a parent's bounds are dropped, so the ancestors must
 * leave room for the slop (e.g. a 44pt-tall row around the control).
 */
function getTouchSlop(variant: SegmentedVariant, size: "md" | "sm") {
  const item = Math.max(0, Math.ceil((MIN_TOUCH_SIZE - getItemMinHeight(variant, size)) / 2));
  const container = Math.max(0, item - getContainerInset(variant));
  return {
    container: container > 0 ? { top: container, bottom: container } : undefined,
    item: item > 0 ? { top: item, bottom: item } : undefined,
  };
}

function SegmentedControl({
  value,
  options,
  variant = "pills",
  selectionMode = "single",
  block,
  size = "md",
  className,
  labelClassName,
  onValueChange,
  ...props
}: SegmentedControlProps) {
  const isChipVariant = isChipVariantName(variant);
  const theme = useDisplaySettings((state) => state.display.theme);
  const accent = useDisplaySettings((state) => state.display.accent);
  const tokens = React.useMemo(() => getThemeTokens(theme, accent), [theme, accent]);
  const selectedValues = React.useMemo(() => (Array.isArray(value) ? value : [value]), [value]);
  const touchSlop = React.useMemo(() => getTouchSlop(variant, size), [size, variant]);

  const handleSelect = React.useCallback(
    (optionValue: string) => {
      if (selectionMode === "multiple") {
        const isSelected = selectedValues.includes(optionValue);
        const nextValue = isSelected
          ? selectedValues.filter((current) => current !== optionValue)
          : [...selectedValues, optionValue];
        onValueChange?.(nextValue);
        return;
      }

      onValueChange?.(optionValue);
    },
    [onValueChange, selectedValues, selectionMode],
  );

  return (
    <View
      className={cn(
        "flex-row gap-1 rounded-2xl border border-border bg-surface-elevated p-1",
        isChipVariant && "border-transparent bg-transparent p-0",
        variant === "track" && "rounded-xl border-transparent bg-muted p-[3px]",
        block && "w-full",
        className,
      )}
      hitSlop={touchSlop.container}
      {...props}
    >
      {options.map((option) => (
        <SegmentedItem
          key={option.value}
          block={block}
          hitSlop={touchSlop.item}
          isChipVariant={isChipVariant}
          option={option}
          selected={selectedValues.includes(option.value)}
          labelClassName={labelClassName}
          size={size}
          tokens={tokens}
          variant={variant}
          onSelect={handleSelect}
        />
      ))}
    </View>
  );
}

type SegmentedItemProps = {
  option: SegmentedOption;
  selected: boolean;
  variant: SegmentedVariant;
  isChipVariant: boolean;
  block?: boolean;
  hitSlop?: { top: number; bottom: number };
  size: "md" | "sm";
  labelClassName?: string;
  tokens: ThemeTokens;
  onSelect: (value: string) => void;
};

/**
 * Each item is a button that screen readers announce with its selected state: `aria-pressed`
 * on web (react-native-web renders a `<button>`), the selected trait on iOS. Native
 * `TouchableOpacity` forwards only `accessibilityRole`, not `role`.
 */
function getItemAccessibility(selected: boolean) {
  if (process.env.EXPO_OS === "web") {
    return { role: "button" as const, "aria-pressed": selected };
  }
  return { accessibilityRole: "button" as const, "aria-selected": selected };
}

function buildChipStyle(
  variant: SegmentedVariant,
  selected: boolean,
  isChipVariant: boolean,
  block: boolean | undefined,
  size: "md" | "sm",
  disabled: boolean | undefined,
  tokens: ThemeTokens,
): StyleProp<ViewStyle> {
  const base: ViewStyle = {
    minHeight: getItemMinHeight(variant, size),
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    paddingHorizontal: 12,
  };

  if (block) {
    base.flex = 1;
  }

  if (variant === "cells") {
    base.borderRadius = 8;
  } else if (variant === "track") {
    base.borderRadius = 9;
  } else if (variant === "chips") {
    base.borderRadius = 8;
    base.borderWidth = 1;
    base.borderColor = tokens.border;
    base.backgroundColor = tokens.card;
    base.paddingHorizontal = 10;
  } else if (variant === "chipsRound") {
    base.borderRadius = 12;
    base.borderWidth = 1;
    base.borderColor = tokens.border;
    base.backgroundColor = tokens.card;
    base.paddingHorizontal = 10;
  } else if (variant === "chipsBadge") {
    base.borderRadius = 9999;
    base.borderWidth = 1;
    base.borderColor = tokens.border;
    base.backgroundColor = tokens.card;
    base.paddingHorizontal = 10;
  }

  if (selected && variant === "track") {
    base.backgroundColor = tokens.card;
    base.boxShadow = "0 1px 2px rgba(0, 0, 0, 0.12)";
  } else if (selected) {
    base.backgroundColor = tokens.primary;
    if (isChipVariant) {
      base.borderColor = tokens.primary;
    }
  }

  if (disabled) {
    base.opacity = 0.5;
  }

  return base;
}

function SegmentedItemBase({
  option,
  selected,
  variant,
  isChipVariant,
  block,
  hitSlop,
  size,
  labelClassName,
  tokens,
  onSelect,
}: SegmentedItemProps) {
  const handlePress = React.useCallback(() => {
    onSelect(option.value);
  }, [onSelect, option.value]);

  const chipStyle = React.useMemo(
    () => buildChipStyle(variant, selected, isChipVariant, block, size, option.disabled, tokens),
    [block, isChipVariant, option.disabled, selected, size, tokens, variant],
  );

  return (
    <TouchableOpacity
      {...getItemAccessibility(selected)}
      activeOpacity={0.7}
      className={Platform.select({
        web: "outline-none focus-visible:ring-[3px] focus-visible:ring-ring",
      })}
      disabled={option.disabled}
      hitSlop={hitSlop}
      style={chipStyle}
      onPress={handlePress}
    >
      <Text
        className={cn("text-sm font-medium", labelClassName)}
        style={{
          color: selected
            ? variant === "track"
              ? tokens.foreground
              : tokens.primaryForeground
            : tokens.mutedForeground,
        }}
      >
        {option.label}
      </Text>
    </TouchableOpacity>
  );
}

const SegmentedItem = React.memo(SegmentedItemBase);

export { SegmentedControl };
export type { SegmentedControlProps, SegmentedOption };
