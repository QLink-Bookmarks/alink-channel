import {
  buildFolderDeleteParams,
  getFolderLinkCounts,
  needsFolderNameConfirm,
} from "./folder-delete-request";

describe("buildFolderDeleteParams", () => {
  it("detaches for personal (a) into 미분류", () => {
    expect(
      buildFolderDeleteParams({ isShared: false, choice: "keep", targetFolderId: null }),
    ).toEqual({});
  });

  it("moves into the chosen folder for personal (a)", () => {
    expect(buildFolderDeleteParams({ isShared: false, choice: "keep", targetFolderId: 7 })).toEqual(
      {
        onDelete: "move",
        targetFolderId: 7,
      },
    );
  });

  it("cascades for (b), personal or shared, without a target", () => {
    expect(
      buildFolderDeleteParams({ isShared: false, choice: "delete", targetFolderId: 7 }),
    ).toEqual({ onDelete: "cascade" });
    expect(
      buildFolderDeleteParams({ isShared: true, choice: "delete", targetFolderId: null }),
    ).toEqual({ onDelete: "cascade" });
  });

  it("detaches for shared (a) even if a target was left over", () => {
    expect(buildFolderDeleteParams({ isShared: true, choice: "keep", targetFolderId: 7 })).toEqual(
      {},
    );
  });
});

describe("getFolderLinkCounts", () => {
  it("splits my links from other users' links", () => {
    expect(getFolderLinkCounts({ linkCounts: 15, myLinkCounts: 12 })).toEqual({
      total: 15,
      mine: 12,
      others: 3,
    });
  });

  it("keeps the counts in range", () => {
    expect(getFolderLinkCounts({ linkCounts: 2, myLinkCounts: 5 })).toEqual({
      total: 2,
      mine: 2,
      others: 0,
    });
    expect(getFolderLinkCounts({ linkCounts: 0, myLinkCounts: 0 })).toEqual({
      total: 0,
      mine: 0,
      others: 0,
    });
  });
});

describe("needsFolderNameConfirm", () => {
  it("asks a personal folder only for (b) with own links", () => {
    expect(needsFolderNameConfirm({ isShared: false, choice: "delete", myLinkCount: 1 })).toBe(
      true,
    );
    expect(needsFolderNameConfirm({ isShared: false, choice: "keep", myLinkCount: 4 })).toBe(false);
    expect(needsFolderNameConfirm({ isShared: false, choice: "delete", myLinkCount: 0 })).toBe(
      false,
    );
  });

  it("asks a shared folder with links or other members", () => {
    expect(needsFolderNameConfirm({ isShared: true, linkCount: 3, otherMemberCount: 0 })).toBe(
      true,
    );
    expect(needsFolderNameConfirm({ isShared: true, linkCount: 0, otherMemberCount: 2 })).toBe(
      true,
    );
    expect(needsFolderNameConfirm({ isShared: true, linkCount: 0, otherMemberCount: 0 })).toBe(
      false,
    );
  });
});
