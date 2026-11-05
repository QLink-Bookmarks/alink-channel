import type { AccentName, ThemeMode } from "@/lib/theme";

const DARK_PINK_TEXT_CLASS_NAME = "text-[#c20047]";

function getSaveLabelClassName(accent: AccentName, theme: ThemeMode) {
  return accent === "pink" && theme === "light"
    ? DARK_PINK_TEXT_CLASS_NAME
    : "text-accent-foreground";
}

export { getSaveLabelClassName };
