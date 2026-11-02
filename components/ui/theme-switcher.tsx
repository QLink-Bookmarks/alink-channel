import { Pressable, View } from "react-native";

import { Button } from "@/components/ui/button";
import { Emoji } from "@/components/ui/emoji";
import { Switch } from "@/components/ui/switch";
import { Text } from "@/components/ui/text";
import { ACCENT_OPTIONS, accentSwatchClasses } from "@/lib/accent";
import { type AccentName, DEFAULT_ACCENT, type ThemeMode } from "@/lib/theme";
import { cn } from "@/lib/utils";

type ThemeSwitcherVariant = "icon-buttons" | "switch";

const ACCENT_LABELS: Record<AccentName, string> = {
  gray: "회색",
  pink: "분홍",
  blue: "파랑",
};

function ThemeSwitcher({
  className,
  accent,
  mode = "light",
  variant = "icon-buttons",
  onAccentChange,
  onModeChange,
  ...props
}: React.ComponentProps<typeof View> & {
  accent?: AccentName;
  mode?: ThemeMode;
  variant?: ThemeSwitcherVariant;
  onAccentChange?: (accent: AccentName) => void;
  onModeChange?: (mode: ThemeMode) => void;
}) {
  const resolvedAccent = accent ?? DEFAULT_ACCENT;
  const isDark = mode === "dark";
  const modeOptions: { emoji: string; key: ThemeMode; label: string }[] = [
    { emoji: "☀️", key: "light", label: "Light" },
    { emoji: "🌙", key: "dark", label: "Dark" },
  ];

  return (
    <View
      className={cn("gap-3 rounded-2xl border border-border bg-card p-3", className)}
      {...props}
    >
      <View className="flex-row items-center justify-between gap-3">
        <View
          accessibilityLabel="강조색"
          accessibilityRole="radiogroup"
          className="flex-row gap-2"
        >
          {ACCENT_OPTIONS.map((option) => (
            <Pressable
              key={option}
              accessibilityLabel={`강조색 ${ACCENT_LABELS[option]}`}
              accessibilityRole="radio"
              aria-checked={option === resolvedAccent}
              className={cn(
                "size-5 items-center justify-center rounded-full",
                option === resolvedAccent
                  ? cn("border-2 border-foreground bg-card", accentSwatchClasses.swatch[option])
                  : "border border-border-soft bg-transparent",
              )}
              onPress={() => onAccentChange?.(option)}
            >
              <View className={cn("size-4 rounded-full", accentSwatchClasses.swatch[option])} />
            </Pressable>
          ))}
        </View>

        {variant === "icon-buttons" ? (
          <View className="flex-row gap-1">
            {modeOptions.map((option) => {
              const isActive = option.key === mode;

              return (
                <Button
                  key={option.key}
                  className={cn(
                    "border bg-transparent shadow-none sm:h-6 sm:w-6",
                    isActive
                      ? "border-primary bg-accent/60 dark:bg-accent/70"
                      : "border-border bg-transparent",
                  )}
                  size="icon"
                  variant="ghost"
                  onPress={() => onModeChange?.(option.key)}
                >
                  <Text
                    className={cn(
                      "text-sm",
                      isActive ? "text-accent-foreground" : "text-foreground",
                    )}
                  >
                    {option.emoji}
                  </Text>
                </Button>
              );
            })}
          </View>
        ) : null}

        {variant === "switch" ? (
          <Switch
            accessibilityLabel="다크 모드"
            checked={isDark}
            thumbContent={<Emoji className="text-2xs">{isDark ? "🌙" : "☀️"}</Emoji>}
            onCheckedChange={(checked) => onModeChange?.(checked ? "dark" : "light")}
          />
        ) : null}
      </View>
    </View>
  );
}

export { ThemeSwitcher };
export type { ThemeSwitcherVariant };
