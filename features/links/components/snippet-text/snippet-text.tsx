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

const ELLIPSIS = "…";

/**
 * Folds every run of whitespace (line breaks included) into one space and moves the ranges
 * onto the folded text. A run is dropped at either end, right after a leading "…" and right
 * before a trailing "…". Ranges must be valid over `text`; one left empty is dropped.
 */
function collapseSnippet(
  text: string,
  highlights: HighlightRange[],
): { text: string; highlights: HighlightRange[] } {
  // Index of the last non-whitespace character before `end`, or -1.
  const lastWordIndex = (end: number) => text.slice(0, end).search(/\S\s*$/);
  const last = lastWordIndex(text.length);
  // Whitespace past this index only leads to the end or to a trailing "…".
  const keepBefore = text[last] === ELLIPSIS ? lastWordIndex(last) : last;
  // positions[i] is where the raw index i lands in the folded text.
  const positions: number[] = [];
  let folded = "";
  for (let index = 0; index < text.length; index += 1) {
    positions.push(folded.length);
    const char = text[index];
    if (!/\s/.test(char)) {
      folded += char;
    } else if (
      index < keepBefore &&
      folded !== "" &&
      folded !== ELLIPSIS &&
      !folded.endsWith(" ")
    ) {
      folded += " ";
    }
  }
  positions.push(folded.length);
  return {
    text: folded,
    highlights: highlights
      .map(({ start, end }) => ({ start: positions[start], end: positions[end] }))
      .filter(({ start, end }) => start < end),
  };
}

/** The search context as one line of words for a screen reader: folded, no "…" at the ends. */
function getSnippetLabel(text: string) {
  return collapseSnippet(text, []).text.replace(/^…|…$/g, "");
}

/**
 * Splits `text` at the highlight ranges after folding its whitespace (`collapseSnippet`).
 * Ranges out of bounds, empty, cutting an emoji in half or overlapping an earlier valid range
 * are ignored; the rest apply in order of `start`.
 */
function splitSnippet(rawText: string, rawHighlights: HighlightRange[]): SnippetSegment[] {
  const { text, highlights } = collapseSnippet(
    rawText,
    rawHighlights.filter((range) => isValidRange(rawText, range)),
  );
  const ranges = highlights.sort((a, b) => a.start - b.start || a.end - b.end);
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

export { getSnippetLabel, SnippetText, splitSnippet };
export type { SnippetSegment, SnippetTextProps };
