import type { AccentName, ThemeMode } from "./theme";
import { getNativeThemeVars } from "./theme-vars";

import { readFileSync } from "node:fs";
import { join } from "node:path";

const CSS = readFileSync(join(__dirname, "..", "global.css"), "utf8");

function readBlock(selector: string): Record<string, string> {
  const start = CSS.indexOf(`${selector} {`);
  if (start < 0) {
    throw new Error(`missing ${selector}`);
  }
  const body = CSS.slice(start + selector.length + 2, CSS.indexOf("}", start));
  return Object.fromEntries(
    Array.from(body.matchAll(/--([\w-]+):\s*([^;]+);/g), (match) => [
      `--${match[1]}`,
      match[2].trim(),
    ]),
  );
}

function cssTokens(mode: ThemeMode, accent: AccentName): Record<string, string> {
  const root = mode === "dark" ? ".dark:root" : ":root";
  const base = readBlock(root);
  return accent === "gray" ? base : { ...base, ...readBlock(`${root}[data-accent="${accent}"]`) };
}

function normalize(value: string): string {
  return value
    .replace(/(-?\d*\.?\d+)rem\b/g, (_, num) => `${parseFloat(num) * 16}px`)
    .replace(/\s+/g, " ")
    .trim();
}

const CASES: [ThemeMode, AccentName][] = [
  ["light", "gray"],
  ["dark", "gray"],
  ["light", "pink"],
  ["dark", "pink"],
  ["light", "blue"],
  ["dark", "blue"],
];

describe("native theme vars mirror global.css", () => {
  it.each(CASES)("%s %s: every mirrored token has the global.css value", (mode, accent) => {
    const css = cssTokens(mode, accent);
    const native = getNativeThemeVars(mode, accent);
    const mismatches = Object.entries(native)
      .filter(([name]) => name in css)
      .filter(([name, value]) => normalize(value) !== normalize(css[name]))
      .map(([name, value]) => `${name}: native ${value} / css ${css[name]}`);
    expect(mismatches).toEqual([]);
  });

  it.each(CASES)("%s %s: the sidebar tokens are mirrored", (mode, accent) => {
    const native = getNativeThemeVars(mode, accent);
    for (const name of [
      "--sidebar-text-muted",
      "--sidebar-text-hover",
      "--sidebar-accent-foreground",
      "--sidebar-surface-2",
    ]) {
      expect(native[name]).toBe(normalize(cssTokens(mode, accent)[name]));
    }
  });
});
