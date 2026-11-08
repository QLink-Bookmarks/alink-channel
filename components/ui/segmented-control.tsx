import * as React from "react";
import { Platform, Pressable, type StyleProp, View, type ViewStyle } from "react-native";

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
  /** Locks every option (e.g. while saving) without dimming them; the caller dims the area. */
  disabled?: boolean;
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
  disabled = false,
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
      role={selectionMode === "single" ? "radiogroup" : "group"}
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
          locked={disabled}
          isChipVariant={isChipVariant}
          option={option}
          selected={selectedValues.includes(option.value)}
          selectionMode={selectionMode}
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
  selectionMode: SegmentedSelectionMode;
  variant: SegmentedVariant;
  isChipVariant: boolean;
  block?: boolean;
  hitSlop?: { top: number; bottom: number };
  locked: boolean;
  size: "md" | "sm";
  labelClassName?: string;
  tokens: ThemeTokens;
  onSelect: (value: string) => void;
};

const TRACK_SELECTED_SHADOW = "0 1px 2px rgba(0, 0, 0, 0.12)";

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
    // Web draws this shadow from a class instead, so the focus ring can stack on it.
    if (process.env.EXPO_OS !== "web") base.boxShadow = TRACK_SELECTED_SHADOW;
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
  selectionMode,
  variant,
  isChipVariant,
  block,
  hitSlop,
  locked,
  size,
  labelClassName,
  tokens,
  onSelect,
}: SegmentedItemProps) {
  const isDisabled = locked || option.disabled === true;
  const handlePress = React.useCallback(() => {
    onSelect(option.value);
  }, [onSelect, option.value]);

  // react-native-web presses on Space only for role button; a radio or checkbox needs it too.
  const spaceKeyProps = React.useMemo(
    () =>
      process.env.EXPO_OS === "web" && !isDisabled
        ? ({
            onKeyDown: (event: { key: string; repeat?: boolean; preventDefault: () => void }) => {
              if (event.key === " " || event.key === "Spacebar") {
                event.preventDefault();
                if (event.repeat) return;
                handlePress();
              }
            },
          } as Record<string, unknown>)
        : {},
    [handlePress, isDisabled],
  );

  const chipStyle = React.useMemo(
    () => buildChipStyle(variant, selected, isChipVariant, block, size, option.disabled, tokens),
    [block, isChipVariant, option.disabled, selected, size, tokens, variant],
  );

  return (
    <Pressable
      accessibilityRole={selectionMode === "single" ? "radio" : "checkbox"}
      aria-checked={selected}
      className={cn(
        !isDisabled && "active:opacity-70",
        selected && variant === "track" && "web:shadow-[0_1px_2px_rgba(0,0,0,0.12)]",
        Platform.select({ web: "outline-none focus-visible:ring-[3px] focus-visible:ring-ring" }),
      )}
      disabled={isDisabled}
      hitSlop={hitSlop}
      style={chipStyle}
      onPress={handlePress}
      {...spaceKeyProps}
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
    </Pressable>
  );
}

const SegmentedItem = React.memo(SegmentedItemBase);

export { SegmentedControl };
export type { SegmentedControlProps, SegmentedOption };
