import * as React from "react";
import { type Insets, Platform, Pressable, View } from "react-native";

import { Icon } from "@/components/ui/icon";
import { type AccentName, DEFAULT_ACCENT, getThemeTokens } from "@/lib/theme";
import { cn } from "@/lib/utils";

import type { LucideIcon } from "lucide-react-native";

const isWeb = process.env.EXPO_OS === "web";

type HitSlop = React.ComponentProps<typeof Pressable>["hitSlop"];

/**
 * Offsets of the web press area for a `hitSlop`: a number widens every side, an `Insets` object
 * only the sides it names. No slop gives no area (`null`).
 */
function getHitSlopAreaStyle(
  hitSlop: HitSlop,
): { top: number; right: number; bottom: number; left: number } | null {
  if (hitSlop == null) {
    return null;
  }
  const insets: Insets =
    typeof hitSlop === "number"
      ? { top: hitSlop, right: hitSlop, bottom: hitSlop, left: hitSlop }
      : hitSlop;
  const outward = (side?: number) => (side ? -side : 0);
  return {
    top: outward(insets.top),
    right: outward(insets.right),
    bottom: outward(insets.bottom),
    left: outward(insets.left),
  };
}

/**
 * Web stand-in for `hitSlop`. react-native-web's `Pressable` ignores `hitSlop`, so this renders a
 * transparent area that reaches past the pressable by the slop; presses on it bubble to the
 * pressable while its visible size and layout stay the same. Render it as the pressable's first
 * child, and keep the pressable free of `overflow-hidden`. Native returns nothing: `Pressable`
 * applies `hitSlop` itself there.
 */
function PressableHitSlopArea({ hitSlop }: { hitSlop?: HitSlop }) {
  const areaStyle = getHitSlopAreaStyle(hitSlop);
  if (!isWeb || !areaStyle) {
    return null;
  }
  return (
    <View
      aria-hidden
      className="absolute"
      style={areaStyle}
    />
  );
}

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
 * `hitSlop` widens the press area on every platform (on web through `PressableHitSlopArea`) without
 * changing the visible size. Header icon buttons pass `hitSlop={4}` (36px → 44×44).
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
  hitSlop,
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
  // The web hit area reaches past the button, so it must not be clipped.
  const hasWebHitSlop = isWeb && hitSlop != null;

  if (isGhost) {
    return (
      <Pressable
        accessibilityRole="button"
        className={cn(
          "items-center justify-center rounded-xl bg-transparent",
          !hasWebHitSlop && "overflow-hidden",
          !disabled && "active:bg-accent",
          Platform.select({
            web: cn(
              "outline-none focus-visible:ring-[3px] focus-visible:ring-ring",
              !disabled && "transition-colors duration-150 ease-out hover:bg-accent",
            ),
          }),
          sizeConfig.button,
          active && "bg-accent",
          disabled && "opacity-50",
          className,
        )}
        disabled={disabled}
        hitSlop={hitSlop}
        style={style}
        {...props}
      >
        <PressableHitSlopArea hitSlop={hitSlop} />
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
        "items-center justify-center rounded-full",
        !hasWebHitSlop && "overflow-hidden",
        Platform.select({
          web: cn(
            "outline-none focus-visible:ring-[3px] focus-visible:ring-ring",
            !disabled &&
              "transition-colors duration-150 ease-out hover:bg-primary focus-visible:bg-primary",
          ),
        }),
        sizeConfig.button,
        active ? "bg-primary" : "bg-primary/10",
        disabled && "opacity-50",
        className,
      )}
      disabled={disabled}
      hitSlop={hitSlop}
      style={style}
      {...props}
    >
      {({ pressed }) => (
        <>
          <PressableHitSlopArea hitSlop={hitSlop} />
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
        </>
      )}
    </Pressable>
  );
}

export { IconButton, PressableHitSlopArea, getHitSlopAreaStyle };
