import { View } from "react-native";

import { AppStoreBadge } from "@/components/ui/app-store-badge";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { getThemeTokens } from "@/lib/theme";
import { getNativeThemeVars } from "@/lib/theme-vars";
import { useDisplaySettings } from "@/stores/display-settings";

import { LandingSectionLink, StartButton } from "./landing-chrome";

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
      className="relative aspect-[1.14] w-full max-w-[420px] self-center overflow-hidden md:max-w-[660px]"
      style={
        {
          borderRadius: "38% 38% 9% 9%",
          backgroundImage:
            "radial-gradient(ellipse at 68% 34%, #fff2df, transparent 60%), linear-gradient(135deg, #efd9e4, #e1d1ef)",
        } as never
      }
    >
      <View
        aria-hidden
        className="absolute left-[34%] top-[5%] h-[88%] w-[41%] justify-center gap-1 overflow-hidden rounded-[22px] border-[4px] border-[#28252D] bg-[#151219] shadow-qlink-lg md:rounded-[32px] md:border-[6px]"
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
        className="absolute bottom-[18%] left-[16%] h-14 origin-left -rotate-[4deg] flex-row items-center gap-2.5 rounded-full bg-card pl-3 pr-5 shadow-qlink-lg max-md:scale-[0.82]"
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
      className="w-full px-[22px]"
      style={
        {
          backgroundImage:
            "radial-gradient(ellipse at 92% 75%, #f5dce5, transparent 54%), radial-gradient(ellipse at 5% 0%, #ede4fc, transparent 56%), linear-gradient(#faf6f1, #faf6f1)",
        } as never
      }
    >
      <View
        testID="landing-frame"
        className="mx-auto min-h-[calc(100svh-96px)] w-full max-w-[1280px] gap-2 pb-2 pt-5 md:min-h-[calc(100svh-64px)] md:pt-0"
      >
        <View className="flex-1 flex-col justify-center gap-[22px] md:flex-row md:items-center md:gap-8">
          <View className="min-w-0 items-start gap-[18px] md:flex-[0.86] md:gap-6">
            <Text
              variant="h1"
              className="text-left text-[clamp(33px,11.54vw,45px)] font-extrabold leading-[1.1] tracking-[-0.04em] text-[#292536] md:text-[clamp(38px,5.15vw,78px)]"
            >
              다시 찾을 링크,{"\n"}한곳에 모아요.
            </Text>
            <Text className="text-base text-[#595165] md:text-[clamp(16px,1.55vw,22px)]">
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
