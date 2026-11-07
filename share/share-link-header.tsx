import * as React from "react";
import { View } from "react-native";

import { Icon } from "@/components/ui/icon";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";

import { Image } from "expo-image";
import { Globe } from "lucide-react-native/icons";

type ShareLinkHeaderProps = {
  title: string;
  domain: string;
  thumbnailUri: string | null;
  isThumbnailPending: boolean;
};

function ShareLinkHeader({
  title,
  domain,
  thumbnailUri,
  isThumbnailPending,
}: ShareLinkHeaderProps) {
  const [failedUri, setFailedUri] = React.useState<string | null>(null);
  const shownUri = thumbnailUri && thumbnailUri !== failedUri ? thumbnailUri : null;

  return (
    <View className="flex-row items-center gap-3 px-1 pt-1">
      <View className="size-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border-soft bg-muted">
        {shownUri ? (
          <Image
            accessibilityIgnoresInvertColors
            className="size-14"
            contentFit="cover"
            source={{ uri: shownUri }}
            style={{ width: 56, height: 56 }}
            onError={() => setFailedUri(shownUri)}
          />
        ) : isThumbnailPending ? (
          <Skeleton className="size-14 rounded-none bg-muted" />
        ) : (
          <Icon
            as={Globe}
            className="text-muted-foreground"
            size={26}
          />
        )}
      </View>
      <View className="min-w-0 flex-1 gap-0.5">
        <Text
          className="text-base font-semibold leading-[21px] text-foreground"
          numberOfLines={2}
        >
          {title}
        </Text>
        <Text
          className="text-[13px] leading-[18px] text-muted-foreground"
          numberOfLines={1}
        >
          {domain}
        </Text>
      </View>
    </View>
  );
}

export { ShareLinkHeader };
