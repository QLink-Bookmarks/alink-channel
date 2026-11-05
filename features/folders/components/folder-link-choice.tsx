import * as React from "react";
import { Pressable, View } from "react-native";

import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";

import { type WebKeyDownEvent, getArrowKeyDelta, webKeyDownProps } from "../lib/web-key-down";

type FolderChoiceOption<Value extends string> = {
  value: Value;
  title: string;
  description?: string;
  isDestructive?: boolean;
  /** Leading content (e.g. an avatar) before the title. */
  leading?: React.ReactNode;
  /** Rendered inside the selected option's card, below the radio row (outside the radio). */
  selectedExtra?: React.ReactNode;
};

type FolderChoiceGroupProps<Value extends string> = {
  accessibilityLabel: string;
  value: Value | null;
  options: FolderChoiceOption<Value>[];
  disabled?: boolean;
  onValueChange: (value: Value) => void;
};

/**
 * Radio cards for the folder removal steps (link handling, new owner). The radio is
 * `components/ui/radio-group`, so arrow keys move the choice; the card row also selects.
 */
function FolderChoiceGroup<Value extends string>({
  accessibilityLabel,
  value,
  options,
  disabled = false,
  onValueChange,
}: FolderChoiceGroupProps<Value>) {
  const groupId = React.useId();

  // Radix moves the focus on arrow keys but its select-on-focus does not reach the
  // Pressable item on web, so the arrow key selects the option the focus moves to.
  const handleItemKeyDown = (index: number) => (event: WebKeyDownEvent) => {
    const delta = getArrowKeyDelta(event.nativeEvent?.key);
    if (delta === 0 || disabled || options.length === 0) {
      return;
    }
    const next = options[(index + delta + options.length) % options.length];
    onValueChange(next.value);
  };

  return (
    <RadioGroup
      aria-label={accessibilityLabel}
      className="gap-2"
      disabled={disabled}
      value={value ?? ""}
      onValueChange={(next) => {
        if (!disabled) {
          onValueChange(next as Value);
        }
      }}
    >
      {options.map((option, index) => {
        const isSelected = option.value === value;
        const titleId = `${groupId}-${option.value}-title`;
        const descriptionId = option.description ? `${groupId}-${option.value}-desc` : undefined;

        return (
          <View
            key={option.value}
            className={cn(
              "overflow-hidden rounded-xl border",
              isSelected ? "border-primary bg-primary/5" : "border-border",
            )}
          >
            <Pressable
              accessible={false}
              className={cn(
                "flex-row gap-3 px-3.5 py-3",
                option.description ? "items-start" : "items-center",
                !disabled && "active:bg-accent web:hover:bg-accent",
                disabled && "opacity-60",
              )}
              disabled={disabled}
              focusable={false}
              onPress={() => onValueChange(option.value)}
            >
              <RadioGroupItem
                aria-describedby={descriptionId}
                aria-labelledby={titleId}
                className={option.description ? "mt-0.5" : undefined}
                value={option.value}
                {...webKeyDownProps(handleItemKeyDown(index))}
              />
              {option.leading}
              <View className="min-w-0 flex-1 gap-0.5">
                <Text
                  className={cn(
                    "text-[14.5px] font-semibold",
                    option.isDestructive ? "text-destructive" : "text-foreground",
                  )}
                  nativeID={titleId}
                >
                  {option.title}
                </Text>
                {option.description ? (
                  <Text
                    className={cn(
                      "text-[13px] leading-[19px]",
                      isSelected ? "text-foreground/80" : "text-muted-foreground",
                    )}
                    nativeID={descriptionId}
                  >
                    {option.description}
                  </Text>
                ) : null}
              </View>
            </Pressable>
            {isSelected && option.selectedExtra ? (
              <View className="pb-3 pl-[42px] pr-3.5">{option.selectedExtra}</View>
            ) : null}
          </View>
        );
      })}
    </RadioGroup>
  );
}

export { FolderChoiceGroup };
export type { FolderChoiceGroupProps, FolderChoiceOption };
