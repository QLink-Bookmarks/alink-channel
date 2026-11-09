import { lerpHsl } from "@/lib/color-lerp";

describe("lerpHsl", () => {
  it("returns the start color at t = 0 and the end color at t = 1", () => {
    expect(lerpHsl("hsl(10 20% 30%)", "hsl(50 60% 70%)", 0)).toBe("hsl(10.0 20.0% 30.0%)");
    expect(lerpHsl("hsl(10 20% 30%)", "hsl(50 60% 70%)", 1)).toBe("hsl(50.0 60.0% 70.0%)");
  });

  it("interpolates each channel linearly", () => {
    expect(lerpHsl("hsl(10 20% 30%)", "hsl(50 60% 70%)", 0.5)).toBe("hsl(30.0 40.0% 50.0%)");
  });

  it("takes the shorter way around the hue wheel", () => {
    expect(lerpHsl("hsl(350 50% 50%)", "hsl(10 50% 50%)", 0.5)).toBe("hsl(0.0 50.0% 50.0%)");
  });

  it("treats an unparsable color as black", () => {
    expect(lerpHsl("red", "hsl(0 0% 100%)", 0.5)).toBe("hsl(0.0 0.0% 50.0%)");
  });
});
