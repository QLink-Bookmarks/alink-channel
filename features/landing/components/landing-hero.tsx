import { View } from "react-native";

import { AppStoreBadge } from "@/components/ui/app-store-badge";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";

import {
  LANDING_FRAME,
  LANDING_TOP_GUTTER,
  LandingSectionLink,
  StartButton,
} from "./landing-chrome";

import { Image } from "expo-image";
import { ArrowDown } from "lucide-react-native/icons";

const YOUTUBE_SHARE_CAPTURE = require("@/assets/landing/kaiju-youtube-share.webp");
const SCENE_LABEL =
  "sakanaction의 怪獣 공식 뮤직비디오 YouTube 시청 페이지에서 공유 시트가 열린 화면";

function YouTubeShareScene() {
  return (
    <View
      role="img"
      aria-label={SCENE_LABEL}
      className="h-[clamp(320px,105vw,400px)] w-full max-w-[420px] items-center self-center rounded-b-[9%] rounded-t-[38%] py-4 md:h-[clamp(340px,48vw,550px)] md:max-w-[660px] md:py-5"
      style={
        {
          backgroundImage:
            "radial-gradient(ellipse at 68% 34%, var(--landing-stage-glow), transparent 60%), linear-gradient(135deg, var(--landing-stage-rose), var(--landing-stage-lavender))",
        } as never
      }
    >
      <View
        aria-hidden
        className="aspect-[420/757] h-full max-w-full overflow-hidden rounded-[20px] bg-[color:var(--landing-device-frame)] p-1 shadow-qlink-lg md:rounded-[26px]"
      >
        <Image
          accessible={false}
          source={YOUTUBE_SHARE_CAPTURE}
          className="size-full rounded-[16px] md:rounded-[22px]"
          contentFit="contain"
        />
      </View>
    </View>
  );
}

function LandingHero() {
  return (
    <View
      nativeID="landing-intro"
      className={cn("w-full bg-[color:var(--landing-hero-surface)]", LANDING_TOP_GUTTER)}
      style={
        {
          backgroundImage:
            "radial-gradient(ellipse at 92% 75%, var(--landing-hero-rose), transparent 54%), radial-gradient(ellipse at 5% 0%, var(--landing-hero-lavender), transparent 56%)",
        } as never
      }
    >
      <View
        testID="landing-frame"
        className={cn(
          LANDING_FRAME,
          "min-h-[calc(100svh-96px)] gap-2 pb-2 pt-5 md:min-h-[calc(100svh-64px)] md:pt-0",
        )}
      >
        <View className="flex-1 flex-col justify-center gap-[22px] md:flex-row md:items-center md:gap-8">
          <View className="min-w-0 items-start gap-[18px] md:flex-[0.86] md:gap-6">
            <Text
              variant="h1"
              className="text-left text-[clamp(33px,11.54vw,45px)] font-extrabold leading-[1.1] tracking-[-0.04em] text-[color:var(--landing-hero-foreground)] md:text-[clamp(38px,5.15vw,78px)]"
            >
              다시 찾을 링크,{"\n"}한곳에 모아요.
            </Text>
            <Text className="text-base text-[color:var(--landing-hero-muted)] md:text-[clamp(16px,1.55vw,22px)]">
              AI가 도와주는 북마크 아카이브.
            </Text>
            <StartButton
              href="/app"
              label="웹으로 시작하기"
            />
          </View>
          <View className="w-full min-w-0 md:w-auto md:flex-[1.14]">
            <YouTubeShareScene />
          </View>
        </View>
        <AppStoreBadge className="self-start md:absolute md:bottom-3 md:left-0" />
        <LandingSectionLink
          section="organize"
          accessibilityLabel="Archive 섹션으로"
          className="size-11 items-center justify-center self-center rounded-xl"
        >
          <Icon
            as={ArrowDown}
            size={20}
            className="text-muted-foreground"
          />
        </LandingSectionLink>
      </View>
    </View>
  );
}

export { LandingHero };
