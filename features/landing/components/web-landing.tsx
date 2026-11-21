import * as React from "react";
import { Linking, Pressable, ScrollView, View } from "react-native";

import { AppStoreBadge } from "@/components/ui/app-store-badge";
import { Text } from "@/components/ui/text";
import { SLIDES } from "@/features/onboarding/components/onboarding-screen";
import { getNativeThemeVars } from "@/lib/theme-vars";
import { cn } from "@/lib/utils";

import {
  FINAL_BG,
  LANDING_COLOR_VARS,
  LANDING_FRAME,
  LANDING_SCROLL_ID,
  ProgressRail,
  SECTION_BG,
  SectionBackdrop,
  StartButton,
  focusLandingSection,
  scrollToLandingSection,
} from "./landing-chrome";
import { LandingHeader } from "./landing-header";
import { LandingHero } from "./landing-hero";
import { LandingVisual } from "./landing-visuals";
import { Reveal } from "./reveal";

import { type Href, useRouter } from "expo-router";
import { vars } from "nativewind";

const SECTION_IDS = [
  "landing-intro",
  ...SLIDES.map(({ key }) => `landing-${key}`),
  "landing-final",
];
const SUPPORT_EMAIL = "qlinkk1004@gmail.com";

// The router can replace the history state and remount this route during popstate.
let restoredLandingPosition: { id?: string; scrollTop: number } | undefined;

if (typeof window !== "undefined") {
  window.addEventListener(
    "popstate",
    (event) => {
      const { id, landingScrollTop } = event.state ?? {};
      restoredLandingPosition =
        !window.location.hash && typeof landingScrollTop === "number"
          ? { id, scrollTop: landingScrollTop }
          : undefined;
    },
    true,
  );
}

function getActiveSectionIndex(viewport: HTMLElement) {
  const center = viewport.getBoundingClientRect().top + viewport.clientHeight / 2;
  const index = SECTION_IDS.findLastIndex((id) => {
    const section = document.getElementById(id);
    return section != null && section.getBoundingClientRect().top <= center;
  });
  return Math.max(0, index);
}

