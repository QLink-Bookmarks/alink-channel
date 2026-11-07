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

type SegmentedVariant = "chips" | "chipsBadge" | "chipsRound" | "pills" | "cells";
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

function isChipVariantName(variant: SegmentedVariant) {
  return variant === "chips" || variant === "chipsRound" || variant === "chipsBadge";
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
        block && "w-full",
        className,
      )}
      {...props}
    >
      {options.map((option) => (
        <SegmentedItem
          key={option.value}
          block={block}
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
  size: "md" | "sm";
  labelClassName?: string;
  tokens: ThemeTokens;
  onSelect: (value: string) => void;
};

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
    minHeight: size === "sm" ? 32 : 36,
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
  } else if (variant === "chips") {
    base.minHeight = size === "sm" ? 28 : 32;
    base.borderRadius = 8;
    base.borderWidth = 1;
    base.borderColor = tokens.border;
    base.backgroundColor = tokens.card;
    base.paddingHorizontal = 10;
  } else if (variant === "chipsRound") {
    base.minHeight = size === "sm" ? 28 : 32;
    base.borderRadius = 12;
    base.borderWidth = 1;
    base.borderColor = tokens.border;
    base.backgroundColor = tokens.card;
    base.paddingHorizontal = 10;
  } else if (variant === "chipsBadge") {
    base.minHeight = size === "sm" ? 28 : 32;
    base.borderRadius = 9999;
    base.borderWidth = 1;
    base.borderColor = tokens.border;
    base.backgroundColor = tokens.card;
    base.paddingHorizontal = 10;
  }

  if (selected) {
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
      activeOpacity={0.7}
      className={Platform.select({
        web: "outline-none focus-visible:ring-[3px] focus-visible:ring-ring",
      })}
      disabled={option.disabled}
      style={chipStyle}
      onPress={handlePress}
    >
      <Text
        className={cn("text-sm font-medium", labelClassName)}
        style={{
          color: selected ? tokens.primaryForeground : tokens.mutedForeground,
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
