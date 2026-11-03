import {
  getAvailableListHeight,
  getOpenTarget,
  getPlanTargets,
  getTransitionMinHeight,
  interpolateSectionHeight,
} from "./section-accordion";

describe("getAvailableListHeight", () => {
  it("is unbounded when the surface does not report its free space", () => {
    expect(
      getAvailableListHeight({ availableTotal: undefined, minHeight: 200, headersHeight: 88 }),
    ).toBe(Infinity);
    expect(
      getAvailableListHeight({ availableTotal: 0, minHeight: undefined, headersHeight: 88 }),
    ).toBe(Infinity);
  });

  it("leaves the space under both headers for the open list", () => {
    expect(
      getAvailableListHeight({ availableTotal: 500, minHeight: undefined, headersHeight: 88 }),
    ).toBe(412);
  });

  it("never goes below the next minimum height, which the sidebar grows to after the switch", () => {
    expect(getAvailableListHeight({ availableTotal: 180, minHeight: 260, headersHeight: 88 })).toBe(
      172,
    );
  });
});

describe("getOpenTarget", () => {
  it("opens to the natural height when it fits and to the free space when it does not", () => {
    expect(getOpenTarget(240, 412)).toBe(240);
    expect(getOpenTarget(1800, 412)).toBe(412);
    expect(getOpenTarget(1800, Infinity)).toBe(1800);
  });
});

describe("getPlanTargets", () => {
  it("collapses every mounted section but the one that opens", () => {
    expect(getPlanTargets(["mine", "shared"], "mine", 315)).toEqual({ mine: 315, shared: 0 });
    expect(getPlanTargets(["shared"], "mine", 315)).toEqual({ mine: 315, shared: 0 });
    expect(getPlanTargets(["mine"], null, 0)).toEqual({ mine: 0 });
  });
});

describe("interpolateSectionHeight", () => {
  const plan = { from: { mine: 0, shared: 260 }, to: { mine: 315, shared: 0 } };

  it("moves the opening and the closing list by the same share of their travel", () => {
    expect(interpolateSectionHeight(plan, "mine", 0)).toBe(0);
    expect(interpolateSectionHeight(plan, "shared", 0)).toBe(260);
    expect(interpolateSectionHeight(plan, "mine", 0.5)).toBe(157.5);
    expect(interpolateSectionHeight(plan, "shared", 0.5)).toBe(130);
    expect(interpolateSectionHeight(plan, "mine", 1)).toBe(315);
    expect(interpolateSectionHeight(plan, "shared", 1)).toBe(0);
  });

  it("continues from the current height when a tap retargets mid-way", () => {
    const midway = {
      from: {
        mine: interpolateSectionHeight(plan, "mine", 0.4),
        shared: interpolateSectionHeight(plan, "shared", 0.4),
      },
      to: { mine: 0, shared: 260 },
    };
    expect(interpolateSectionHeight(midway, "mine", 0)).toBe(
      interpolateSectionHeight(plan, "mine", 0.4),
    );
    expect(interpolateSectionHeight(midway, "shared", 0)).toBe(
      interpolateSectionHeight(plan, "shared", 0.4),
    );
  });

  it("treats a section missing from the plan as closed", () => {
    expect(interpolateSectionHeight(plan, "other", 0.5)).toBe(0);
  });
});

describe("getTransitionMinHeight", () => {
  it("holds the larger of the old and new minimum while the sections move", () => {
    expect(getTransitionMinHeight(170, 254)).toBe(254);
    expect(getTransitionMinHeight(254, 170)).toBe(254);
    expect(getTransitionMinHeight(undefined, 120)).toBe(120);
    expect(getTransitionMinHeight(undefined, undefined)).toBeUndefined();
  });
});
