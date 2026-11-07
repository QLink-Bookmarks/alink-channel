import * as React from "react";
import { useColorScheme } from "react-native";

import { type AccentName, type ThemeMode, type ThemeTokens, getThemeTokens } from "@/lib/theme";

type ShareTheme = {
  mode: ThemeMode;
  accent: AccentName;
  tokens: ThemeTokens;
};

const SHARE_ACCENT: AccentName = "gray";

const ShareThemeContext = React.createContext<ShareTheme>({
  mode: "light",
  accent: SHARE_ACCENT,
  tokens: getThemeTokens("light", SHARE_ACCENT),
});

function useSystemShareTheme(): ShareTheme {
  const scheme = useColorScheme();
  const mode: ThemeMode = scheme === "dark" ? "dark" : "light";
  return React.useMemo(
    () => ({ mode, accent: SHARE_ACCENT, tokens: getThemeTokens(mode, SHARE_ACCENT) }),
    [mode],
  );
}

function useShareTheme(): ShareTheme {
  return React.use(ShareThemeContext);
}

export { SHARE_ACCENT, ShareThemeContext, useShareTheme, useSystemShareTheme };
export type { ShareTheme };
