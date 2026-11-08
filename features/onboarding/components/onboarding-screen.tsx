import * as React from "react";
import {
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  View,
  useWindowDimensions,
} from "react-native";
import Animated, {
  Extrapolation,
  type SharedValue,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Badge } from "@/components/ui/badge";
import { Favicon } from "@/components/ui/favicon";
import { Icon } from "@/components/ui/icon";
import { LinearGradient } from "@/components/ui/linear-gradient";
import { Text } from "@/components/ui/text";
import { LinkCard } from "@/features/links/components/link-card/link-card";
import { getNativeThemeVars } from "@/lib/theme-vars";
import { useDisplaySettings } from "@/stores/display-settings";

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
} from "./slide-primitives";

import { Search, Share, Sparkles } from "lucide-react-native/icons";
import { vars } from "nativewind";

function TaskSlide() {
  return (
    <View className="px-2">
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
    </View>
  );
}

function OrganizeSlide() {
  return (
    <View className="gap-3.5">
      <View className="flex-row flex-wrap gap-2">
        <FolderChip label="전체" />
        <FolderChip label="🍜 맛집" />
        <FolderChip label="🎧 플리" />
        <FolderChip
          label="✈️ 여행"
          active
        />
      </View>
      {/* The redesigned card has a 16:9 image cell, so two cards sit side by side to fit the slide. */}
      <View className="flex-row gap-3">
        <LinkCard
          className="flex-1 shadow-qlink-md"
          domain="campaign.naver.com"
          faviconUrl={faviconFor("campaign.naver.com")}
          thumbnailAsset={require("@/assets/sample-links/jeju-food-map.jpg")}
          title="제주 맛집 지도 — 저장한 장소"
          tags={["#제주", "#맛집"]}
        />
        <LinkCard
          className="flex-1 shadow-qlink-md"
          domain="banksalad.com"
          faviconUrl={faviconFor("banksalad.com")}
          thumbnailAsset={require("@/assets/sample-links/jeju-course-guide.jpg")}
          title="제주 3박4일 여행 코스 총정리"
          tags={["#여행코스", "#뚜벅이"]}
        />
      </View>
    </View>
  );
}

// Recreates the ALink iOS share-extension sheet (#72): link header, the 폴더 and AI 옵션
// rows, then 저장 / AI 정리.
function ShareSlide() {
  return (
    <View className="gap-3">
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
        <Icon
          as={Share}
          className="size-4 text-white"
        />
      </View>
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
    </View>
  );
}

// The search dialog with a query that appears only inside the saved pages' bodies: the titles
// stay plain and the matched words are highlighted in the body snippet under each card.
function AskSlide() {
  return (
    <View className="gap-3.5">
      <View className="flex-row items-center gap-2 rounded-2xl border border-border bg-card px-4 py-3 shadow-qlink-sm">
        <Icon
          as={Search}
          className="size-4 text-muted-foreground"
        />
        <Text className="flex-1 text-sm text-foreground">{ASK_QUERY}</Text>
        <Text className="text-xs font-medium text-muted-foreground">본문 일치 2</Text>
      </View>
      <View className="flex-row gap-3">
        {ASK_RESULTS.map((result) => (
          <LinkCard
            key={result.domain}
            className="flex-1 shadow-qlink-md"
            domain={result.domain}
            faviconUrl={faviconFor(result.domain)}
            thumbnailAsset={result.thumbnailAsset}
            title={result.title}
            tags={[...result.tags]}
            snippet={result.snippet}
            highlightQuery={ASK_QUERY}
          />
        ))}
      </View>
    </View>
  );
}

