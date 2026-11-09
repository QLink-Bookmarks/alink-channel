import { ONBOARDING_VERSION, isCompletionCurrent } from "./onboarding";

jest.mock("@/lib/session-storage", () => ({
  SessionStorage: {
    getItem: jest.fn(async () => null),
    setItem: jest.fn(async () => {}),
    removeItem: jest.fn(async () => {}),
  },
}));

describe("isCompletionCurrent", () => {
  it("accepts a completion stored by the current slides", () => {
    expect(
      isCompletionCurrent(JSON.stringify({ completed: true, version: ONBOARDING_VERSION })),
    ).toBe(true);
  });

  it("accepts a completion stored by a later version", () => {
    expect(
      isCompletionCurrent(JSON.stringify({ completed: true, version: ONBOARDING_VERSION + 1 })),
    ).toBe(true);
  });

  it("shows the slides again to a user who finished the 1.x onboarding", () => {
    // 1.x persisted `{ completed: true }` with no version.
    expect(isCompletionCurrent(JSON.stringify({ completed: true }))).toBe(false);
    expect(isCompletionCurrent(JSON.stringify({ completed: true, version: 1 }))).toBe(false);
  });

  it("treats nothing stored, an unfinished flag and corrupt storage as not completed", () => {
    expect(isCompletionCurrent(null)).toBe(false);
    expect(isCompletionCurrent(JSON.stringify({ completed: false, version: 2 }))).toBe(false);
    expect(isCompletionCurrent("{not json")).toBe(false);
  });
});
