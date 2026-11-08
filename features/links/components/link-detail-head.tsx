import * as React from "react";
import { Pressable, View } from "react-native";

import { ActivityIndicator } from "@/components/ui/activity-indicator";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { formatLinkStatus, getDomainFromUrl } from "@/features/home/lib/link-card-mapper";
import { openLinkUrl } from "@/features/links/lib/open-link-url";
import type { LinkDetail } from "@/features/links/types";
import { cn } from "@/lib/utils";

import { FOCUS_RING_CLASS_NAME, HoverLabel } from "./link-detail-parts";
import { LinkThumbnail } from "./link-thumbnail/link-thumbnail";

import { ExternalLink } from "lucide-react-native/icons";

type LinkDetailHeadProps = {
  mode: "panel" | "screen";
  url: string;
  title: string;
  thumbnailUrl?: string | null;
  faviconUrl?: string | null;
  isVideo?: boolean;
  status?: LinkDetail["status"];
  workModel?: string | null;
};

const SOURCE_HIT_SLOP = { top: 12, bottom: 12, left: 4, right: 4 };

// What the link is: the representative image (a low domain fallback without one), the
// title, and one meta line with the source and the AI status.
function LinkDetailHeadBase({
  mode,
  url,
  title,
  thumbnailUrl,
  faviconUrl,
  isVideo,
  status,
  workModel,
}: LinkDetailHeadProps) {
  const domain = React.useMemo(() => getDomainFromUrl(url), [url]);
  const statusMeta = formatLinkStatus(status, workModel);
  const hasImage = Boolean(thumbnailUrl);
  const handleOpenOriginal = React.useCallback(() => openLinkUrl(url), [url]);

  return (
    <>
      <HoverLabel label="원본 열기">
        <Pressable
          accessibilityLabel="원본 열기"
          accessibilityRole="link"
          className={cn(
            "overflow-hidden rounded-[14px] border border-border-soft",
            "web:transition-colors web:hover:border-primary",
            FOCUS_RING_CLASS_NAME,
          )}
          testID="link-detail-image"
          onPress={handleOpenOriginal}
        >
          <LinkThumbnail
            className={cn(hasImage ? "max-h-[240px]" : "aspect-auto h-[120px] bg-surface-elevated")}
            domain={domain}
            fallback="favicon"
            faviconUrl={faviconUrl}
            fit="auto"
            isVideo={isVideo}
            showHint={hasImage}
            testID="link-detail-thumbnail"
            thumbnailUrl={thumbnailUrl}
          />
        </Pressable>
      </HoverLabel>

      <View className="gap-1.5">
        <Text
          aria-level={1}
          className={cn(
            "font-bold text-foreground",
            mode === "panel" ? "text-2xl leading-[27px]" : "text-xl leading-[24.3px]",
          )}
          role="heading"
          testID="link-detail-title"
        >
          {title}
        </Text>
        <View
          className="flex-row flex-wrap items-center gap-1.5"
          testID="link-detail-meta"
        >
          <Pressable
            accessibilityLabel={`원본 열기, ${domain}`}
            accessibilityRole="link"
            className={cn(
              "group min-w-0 shrink flex-row items-center gap-1.5 rounded-sm",
              FOCUS_RING_CLASS_NAME,
            )}
            hitSlop={SOURCE_HIT_SLOP}
            testID="link-detail-source"
            onPress={handleOpenOriginal}
          >
            <LinkThumbnail
              className="size-4 rounded"
              domain={domain}
              faviconUrl={faviconUrl}
              size="small"
              testID="link-detail-favicon"
            />
            <Text
              className="min-w-0 shrink text-xs font-medium text-muted-foreground web:group-hover:text-foreground web:group-hover:underline"
              numberOfLines={1}
            >
              {domain}
            </Text>
            <Icon
              as={ExternalLink}
              size={12}
              className="text-muted-foreground"
            />
          </Pressable>
          {statusMeta.label ? (
            <>
              <Text className="text-xs text-muted-foreground opacity-60">·</Text>
              <View
                className="flex-row items-center gap-1.5"
                testID="link-detail-status"
              >
                {statusMeta.variant === "progress" ? <ActivityIndicator size="small" /> : null}
                <Text
                  className={cn(
                    "text-xs font-semibold",
                    statusMeta.variant === "progress" && "text-primary",
                    statusMeta.variant === "error" && "text-destructive",
                    statusMeta.variant === "success" && "text-muted-foreground",
                  )}
                >
                  {statusMeta.label}
                </Text>
              </View>
            </>
          ) : null}
        </View>
      </View>
    </>
  );
}

const LinkDetailHead = React.memo(LinkDetailHeadBase);

export { LinkDetailHead };
