import {
  DEFAULT_LINK_SORT,
  LINK_SORT_CRITERIA,
  getLinkAppliedLabel,
  getLinkPill,
  isDefaultLinkFilter,
  readLinkSort,
  toLinkListParams,
} from "./link-sort";

const TITLE_ASC = { key: "title", direction: "asc" } as const;

describe("LINK_SORT_CRITERIA", () => {
  it("starts 저장일 newest first and 제목 in 가나다 order", () => {
    expect(LINK_SORT_CRITERIA).toEqual([
      { key: "created_at", label: "저장일", firstDirection: "desc" },
      { key: "title", label: "제목", firstDirection: "asc" },
    ]);
  });
});

describe("isDefaultLinkFilter", () => {
  it("is the default only at 저장일 ↓ with 바로가기 off", () => {
    expect(isDefaultLinkFilter(DEFAULT_LINK_SORT, false)).toBe(true);
    expect(isDefaultLinkFilter(DEFAULT_LINK_SORT, true)).toBe(false);
    expect(isDefaultLinkFilter({ key: "created_at", direction: "asc" }, false)).toBe(false);
    expect(isDefaultLinkFilter(TITLE_ASC, false)).toBe(false);
  });
});

describe("toLinkListParams", () => {
  it("sends the criterion and direction, and isFavorite only when on", () => {
    expect(toLinkListParams(TITLE_ASC, false)).toEqual({ orderKey: "title", order: "asc" });
    expect(toLinkListParams(DEFAULT_LINK_SORT, true)).toEqual({
      orderKey: "created_at",
      order: "desc",
      isFavorite: true,
    });
  });
});

describe("getLinkPill", () => {
  it("is null at the default", () => {
    expect(getLinkPill(DEFAULT_LINK_SORT, false)).toBeNull();
  });

  it("shows ★ then the sort", () => {
    expect(getLinkPill(TITLE_ASC, true)).toEqual([
      { id: "star" },
      { id: "sort", label: "제목", direction: "asc" },
    ]);
  });

  it("shows only the sort, or only ★", () => {
    expect(getLinkPill({ key: "created_at", direction: "asc" }, false)).toEqual([
      { id: "sort", label: "저장일", direction: "asc" },
    ]);
    expect(getLinkPill(DEFAULT_LINK_SORT, true)).toEqual([{ id: "star" }]);
  });
});

describe("getLinkAppliedLabel", () => {
  it("reads the sort and then 바로가기만", () => {
    expect(getLinkAppliedLabel(TITLE_ASC, true)).toBe("제목 오름차순, 바로가기만");
    expect(getLinkAppliedLabel({ key: "created_at", direction: "asc" }, false)).toBe(
      "저장일 오름차순",
    );
    expect(getLinkAppliedLabel(DEFAULT_LINK_SORT, true)).toBe("바로가기만");
    expect(getLinkAppliedLabel(DEFAULT_LINK_SORT, false)).toBeNull();
  });
});

describe("readLinkSort", () => {
  it("keeps a valid sort", () => {
    expect(readLinkSort({ key: "title", direction: "desc" })).toEqual({
      key: "title",
      direction: "desc",
    });
  });

  it("falls back to the default for anything else", () => {
    expect(readLinkSort(undefined)).toEqual(DEFAULT_LINK_SORT);
    expect(readLinkSort("latest")).toEqual(DEFAULT_LINK_SORT);
    expect(readLinkSort({ key: "similarity", direction: "desc" })).toEqual(DEFAULT_LINK_SORT);
    expect(readLinkSort({ key: "title", direction: "up" })).toEqual(DEFAULT_LINK_SORT);
  });
});
