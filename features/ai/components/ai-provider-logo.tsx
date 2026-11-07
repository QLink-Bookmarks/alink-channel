import type * as React from "react";
import { View } from "react-native";

import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";
import { useDisplaySettings } from "@/stores/display-settings";

import { type AiProviderKind, getAiProviderName } from "../lib/provider-kind";

import { Image } from "expo-image";
import { cssInterop } from "nativewind";

cssInterop(Image, { className: "style" });

const LOGO_SOURCES = {
  claude: require("@/assets/ai-providers/claude.svg"),
  gemini: require("@/assets/ai-providers/gemini.svg"),
  openaiOnLight: require("@/assets/ai-providers/openai-on-light.svg"),
  openaiOnDark: require("@/assets/ai-providers/openai-on-dark.svg"),
};

const LOGO_SIZE_CLASS = { sm: "size-3.5", md: "size-4" } as const;

type AiProviderLogoProps = {
  kind: AiProviderKind;
  /** Defaults to the provider's own name (Gemini, Claude, OpenAI). */
  name?: string;
  size?: keyof typeof LOGO_SIZE_CLASS;
  className?: string;
  nameClassName?: string;
  /** Shown after the name in the same line, e.g. the model or a 기본 tag. */
  children?: React.ReactNode;
};

// A provider's official mark, always paired with its name. OpenAI's mark is black on
// light and white on dark, as its brand guide asks; Claude and Gemini keep their colors.
function AiProviderLogo({
  kind,
  name,
  size = "md",
  className,
  nameClassName,
  children,
}: AiProviderLogoProps) {
  const theme = useDisplaySettings((state) => state.display.theme);
  const source =
    kind === "openai"
      ? theme === "dark"
        ? LOGO_SOURCES.openaiOnDark
        : LOGO_SOURCES.openaiOnLight
      : LOGO_SOURCES[kind];

  return (
    <View
      className={cn("min-w-0 flex-row items-center gap-1.5", className)}
      testID="ai-provider-logo"
    >
      <Image
        accessible={false}
        className={LOGO_SIZE_CLASS[size]}
        contentFit="contain"
        source={source}
        testID={`ai-provider-logo-${kind}`}
      />
      <Text
        className={cn("shrink-0 font-semibold text-foreground", nameClassName)}
        numberOfLines={1}
      >
        {name ?? getAiProviderName(kind)}
      </Text>
      {children}
    </View>
  );
}

export { AiProviderLogo };
export type { AiProviderLogoProps };
