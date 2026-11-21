import { Pressable, View } from "react-native";

import { BrandHeader } from "@/components/layout/brand-header";
import { Text } from "@/components/ui/text";
import { SidebarProfileButton } from "@/features/navigation/components/sidebar-profile-button";
import { SLIDES } from "@/features/onboarding/components/onboarding-screen";
import { useWideView } from "@/lib/hooks/use-wide-view";
import { getNativeThemeVars } from "@/lib/theme-vars";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth";
import { useDisplaySettings } from "@/stores/display-settings";

import {
  LANDING_FOCUS,
  LANDING_FRAME,
  LANDING_TOP_GUTTER,
  LandingSectionLink,
  StartButton,
} from "./landing-chrome";

import { Link, useRouter } from "expo-router";
import { vars } from "nativewind";

function LandingHeader({ activeSection }: { activeSection?: string }) {
  const router = useRouter();
  const isWideView = useWideView();
  const isMember = useAuthStore((state) => state.hasHydrated && state.accessToken !== null);
  const accent = useDisplaySettings((state) => state.display.accent);
  const mode = useDisplaySettings((state) => state.display.theme);

  const account = (
    <View
      key="account"
      className="min-w-0 flex-1 flex-row items-center justify-end gap-2 md:order-3 md:gap-4"
    >
      {isMember ? (
        <View
          className="min-w-0 shrink"
          style={vars(getNativeThemeVars(mode, accent))}
        >
          <SidebarProfileButton
            className="flex-none gap-2 rounded-full bg-sidebar px-2 md:gap-3 md:pl-5 md:pr-3"
            onPress={() => router.push("/settings")}
          />
        </View>
      ) : (
        <Link
          href="/login"
          asChild
        >
          <Pressable className={cn("h-11 shrink-0 justify-center rounded-xl px-2", LANDING_FOCUS)}>
            <Text className="text-sm font-semibold">로그인</Text>
          </Pressable>
        </Link>
      )}
      <StartButton
        href="/app"
        label="시작하기"
        className="h-11 shrink-0 px-3 md:h-12 md:px-6"
      />
    </View>
  );
  const sections = (
    <View
      key="sections"
      role="navigation"
      aria-label="온보딩 섹션"
      className="w-full flex-row items-center justify-between md:order-2 md:w-auto md:gap-1 lg:gap-4"
    >
      {SLIDES.map(({ key, subject }) => {
        const isCurrent = key === activeSection;
        return (
          <LandingSectionLink
            key={key}
            section={key}
            aria-current={isCurrent ? "location" : undefined}
            className={cn(
              "h-11 min-w-11 items-center justify-center rounded-xl px-1",
              isCurrent && "bg-secondary",
            )}
          >
            <Text
              className={cn(
                "text-xs font-semibold md:text-sm",
                isCurrent && "underline underline-offset-4",
              )}
            >
              {subject}
            </Text>
          </LandingSectionLink>
        );
      })}
    </View>
  );

  return (
    <View
      role="banner"
      className={cn("z-10 shrink-0 bg-[color:var(--landing-header-surface)]", LANDING_TOP_GUTTER)}
    >
      <View
        testID="landing-frame"
        className={cn(
          LANDING_FRAME,
          "flex-row flex-wrap items-center justify-between py-1 md:flex-nowrap md:gap-4 md:py-2",
        )}
      >
        <View className="shrink-0 md:flex-1">
          <BrandHeader
            accent={accent}
            className="pt-0"
            mode={mode}
          />
        </View>
        {isWideView ? [sections, account] : [account, sections]}
      </View>
    </View>
  );
}

export { LandingHeader };
