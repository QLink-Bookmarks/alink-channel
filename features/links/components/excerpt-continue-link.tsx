import { Pressable } from "react-native";

import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { openLinkUrl } from "@/features/links/lib/open-link-url";

import { ExternalLink } from "lucide-react-native/icons";

type ExcerptContinueLinkProps = {
  /** The original page, opened with the system handler. */
  url: string;
};

// The 20pt line + 12pt above and below = 44pt; 6pt to each side.
const EXCERPT_LINK_HIT_SLOP = { top: 12, bottom: 12, left: 6, right: 6 };

// A long press selects the excerpt text; without a handler the release would still open
// the original.
function handleLongPress() {}

/**
 * Native: "이어 읽기" inside the excerpt paragraph. A nested Text takes no hitSlop, so an
 * inline Pressable reaches 44pt instead. A short press opens the original.
 */
function ExcerptContinueLink({ url }: ExcerptContinueLinkProps) {
  return (
    <Pressable
      accessibilityLabel="이어 읽기"
      accessibilityRole="link"
      className="flex-row items-center gap-0.5"
      hitSlop={EXCERPT_LINK_HIT_SLOP}
      testID="link-detail-continue"
      onLongPress={handleLongPress}
      onPress={() => openLinkUrl(url)}
    >
      <Text className="text-[13px] font-semibold leading-5 text-foreground underline">
        이어 읽기
      </Text>
      <Icon
        as={ExternalLink}
        className="text-foreground"
        size={13}
      />
    </Pressable>
  );
}

export { ExcerptContinueLink };
export type { ExcerptContinueLinkProps };
