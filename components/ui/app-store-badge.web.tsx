import { Linking, Pressable } from "react-native";

import { cn } from "@/lib/utils";

import { Image } from "expo-image";

const BADGE_SOURCE = "/app-store-badge-ko.svg";
// Matches the badge artwork ratio (129.7 x 40) so nothing is letterboxed.
const BADGE_WIDTH = 130;
const BADGE_HEIGHT = 40;

type AppStoreBadgeProps = {
  className?: string;
  storeUrl?: string;
};

// Apple's official "Download on the App Store" badge. Hidden when no store URL
// is configured so it never links nowhere.
function AppStoreBadge({
  className,
  storeUrl = process.env.EXPO_PUBLIC_IOS_APP_STORE_URL,
}: AppStoreBadgeProps) {
  if (!storeUrl) {
    return null;
  }

  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel="App Store에서 에이링크 다운로드"
      className={cn("active:opacity-70 web:transition-opacity", className)}
      onPress={() => Linking.openURL(storeUrl)}
    >
      <Image
        source={BADGE_SOURCE}
        style={{ width: BADGE_WIDTH, height: BADGE_HEIGHT }}
        contentFit="contain"
        alt="App Store에서 다운로드"
      />
    </Pressable>
  );
}

export { AppStoreBadge };
export type { AppStoreBadgeProps };