function WebLanding() {
  const router = useRouter();
  const [active, setActive] = React.useState(0);

  function handleScroll() {
    const viewport = document.getElementById(LANDING_SCROLL_ID);
    if (viewport) setActive(getActiveSectionIndex(viewport));
  }

  React.useEffect(() => {
    function getRestoredPosition() {
      if (restoredLandingPosition?.id === window.history.state?.id) return restoredLandingPosition;
    }

    function restoreSection() {
      const viewport = document.getElementById(LANDING_SCROLL_ID);
      if (!viewport) return;
      const id = window.location.hash.slice(1);
      const restored = getRestoredPosition();
      const saved = restored?.scrollTop ?? window.history.state?.landingScrollTop;
      if (SECTION_IDS.includes(id)) {
        scrollToLandingSection(id);
      } else if (!id) {
        viewport.scrollTop = typeof saved === "number" ? saved : 0;
        if (typeof saved === "number" && window.history.state?.landingScrollTop !== saved) {
          window.history.replaceState({ ...window.history.state, landingScrollTop: saved }, "");
        }
      } else {
        return;
      }
      const index = getActiveSectionIndex(viewport);
      setActive(index);
      const focused = document.activeElement;
      if (restored && focused === document.body) {
        const section = document.getElementById(SECTION_IDS[index]);
        if (section) focusLandingSection(section);
      } else if (focused && viewport.contains(focused)) {
        const { top, bottom } = focused.getBoundingClientRect();
        const visible = viewport.getBoundingClientRect();
        if (bottom <= visible.top || top >= visible.bottom) {
          const section = document.getElementById(SECTION_IDS[index]);
          if (section) focusLandingSection(section);
        }
      }
    }
    if (window.location.hash || getRestoredPosition()) restoreSection();
    window.addEventListener("hashchange", restoreSection);
    return () => window.removeEventListener("hashchange", restoreSection);
  }, []);

  return (
    <View
      className="flex-1 bg-background"
      style={vars({ ...getNativeThemeVars("light", "gray"), ...LANDING_COLOR_VARS })}
    >
      <LandingHeader activeSection={SLIDES[active - 1]?.key} />
      <View className="min-h-0 flex-1">
        <ScrollView
          nativeID={LANDING_SCROLL_ID}
          className="flex-1"
          contentInsetAdjustmentBehavior="automatic"
          showsVerticalScrollIndicator={false}
          scrollEventThrottle={16}
          onLayout={handleScroll}
          onScroll={handleScroll}
        >
          <LandingHero />

          {SLIDES.map((slide, index) => {
            const reversed = index % 2 === 1;
            // The AI (share) section stages its visual (bar → share icon → sheet), so its copy
            // lands last; other slides bring the copy in alongside the visual.
            const textDelay = slide.key === "share" ? 950 : 220;
            return (
              <View
                key={slide.key}
                nativeID={`landing-${slide.key}`}
                role="region"
                aria-label={slide.subject}
                className={cn(
                  "min-h-screen w-full justify-center overflow-hidden px-6 py-16",
                  SECTION_BG[index % SECTION_BG.length],
                )}
              >
                <SectionBackdrop index={index} />
                <View
                  testID="landing-frame"
                  className={LANDING_FRAME}
                >
                  <View
                    className={cn(
                      "mx-auto w-full max-w-4xl flex-col items-center gap-10 md:flex-row md:gap-16",
                      reversed && "md:flex-row-reverse",
                    )}
                  >
                    <View className="w-full max-w-sm md:flex-1">
                      <LandingVisual slideKey={slide.key} />
                    </View>
                    <Reveal
                      from={reversed ? "left" : "right"}
                      delay={textDelay}
                      className="w-full gap-4 md:flex-1"
                    >
                      <View className="items-center gap-1.5 md:items-start">
                        <Text className="text-xs font-bold uppercase tracking-widest text-primary">
                          {slide.subject}
                        </Text>
                        <Text className="text-center text-2xl font-bold leading-snug text-foreground md:text-left md:text-4xl">
                          {slide.title}
                        </Text>
                      </View>
                      <Text className="text-center text-base leading-7 text-muted-foreground md:text-left md:text-lg">
                        {slide.description}
                      </Text>
                      {slide.footnote ? (
                        <Text className="text-center text-xs leading-4 text-muted-foreground/60 md:text-left">
                          {slide.footnote}
                        </Text>
                      ) : null}
                    </Reveal>
                  </View>
                </View>
              </View>
            );
          })}

          <View
            nativeID="landing-final"
            className={cn(
              "min-h-screen w-full items-center justify-center gap-6 overflow-hidden px-6",
              FINAL_BG,
            )}
          >
            <View
              pointerEvents="none"
              className="absolute inset-0"
            >
              <View
                className="absolute -left-24 top-16 h-80 w-80 rounded-full"
                style={{ backgroundColor: "#F1A8CE", opacity: 0.18 }}
              />
              <View
                className="absolute -right-20 bottom-20 h-96 w-96 rounded-full"
                style={{ backgroundColor: "#E0A9EE", opacity: 0.16 }}
              />
            </View>
            <View
              testID="landing-frame"
              className={LANDING_FRAME}
            >
              <Reveal
                from="up"
                className="w-full items-center gap-6"
              >
                <Text className="text-center text-3xl font-extrabold leading-tight text-foreground md:text-5xl">
                  흩어진 북마크,{"\n"}이제는 하나로 Archive
                </Text>
                <StartButton
                  href="/app"
                  label="웹으로 시작하기"
                />
                <AppStoreBadge />
              </Reveal>
            </View>
            <View
              role="contentinfo"
              className="absolute inset-x-0 bottom-0 border-t border-border bg-background px-6 py-10"
            >
              <View
                testID="landing-frame"
                className={cn(LANDING_FRAME, "items-center gap-2")}
              >
                <Text className="font-mono text-sm text-muted-foreground">에이링크 ALink</Text>
                <Pressable onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}`)}>
                  <Text className="text-xs text-muted-foreground web:hover:text-foreground">
                    문의 · <Text className="underline">{SUPPORT_EMAIL}</Text>
                  </Text>
                </Pressable>
                <Pressable onPress={() => router.push("/privacy" as Href)}>
                  <Text className="text-xs text-muted-foreground underline web:hover:text-foreground">
                    개인정보처리방침
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        </ScrollView>

        <ProgressRail
          total={SECTION_IDS.length}
          active={active}
        />
      </View>
    </View>
  );
}

export { WebLanding };
