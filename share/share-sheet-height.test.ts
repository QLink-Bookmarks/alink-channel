import {
  DEFAULT_SHEET_HEIGHT,
  clampSheetHeight,
  getAvailableSheetHeight,
  getFolderStepHeight,
} from "./share-sheet-height";

/* eslint-disable @typescript-eslint/no-require-imports -- jest.mock factories must require */
jest.mock("react-native-worklets", () => require("react-native-worklets/src/mock"));
jest.mock("react-native-reanimated", () => require("react-native-reanimated/mock"));

describe("getFolderStepHeight", () => {
  it("fits the nav and the 미분류 row when there are no folders", () => {
    expect(
      getFolderStepHeight({
        sectionRowCounts: [],
        paddingBottom: 42,
        maxHeight: DEFAULT_SHEET_HEIGHT,
      }),
    ).toBe(20 + 44 + 48 + 42);
  });

  it("adds the section headers and the tallest section's rows", () => {
    expect(
      getFolderStepHeight({ sectionRowCounts: [2, 1], paddingBottom: 16, maxHeight: 1000 }),
    ).toBe(20 + 44 + 48 + 6 + 52 * 2 + (2 * 48 + 2 + 12) + 16);
  });

  it("caps the height at the extension height so long lists scroll inside", () => {
    expect(getFolderStepHeight({ sectionRowCounts: [12], paddingBottom: 42, maxHeight: 392 })).toBe(
      392,
    );
  });
});

describe("clampSheetHeight", () => {
  it("uses the full container until a height is measured", () => {
    expect(clampSheetHeight(undefined, 392)).toBe(392);
    expect(clampSheetHeight(0, 392)).toBe(392);
  });

  it("never exceeds the container", () => {
    expect(clampSheetHeight(320, 392)).toBe(320);
    expect(clampSheetHeight(500, 392)).toBe(392);
  });
});

describe("getAvailableSheetHeight", () => {
  it("keeps the full extension height when it ends at the window bottom", () => {
    expect(getAvailableSheetHeight({ top: 452, height: 392 }, 844)).toBe(392);
  });

  it("drops the part the system pushed below the window", () => {
    expect(getAvailableSheetHeight({ top: 462, height: 392 }, 844)).toBe(382);
    expect(getAvailableSheetHeight({ top: 509, height: 392 }, 844)).toBe(335);
  });
});
