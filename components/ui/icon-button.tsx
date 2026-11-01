import * as React from "react";
import { Platform, Pressable, View } from "react-native";

import { Icon } from "@/components/ui/icon";
import { type AccentName, DEFAULT_ACCENT, getThemeTokens } from "@/lib/theme";
import { cn } from "@/lib/utils";

import type { LucideIcon } from "lucide-react-native";

const iconButtonSizes = {
  sm: {
    button: "size-9",
    icon: 16,
  },
  md: {
    button: "size-11",
    icon: 18,
  },
  lg: {
    button: "size-14",
    icon: 22,
  },
} as const;

/**
 * Icon-only button.
 * - `solid`: tinted round button.
 * - `ghost`: transparent; hover, press and `active` lay a soft rounded-square background.
 *   Used for header actions (top bar, mobile header).
 */
function IconButton({
  className,
  icon,
  size = "md",
  variant = "solid",
  accent = DEFAULT_ACCENT,
  color,
  backgroundColor,
  active = false,
  disabled,
  style,
  ...props
}: React.ComponentProps<typeof Pressable> & {
  icon: LucideIcon;
  size?: keyof typeof iconButtonSizes;
  variant?: "solid" | "ghost";
  accent?: AccentName;
  color?: string;
  backgroundColor?: string;
  active?: boolean;
}) {
  const tokens = React.useMemo(() => getThemeTokens("light", accent), [accent]);
  const sizeConfig = iconButtonSizes[size];
  const isGhost = variant === "ghost";
  const solidIconColor = color ?? (active ? tokens.primaryForeground : tokens.primary);
  const solidPressedBackgroundColor = backgroundColor ?? tokens.primary;

  if (isGhost) {
    return (
      <Pressable
        accessibilityRole="button"
        className={cn(
          "items-center justify-center overflow-hidden rounded-xl bg-transparent",
          !disabled && "active:bg-accent",
          Platform.select({
            web: !disabled ? "transition-colors duration-150 ease-out hover:bg-accent" : undefined,
          }),
          sizeConfig.button,
          active && "bg-accent",
          disabled && "opacity-50",
          className,
        )}
        disabled={disabled}
        style={style}
        {...props}
      >
        <Icon
          as={icon}
          color={color}
          className={color ? undefined : active ? "text-primary" : "text-foreground"}
          size={sizeConfig.icon}
        />
      </Pressable>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      className={cn(
        "items-center justify-center overflow-hidden rounded-full",
        Platform.select({
          web: !disabled
            ? "transition-colors duration-150 ease-out hover:bg-primary focus-visible:bg-primary"
            : undefined,
        }),
        sizeConfig.button,
        active ? "bg-primary" : "bg-primary/10",
        disabled && "opacity-50",
        className,
      )}
      disabled={disabled}
      style={style}
      {...props}
    >
      {({ pressed }) => (
        <View
          className="items-center justify-center rounded-full"
          style={{
            backgroundColor: !disabled && pressed ? solidPressedBackgroundColor : "transparent",
            height: "100%",
            width: "100%",
          }}
        >
          <Icon
            as={icon}
            color={solidIconColor}
            size={sizeConfig.icon}
          />
        </View>
      )}
    </Pressable>
  );
}

export { IconButton };
