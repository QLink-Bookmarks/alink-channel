import { ActivityIndicator as RNActivityIndicator, View } from "react-native";

import { getThemeTokens } from "@/lib/theme";
import { cn } from "@/lib/utils";
import { useDisplaySettings } from "@/stores/display-settings";

type ActivityIndicatorTone = "primary" | "onPrimary";

type ActivityIndicatorProps = {
  size?: "small" | "large";
  tone?: ActivityIndicatorTone;
  accessibilityLabel?: string;
  className?: string;
};

function ActivityIndicator({
  size = "small",
  tone = "primary",
  accessibilityLabel,
  className,
}: ActivityIndicatorProps) {
  const accent = useDisplaySettings((state) => state.display.accent);
  const theme = useDisplaySettings((state) => state.display.theme);
  const tokens = getThemeTokens(theme, accent);

  return (
    <View className={cn("items-center justify-center", className)}>
      <RNActivityIndicator
        accessibilityLabel={accessibilityLabel}
        size={size}
        color={tone === "onPrimary" ? tokens.primaryForeground : tokens.primary}
      />
    </View>
  );
}

export { ActivityIndicator };
export type { ActivityIndicatorProps, ActivityIndicatorTone };
