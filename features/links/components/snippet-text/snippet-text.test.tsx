import { render, screen } from "@testing-library/react-native";

import { SnippetText, splitSnippet } from "./snippet-text";

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

  it("ignores a range that would cut an emoji in half", () => {
    expect(splitSnippet("😀 제주", [{ start: 1, end: 3 }])).toEqual([
      { value: "😀 제주", match: false },
    ]);
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
});
