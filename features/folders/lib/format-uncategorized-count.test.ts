import { formatUncategorizedCount } from "./format-uncategorized-count";

function linksPage(count: number, hasNext: boolean) {
  return { contents: Array.from({ length: count }, (_, index) => index), hasNext };
}

describe("formatUncategorizedCount", () => {
  it("shows the received count when there is no next page", () => {
    expect(formatUncategorizedCount(linksPage(0, false), false)).toBe("0");
    expect(formatUncategorizedCount(linksPage(37, false), false)).toBe("37");
    expect(formatUncategorizedCount(linksPage(100, false), false)).toBe("100");
  });

  it("shows 100+ when another page exists", () => {
    expect(formatUncategorizedCount(linksPage(100, true), false)).toBe("100+");
  });

  it("hides the count on failure or before data arrives", () => {
    expect(formatUncategorizedCount(linksPage(37, false), true)).toBeUndefined();
    expect(formatUncategorizedCount(undefined, true)).toBeUndefined();
    expect(formatUncategorizedCount(undefined, false)).toBeUndefined();
  });
});
