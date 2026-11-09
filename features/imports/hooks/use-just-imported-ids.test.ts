import { takeJustImportedIds } from "./use-just-imported-ids";

const NOW = new Date("2026-11-05T06:00:00.000Z");

function at(offsetMs: number) {
  return new Date(NOW.getTime() + offsetMs).toISOString();
}

describe("takeJustImportedIds", () => {
  it("picks imports from the last minute the first time they are shown", () => {
    const shown = new Set<number>();
    const fresh = takeJustImportedIds(
      [
        { id: 3, createdAt: at(-5_000) },
        { id: 2, createdAt: at(-60_000) },
        { id: 1, createdAt: at(-61_000) },
      ],
      shown,
      NOW,
    );
    expect(fresh).toEqual([3, 2]);
    expect([...shown]).toEqual([3, 2, 1]);
  });

  it("never picks an import again once it was shown", () => {
    const shown = new Set<number>([3]);
    expect(takeJustImportedIds([{ id: 3, createdAt: at(-1_000) }], shown, NOW)).toEqual([]);
  });

  it("picks an import whose time is slightly ahead of this clock", () => {
    expect(takeJustImportedIds([{ id: 4, createdAt: at(3_000) }], new Set(), NOW)).toEqual([4]);
  });

  it("picks a new import that shows up while the list is open", () => {
    const shown = new Set<number>();
    takeJustImportedIds([{ id: 1, createdAt: at(-600_000) }], shown, NOW);
    expect(
      takeJustImportedIds(
        [
          { id: 2, createdAt: at(-2_000) },
          { id: 1, createdAt: at(-600_000) },
        ],
        shown,
        NOW,
      ),
    ).toEqual([2]);
  });
});
