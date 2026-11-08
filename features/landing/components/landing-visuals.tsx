import * as React from "react";
import { View } from "react-native";

import { Badge } from "@/components/ui/badge";
import { Favicon } from "@/components/ui/favicon";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { LinkCard } from "@/features/links/components/link-card/link-card";
import {
  ASK_QUERY,
  ASK_RESULTS,
  ChecklistRow,
  FolderChip,
  MemberAvatar,
  SHARE_SHEET,
  ShareSheetActions,
  ShareSheetHeader,
  ShareSheetRow,
  faviconFor,
} from "@/features/onboarding/components/slide-primitives";
import { cn } from "@/lib/utils";

import { Reveal } from "./reveal";

import { Search, Share, Sparkles } from "lucide-react-native/icons";

// Landing-specific animated recreations of the onboarding visuals. The onboarding
// SLIDES render statically inside a native pager; here each internal element
// reveals in sequence as the section scrolls into view (web-only), reusing the
// same leaf primitives so the two surfaces stay in sync.

const ORGANIZE_FOLDERS = [
  {
    key: "맛집",
    label: "🍜 맛집",
    links: [
      {
        domain: "elle.co.kr",
        title: "성수 브런치 맛집 지도",
        tags: ["#성수", "#브런치"],
        thumbnailAsset: require("@/assets/sample-links/seongsu-brunch.jpg"),
      },
      {
        domain: "instagram.com",
        title: "요즘 핫한 이자카야 릴스",
        tags: ["#이자카야", "#릴스"],
        isVideo: true,
      },
    ],
  },
  {
    key: "플리",
    label: "🎧 플리",
    links: [
      {
        domain: "youtube.com",
        title: "공부할 때 듣기 좋은 플리",
        tags: ["#집중", "#lofi"],
        thumbnailAsset: require("@/assets/sample-links/study-playlist.jpg"),
        isVideo: true,
      },
      {
        domain: "spotify.com",
        title: "드라이브 감성 플레이리스트",
        tags: ["#드라이브", "#감성"],
        thumbnailAsset: require("@/assets/sample-links/drive-playlist.jpg"),
      },
    ],
  },
  {
    key: "여행",
    label: "✈️ 여행",
    links: [
      {
        domain: "haniseoul.com",
        title: "제주 3박4일 여행 코스",
        tags: ["#제주", "#뚜벅이"],
        thumbnailAsset: require("@/assets/sample-links/jeju-course-route.jpg"),
      },
      {
        domain: "airbnb.co.kr",
        title: "애월 감성 숙소 모음",
        tags: ["#숙소", "#애월"],
        thumbnailAsset: require("@/assets/sample-links/aewol-stay-ocean.jpg"),
      },
    ],
  },
];

function OrganizeVisual() {
  const [selected, setSelected] = React.useState(ORGANIZE_FOLDERS[0].key);
  const folder = ORGANIZE_FOLDERS.find((item) => item.key === selected) ?? ORGANIZE_FOLDERS[0];

  return (
    <View className="gap-3.5">
      <Reveal from="up">
        <View className="flex-row flex-wrap gap-2">
          <FolderChip label="전체" />
          {ORGANIZE_FOLDERS.map((item) => (
            <FolderChip
              key={item.key}
              label={item.label}
              active={item.key === selected}
              onPress={() => setSelected(item.key)}
            />
          ))}
        </View>
      </Reveal>
      {/* Keyed by folder so switching remounts the cards and replays their reveal. */}
      <View
        key={folder.key}
        className="flex-row gap-3.5"
      >
        {/* The redesigned card has a 16:9 image cell, so the cards sit side by side to fit the section. */}
        {folder.links.map((link, index) => (
          <Reveal
            key={link.domain}
            className="flex-1"
            from="up"
            delay={index === 0 ? 0 : 110}
          >
            <LinkCard
              className="shadow-qlink-md"
              domain={link.domain}
              faviconUrl={faviconFor(link.domain)}
              thumbnailAsset={"thumbnailAsset" in link ? link.thumbnailAsset : undefined}
              isVideo={"isVideo" in link ? link.isVideo : false}
              title={link.title}
              tags={link.tags}
            />
          </Reveal>
        ))}
      </View>
    </View>
  );
}

