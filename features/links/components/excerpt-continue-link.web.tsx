import type * as React from "react";
import { Text as RNText } from "react-native";

import { Icon } from "@/components/ui/icon";
import { useWideView } from "@/lib/hooks/use-wide-view";
import { cn } from "@/lib/utils";

import { ExternalLink } from "lucide-react-native/icons";

type ExcerptContinueLinkProps = {
  /** The original page, opened in a new tab. */
  url: string;
};

type LinkTextProps = React.ComponentProps<typeof RNText> & {
  href: string;
  hrefAttrs: { target: string; rel: string };
};

// react-native-web renders a Text with `href` as an <a>; React Native's types do not list it.
const LinkText = RNText as unknown as React.ComponentType<LinkTextProps>;

/**
 * Web: "이어 읽기" as a real link inside the excerpt paragraph, so Enter, ⌘-click and the
 * context menu work like any link. No onPress: the browser opens the one new tab. On mobile,
 * inline vertical padding widens the press area to 44px without moving the line. The no-break
 * spaces keep "이어 읽기" and its icon together.
 */
function ExcerptContinueLink({ url }: ExcerptContinueLinkProps) {
  const isWideView = useWideView();
  return (
    <LinkText
      accessibilityLabel="이어 읽기"
      accessibilityRole="link"
      className={cn(
        "font-semibold text-foreground underline web:cursor-pointer web:whitespace-nowrap web:rounded-sm web:decoration-1 web:outline-none web:transition-[text-decoration-thickness] web:hover:decoration-2 web:focus-visible:ring-[3px] web:focus-visible:ring-ring",
        // Mobile width only: on wide the padding would cover the line above (a pointer
        // needs no 44px target there).
        !isWideView && "web:py-3.5",
      )}
      href={url}
      hrefAttrs={{ target: "_blank", rel: "noopener noreferrer" }}
      testID="link-detail-continue"
    >
      {"이어\u00A0읽기\u00A0"}
      <Icon
        as={ExternalLink}
        className="text-foreground web:inline-block web:align-[-1px]"
        size={13}
      />
    </LinkText>
  );
}

export { ExcerptContinueLink };
export type { ExcerptContinueLinkProps };
