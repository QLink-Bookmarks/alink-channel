import { Pressable, View } from "react-native";

import { Text } from "@/components/ui/text";
import type { TodoCountSummary } from "@/features/home/lib/link-card-mapper";
import { cn } from "@/lib/utils";

import { formatTagLabel } from "../../lib/format-tag-label";
import type { ContentSnippet } from "../../types";
import { LinkThumbnail } from "../link-thumbnail/link-thumbnail";
import { HighlightedText } from "../snippet-text/highlighted-text";
import { SnippetText, getSnippetLabel } from "../snippet-text/snippet-text";
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
  /** One muted line under the domain (the page excerpt); null hides the line. */
  excerpt?: string | null;
  /** Search context shown in place of the excerpt, two lines, ranges in bold. */
  snippet?: ContentSnippet | null;
  /** While searching: the query whose matches are highlighted in the title. */
  highlightQuery?: string;
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
 * Link card: 16:9 image cell, then title (two lines), domain and status, an optional excerpt
 * line (or search context), tags and todo counts. Every other part below the image has a
 * fixed height; only the excerpt line comes and goes. The card fills the height of a column
 * parent (such as a grid cell), so cards side by side in a row match the tallest one, with the
 * tags and todo counts at the bottom.
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
  excerpt,
  snippet,
  highlightQuery,
  active,
  statusLabel,
  statusVariant,
  bookmarkHoverAction,
  bookmarkPinned,
  trailingHoverActions,
  onPress,
  onImagePress,
}: LinkCardProps) {
  // While searching, the context says why the card matched; the domain is left out because
  // the image cell already reads it.
  const snippetLabel = snippet ? getSnippetLabel(snippet.text) : "";
  return (
    <View
      className={cn(
        // grow fills the grid cell stretched to the row's tallest card; without it iOS debug builds can abort on a Yoga assertion (#94).
        "group relative grow overflow-hidden rounded-[14px] border border-border bg-card",
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
        accessibilityLabel={snippetLabel ? `${title}, ${snippetLabel}` : title}
        className="grow gap-1.5 px-3 pb-3 pt-2.5"
        testID="link-card-body"
        onPress={onPress}
      >
        {highlightQuery?.trim() ? (
          <HighlightedText
            className="h-9 text-[13px] font-semibold leading-[18px] text-foreground"
            numberOfLines={2}
            query={highlightQuery}
            testID="link-card-title"
            text={title}
          />
        ) : (
          <Text
            className="h-9 text-[13px] font-semibold leading-[18px] text-foreground"
            numberOfLines={2}
            testID="link-card-title"
          >
            {title}
          </Text>
        )}
        <View className="h-[18px] min-w-0 flex-row items-center justify-between gap-2">
          <Text
            className="min-w-[25%] flex-1 text-[11px] text-muted-foreground"
            numberOfLines={1}
          >
            {domain}
          </Text>
          {statusLabel ? (
            <Text
              className={cn(
                "min-w-0 shrink text-[11px] font-semibold",
                statusVariant ? statusVariantClasses[statusVariant] : "text-muted-foreground",
              )}
              numberOfLines={1}
              testID="link-card-status"
            >
              {statusLabel}
            </Text>
          ) : null}
        </View>
        {snippet ? (
          <SnippetText
            className="text-xs leading-[18px] text-muted-foreground"
            highlights={snippet.highlights}
            numberOfLines={2}
            testID="link-card-snippet"
            text={snippet.text}
          />
        ) : excerpt ? (
          <Text
            className="text-xs leading-[18px] text-muted-foreground"
            numberOfLines={1}
            testID="link-card-excerpt"
          >
            {excerpt}
          </Text>
        ) : null}
        <View className="mt-auto h-5 min-w-0 flex-row items-center gap-2">
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
                  className="text-xs font-medium text-muted-foreground"
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
