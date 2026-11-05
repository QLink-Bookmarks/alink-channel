import * as React from "react";
import { View } from "react-native";

import { Icon } from "@/components/ui/icon";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";

import { Image, type ImageLoadEventData, type ImageSource } from "expo-image";
import { Play, Pointer } from "lucide-react-native/icons";
import { cssInterop } from "nativewind";

// expo-image is third-party, so NativeWind needs the className → style mapping on native.
cssInterop(Image, { className: "style" });

type LinkThumbnailSize = "default" | "small";
/** A bundled image from `require(...)`: a number on native, an asset object on web. */
type ThumbnailAsset = number | ImageSource;
/** A remote image URL, or a bundled image. */
type ThumbnailSource = string | ThumbnailAsset;

type LinkThumbnailProps = {
  className?: string;
  /** Shown in the fallback, and its first letter fills the small cell. */
  domain: string;
  /** Representative image. When it fails to load, only the domain is shown. */
  thumbnailUrl?: string | null;
  /** Bundled representative image (`require(...)`), used instead of `thumbnailUrl` by the landing and onboarding sample cards. */
  thumbnailAsset?: ThumbnailAsset;
  /** Used only when there is no representative image. */
  faviconUrl?: string | null;
  isVideo?: boolean;
  /** `default` is a 16:9 frame that fills its width; `small` is the 22px todo-card cell. */
  size?: LinkThumbnailSize;
  /**
   * What the fallback shows when there is no usable representative image.
   * `favicon`: the stored favicon and the domain (domain only when the favicon is missing or broken).
   * `domain`: the domain only (link detail).
   */
  fallback?: "favicon" | "domain";
  /** Icon without text: play for video links, a small faint pointer for the rest (centered on an image, under the domain in the fallback). */
  showHint?: boolean;
  /** "▶ 영상" badge at the bottom left, for video links with an image. */
  showVideoBadge?: boolean;
  /** Keeps the frame and shows a loading state, e.g. while a preview is being fetched. */
  loading?: boolean;
  /** `auto` fits portrait images inside the frame instead of cropping them. */
  fit?: "cover" | "auto";
  testID?: string;
};

function VideoBadge() {
  return (
    <View className="absolute bottom-1.5 left-1.5 flex-row items-center gap-1 rounded-full bg-background/90 py-0.5 pl-1 pr-1.5">
      <Icon
        as={Play}
        size={10}
        fill="currentColor"
        className="text-foreground"
      />
      <Text className="text-xs font-semibold text-foreground">영상</Text>
    </View>
  );
}

function CenterHint({ compact }: { compact: boolean }) {
  return (
    <View
      className={cn(
        "pointer-events-none absolute items-center",
        compact ? "inset-x-0 bottom-3" : "inset-0 justify-center",
      )}
      testID="link-thumbnail-hint-play"
    >
      <View
        className={cn(
          "items-center justify-center rounded-full border border-border-soft bg-background/90",
          compact ? "size-9" : "size-[52px]",
        )}
      >
        <Icon
          as={Play}
          size={compact ? 16 : 22}
          fill="currentColor"
          className="ml-0.5 text-foreground"
        />
      </View>
    </View>
  );
}

function OpenHint({ compact }: { compact: boolean }) {
  return (
    <View
      className={cn(
        "pointer-events-none absolute items-center",
        compact ? "inset-x-0 bottom-3" : "inset-0 justify-center",
      )}
      testID="link-thumbnail-hint-open"
    >
      <View className="size-9 items-center justify-center rounded-full border border-border-soft/60 bg-background/60">
        <Icon
          as={Pointer}
          size={15}
          className="text-foreground/70"
        />
      </View>
    </View>
  );
}

