import { formatTagLabel } from "./format-tag-label";

describe("formatTagLabel", () => {
  it("adds a leading #", () => {
    expect(formatTagLabel("React Query")).toBe("#React Query");
  });

  it("never doubles a # the tag already has", () => {
    expect(formatTagLabel("#맛집")).toBe("#맛집");
    expect(formatTagLabel("#맛집")).not.toMatch(/^##/);
  });
});