// Flips to `active` a beat after the node scrolls into view — drives the
// share-button's not-active → active transition.
function useActivateInView(delay: number) {
  const ref = React.useRef<View>(null);
  const [active, setActive] = React.useState(false);

  React.useEffect(() => {
    const node = ref.current as unknown as Element | null;
    if (!node || typeof IntersectionObserver === "undefined") {
      setActive(true);
      return;
    }
    let timer: ReturnType<typeof setTimeout>;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          timer = setTimeout(() => setActive(true), delay);
          observer.disconnect();
        }
      },
      { threshold: 0.25 },
    );
    observer.observe(node);
    return () => {
      observer.disconnect();
      clearTimeout(timer);
    };
  }, [delay]);

  return { ref, active };
}

const SHARE_TRANSITION = {
  transitionProperty: "opacity, transform",
  transitionDuration: "420ms",
  transitionTimingFunction: "cubic-bezier(0.34, 1.4, 0.5, 1)",
};

// The share icon keeps a thin size-5 footprint (bar stays slim). Both the icon
// and its halo are absolute, so on activate the icon itself scales up and the
// highlight pops in without pushing the bar taller.
function ShareButton() {
  const { ref, active } = useActivateInView(600);
  return (
    <View
      ref={ref}
      className="relative size-5 items-center justify-center"
    >
      <View
        className="absolute inset-0 items-center justify-center"
        style={
          {
            ...SHARE_TRANSITION,
            opacity: active ? 1 : 0,
            transform: [{ scale: active ? 1 : 0.4 }],
          } as object
        }
      >
        <View className="size-10 rounded-full bg-white/25" />
      </View>
      <View
        className="absolute inset-0 items-center justify-center"
        style={
          {
            ...SHARE_TRANSITION,
            transform: [{ scale: active ? 1.5 : 1 }],
          } as object
        }
      >
        <Icon
          as={Share}
          className="size-5 text-white"
        />
      </View>
    </View>
  );
}

// AI section — the browser bar appears, the share icon itself scales up into an
// active highlight, then the ALink share-extension sheet (#72) rises up from below.
function ShareVisual() {
  return (
    <View className="gap-3">
      <Reveal from="up">
        <View className="w-full flex-row items-center gap-2.5 rounded-full bg-[#48484A] px-4 py-3">
          <Icon
            as={Sparkles}
            className="size-4 text-white"
          />
          <Text
            className="flex-1 text-center text-sm font-semibold text-white"
            numberOfLines={1}
          >
            {SHARE_SHEET.domain}
          </Text>
          <ShareButton />
        </View>
      </Reveal>
      <Reveal
        from="up"
        delay={700}
      >
        <View className="gap-4 rounded-[28px] border border-border bg-card p-5 shadow-qlink-md">
          <View className="h-1 w-10 self-center rounded-full bg-muted" />
          <ShareSheetHeader />
          <View className="overflow-hidden rounded-[14px] border border-border-soft bg-background">
            <ShareSheetRow
              label="폴더"
              value={`${SHARE_SHEET.folderEmoji} ${SHARE_SHEET.folderName}`}
            />
            <ShareSheetRow
              label="AI 옵션"
              value={`${SHARE_SHEET.model} · ${SHARE_SHEET.todoSummary}`}
              hasDivider
              showsProviderLogo
            />
          </View>
          <ShareSheetActions />
        </View>
      </Reveal>
    </View>
  );
}

// Ask & Access section — the query lands in the search bar, then the two body-matched
// cards rise with their highlighted snippets.
function AskVisual() {
  return (
    <View className="gap-3.5">
      <Reveal from="up">
        <View className="flex-row items-center gap-2 rounded-2xl border border-border bg-card px-4 py-3 shadow-qlink-sm">
          <Icon
            as={Search}
            className="size-4 text-muted-foreground"
          />
          <Text className="flex-1 text-sm text-foreground">{ASK_QUERY}</Text>
          <Text className="text-xs font-medium text-muted-foreground">본문 일치 2</Text>
        </View>
      </Reveal>
      <View className="flex-row gap-3.5">
        {ASK_RESULTS.map((result, index) => (
          <Reveal
            key={result.domain}
            className="flex-1"
            from="up"
            delay={220 + index * 110}
          >
            <LinkCard
              className="shadow-qlink-md"
              domain={result.domain}
              faviconUrl={faviconFor(result.domain)}
              thumbnailAsset={result.thumbnailAsset}
              title={result.title}
              tags={[...result.tags]}
              snippet={result.snippet}
              highlightQuery={ASK_QUERY}
            />
          </Reveal>
        ))}
      </View>
    </View>
  );
}