function SharedFolderSlide() {
  return (
    <View className="gap-4">
      <View className="items-center gap-2">
        <View className="flex-row">
          <MemberAvatar
            emoji="🧑🏻‍💻"
            tint="bg-[#7B61FF]"
          />
          <MemberAvatar
            emoji="👩🏻"
            tint="bg-[#EC4899]"
            overlap
          />
          <MemberAvatar
            emoji="🧑🏻‍🦱"
            tint="bg-[#F59E0B]"
            overlap
          />
          <View className="-ml-3 size-10 items-center justify-center rounded-full border-2 border-card bg-muted">
            <Text className="text-xs font-bold text-muted-foreground">+2</Text>
          </View>
        </View>
        <Text className="text-xs font-medium text-muted-foreground">친구 5명과 함께 채우는 중</Text>
      </View>
      <View className="flex-row items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 shadow-qlink-sm">
        <View className="size-9 items-center justify-center rounded-xl bg-muted">
          <Text className="text-lg">✈️</Text>
        </View>
        <View className="min-w-0 flex-1">
          <Text className="text-base font-bold text-foreground">제주 여행 같이 가자</Text>
          <Text className="text-xs text-muted-foreground">공유 폴더</Text>
        </View>
      </View>
      {/* The redesigned card has a 16:9 image cell, so two cards sit side by side to fit the slide. */}
      <View className="flex-row gap-3">
        <LinkCard
          className="flex-1 shadow-qlink-md"
          domain="harpersbazaar.co.kr"
          faviconUrl={faviconFor("harpersbazaar.co.kr")}
          thumbnailAsset={require("@/assets/sample-links/jeju-food-list.jpg")}
          title="제주 맛집 지도 저장 목록"
          tags={["#맛집", "#같이가요"]}
        />
        <LinkCard
          className="flex-1 shadow-qlink-md"
          domain="airbnb.co.kr"
          faviconUrl={faviconFor("airbnb.co.kr")}
          thumbnailAsset={require("@/assets/sample-links/aewol-stay.jpg")}
          title="애월 감성 숙소 모음"
          tags={["#숙소", "#애월"]}
        />
      </View>
    </View>
  );
}

type Slide = {
  key: string;
  subject: string;
  title: string;
  description: string;
  footnote?: string;
  render: () => React.ReactNode;
};

const SLIDES: Slide[] = [
  {
    key: "organize",
    subject: "Archive",
    title: "흩어진 링크,\n에이링크에서 하나로",
    description:
      "각종 브라우저에, 폰에, 회사 PC에 두고 잊은 북마크.\n이제 폴더와 태그로 한곳에 모아요.",
    render: () => <OrganizeSlide />,
  },
  {
    key: "share",
    subject: "AI",
    title: "모바일에서\n간편하게, 스마트하게",
    description:
      "보던 페이지를 에이링크로 공유하면 바로 저장,\nAI 정리로 요약·태그·폴더까지 한 번에.",
    footnote: "AI 정리 시 페이지의 서비스 정책에 따라 접근·내용 추출이 제한될 수 있어요.",
    render: () => <ShareSlide />,
  },
  {
    key: "ask",
    subject: "Ask & Access",
    title: "제목이 기억 안 나도\n본문으로 찾아요",
    description: "저장한 페이지의 본문까지 검색해요.\n한 단어만 떠올라도 바로 꺼내 봐요.",
    render: () => <AskSlide />,
  },
  {
    key: "task",
    subject: "Action",
    title: "저장하고, 행동까지.",
    description: "북마크에 액션과 알림을 더해\n저장을 넘어 행동까지.",
    render: () => <TaskSlide />,
  },
  {
    key: "shared",
    subject: "Amigo",
    title: "같이 모으면\n더 좋으니까",
    description: "친구·팀과 폴더를 공유하고\n링크를 함께 채워가요.",
    render: () => <SharedFolderSlide />,
  },
];

// Pagination dot driven continuously by scroll position: width/opacity grow as
// its page comes into view, so it tracks the swipe instead of snapping.
function OnboardingDot({
  index,
  scrollX,
  width,
}: {
  index: number;
  scrollX: SharedValue<number>;
  width: number;
}) {
  const animatedStyle = useAnimatedStyle(() => {
    const inputRange = [(index - 1) * width, index * width, (index + 1) * width];
    return {
      width: interpolate(scrollX.value, inputRange, [6, 20, 6], Extrapolation.CLAMP),
      opacity: interpolate(scrollX.value, inputRange, [0.35, 1, 0.35], Extrapolation.CLAMP),
    };
  });

  return (
    <Animated.View
      className="bg-primary"
      style={[{ height: 6, borderRadius: 999 }, animatedStyle]}
    />
  );
}

