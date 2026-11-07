import { PILL_ROW_GAP, PRIMARY_FADE_WIDTH, pickPillLevel } from "./filter-pill-level";

describe("pickPillLevel", () => {
  it("spells the value out when the protected 1st chips stay whole", () => {
    expect(
      pickPillLevel({ rowWidth: 358, protectRight: 200, pillWidths: { text: 100, mark: 60 } }),
    ).toBe("text");
  });

  it("falls back to marks when the text pill would cut the protected chips", () => {
    expect(
      pickPillLevel({ rowWidth: 288, protectRight: 200, pillWidths: { text: 100, mark: 60 } }),
    ).toBe("mark");
  });

  it("counts the gap and the fade as covering the chips", () => {
    const rowWidth = 300;
    const textWidth = 80;
    const edge = rowWidth - textWidth - PILL_ROW_GAP - PRIMARY_FADE_WIDTH;
    expect(pickPillLevel({ rowWidth, protectRight: edge, pillWidths: { text: textWidth } })).toBe(
      "text",
    );
    expect(
      pickPillLevel({ rowWidth, protectRight: edge + 1, pillWidths: { text: textWidth } }),
    ).toBe("mark");
  });

  it("always spells the value out without 1st chips to protect (wide, folder detail)", () => {
    expect(pickPillLevel({ rowWidth: 200, protectRight: null, pillWidths: { text: 190 } })).toBe(
      "text",
    );
  });

  it("spells the value out until the row and the pill are measured", () => {
    expect(pickPillLevel({ rowWidth: 0, protectRight: 200, pillWidths: { text: 100 } })).toBe(
      "text",
    );
    expect(pickPillLevel({ rowWidth: 300, protectRight: 280, pillWidths: {} })).toBe("text");
  });
});
