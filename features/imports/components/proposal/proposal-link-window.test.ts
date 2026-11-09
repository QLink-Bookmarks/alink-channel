import { getLinkWindowRange } from "./proposal-link-window";

describe("getLinkWindowRange", () => {
  it("renders the rows on screen plus a margin above and below", () => {
    expect(
      getLinkWindowRange({ count: 3000, rowHeight: 50, hiddenAbove: 0, viewportHeight: 600 }),
    ).toEqual({ start: 0, end: 28 });
    expect(
      getLinkWindowRange({ count: 3000, rowHeight: 50, hiddenAbove: 5000, viewportHeight: 600 }),
    ).toEqual({ start: 84, end: 128 });
  });

  it("stops at the end of the list", () => {
    expect(
      getLinkWindowRange({ count: 200, rowHeight: 50, hiddenAbove: 9800, viewportHeight: 600 }),
    ).toEqual({ start: 180, end: 200 });
  });

  it("treats a list below the viewport as starting at the top", () => {
    expect(
      getLinkWindowRange({ count: 3000, rowHeight: 50, hiddenAbove: -300, viewportHeight: 600 }),
    ).toEqual({ start: 0, end: 22 });
  });
});
