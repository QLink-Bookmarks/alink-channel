import * as React from "react";
import { View } from "react-native";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { getAppVariant } from "@/lib/app-variant";

import { X } from "lucide-react-native/icons";

const APP_SCHEME = "qlinkchannel";

type MobilePlatform = "ios" | "android" | null;

type OpenInAppBannerProps = {
  token?: string | null;
  folderId?: string | null;
};

function detectMobilePlatform(): MobilePlatform {
  if (typeof navigator === "undefined") {
    return null;
  }
  if (/iPhone|iPad|iPod/i.test(navigator.userAgent)) {
    return "ios";
  }
  if (/Android/i.test(navigator.userAgent)) {
    return "android";
  }
  return null;
}

function getStoreUrl(platform: MobilePlatform): string | undefined {
  if (platform === "ios") {
    return process.env.EXPO_PUBLIC_IOS_APP_STORE_URL || undefined;
  }
  if (platform === "android") {
    return process.env.EXPO_PUBLIC_ANDROID_PLAY_STORE_URL || undefined;
  }
  return undefined;
}

function OpenInAppBanner({ token, folderId }: OpenInAppBannerProps) {
  const [dismissed, setDismissed] = React.useState(false);
  const [platform] = React.useState(detectMobilePlatform);
  const storeUrl = getStoreUrl(platform);
  const isProduction = getAppVariant() === "production";

  if (dismissed || !platform) {
    return null;
  }
  // Outside production, always surface the banner so testers can hand off to the
  // app even without a published store listing. In production keep it gated on a
  // store URL, otherwise "open in app" is a dead end for users without the app.
  if (isProduction && !storeUrl) {
    return null;
  }

  // With an invite in hand, hand off straight to it; otherwise just open the app.
  const deepLink =
    token && folderId
      ? `${APP_SCHEME}://invite?token=${encodeURIComponent(token)}&folderId=${encodeURIComponent(
          folderId,
        )}`
      : `${APP_SCHEME}://`;

  // Try to hand off to the installed app. If the page never backgrounds (app not
  // installed), fall back to the store, or tell the user no app is installed.
  const handleOpenApp = () => {
    let backgrounded = false;
    const onVisibilityChange = () => {
      if (document.hidden) {
        backgrounded = true;
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.location.href = deepLink;

    window.setTimeout(() => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      if (!backgrounded && !document.hidden) {
        if (storeUrl) {
          window.location.href = storeUrl;
        } else {
          window.alert("설치된 앱이 없어요. 개발자에게 문의해주세요.");
        }
      }
    }, 1500);
  };

  return (
    <View className="flex-row items-center gap-3 border-b border-border bg-card px-4 py-3">
      <View className="min-w-0 flex-1">
        <Text className="text-sm font-semibold text-foreground">저희 앱도 있어요..</Text>
        <Text className="text-xs text-muted-foreground">앱도 한 번 써보시죠</Text>
      </View>
      <Button
        className="self-center"
        size="sm"
        variant="gradient"
        onPress={handleOpenApp}
      >
        <Text className="whitespace-nowrap">앱에서 열기</Text>
      </Button>
      <Button
        accessibilityLabel="배너 닫기"
        className="self-center"
        size="icon"
        variant="ghost"
        onPress={() => setDismissed(true)}
      >
        <Icon
          as={X}
          size={16}
          className="text-muted-foreground"
        />
      </Button>
    </View>
  );
}

export { OpenInAppBanner };
export type { OpenInAppBannerProps };
