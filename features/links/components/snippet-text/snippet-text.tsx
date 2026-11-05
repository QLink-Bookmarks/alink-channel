import { Text as RNText } from "react-native";

import { Text } from "@/components/ui/text";
import type { HighlightRange } from "@/features/links/types";

import { HIGHLIGHT_CLASS_NAME } from "./highlighted-text";

type SnippetTextProps = {
  text: string;
  /** Server ranges over `text`: UTF-16 indexes, `end` exclusive. */
  highlights: HighlightRange[];
  numberOfLines?: number;
  className?: string;
  /** Style of the highlighted ranges; defaults to the search highlight. */
  highlightClassName?: string;
  testID?: string;
};

type SnippetSegment = { value: string; match: boolean };

// True when `index` falls between the two halves of a surrogate pair (e.g. inside an emoji).
function splitsSurrogatePair(text: string, index: number) {
  if (index <= 0 || index >= text.length) {
    return false;
  }
  const before = text.charCodeAt(index - 1);
  const after = text.charCodeAt(index);
  return before >= 0xd800 && before <= 0xdbff && after >= 0xdc00 && after <= 0xdfff;
}

function isValidRange(text: string, { start, end }: HighlightRange) {
  return (
    Number.isInteger(start) &&
    Number.isInteger(end) &&
    0 <= start &&
    start < end &&
    end <= text.length &&
    !splitsSurrogatePair(text, start) &&
    !splitsSurrogatePair(text, end)
  );
}

/**
 * Splits `text` at the highlight ranges. Ranges out of bounds, empty, cutting an emoji in
 * half or overlapping an earlier valid range are ignored; the rest apply in order of `start`.
 */
function splitSnippet(text: string, highlights: HighlightRange[]): SnippetSegment[] {
  const ranges = highlights
    .filter((range) => isValidRange(text, range))
    .sort((a, b) => a.start - b.start || a.end - b.end);
  const segments: SnippetSegment[] = [];
  let cursor = 0;
  for (const range of ranges) {
    if (range.start < cursor) {
      continue;
    }
    if (range.start > cursor) {
      segments.push({ value: text.slice(cursor, range.start), match: false });
    }
    segments.push({ value: text.slice(range.start, range.end), match: true });
    cursor = range.end;
  }
  if (cursor < text.length) {
    segments.push({ value: text.slice(cursor), match: false });
  }
  return segments;
}

/** Search context with the server's highlight ranges in bold. */
function SnippetText({
  text,
  highlights,
  numberOfLines,
  className,
  highlightClassName = HIGHLIGHT_CLASS_NAME,
  testID,
}: SnippetTextProps) {
  return (
    <Text
      className={className}
      numberOfLines={numberOfLines}
      testID={testID}
    >
      {splitSnippet(text, highlights).map((segment, index) =>
        segment.match ? (
          // A plain RN Text inherits the outer size; the ui Text would reset it on native.
          <RNText
            key={index}
            className={highlightClassName}
          >
            {segment.value}
          </RNText>
        ) : (
          segment.value
        ),
      )}
    </Text>
  );
}

export { SnippetText, splitSnippet };
export type { SnippetSegment, SnippetTextProps };
