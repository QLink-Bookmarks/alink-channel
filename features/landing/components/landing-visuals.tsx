import * as React from "react";
import { View } from "react-native";

import { Badge } from "@/components/ui/badge";
import { Favicon } from "@/components/ui/favicon";
import { Icon } from "@/components/ui/icon";
import { LinearGradient } from "@/components/ui/linear-gradient";
import { Text } from "@/components/ui/text";
import { LinkCard } from "@/features/links/components/link-card/link-card";
import {
  BookmarkCard,
  BrowserDot,
  ChecklistRow,
  FolderChip,
  MemberAvatar,
  SheetChip,
  faviconFor,
} from "@/features/onboarding/components/slide-primitives";
import { cn } from "@/lib/utils";

import { Reveal } from "./reveal";

import { Search, Share, Sparkles } from "lucide-react-native/icons";

// Landing-specific animated recreations of the onboarding visuals. The onboarding
// SLIDES render statically inside a native pager; here each internal element
// reveals in sequence as the section scrolls into view (web-only), reusing the
// same leaf primitives so the two surfaces stay in sync.

const SCATTER_CARDS = [
  { pos: "left-0 top-1", rotate: "-7deg", fallback: "📁", title: "Mobile Bookmarks" },
  {
    pos: "right-0 top-16",
    rotate: "6deg",
    faviconUrl: faviconFor("brunch.co.kr"),
    fallback: "B",
    title: "일잘러 되는 법",
  },
  {
    pos: "left-0 top-32",
    rotate: "3deg",
    faviconUrl: faviconFor("youtube.com"),
    fallback: "Y",
    title: "공부할 때 듣기 좋은 플리",
  },
  {
    pos: "right-0 top-48",
    rotate: "-5deg",
    faviconUrl: faviconFor("google.com"),
    fallback: "G",
    title: "제주 3박4일 코스",
  },
  { pos: "left-3 top-64", rotate: "7deg", fallback: "🔥", title: "갖고 싶은 신발" },
];

const SCATTER_DOTS = [
  { pos: "right-8 top-1", rotate: "-10deg", fallback: "S", tint: "bg-[#1E90FF]" },
  { pos: "left-36 top-24", rotate: "8deg", fallback: "C", tint: "bg-[#F4B400]" },
  { pos: "left-2 top-52", rotate: "-6deg", fallback: "N", tint: "bg-[#03C75A]" },
  { pos: "right-10 top-72", rotate: "9deg", fallback: "W", tint: "bg-[#4B5563]" },
];

function ScatterVisual() {
  return (
    <View className="h-80">
      {SCATTER_DOTS.map((dot, index) => (
        <Reveal
          key={`dot-${index}`}
          from="scale"
          delay={index * 80}
          className={cn("absolute", dot.pos)}
        >
          <BrowserDot
            rotate={dot.rotate}
            fallback={dot.fallback}
            tint={dot.tint}
          />
        </Reveal>
      ))}
      {SCATTER_CARDS.map((card, index) => (
        <Reveal
          key={`card-${index}`}
          from="scale"
          delay={140 + index * 120}
          className={cn("absolute w-48", card.pos)}
        >
          <BookmarkCard
            className="w-full"
            rotate={card.rotate}
            faviconUrl={card.faviconUrl}
            fallback={card.fallback}
            title={card.title}
          />
        </Reveal>
      ))}
    </View>
  );
}

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
        <View className="flex-row items-center gap-2 rounded-2xl border border-border bg-card px-4 py-3 shadow-qlink-sm">
          <Icon
            as={Search}
            className="size-4 text-muted-foreground"
          />
          <Text className="text-sm text-muted-foreground">저장한 링크 검색</Text>
        </View>
      </Reveal>
      <Reveal
        from="up"
        delay={110}
      >
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

// Slide 3 — the browser bar appears, the share icon itself scales up into an
// active highlight, then the ALink share-extension sheet rises up from below.
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
            news.hada.io
          </Text>
          <ShareButton />
        </View>
      </Reveal>
      <Reveal
        from="up"
        delay={700}
      >
        <View className="gap-3.5 rounded-[28px] border border-border bg-card p-5 shadow-qlink-md">
          <View className="h-1 w-10 self-center rounded-full bg-muted" />
          <View className="gap-0.5">
            <Text
              className="text-sm font-bold text-foreground"
              numberOfLines={1}
            >
              news.hada.io/topic?id=42
            </Text>
            <Text
              className="text-xs text-muted-foreground"
              numberOfLines={1}
            >
              아이디어부터 앱스토어까지 — 1인 개발 회고
            </Text>
          </View>
          <View className="gap-2">
            <Text className="text-xs font-medium text-muted-foreground">폴더</Text>
            <View className="flex-row flex-wrap gap-2">
              <SheetChip
                label="✨ AI 자동 분류"
                active
              />
              <SheetChip label="💻 개발" />
              <SheetChip label="📰 읽을거리" />
            </View>
          </View>
          <View className="gap-2">
            <Text className="text-xs font-medium text-muted-foreground">AI 모델</Text>
            <View className="flex-row gap-2">
              <SheetChip
                label="Gemini · 기본"
                active
              />
              <SheetChip label="OpenAI" />
            </View>
          </View>
          <View className="flex-row gap-3 pt-1">
            <View className="h-11 flex-1 items-center justify-center rounded-2xl border border-border bg-background">
              <Text className="text-sm font-semibold text-foreground">저장</Text>
            </View>
            <View className="relative h-11 flex-1 items-center justify-center overflow-hidden rounded-2xl">
              <LinearGradient
                accent="pink"
                style={{ bottom: 0, left: 0, position: "absolute", right: 0, top: 0 }}
                pointerEvents="none"
              />
              <Text className="text-sm font-semibold text-primary-foreground">AI 요약 저장</Text>
            </View>
          </View>
        </View>
      </Reveal>
    </View>
  );
}

// Slide 4 reveals as one card (no per-element stagger).
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
              <Text className="text-xs font-semibold">할 일 2/3 완료</Text>
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
    case "scatter":
      return <ScatterVisual />;
    case "organize":
      return <OrganizeVisual />;
    case "share":
      return <ShareVisual />;
    case "task":
      return <TaskVisual />;
    case "shared":
      return <SharedVisual />;
    default:
      return null;
  }
}