function OnboardingScreen({ onDone }: { onDone: () => void }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const mode = useDisplaySettings((state) => state.display.theme);
  const scrollRef = React.useRef<Animated.ScrollView>(null);
  const scrollX = useSharedValue(0);
  const [page, setPage] = React.useState(0);

  const isLast = page === SLIDES.length - 1;

  const scrollHandler = useAnimatedScrollHandler((event) => {
    scrollX.value = event.contentOffset.x;
  });

  // Settle `page` only when the scroll finishes, so the optimistic setPage in
  // goToPage doesn't fight Math.round mid-animation (which made the dots jump).
  const handleMomentumEnd = React.useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const next = Math.round(event.nativeEvent.contentOffset.x / width);
      setPage((prev) => (prev === next ? prev : next));
    },
    [width],
  );

  const goToPage = React.useCallback(
    (next: number) => {
      scrollRef.current?.scrollTo({ x: next * width, animated: true });
      setPage(next);
    },
    [width],
  );

  const handleNext = React.useCallback(() => {
    if (isLast) {
      onDone();
      return;
    }
    goToPage(page + 1);
  }, [goToPage, isLast, onDone, page]);

  return (
    <View
      className="flex-1 bg-background"
      style={vars(getNativeThemeVars(mode, "gray"))}
    >
      <View
        className="flex-row items-center justify-between px-5"
        style={{ paddingTop: insets.top + 8 }}
      >
        {page > 0 ? (
          <Pressable
            hitSlop={8}
            onPress={() => goToPage(page - 1)}
          >
            <Text className="text-sm font-medium text-muted-foreground">‹ 이전</Text>
          </Pressable>
        ) : (
          <View />
        )}
        <Pressable
          hitSlop={8}
          onPress={onDone}
        >
          <Text className="text-sm font-medium text-muted-foreground">건너뛰기</Text>
        </Pressable>
      </View>

      <Animated.ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={scrollHandler}
        onMomentumScrollEnd={handleMomentumEnd}
        className="flex-1"
      >
        {SLIDES.map((slide) => (
          <View
            key={slide.key}
            style={{ width }}
            className="flex-1 justify-center px-6"
          >
            <View className="w-full max-w-md gap-8 self-center">
              {slide.render()}
              <View className="gap-3">
                <View className="items-center gap-1.5">
                  <Text className="text-xs font-bold uppercase tracking-widest text-primary">
                    {slide.subject}
                  </Text>
                  <Text className="text-center text-2xl font-bold leading-snug text-foreground">
                    {slide.title}
                  </Text>
                </View>
                <Text className="text-center text-sm leading-6 text-muted-foreground">
                  {slide.description}
                </Text>
              </View>
            </View>
            {slide.footnote ? (
              <Text className="absolute inset-x-0 bottom-1 px-8 text-center text-xs leading-4 text-muted-foreground">
                {slide.footnote}
              </Text>
            ) : null}
          </View>
        ))}
      </Animated.ScrollView>

      <View
        className="gap-6 px-6"
        style={{ paddingBottom: insets.bottom + 16 }}
      >
        <View className="flex-row items-center justify-center gap-2">
          {SLIDES.map((slide, index) => (
            <OnboardingDot
              key={slide.key}
              index={index}
              scrollX={scrollX}
              width={width}
            />
          ))}
        </View>
        <Pressable
          className="relative h-14 w-full items-center justify-center overflow-hidden rounded-2xl shadow-qlink-sm active:opacity-95"
          onPress={handleNext}
        >
          <LinearGradient
            accent="pink"
            style={{ bottom: 0, left: 0, position: "absolute", right: 0, top: 0 }}
            pointerEvents="none"
          />
          <Text className="text-base font-semibold text-primary-foreground">
            {isLast ? "시작하기" : "다음"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

export { OnboardingScreen, SLIDES };
export type { Slide };
