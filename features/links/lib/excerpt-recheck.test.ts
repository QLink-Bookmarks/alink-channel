import { getExcerptRecheckDelay } from "./excerpt-recheck";

const pending = { excerpt: null, isPending: true };

describe("getExcerptRecheckDelay", () => {
  it("schedules the re-checks 3, 6 and 12 seconds after the detail opened", () => {
    const openedAt = 1_000;
    expect(
      getExcerptRecheckDelay({ openedAt, now: openedAt, recheckCount: 0, content: pending }),
    ).toBe(3000);
    expect(
      getExcerptRecheckDelay({ openedAt, now: openedAt + 3000, recheckCount: 1, content: pending }),
    ).toBe(3000);
    expect(
      getExcerptRecheckDelay({ openedAt, now: openedAt + 6000, recheckCount: 2, content: pending }),
    ).toBe(6000);
  });

  it("measures from the opening, so a slow response does not push the next re-check back", () => {
    expect(
      getExcerptRecheckDelay({ openedAt: 0, now: 4_500, recheckCount: 1, content: pending }),
    ).toBe(1500);
    expect(
      getExcerptRecheckDelay({ openedAt: 0, now: 7_000, recheckCount: 1, content: pending }),
    ).toBe(0);
  });

  it("stops after three re-checks", () => {
    expect(
      getExcerptRecheckDelay({ openedAt: 0, now: 12_000, recheckCount: 3, content: pending }),
    ).toBeNull();
  });

  it("stops once the excerpt is in", () => {
    expect(
      getExcerptRecheckDelay({
        openedAt: 0,
        now: 3_000,
        recheckCount: 1,
        content: { excerpt: "본문 앞부분…", isPending: false },
      }),
    ).toBeNull();
    expect(
      getExcerptRecheckDelay({
        openedAt: 0,
        now: 3_000,
        recheckCount: 1,
        content: { excerpt: "본문 앞부분…", isPending: true },
      }),
    ).toBeNull();
  });

  it("never re-checks unless the body is pending", () => {
    for (const content of [undefined, null, { excerpt: null, isPending: false }]) {
      expect(getExcerptRecheckDelay({ openedAt: 0, now: 0, recheckCount: 0, content })).toBeNull();
    }
  });
});
