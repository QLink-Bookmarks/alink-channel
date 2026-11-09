import "./global.css";

import * as React from "react";
import { AppRegistry } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider, initialWindowMetrics } from "react-native-safe-area-context";

import { getNativeThemeVars } from "@/lib/theme-vars";

import { ShareSheet } from "./share/share-sheet";
import { ShareThemeContext, useSystemShareTheme } from "./share/share-theme";

import { useColorScheme as useNativeWindColorScheme, vars } from "nativewind";

function ShareExtension(props: { url?: string; text?: string; preprocessingResults?: unknown }) {
  const theme = useSystemShareTheme();
  const { setColorScheme } = useNativeWindColorScheme();
  const themeVars = React.useMemo(
    () => vars(getNativeThemeVars(theme.mode, theme.accent)),
    [theme.accent, theme.mode],
  );

  React.useEffect(() => {
    setColorScheme(theme.mode);
  }, [setColorScheme, theme.mode]);

  return (
    <ShareThemeContext value={theme}>
      <GestureHandlerRootView
        className="flex-1 bg-transparent"
        style={[{ flex: 1, backgroundColor: "transparent" }, themeVars]}
      >
        <SafeAreaProvider
          initialMetrics={initialWindowMetrics}
          style={{ backgroundColor: "transparent" }}
        >
          <ShareSheet {...props} />
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ShareThemeContext>
  );
}

AppRegistry.registerComponent("shareExtension", () => ShareExtension);