// Action section reveals as one card (no per-element stagger).
function TaskVisual() {
  return (
    <Reveal
      from="up"
      className="px-2"
    >
      <View className="gap-4 rounded-[28px] border border-border bg-card p-5 shadow-qlink-md">
        <View className="flex-row items-start gap-3">
          <Favicon
            url={faviconFor("careers.lg.com")}
            fallback="L"
          />
          <View className="flex-1 gap-1">
            <Text className="text-xs text-muted-foreground">careers.lg.com</Text>
            <Text
              className="text-base font-semibold"
              numberOfLines={2}
            >
              LG CNS 2026 상반기 신입 채용
            </Text>
          </View>
        </View>
        <View className="rounded-xl bg-primary/10 px-3 py-2">
          <Text className="text-sm text-foreground">
            <Text className="text-sm font-semibold text-primary">메모 · </Text>
            마감 전 포트폴리오 링크 꼭 첨부하기!
          </Text>
        </View>
        <View className="gap-3 border-t border-dashed border-border-soft pt-4">
          <View className="flex-row items-center gap-2">
            <Badge variant="todo">
              <Text className="text-xs font-semibold">액션 2/3 완료</Text>
            </Badge>
          </View>
          <ChecklistRow
            text="자기소개서 초안 작성"
            done
          />
          <ChecklistRow
            text="포트폴리오 첨부"
            done
          />
          <ChecklistRow
            text="지원서 최종 제출"
            reminderLabel="06/16 09:00"
            overdue
          />
        </View>
      </View>
    </Reveal>
  );
}

const SHARED_AVATARS = [
  { emoji: "🧑🏻‍💻", tint: "bg-[#7B61FF]", overlap: false },
  { emoji: "👩🏻", tint: "bg-[#EC4899]", overlap: true },
  { emoji: "🧑🏻‍🦱", tint: "bg-[#F59E0B]", overlap: true },
];

function SharedVisual() {
  return (
    <View className="gap-4">
      <View className="items-center gap-2">
        <View className="flex-row">
          {SHARED_AVATARS.map((avatar, index) => (
            <Reveal
              key={index}
              from="scale"
              delay={index * 110}
              className={cn(avatar.overlap && "-ml-3")}
            >
              <MemberAvatar
                emoji={avatar.emoji}
                tint={avatar.tint}
              />
            </Reveal>
          ))}
          <Reveal
            from="scale"
            delay={330}
            className="-ml-3"
          >
            <View className="size-10 items-center justify-center rounded-full border-2 border-card bg-muted">
              <Text className="text-xs font-bold text-muted-foreground">+2</Text>
            </View>
          </Reveal>
        </View>
        <Reveal
          from="up"
          delay={430}
        >
          <Text className="text-xs font-medium text-muted-foreground">
            친구 5명과 함께 채우는 중
          </Text>
        </Reveal>
      </View>
      <Reveal
        from="up"
        delay={520}
      >
        <View className="flex-row items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 shadow-qlink-sm">
          <View className="size-9 items-center justify-center rounded-xl bg-muted">
            <Text className="text-lg">✈️</Text>
          </View>
          <View className="min-w-0 flex-1">
            <Text className="text-base font-bold text-foreground">제주 여행 같이 가자</Text>
            <Text className="text-xs text-muted-foreground">공유 폴더</Text>
          </View>
        </View>
      </Reveal>
      {/* Side by side, as in the archive section, so the section keeps its height. */}
      <View className="flex-row gap-3.5">
        <Reveal
          className="flex-1"
          from="up"
          delay={620}
        >
          <LinkCard
            className="shadow-qlink-md"
            domain="harpersbazaar.co.kr"
            faviconUrl={faviconFor("harpersbazaar.co.kr")}
            thumbnailAsset={require("@/assets/sample-links/jeju-food-list.jpg")}
            title="제주 맛집 지도 저장 목록"
            tags={["#맛집", "#같이가요"]}
          />
        </Reveal>
        <Reveal
          className="flex-1"
          from="up"
          delay={700}
        >
          <LinkCard
            className="shadow-qlink-md"
            domain="airbnb.co.kr"
            faviconUrl={faviconFor("airbnb.co.kr")}
            thumbnailAsset={require("@/assets/sample-links/aewol-stay.jpg")}
            title="애월 감성 숙소 모음"
            tags={["#숙소", "#애월"]}
          />
        </Reveal>
      </View>
    </View>
  );
}

export function LandingVisual({ slideKey }: { slideKey: string }) {
  switch (slideKey) {
    case "organize":
      return <OrganizeVisual />;
    case "share":
      return <ShareVisual />;
    case "ask":
      return <AskVisual />;
    case "task":
      return <TaskVisual />;
    case "shared":
      return <SharedVisual />;
    default:
      return null;
  }
}
