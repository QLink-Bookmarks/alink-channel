import { getSaveLabelClassName } from "./save-label-class-name";

describe("getSaveLabelClassName", () => {
  it("uses the accent text color for gray and blue in both themes and pink in dark", () => {
    expect(getSaveLabelClassName("gray", "light")).toBe("text-accent-foreground");
    expect(getSaveLabelClassName("gray", "dark")).toBe("text-accent-foreground");
    expect(getSaveLabelClassName("blue", "light")).toBe("text-accent-foreground");
    expect(getSaveLabelClassName("blue", "dark")).toBe("text-accent-foreground");
    expect(getSaveLabelClassName("pink", "dark")).toBe("text-accent-foreground");
  });

  it("uses a darker pink in light pink so the label stays readable on its tint", () => {
    expect(getSaveLabelClassName("pink", "light")).toBe("text-[#c20047]");
  });
});
