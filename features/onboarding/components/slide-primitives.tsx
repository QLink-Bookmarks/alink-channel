import { Pressable, View } from "react-native";

import { Checkbox } from "@/components/ui/checkbox";
import { Icon } from "@/components/ui/icon";
import { LinearGradient } from "@/components/ui/linear-gradient";
import { Text } from "@/components/ui/text";
import type { ContentSnippet, HighlightRange } from "@/features/links/types";
import { cn } from "@/lib/utils";
import { ShareProviderLogo } from "@/share/share-provider-logo";

import { Image } from "expo-image";
import { AlarmClock, ChevronRight, Save } from "lucide-react-native/icons";

// Shared leaf visuals used by both the native onboarding pager and the web
// marketing landing. Positioning/animation is left to the caller (the landing
// wraps these in scroll-reveal wrappers; onboarding places them statically), so
// these stay purely presentational.

export function faviconFor(domain: string) {
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
}

/** Every occurrence of `word` in `text` as a highlight range, for the sample snippets. */
export function highlightAll(text: string, word: string): HighlightRange[] {
  const ranges: HighlightRange[] = [];
  if (!word) {
    return ranges;
  }
  let index = text.indexOf(word);
  while (index !== -1) {
    ranges.push({ start: index, end: index + word.length });
    index = text.indexOf(word, index + word.length);
  }
  return ranges;
}

function snippetOf(text: string, word: string): ContentSnippet {
  return { text, highlights: highlightAll(text, word) };
}

// Sample page shared in on the AI slide: mirrors the share-extension sheet (#72).
export const SHARE_SHEET = {
  domain: "brunch.co.kr",
  title: "퇴근 후 2시간, 사이드 프로젝트로 앱 출시까지",
  thumbnailAsset: require("@/assets/sample-links/study-playlist.jpg") as number,
  folderEmoji: "🗂️",
  folderName: "미분류",
  model: "Gemini",
  todoSummary: "액션 끔",
} as const;

// The Ask & Access slide: a word that is in neither title, only in the saved pages' bodies.
export const ASK_QUERY = "주차";

export const ASK_RESULTS = [
  {
    domain: "brunch.co.kr",
    title: "성수 브런치 카페 5곳 솔직 후기",
    tags: ["#성수", "#브런치"],
    thumbnailAsset: require("@/assets/sample-links/seongsu-brunch.jpg") as number,
    snippet: snippetOf(
      "…가게 앞 주차는 어렵고, 길 건너 유료 주차장이 제일 가까워요. 주말 11시 이후엔 웨이팅이…",
      ASK_QUERY,
    ),
  },
  {
    domain: "airbnb.co.kr",
    title: "애월 바다 뷰 숙소 2박 솔직 후기",
    tags: ["#애월", "#숙소"],
    thumbnailAsset: require("@/assets/sample-links/aewol-stay-ocean.jpg") as number,
    snippet: snippetOf(
      "…전용 주차 공간이 3대뿐이라 늦게 도착하면 근처 공영 주차장을 써야 해요. 조식은…",
      ASK_QUERY,
    ),
  },
] as const;

