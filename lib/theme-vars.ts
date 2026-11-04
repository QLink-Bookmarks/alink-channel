import { type AccentName, type ThemeMode, getThemeTokens } from "./theme";

// Strip "hsl(...)" / "hsla(...)" wrappers so the values can be re-wrapped by Tailwind's
// `hsl(var(--accent))` definitions in tailwind.config.js. Non-color tokens pass through.
function stripHslWrapper(value: string): string {
  const trimmed = value.trim();
  const match = trimmed.match(/^hsla?\((.*)\)$/i);
  return match ? match[1].trim() : trimmed;
}

// Native CSS-var resolution can't deal with `rem` units inside `calc()` (e.g.
// `rounded-2xl` is `calc(var(--radius) - 2px)` — on web the browser resolves
// `0.875rem` to a pixel value, on RN the calc silently collapses to 0 and every
// rounded-* token loses its radius). Convert any `rem` token to a px string so
// downstream calc() expressions work natively. 1rem = 16px to match the web
// default rather than RN's font-scale-dependent rem.
function remToPx(value: string): string {
  return value.replace(/(-?\d*\.?\d+)rem\b/g, (_, num) => `${parseFloat(num) * 16}px`);
}

function normalizeNativeValue(value: string): string {
  return remToPx(stripHslWrapper(value));
}

function camelToKebab(key: string): string {
  return key
    .replace(/([a-z])([A-Z])/g, "$1-$2")
    .replace(/([a-zA-Z])([0-9])/g, "$1-$2")
    .toLowerCase();
}

// CSS variables that are defined in global.css and that we want to mirror natively.
// Anything not in this set is skipped — the corresponding camelCase keys in THEME
// (gradPrimary, shadowSm, iconTint, …) don't have a `--var` counterpart and would
// only add noise to the inline style.
const NATIVE_VAR_KEYS = new Set<string>([
  "background",
  "foreground",
  "card",
  "cardForeground",
  "popover",
  "popoverForeground",
  "primary",
  "primary2",
  "primaryForeground",
  "secondary",
  "secondaryForeground",
  "muted",
  "mutedForeground",
  "accent",
  "accentForeground",
  "accentYellow",
  "destructive",
  "destructiveForeground",
  "destructiveText",
  "border",
  "borderSoft",
  "input",
  "ring",
  "chart1",
  "chart2",
  "chart3",
  "chart4",
  "chart5",
  "sidebar",
  "sidebarForeground",
  "sidebarPrimary",
  "sidebarPrimaryForeground",
  "sidebarAccent",
  "sidebarAccentForeground",
  "sidebarBorder",
  "sidebarRing",
  "sidebarTextMuted",
  "sidebarTextHover",
  "sidebarSurface2",
  "success",
  "successForeground",
  "successText",
  "warning",
  "warningForeground",
  "warningText",
  "surface",
  "surfaceElevated",
  "overlay",
  "glowRgb",
  "buttonWidthXs",
  "buttonWidthSm",
  "buttonWidthDefault",
  "buttonWidthLg",
]);

function getNativeThemeVars(mode: ThemeMode, accent: AccentName): Record<string, string> {
  const tokens = getThemeTokens(mode, accent);
  const entries: [string, string][] = [];
  for (const [key, rawValue] of Object.entries(tokens)) {
    if (!NATIVE_VAR_KEYS.has(key)) {
      continue;
    }
    const varName = `--${camelToKebab(key)}`;
    entries.push([varName, normalizeNativeValue(rawValue)]);
  }
  return Object.fromEntries(entries);
}

export { getNativeThemeVars };
