import { getGridColumnCount } from "@/lib/hooks/use-grid-columns";

import { getLinkCardMinWidth, normalizeLinkCardSize, resolveLinkCardSize } from "./link-card-size";

const GAP = 12;

function columnsAt(width: number, size: "small" | "large", isWideView: boolean) {
  return getGridColumnCount(width, getLinkCardMinWidth(size, isWideView), GAP);
}

describe("normalizeLinkCardSize", () => {
  it("keeps small and large", () => {
    expect(normalizeLinkCardSize("small")).toBe("small");
    expect(normalizeLinkCardSize("large")).toBe("large");
  });

  it("treats anything else as not chosen", () => {
    for (const value of [null, undefined, "", "medium", "SMALL", 1, {}, ["small"]]) {
      expect(normalizeLinkCardSize(value)).toBeNull();
    }
  });
});

describe("resolveLinkCardSize", () => {
  it("defaults to small on wide and large on mobile", () => {
    expect(resolveLinkCardSize(null, true)).toBe("small");
    expect(resolveLinkCardSize(null, false)).toBe("large");
  });

  it("uses the chosen size on both layouts", () => {
    expect(resolveLinkCardSize("large", true)).toBe("large");
    expect(resolveLinkCardSize("small", false)).toBe("small");
  });
});

describe("getLinkCardMinWidth", () => {
  it("is 196/150 for small and 360/280 for large (wide/mobile)", () => {
    expect(getLinkCardMinWidth("small", true)).toBe(196);
    expect(getLinkCardMinWidth("small", false)).toBe(150);
    expect(getLinkCardMinWidth("large", true)).toBe(360);
    expect(getLinkCardMinWidth("large", false)).toBe(280);
  });

  it("gives the confirmed column counts for mobile list widths (screen minus 16px gutters)", () => {
    expect(columnsAt(375 - 32, "small", false)).toBe(2);
    expect(columnsAt(390 - 32, "small", false)).toBe(2);
    expect(columnsAt(430 - 32, "small", false)).toBe(2);
    expect(columnsAt(390 - 32, "large", false)).toBe(1);
    expect(columnsAt(430 - 32, "large", false)).toBe(1);
    expect(columnsAt(320 - 32, "small", false)).toBe(1);
    expect(columnsAt(768 - 32, "small", false)).toBe(4);
    expect(columnsAt(768 - 32, "large", false)).toBe(2);
  });

  it("gives four and two columns in the wide home's ~930px recent list", () => {
    expect(columnsAt(930, "small", true)).toBe(4);
    expect(columnsAt(930, "large", true)).toBe(2);
  });
});