export function ChecklistRow({
  text,
  done,
  reminderLabel,
  overdue,
}: {
  text: string;
  done?: boolean;
  reminderLabel?: string;
  overdue?: boolean;
}) {
  return (
    <View className="flex-row items-center gap-3">
      <Checkbox
        checked={done ?? false}
        disabled
        shape="round"
        size="sm"
        onCheckedChange={() => {}}
      />
      <Text
        className={cn("flex-1 text-sm", done && "text-muted-foreground line-through")}
        numberOfLines={1}
      >
        {text}
      </Text>
      {reminderLabel ? (
        <View
          className={cn(
            "flex-row items-center gap-1 rounded-full px-3 py-1.5",
            overdue ? "bg-destructive/10" : "bg-primary/10",
          )}
        >
          <Icon
            as={AlarmClock}
            className={cn("size-3.5", overdue ? "text-destructive" : "text-primary")}
          />
          <Text
            className={cn("text-xs font-semibold", overdue ? "text-destructive" : "text-primary")}
          >
            {reminderLabel}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

// Folder pill. Pressable when `onPress` is supplied (landing uses this for the
// selectable filter row); a plain view otherwise (onboarding's static preview).
export function FolderChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active?: boolean;
  onPress?: () => void;
}) {
  const className = cn(
    "rounded-full border px-3.5 py-1.5",
    active ? "border-primary bg-primary" : "border-border bg-card",
    onPress && "web:transition-transform web:hover:scale-105",
  );
  const content = (
    <Text
      className={cn(
        "text-sm font-semibold",
        active ? "text-primary-foreground" : "text-muted-foreground",
      )}
    >
      {label}
    </Text>
  );
  if (!onPress) {
    return <View className={className}>{content}</View>;
  }
  return (
    <Pressable
      className={cn(className, "active:opacity-90")}
      onPress={onPress}
    >
      {content}
    </Pressable>
  );
}

/** The share sheet's link header: thumbnail, title, domain. */
export function ShareSheetHeader() {
  return (
    <View className="flex-row items-center gap-3 px-1">
      <View className="size-14 shrink-0 overflow-hidden rounded-xl border border-border-soft bg-muted">
        <Image
          accessibilityIgnoresInvertColors
          className="size-14"
          contentFit="cover"
          source={SHARE_SHEET.thumbnailAsset}
          style={{ width: 56, height: 56 }}
        />
      </View>
      <View className="min-w-0 flex-1 gap-0.5">
        <Text
          className="text-base font-semibold leading-[21px] text-foreground"
          numberOfLines={2}
        >
          {SHARE_SHEET.title}
        </Text>
        <Text
          className="text-[13px] leading-[18px] text-muted-foreground"
          numberOfLines={1}
        >
          {SHARE_SHEET.domain}
        </Text>
      </View>
    </View>
  );
}

/** One setting row of the share sheet (폴더 / AI 옵션): label, value, chevron. */
export function ShareSheetRow({
  label,
  value,
  hasDivider,
  showsProviderLogo,
}: {
  label: string;
  value: string;
  hasDivider?: boolean;
  showsProviderLogo?: boolean;
}) {
  return (
    <View className="min-h-[50px] flex-row items-center gap-2.5 pl-3.5 pr-2.5">
      {hasDivider ? <View className="absolute left-3.5 right-0 top-0 h-px bg-border-soft" /> : null}
      <Text className="shrink-0 text-base leading-[21px] text-foreground">{label}</Text>
      <View className="min-w-0 flex-1 flex-row items-center justify-end gap-1.5">
        {showsProviderLogo ? <ShareProviderLogo type="GEMINI" /> : null}
        <Text
          className="min-w-0 shrink text-[15px] leading-5 text-muted-foreground"
          numberOfLines={1}
        >
          {value}
        </Text>
      </View>
      <Icon
        as={ChevronRight}
        className="text-muted-foreground/80"
        size={16}
      />
    </View>
  );
}

/** The share sheet's 저장 / AI 정리 buttons with their captions. */
export function ShareSheetActions() {
  return (
    <View className="gap-[5px]">
      <View className="flex-row gap-2">
        <View className="h-12 flex-1 flex-row items-center justify-center gap-2 rounded-xl bg-primary/15">
          <Icon
            as={Save}
            className="text-accent-foreground"
            size={18}
          />
          <Text className="text-base font-semibold text-accent-foreground">저장</Text>
        </View>
        <View className="relative h-12 flex-1 items-center justify-center overflow-hidden rounded-xl shadow-qlink-sm">
          <LinearGradient
            accent="gray"
            pointerEvents="none"
            style={{ bottom: 0, left: 0, position: "absolute", right: 0, top: 0 }}
          />
          <Text className="text-base font-semibold text-primary-foreground">AI 정리</Text>
        </View>
      </View>
      <View className="flex-row gap-2">
        <Text className="flex-1 text-center text-xs leading-4 text-muted-foreground">
          그대로 보관
        </Text>
        <Text className="flex-1 text-center text-xs leading-4 text-muted-foreground">
          요약·태그까지 정리
        </Text>
      </View>
    </View>
  );
}

export function MemberAvatar({
  emoji,
  tint,
  overlap,
}: {
  emoji: string;
  tint: string;
  overlap?: boolean;
}) {
  return (
    <View
      className={cn(
        "size-10 items-center justify-center rounded-full border-2 border-card",
        tint,
        overlap && "-ml-3",
      )}
    >
      <Text className="text-lg">{emoji}</Text>
    </View>
  );
}
