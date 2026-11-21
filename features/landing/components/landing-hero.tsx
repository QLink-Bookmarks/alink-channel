import { View } from "react-native";

import { AppStoreBadge } from "@/components/ui/app-store-badge";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { getThemeTokens } from "@/lib/theme";
import { getNativeThemeVars } from "@/lib/theme-vars";
import { cn } from "@/lib/utils";
import { useDisplaySettings } from "@/stores/display-settings";

import {
  LANDING_FRAME,
  LANDING_TOP_GUTTER,
  LandingSectionLink,
  StartButton,
} from "./landing-chrome";

import { Image } from "expo-image";
import { ArrowDown, CircleCheck } from "lucide-react-native/icons";
import { vars } from "nativewind";

const KAIJU_THUMBNAIL = require("@/assets/sample-links/sakanaction-kaiju.jpg");
const SCENE_LABEL =
  "sakanaction의 怪獣 뮤직비디오 링크를 저장한 기기와 ALink의 Archived 저장 완료 표시";

function ArchivedScene() {
  const accent = useDisplaySettings((state) => state.display.accent);
  const mode = useDisplaySettings((state) => state.display.theme);
  const { success } = getThemeTokens(mode, accent);

  return (
    <View
      role="img"
      aria-label={SCENE_LABEL}
      testID="landing-archived-scene"
      className="relative aspect-[1.14] w-full max-w-[420px] self-center overflow-hidden rounded-b-[9%] rounded-t-[38%] md:max-w-[660px]"
      style={
        {
          backgroundImage:
            "radial-gradient(ellipse at 68% 34%, var(--landing-stage-glow), transparent 60%), linear-gradient(135deg, var(--landing-stage-rose), var(--landing-stage-lavender))",
        } as never
      }
    >
      <View
        aria-hidden
        className="absolute left-[34%] top-[5%] h-[88%] w-[41%] justify-center gap-1 overflow-hidden rounded-[22px] border-[4px] border-[color:var(--landing-device-frame)] bg-[color:var(--landing-device-surface)] shadow-qlink-lg md:rounded-[32px] md:border-[6px]"
        style={{ transform: [{ rotate: "5deg" }] }}
      >
        <Image
          source={KAIJU_THUMBNAIL}
          style={{ aspectRatio: 16 / 9, width: "100%" }}
          contentFit="cover"
        />
        <Text className="px-2 text-[10px] font-bold text-white md:text-[clamp(10px,1.15vw,16px)]">
          怪獣 -Music Video-
        </Text>
        <Text className="px-2 text-[8px] text-white/85 md:text-[clamp(8px,0.9vw,13px)]">
          サカナクション sakanaction
        </Text>
      </View>
      <View
        aria-hidden
        className="absolute bottom-[8%] left-[16%] h-14 origin-left -rotate-[4deg] flex-row items-center gap-2.5 rounded-full bg-card pl-3 pr-5 shadow-qlink-lg max-md:scale-[0.82] xl:bottom-[18%]"
        style={vars(getNativeThemeVars(mode, accent))}
      >
        <Icon
          as={CircleCheck}
          size={32}
          color={success}
        />
        <Text className="text-xl font-semibold">Archived</Text>
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
            <ArchivedScene />
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
