import { render, screen } from "@testing-library/react-native";

import { SnippetText, getSnippetLabel, splitSnippet } from "./snippet-text";

// The server range of `word` in `text`: UTF-16 indexes, `end` exclusive.
function rangeOf(text: string, word: string) {
  const start = text.indexOf(word);
  return { start, end: start + word.length };
}

describe("splitSnippet", () => {
  it("splits the text at the highlight ranges (UTF-16, end exclusive)", () => {
    expect(splitSnippet("…공항에서 성산일출봉으로 이동…", [{ start: 6, end: 11 }])).toEqual([
      { value: "…공항에서 ", match: false },
      { value: "성산일출봉", match: true },
      { value: "으로 이동…", match: false },
    ]);
  });

  it("applies several ranges in order of start", () => {
    expect(
      splitSnippet("a_b and a_b", [
        { start: 8, end: 11 },
        { start: 0, end: 3 },
      ]),
    ).toEqual([
      { value: "a_b", match: true },
      { value: " and ", match: false },
      { value: "a_b", match: true },
    ]);
  });

  it("returns the whole text when there is no range", () => {
    expect(splitSnippet("문맥", [])).toEqual([{ value: "문맥", match: false }]);
  });

  it("ignores empty, reversed and out-of-bounds ranges", () => {
    const text = "제주 여행";
    for (const range of [
      { start: 1, end: 1 },
      { start: 3, end: 1 },
      { start: -1, end: 2 },
      { start: 3, end: 99 },
      { start: 0.5, end: 2 },
    ]) {
      expect(splitSnippet(text, [range])).toEqual([{ value: text, match: false }]);
    }
  });

  it("ignores a range that overlaps an earlier one", () => {
    expect(
      splitSnippet("abcdef", [
        { start: 0, end: 3 },
        { start: 2, end: 5 },
      ]),
    ).toEqual([
      { value: "abc", match: true },
      { value: "def", match: false },
    ]);
  });

  it("keeps emoji whole: a range in UTF-16 units after an emoji lands on the right text", () => {
    // "😀" is two UTF-16 units, so "제주" starts at 3.
    expect(splitSnippet("😀 제주 바다", [{ start: 3, end: 5 }])).toEqual([
      { value: "😀 ", match: false },
      { value: "제주", match: true },
      { value: " 바다", match: false },
    ]);
    expect(splitSnippet("😀 제주", [{ start: 0, end: 2 }])).toEqual([
      { value: "😀", match: true },
      { value: " 제주", match: false },
    ]);
  });

  it("folds a blank line before the match into one space and keeps the match bold", () => {
    const text = "…겨울철 반찬\n\n고춧가루, 젓갈과 함께 버무린다…";
    expect(splitSnippet(text, [rangeOf(text, "고춧가루")])).toEqual([
      { value: "…겨울철 반찬 ", match: false },
      { value: "고춧가루", match: true },
      { value: ", 젓갈과 함께 버무린다…", match: false },
    ]);
  });

  it("folds a blank line after the match into one space", () => {
    const text = "…성산일출봉\n\n우도로 가는 배…";
    expect(splitSnippet(text, [rangeOf(text, "성산일출봉")])).toEqual([
      { value: "…", match: false },
      { value: "성산일출봉", match: true },
      { value: " 우도로 가는 배…", match: false },
    ]);
  });

  it("folds a blank line inside the match and keeps the whole match bold", () => {
    const text = "…동쪽 제주\n\n여행 코스…";
    expect(splitSnippet(text, [rangeOf(text, "제주\n\n여행")])).toEqual([
      { value: "…동쪽 ", match: false },
      { value: "제주 여행", match: true },
      { value: " 코스…", match: false },
    ]);
  });

  it("folds \\r\\n, tabs and runs of spaces, and moves every later range with the text", () => {
    const text = "a\r\n\t b   c\n\nd";
    expect(splitSnippet(text, [rangeOf(text, "b"), rangeOf(text, "d")])).toEqual([
      { value: "a ", match: false },
      { value: "b", match: true },
      { value: " c ", match: false },
      { value: "d", match: true },
    ]);
  });

  it("drops whitespace at both ends and next to the leading and trailing …", () => {
    const text = "\n… 일반적으로 사용되는 재료 … 고춧가루\n\n …\n";
    expect(splitSnippet(text, [rangeOf(text, "고춧가루")])).toEqual([
      { value: "…일반적으로 사용되는 재료 … ", match: false },
      { value: "고춧가루", match: true },
      { value: "…", match: false },
    ]);
  });

  it("drops a range left empty by the folding", () => {
    expect(splitSnippet("\n\n제주", [{ start: 0, end: 2 }])).toEqual([
      { value: "제주", match: false },
    ]);
  });

  it("keeps emoji whole next to folded line breaks", () => {
    const text = "😀\n\n제주";
    expect(splitSnippet(text, [rangeOf(text, "제주")])).toEqual([
      { value: "😀 ", match: false },
      { value: "제주", match: true },
    ]);
  });

  it("ignores a range that would cut an emoji in half", () => {
    expect(splitSnippet("😀 제주", [{ start: 1, end: 3 }])).toEqual([
      { value: "😀 제주", match: false },
    ]);
  });
});

describe("getSnippetLabel", () => {
  it("reads the context as one line without the … at either end", () => {
    expect(getSnippetLabel("…겨울철 반찬\n\n고춧가루, 젓갈과 함께 …")).toBe(
      "겨울철 반찬 고춧가루, 젓갈과 함께",
    );
    expect(getSnippetLabel("제주 바다 … 우도")).toBe("제주 바다 … 우도");
  });
});

describe("SnippetText", () => {
  it("renders the whole text with the highlighted range as its own text", () => {
    render(
      <SnippetText
        highlights={[{ start: 4, end: 6 }]}
        testID="snippet"
        text="…본문 제주 바다…"
      />,
    );
    expect(screen.getByTestId("snippet")).toHaveTextContent("…본문 제주 바다…");
    expect(screen.getByText("제주")).toBeOnTheScreen();
  });

  it("renders a context with line breaks as one run of words", () => {
    const text = "…겨울철 반찬\n\n고춧가루, 젓갈…";
    render(
      <SnippetText
        highlights={[rangeOf(text, "고춧가루")]}
        testID="snippet"
        text={text}
      />,
    );
    expect(screen.getByTestId("snippet")).toHaveTextContent("…겨울철 반찬 고춧가루, 젓갈…", {
      normalizer: (value) => value,
    });
    expect(screen.getByText("고춧가루")).toBeOnTheScreen();
  });
});
