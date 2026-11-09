import { Text as RNText } from "react-native";

import { Text } from "@/components/ui/text";

/** Style of a highlighted match, shared with `SnippetText`. */
const HIGHLIGHT_CLASS_NAME = "rounded bg-primary/20 font-semibold text-foreground";

type HighlightedTextProps = {
  text: string;
  /** Every case-insensitive occurrence of the trimmed query is highlighted. */
  query: string;
  className?: string;
  numberOfLines?: number;
  testID?: string;
};

/** Text with every occurrence of the search query highlighted (client-side match). */
function HighlightedText({ text, query, className, numberOfLines, testID }: HighlightedTextProps) {
  const trimmed = query.trim();
  if (!trimmed) {
    return (
      <Text
        className={className}
        numberOfLines={numberOfLines}
        testID={testID}
      >
        {text}
      </Text>
    );
  }

  const lower = text.toLowerCase();
  const target = trimmed.toLowerCase();
  const segments: { value: string; match: boolean }[] = [];
  let index = 0;

  while (index < text.length) {
    const found = lower.indexOf(target, index);
    if (found === -1) {
      segments.push({ value: text.slice(index), match: false });
      break;
    }
    if (found > index) {
      segments.push({ value: text.slice(index, found), match: false });
    }
    segments.push({ value: text.slice(found, found + target.length), match: true });
    index = found + target.length;
  }

  return (
    <Text
      className={className}
      numberOfLines={numberOfLines}
      testID={testID}
    >
      {segments.map((segment, segmentIndex) =>
        segment.match ? (
          // A plain RN Text inherits the outer size; the ui Text would reset it on native.
          <RNText
            key={segmentIndex}
            className={HIGHLIGHT_CLASS_NAME}
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

export { HIGHLIGHT_CLASS_NAME, HighlightedText };
export type { HighlightedTextProps };
