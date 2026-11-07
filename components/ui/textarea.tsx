import * as React from "react";
import { Platform, TextInput } from "react-native";

import { useIsInsideSheet } from "@/components/layout/sheet";
import { getThemeTokens } from "@/lib/theme";
import { cn } from "@/lib/utils";
import { useDisplaySettings } from "@/stores/display-settings";
import { BottomSheetTextInput } from "@gorhom/bottom-sheet";

import { useControlledValueMirror } from "./use-controlled-value-mirror";

const Textarea = React.forwardRef<
  TextInput,
  React.ComponentProps<typeof TextInput> & { variant?: "default" | "memo" }
>(function Textarea(
  {
    className,
    variant = "default",
    multiline = true,
    numberOfLines = Platform.select({ web: 2, native: 8 }), // On web, numberOfLines also determines initial height. On native, it determines the maximum height.
    onBlur,
    onFocus,
    onChangeText,
    value,
    defaultValue,
    placeholderClassName,
    style,
    ...props
  },
  ref,
) {
  const accent = useDisplaySettings((state) => state.display.accent);
  const theme = useDisplaySettings((state) => state.display.theme);
  const tokens = React.useMemo(() => getThemeTokens(theme, accent), [accent, theme]);
  const [isFocused, setIsFocused] = React.useState(false);

  // Match the Input primitive: swap to BottomSheetTextInput inside a sheet so the
  // native Korean IME doesn't drop/split composition, and mirror the controlled
  // value so web IME composition doesn't duplicate characters.
  const isInsideSheet = useIsInsideSheet();
  // Swap to BottomSheetTextInput only on native: it fixes the sheet's IME
  // composition there, but on web it drops the className (transparent background)
  // and web has no such IME issue. (Mirrors why Input has a separate web variant.)
  const TextInputComponent = (isInsideSheet && process.env.EXPO_OS !== "web"
    ? BottomSheetTextInput
    : TextInput) as unknown as typeof TextInput;
  const { inputValue, inputDefaultValue, handleChangeText } = useControlledValueMirror({
    value,
    defaultValue,
    onChangeText,
  });

  return (
    <TextInputComponent
      ref={ref}
      className={cn(
        "scrollbar-none flex min-h-16 w-full flex-row rounded-md border border-input px-3 py-2 text-base text-foreground shadow-sm shadow-black/5 dark:bg-input/30 md:text-sm",
        variant === "memo" ? "bg-surface-elevated" : "bg-transparent",
        Platform.select({
          web: "aria-invalid:ring-destructive aria-invalid:border-destructive field-sizing-content resize-y outline-none transition-[color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring disabled:cursor-not-allowed",
        }),
        props.editable === false && "opacity-50",
        className,
      )}
      onBlur={(event) => {
        setIsFocused(false);
        onBlur?.(event);
      }}
      onFocus={(event) => {
        setIsFocused(true);
        onFocus?.(event);
      }}
      onChangeText={handleChangeText}
      value={inputValue}
      defaultValue={inputDefaultValue}
      placeholderClassName={cn("text-muted-foreground", placeholderClassName)}
      multiline={multiline}
      numberOfLines={numberOfLines}
      style={[
        Platform.OS !== "web" && isFocused
          ? {
              borderColor: tokens.ring,
              borderWidth: 1.5,
              boxShadow: `0 0 0 3px ${tokens.primary}26`,
            }
          : undefined,
        style,
      ]}
      textAlignVertical="top"
      {...props}
    />
  );
});

export { Textarea };
