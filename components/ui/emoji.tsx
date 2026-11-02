import * as React from "react";
import { Text as RNText } from "react-native";

import { cn } from "@/lib/utils";

type EmojiProps = React.ComponentProps<typeof RNText>;

/**
 * Renders an emoji glyph without the top-clipping caused by a tight lineHeight.
 * Emoji are taller than the text em-box, so `leading-none`/`leading-tight` cut
 * off their tops — most visibly inside fixed-size avatar and folder icon boxes.
 * This primitive never applies a clamping lineHeight; align it with a
 * flex-centered parent instead.
 */
function Emoji({ className, ...props }: EmojiProps) {
  return (
    <RNText
      className={cn("text-base", className)}
      {...props}
    />
  );
}

export { Emoji };
export type { EmojiProps };
