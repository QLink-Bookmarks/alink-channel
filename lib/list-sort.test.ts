import {
  type ListSort,
  getSortCriterionLabel,
  isSameListSort,
  pressSortCriterion,
  reverseSortDirection,
} from "./list-sort";

type Key = "created_at" | "title";

describe("pressSortCriterion", () => {
  const current: ListSort<Key> = { key: "created_at", direction: "desc" };

  it("turns an off criterion on in its first direction", () => {
    expect(pressSortCriterion(current, { key: "title", firstDirection: "asc" })).toEqual({
      key: "title",
      direction: "asc",
    });
  });

  it("ignores the current direction when switching criterion", () => {
    expect(
      pressSortCriterion(
        { key: "title", direction: "desc" },
        { key: "created_at", firstDirection: "desc" },
      ),
    ).toEqual({ key: "created_at", direction: "desc" });
  });

  it("reverses the criterion that is already on", () => {
    expect(pressSortCriterion(current, { key: "created_at", firstDirection: "desc" })).toEqual({
      key: "created_at",
      direction: "asc",
    });
    expect(
      pressSortCriterion(
        { key: "created_at", direction: "asc" },
        { key: "created_at", firstDirection: "desc" },
      ),
    ).toEqual({ key: "created_at", direction: "desc" });
  });
});

describe("sort helpers", () => {
  it("reverses a direction", () => {
    expect(reverseSortDirection("asc")).toBe("desc");
    expect(reverseSortDirection("desc")).toBe("asc");
  });

  it("compares two sorts by key and direction", () => {
    expect(
      isSameListSort<Key>({ key: "title", direction: "asc" }, { key: "title", direction: "asc" }),
    ).toBe(true);
    expect(
      isSameListSort<Key>({ key: "title", direction: "asc" }, { key: "title", direction: "desc" }),
    ).toBe(false);
  });

  it("names a criterion with its direction for screen readers", () => {
    expect(getSortCriterionLabel("제목", "asc")).toBe("제목, 오름차순");
    expect(getSortCriterionLabel("저장일", "desc")).toBe("저장일, 내림차순");
  });
});
