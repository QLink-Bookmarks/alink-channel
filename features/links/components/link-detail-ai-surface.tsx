import * as React from "react";
import { type AccessibilityActionEvent, View } from "react-native";

import { Text } from "@/components/ui/text";
import { AiProviderLogo } from "@/features/ai/components/ai-provider-logo";
import { getAiProviderKind } from "@/features/ai/lib/provider-kind";
import { openLinkUrl } from "@/features/links/lib/open-link-url";
import type { LinkStatus } from "@/features/links/types";

import { ExcerptContinueLink } from "./excerpt-continue-link";

// The action's name is what VoiceOver reads, so it is the visible link's wording.
const OPEN_ORIGINAL_ACTION = "이어 읽기";

/**
 * Native: VoiceOver cannot reach an inline view inside a Text, so the excerpt paragraph
 * offers "이어 읽기" as a custom action that opens the original.
 */
function getExcerptAccessibilityProps(url: string) {
  return {
    accessibilityActions: [{ name: OPEN_ORIGINAL_ACTION }],
    onAccessibilityAction: (event: AccessibilityActionEvent) => {
      if (event.nativeEvent.actionName === OPEN_ORIGINAL_ACTION) {
        openLinkUrl(url);
      }
    },
  };
}

function SurfaceHeading({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <View className="min-h-5 flex-row items-center justify-between gap-3">
      <Text
        aria-level={2}
        className="text-xs font-semibold text-muted-foreground"
        role="heading"
      >
        {title}
      </Text>
      {children}
    </View>
  );
}

// `[logo] Gemini · gemini-2.5-flash`: the logo is picked from the model name.
function SummaryModel({ workModel }: { workModel: string }) {
  return (
    <View
      className="min-w-0 shrink"
      testID="link-detail-summary-model"
    >
      <AiProviderLogo
        kind={getAiProviderKind(workModel)}
        nameClassName="text-xs text-muted-foreground"
        size="sm"
      >
        <Text className="text-xs text-muted-foreground">·</Text>
        <Text
          className="min-w-0 shrink text-xs text-muted-foreground"
          numberOfLines={1}
        >
          {workModel}
        </Text>
      </AiProviderLogo>
    </View>
  );
}

/**
 * The page excerpt: muted text with an inline "이어 읽기" link right after the trailing "…"
 * that opens the original.
 */
function DetailExcerpt({ excerpt, url }: { excerpt: string; url: string }) {
  return (
    <Text
      selectable
      {...(process.env.EXPO_OS === "web" ? {} : getExcerptAccessibilityProps(url))}
      // Native: the bottom padding (cancelled by the negative margin) lets the inline link's
      // hitSlop reach below the last line; touches outside the paragraph never reach it.
      className="native:-mb-3 native:pb-3 text-[13px] leading-5 text-muted-foreground"
      lineBreakStrategyIOS="hangul-word"
      testID="link-detail-excerpt-text"
    >
      {excerpt} <ExcerptContinueLink url={url} />
    </Text>
  );
}

type LinkDetailAiSurfaceProps = {
  url: string;
  summary?: string | null;
  excerpt?: string | null;
  status?: LinkStatus | null;
  workModel?: string | null;
};

// What the link holds, on one soft face: the AI summary with its model, then the page
// excerpt. A missing part is left out, and without both there is no face at all.
function LinkDetailAiSurfaceBase({
  url,
  summary,
  excerpt,
  status,
  workModel,
}: LinkDetailAiSurfaceProps) {
  const summaryText = summary?.trim() ? summary : null;
  const excerptText = excerpt?.trim() ? excerpt : null;
  if (!summaryText && !excerptText) {
    return null;
  }
  const model = status === "A" && workModel ? workModel : null;

  return (
    <View
      accessibilityLabel="링크 내용"
      className="gap-3.5 rounded-2xl bg-surface-elevated px-4 pb-4 pt-3.5"
      testID="link-detail-ai-surface"
    >
      {summaryText ? (
        <View
          className="gap-1.5"
          testID="link-detail-summary"
        >
          <SurfaceHeading title="한 줄 요약">
            {model ? <SummaryModel workModel={model} /> : null}
          </SurfaceHeading>
          <Text className="text-[15px] font-medium leading-[23px] text-foreground">
            {summaryText}
          </Text>
        </View>
      ) : null}
      {excerptText ? (
        <View
          className={
            summaryText
              ? "gap-1.5 border-t border-border-soft pt-3.5 dark:border-border"
              : "gap-1.5"
          }
          testID="link-detail-excerpt"
        >
          <SurfaceHeading title="미리보기" />
          <DetailExcerpt
            excerpt={excerptText}
            url={url}
          />
        </View>
      ) : null}
    </View>
  );
}

const LinkDetailAiSurface = React.memo(LinkDetailAiSurfaceBase);

export { LinkDetailAiSurface };
