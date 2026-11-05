import type { Folder } from "../types";
import {
  findFolderInPages,
  flattenFolderPages,
  getMoveTargetFolderId,
  getNextFolderCursor,
  isFolderId,
  resolveScrollRestore,
  shouldFetchMoreFolders,
  splitFoldersBySection,
} from "./folder-pages";

function folder(id: number, isShared = false): Folder {
  return {
    id,
    name: `폴더 ${id}`,
    isShared,
    shareCounts: isShared ? 2 : 0,
    linkCounts: 0,
    myLinkCounts: 0,
  };
}

function page(contents: Folder[], nextCursor: string | null = null) {
  return { contents, nextCursor, hasNext: nextCursor != null };
}

describe("getNextFolderCursor", () => {
  it("returns the cursor only when another page exists", () => {
    expect(getNextFolderCursor({ hasNext: true, nextCursor: "20" })).toBe("20");
    expect(getNextFolderCursor({ hasNext: false, nextCursor: "20" })).toBeUndefined();
    expect(getNextFolderCursor({ hasNext: true, nextCursor: null })).toBeUndefined();
    expect(getNextFolderCursor({ hasNext: true, nextCursor: "" })).toBeUndefined();
  });
});

describe("flattenFolderPages", () => {
  it("keeps page order and drops ids already seen", () => {
    const pages = [page([folder(5), folder(4)], "2"), page([folder(4), folder(3)])];
    expect(flattenFolderPages(pages).map((entry) => entry.id)).toEqual([5, 4, 3]);
  });

  it("returns an empty list without pages", () => {
    expect(flattenFolderPages(undefined)).toEqual([]);
  });
});

describe("splitFoldersBySection", () => {
  it("splits by isShared, appending later pages to each section", () => {
    const pages = [
      page([folder(6), folder(5, true), folder(4)], "3"),
      page([folder(3, true), folder(2), folder(5, true)]),
    ];
    const sections = splitFoldersBySection(pages);
    expect(sections.mine.map((entry) => entry.id)).toEqual([6, 4, 2]);
    expect(sections.shared.map((entry) => entry.id)).toEqual([5, 3]);
  });
});

describe("splitFoldersBySection with a limit", () => {
  it("keeps only the first folders across both sections", () => {
    const pages = [page([folder(6), folder(5, true), folder(4), folder(3, true)])];
    const sections = splitFoldersBySection(pages, { limit: 3 });
    expect(sections.mine.map((entry) => entry.id)).toEqual([6, 4]);
    expect(sections.shared.map((entry) => entry.id)).toEqual([5]);
  });
});

describe("findFolderInPages", () => {
  it("finds a folder on any loaded page", () => {
    const pages = [page([folder(9)], "1"), page([folder(1)])];
    expect(findFolderInPages(pages, 1)?.name).toBe("폴더 1");
    expect(findFolderInPages(pages, 7)).toBeUndefined();
    expect(findFolderInPages(undefined, 1)).toBeUndefined();
  });
});

describe("isFolderId", () => {
  it("accepts positive integers only", () => {
    expect(isFolderId(1)).toBe(true);
    expect(isFolderId(0)).toBe(false);
    expect(isFolderId(-3)).toBe(false);
    expect(isFolderId(1.5)).toBe(false);
    expect(isFolderId(Number.NaN)).toBe(false);
  });
});

describe("shouldFetchMoreFolders", () => {
  const ready = {
    hasOpenSection: true,
    hasNextPage: true,
    isFetchingNextPage: false,
    isFetchNextPageError: false,
  };

  it("fetches when the open list reaches its end or does not fill its area", () => {
    expect(shouldFetchMoreFolders(ready, { endReached: true })).toBe(true);
    expect(
      shouldFetchMoreFolders(ready, { endReached: false, contentHeight: 120, viewportHeight: 300 }),
    ).toBe(true);
    expect(
      shouldFetchMoreFolders(ready, { endReached: false, contentHeight: 900, viewportHeight: 300 }),
    ).toBe(false);
  });

  it("does not fetch with both sections closed, without a next page, while fetching or after a failure", () => {
    expect(shouldFetchMoreFolders({ ...ready, hasOpenSection: false }, { endReached: true })).toBe(
      false,
    );
    expect(shouldFetchMoreFolders({ ...ready, hasNextPage: false }, { endReached: true })).toBe(
      false,
    );
    expect(
      shouldFetchMoreFolders({ ...ready, isFetchingNextPage: true }, { endReached: true }),
    ).toBe(false);
    expect(
      shouldFetchMoreFolders({ ...ready, isFetchNextPageError: true }, { endReached: true }),
    ).toBe(false);
  });

  it("waits for a measured area before treating the list as short", () => {
    expect(
      shouldFetchMoreFolders(ready, { endReached: false, contentHeight: 0, viewportHeight: 0 }),
    ).toBe(false);
  });
});

describe("resolveScrollRestore", () => {
  const base = {
    viewportHeight: 300,
    hasNextPage: false,
    isFetchingNextPage: false,
    isFetchNextPageError: false,
  };

  it("does nothing without a saved position", () => {
    expect(resolveScrollRestore({ ...base, savedOffset: 0, contentHeight: 900 })).toEqual({
      type: "none",
    });
  });

  it("scrolls to the saved position once the content reaches it", () => {
    expect(resolveScrollRestore({ ...base, savedOffset: 400, contentHeight: 900 })).toEqual({
      type: "scroll",
      offset: 400,
    });
  });

  it("fetches more when the content is too short and another page exists", () => {
    expect(
      resolveScrollRestore({ ...base, savedOffset: 800, contentHeight: 900, hasNextPage: true }),
    ).toEqual({ type: "fetchMore" });
    expect(
      resolveScrollRestore({
        ...base,
        savedOffset: 800,
        contentHeight: 900,
        hasNextPage: true,
        isFetchingNextPage: true,
      }),
    ).toEqual({ type: "wait" });
  });

  it("goes to the last possible position when the list got shorter", () => {
    expect(resolveScrollRestore({ ...base, savedOffset: 800, contentHeight: 700 })).toEqual({
      type: "scroll",
      offset: 400,
    });
  });

  it("waits until the list is measured", () => {
    expect(resolveScrollRestore({ ...base, savedOffset: 400, contentHeight: 0 })).toEqual({
      type: "wait",
    });
  });
});

describe("getMoveTargetFolderId", () => {
  it("sends 0 for none so the server moves the link out of its folder", () => {
    expect(getMoveTargetFolderId(null)).toBe(0);
  });

  it("keeps a folder id as it is", () => {
    expect(getMoveTargetFolderId(43)).toBe(43);
  });
});