function LinkThumbnail({
  className,
  domain,
  thumbnailUrl,
  thumbnailAsset,
  faviconUrl,
  isVideo = false,
  size = "default",
  fallback = "favicon",
  showHint = false,
  showVideoBadge = false,
  loading = false,
  fit = "cover",
  testID = "link-thumbnail",
}: LinkThumbnailProps) {
  const [failedUrls, setFailedUrls] = React.useState<ThumbnailSource[]>([]);
  const [loadedUrl, setLoadedUrl] = React.useState<ThumbnailSource | null>(null);
  const [isPortrait, setIsPortrait] = React.useState(false);

  const isSmall = size === "small";
  const thumbnailSource = thumbnailAsset ?? thumbnailUrl ?? null;
  const thumbnail =
    thumbnailSource !== null && !failedUrls.includes(thumbnailSource) ? thumbnailSource : null;
  // The favicon stands in only for a link that has no representative image at all.
  const favicon =
    thumbnailSource === null && faviconUrl && !failedUrls.includes(faviconUrl) ? faviconUrl : null;
  const showFavicon = Boolean(favicon) && (isSmall || fallback === "favicon");
  const isImageLoading = thumbnail !== null && loadedUrl !== thumbnail;
  const showPlayHint = showHint && isVideo;
  const showOpenHint = showHint && !isVideo;

  const handleError = React.useCallback((url: ThumbnailSource) => {
    setFailedUrls((current) => (current.includes(url) ? current : [...current, url]));
  }, []);

  const handleThumbnailLoad = React.useCallback(
    (url: ThumbnailSource, event: ImageLoadEventData) => {
      setLoadedUrl(url);
      const { width, height } = event.source ?? {};
      setIsPortrait(Boolean(width && height && height > width));
    },
    [],
  );

  const frameClassName = cn(
    "relative items-center justify-center overflow-hidden bg-muted",
    isSmall ? "size-[22px] rounded-md border border-border-soft" : "aspect-video w-full",
    className,
  );

  if (loading) {
    return (
      <View
        className={frameClassName}
        testID={`${testID}-loading`}
        accessibilityLabel="이미지 불러오는 중"
      >
        <Skeleton className="absolute inset-0 rounded-none" />
      </View>
    );
  }

  if (thumbnail !== null) {
    return (
      <View
        className={frameClassName}
        testID={testID}
      >
        {isImageLoading ? (
          <Skeleton
            className="absolute inset-0 rounded-none"
            testID={`${testID}-image-loading`}
          />
        ) : null}
        <Image
          accessibilityIgnoresInvertColors
          className="absolute inset-0 size-full"
          contentFit={fit === "auto" && isPortrait ? "contain" : "cover"}
          source={typeof thumbnail === "string" ? { uri: thumbnail } : thumbnail}
          testID={`${testID}-image`}
          transition={120}
          onError={() => handleError(thumbnail)}
          onLoad={(event) => handleThumbnailLoad(thumbnail, event)}
        />
        {!isSmall && isVideo && showVideoBadge ? <VideoBadge /> : null}
        {!isSmall && showPlayHint ? <CenterHint compact={false} /> : null}
        {!isSmall && showOpenHint ? <OpenHint compact={false} /> : null}
      </View>
    );
  }

  if (isSmall) {
    return (
      <View
        className={frameClassName}
        testID={`${testID}-fallback`}
      >
        {showFavicon && favicon ? (
          <Image
            accessibilityIgnoresInvertColors
            className="size-full"
            contentFit="cover"
            source={{ uri: favicon }}
            onError={() => handleError(favicon)}
          />
        ) : (
          <Text className="text-[10px] font-bold text-muted-foreground">
            {domain.slice(0, 1).toUpperCase()}
          </Text>
        )}
      </View>
    );
  }

  return (
    <View
      className={frameClassName}
      testID={`${testID}-fallback`}
    >
      <View className={cn("items-center justify-center gap-2 px-3", showHint && "pb-10")}>
        {showFavicon && favicon ? (
          <View className="size-10 overflow-hidden rounded-xl border border-border-soft bg-card">
            <Image
              accessibilityIgnoresInvertColors
              className="size-full"
              contentFit="cover"
              source={{ uri: favicon }}
              testID={`${testID}-favicon`}
              onError={() => handleError(favicon)}
            />
          </View>
        ) : null}
        <Text
          className={cn(
            "text-center text-muted-foreground",
            fallback === "domain" ? "text-sm font-semibold" : "text-[11px]",
          )}
          numberOfLines={1}
        >
          {domain}
        </Text>
      </View>
      {showPlayHint ? <CenterHint compact /> : null}
      {showOpenHint ? <OpenHint compact /> : null}
    </View>
  );
}

export { LinkThumbnail };
export type { LinkThumbnailProps, LinkThumbnailSize };
