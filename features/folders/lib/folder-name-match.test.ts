import { isFolderNameMatch } from "./folder-name-match";

describe("isFolderNameMatch", () => {
  it("matches the exact name", () => {
    expect(isFolderNameMatch("주말 여행", "주말 여행")).toBe(true);
  });

  it("ignores leading and trailing spaces on both sides", () => {
    expect(isFolderNameMatch("  주말 여행 \n", "주말 여행")).toBe(true);
    expect(isFolderNameMatch("Reading", " Reading ")).toBe(true);
  });

  it("is case-sensitive and rejects any other difference", () => {
    expect(isFolderNameMatch("reading", "Reading")).toBe(false);
    expect(isFolderNameMatch("주말여행", "주말 여행")).toBe(false);
    expect(isFolderNameMatch("주말 여행!", "주말 여행")).toBe(false);
    expect(isFolderNameMatch("", "주말 여행")).toBe(false);
  });

  it("matches a decomposed (NFD) Hangul name pasted from elsewhere", () => {
    const composed = "읽을거리";
    const decomposed = composed.normalize("NFD");
    expect(decomposed).not.toBe(composed);
    expect(isFolderNameMatch(decomposed, composed)).toBe(true);
    expect(isFolderNameMatch(composed, decomposed)).toBe(true);
  });
});
