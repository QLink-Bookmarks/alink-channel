import { getDetailPanelWidth } from "./detail-panel-width";

describe("getDetailPanelWidth", () => {
  it("keeps the 420 minimum on iPad portrait and landscape", () => {
    expect(getDetailPanelWidth(820)).toBe(420);
    expect(getDetailPanelWidth(1180)).toBe(420);
  });

  it("follows 34% of the window between the bounds", () => {
    expect(getDetailPanelWidth(1376)).toBe(468);
  });

  it("stops at the 560 maximum", () => {
    expect(getDetailPanelWidth(1920)).toBe(560);
  });
});
