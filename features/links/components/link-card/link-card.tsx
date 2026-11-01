import { Pressable, View } from "react-native";

import { Text } from "@/components/ui/text";
import type { TodoCountSummary } from "@/features/home/lib/link-card-mapper";
import { cn } from "@/lib/utils";

import { formatTagLabel } from "../../lib/format-tag-label";
import { LinkThumbnail } from "../link-thumbnail/link-thumbnail";
import { TodoCountBadge } from "./todo-count-badge";

type LinkCardStatusVariant = "progress" | "success" | "error" | null;

const statusVariantClasses: Record<NonNullable<LinkCardStatusVariant>, string> = {
  progress: "text-primary",
  success: "text-muted-foreground",
  error: "text-destructive",
};

type LinkCardProps = {
  className?: string;
  domain: string;
  title: string;
  tags?: string[];
  thumbnailUrl?: string | null;
  /** Bundled image (`require(...)`) for the landing and onboarding sample cards. */
  thumbnailAsset?: React.ComponentProps<typeof LinkThumbnail>["thumbnailAsset"];
  faviconUrl?: string | null;
  isVideo?: boolean;
  /** Linked todo counts; null hides them. */
  todoCounts?: TodoCountSummary | null;
  active?: boolean;
  statusLabel?: string | null;
  statusVariant?: LinkCardStatusVariant;
  /** Star badge at the image's top-left (shortcut toggle). */
  bookmarkHoverAction?: React.ReactNode;
  /** When true the star stays visible (no hover required). Use for favorited links. */
  bookmarkPinned?: boolean;
  /** Wide-only buttons at the image's top-right, shown on hover. */
  trailingHoverActions?: React.ReactNode;
  /** Pressing anywhere but the image cell, e.g. to open the detail. */
  onPress?: () => void;
  /** Pressing the image cell, e.g. to open the original link. Falls back to `onPress`. */
  onImagePress?: () => void;
};

/**
 * Link card: 16:9 image cell, then title (two lines), domain and status, tags and todo counts.
 * Every part below the image has a fixed height, so all cards in a row are the same height.
 */
function LinkCard({
  className,
  domain,
  title,
  tags = [],
  thumbnailUrl,
  thumbnailAsset,
  faviconUrl,
  isVideo = false,
  todoCounts,
  active,
  statusLabel,
  statusVariant,
  bookmarkHoverAction,
  bookmarkPinned,
  trailingHoverActions,
  onPress,
  onImagePress,
}: LinkCardProps) {
  return (
    <View
      className={cn(
        "group relative overflow-hidden rounded-[14px] border border-border bg-card",
        "web:transition-colors web:hover:border-primary",
        active && "border-primary",
        className,
      )}
      testID="link-card"
    >
      <Pressable
        accessibilityLabel={`원본 열기, ${domain}`}
        accessibilityRole="link"
        className="border-b border-border-soft"
        testID="link-card-image"
        onPress={onImagePress ?? onPress}
      >
        <LinkThumbnail
          domain={domain}
          faviconUrl={faviconUrl}
          isVideo={isVideo}
          showVideoBadge
          thumbnailUrl={thumbnailUrl}
          thumbnailAsset={thumbnailAsset}
        />
      </Pressable>
      <Pressable
        // No button role: the todo counts inside are a tooltip trigger, and a button must not
        // contain another button on web.
        accessibilityHint="상세 열기"
        accessibilityLabel={title}
        className="gap-1.5 px-3 pb-3 pt-2.5"
        testID="link-card-body"
        onPress={onPress}
      >
        <Text
          className="h-9 text-[13px] font-semibold leading-[18px] text-foreground"
          numberOfLines={2}
          testID="link-card-title"
        >
          {title}
        </Text>
        <View className="h-[18px] min-w-0 flex-row items-center justify-between gap-2">
          <Text
            className="min-w-0 flex-1 text-[11px] text-muted-foreground"
            numberOfLines={1}
          >
            {domain}
          </Text>
          {statusLabel ? (
            <Text
              className={cn(
                "shrink-0 text-[11px] font-semibold",
                statusVariant ? statusVariantClasses[statusVariant] : "text-muted-foreground",
              )}
              numberOfLines={1}
              testID="link-card-status"
            >
              {statusLabel}
            </Text>
          ) : null}
        </View>
        <View className="h-5 min-w-0 flex-row items-center gap-2">
          {/* Tags that do not fit wrap out of the fixed-height row instead of being cut. */}
          <View
            className="h-5 min-w-0 flex-1 flex-row flex-wrap content-start items-center gap-1.5 overflow-hidden"
            testID="link-card-tags"
          >
            {tags.map((tag) => (
              <View
                key={tag}
                className="max-w-full shrink rounded-lg border border-border-soft bg-surface-elevated px-1.5 py-px"
              >
                <Text
                  className="text-[10.5px] font-medium text-muted-foreground"
                  numberOfLines={1}
                >
                  {formatTagLabel(tag)}
                </Text>
              </View>
            ))}
          </View>
          {todoCounts ? (
            <TodoCountBadge
              summary={todoCounts}
              onPress={onPress}
            />
          ) : null}
        </View>
      </Pressable>
      {bookmarkHoverAction ? (
        <View
          className={cn(
            "absolute left-1.5 top-1.5 z-10",
            !(active || bookmarkPinned) &&
              "hidden web:group-focus-within:flex web:group-hover:flex",
          )}
        >
          {bookmarkHoverAction}
        </View>
      ) : null}
      {trailingHoverActions ? (
        <View
          className={cn(
            "absolute right-1.5 top-1.5 z-10 flex-row gap-0.5 rounded-xl border border-border-soft bg-card p-1",
            !active && "hidden web:group-focus-within:flex web:group-hover:flex",
          )}
          testID="link-card-hover-actions"
        >
          {trailingHoverActions}
        </View>
      ) : null}
    </View>
  );
}

export { LinkCard };
export type { LinkCardProps, LinkCardStatusVariant };
