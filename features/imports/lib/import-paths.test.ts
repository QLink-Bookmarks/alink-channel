import { IMPORTS_PATH, getImportDetailPath } from "./import-paths";

describe("import paths", () => {
  it("puts the import history under settings", () => {
    expect(IMPORTS_PATH).toBe("/settings/imports");
  });

  it("builds the record detail path from the id", () => {
    expect(getImportDetailPath(42)).toBe("/settings/imports/42");
    expect(getImportDetailPath("42")).toBe("/settings/imports/42");
  });
});
