import type { ImportReversalFolder, ImportReversalLink, ImportReversalPreview } from "../types";
import {
  EMPTY_EXCLUSIONS,
  type ReversalExclusions,
  type ReversalFolderItem,
  buildReversalFolders,
  buildReverseRequest,
  findReversedSince,
  getFolderCheck,
  getFolderEditedSelectedCount,
  getReversalCounts,
  getReversalLinkOutcome,
  hasReversibleItems,
  toggleReversalFolder,
  toggleReversalLink,
} from "./reversal-selection";

function link(linkId: number, state: ImportReversalLink["state"] = "IMPORTED"): ImportReversalLink {
  return { linkId, title: `링크 ${linkId}`, url: `https://example.com/${linkId}`, state };
}

function folder(
  overrides: Partial<ImportReversalFolder> & Pick<ImportReversalFolder, "links">,
): ImportReversalFolder {
  return {
    kind: "NEW",
    state: "ACTIVE",
    folderId: 10,
    name: "자바",
    emoji: null,
    ...overrides,
  };
}

function preview(...folders: ImportReversalFolder[]): ImportReversalPreview {
  return { folders };
}

function byKey(folders: ReversalFolderItem[], key: string) {
  const found = folders.find((item) => item.key === key);
  if (!found) throw new Error(`no folder ${key}`);
  return found;
}

const BASE = preview(
  folder({
    folderId: 10,
    name: "자바",
    links: [link(1), link(2, "EDITED"), link(3, "ADDED_LATER")],
  }),
  folder({ kind: "EXISTING", folderId: 20, name: "aws", emoji: "☁️", links: [link(4), link(5)] }),
  folder({ kind: "UNFILED", folderId: null, name: null, links: [link(6)] }),
  folder({ folderId: 30, state: "SHARED", name: "취업 2", links: [link(7)] }),
);

describe("buildReversalFolders", () => {
  it("orders unfiled, existing, shared new and new folders", () => {
    const folders = buildReversalFolders(BASE);
    expect(folders.map((item) => item.key)).toEqual([
      "unfiled",
      "folder-20",
      "folder-30",
      "folder-10",
    ]);
  });

  it("only lets an active new folder be removed", () => {
    const folders = buildReversalFolders(BASE);
    expect(byKey(folders, "folder-10").isRemovable).toBe(true);
    expect(byKey(folders, "folder-20").isRemovable).toBe(false);
    expect(byKey(folders, "unfiled").isRemovable).toBe(false);
    expect(byKey(folders, "folder-30").isRemovable).toBe(false);
  });

  it("hides reversed folders and links", () => {
    const folders = buildReversalFolders(
      preview(
        folder({ folderId: 10, links: [link(1), link(2, "REVERSED")] }),
        folder({ folderId: 11, state: "REVERSED", links: [link(3, "REVERSED")] }),
      ),
    );
    expect(folders.map((item) => item.key)).toEqual(["folder-10"]);
    expect(folders[0].links.map((item) => item.linkId)).toEqual([1]);
  });

  it("keeps deleted links to show them as already deleted", () => {
    const folders = buildReversalFolders(
      preview(folder({ kind: "EXISTING", folderId: 20, links: [link(1, "DELETED")] })),
    );
    expect(folders[0].links).toHaveLength(1);
    expect(getFolderCheck(folders[0], EMPTY_EXCLUSIONS)).toEqual({
      checked: false,
      disabled: true,
    });
  });

  it("drops a folder with nothing left to show", () => {
    const folders = buildReversalFolders(
      preview(folder({ kind: "EXISTING", folderId: 20, links: [link(1, "REVERSED")] })),
    );
    expect(folders).toEqual([]);
  });

  it("keeps a new folder with no selectable link left, unchecked", () => {
    const folders = buildReversalFolders(
      preview(folder({ folderId: 10, links: [link(1, "ADDED_LATER"), link(2, "DELETED")] })),
    );
    expect(folders).toHaveLength(1);
    const [only] = folders;
    expect(getFolderCheck(only, EMPTY_EXCLUSIONS)).toEqual({ checked: false, disabled: true });
    expect(getReversalLinkOutcome(only, only.links[0], EMPTY_EXCLUSIONS)).toBe("keep");
    expect(buildReverseRequest(folders, EMPTY_EXCLUSIONS)).toEqual({ linkIds: [], folderIds: [] });
    expect(getReversalCounts(folders, EMPTY_EXCLUSIONS)).toEqual({
      links: 0,
      folders: 0,
      moved: 0,
      edited: 0,
    });
    expect(hasReversibleItems(folders)).toBe(false);
  });

  it("shows items reversed in this session as done", () => {
    const folders = buildReversalFolders(
      preview(
        folder({ kind: "EXISTING", folderId: 20, links: [link(4, "REVERSED"), link(5)] }),
        folder({ folderId: 10, state: "REVERSED", links: [link(1, "REVERSED")] }),
      ),
      { linkIds: new Set([4, 1]), folderIds: new Set([10]) },
    );
    const existing = byKey(folders, "folder-20");
    expect(existing.links.map((item) => [item.linkId, item.isDone])).toEqual([
      [4, true],
      [5, false],
    ]);
    const reversed = byKey(folders, "folder-10");
    expect(reversed.isDone).toBe(true);
    expect(reversed.isRemovable).toBe(false);
    expect(getReversalLinkOutcome(reversed, reversed.links[0], EMPTY_EXCLUSIONS)).toBe("done");
  });
});

describe("initial selection", () => {
  const folders = buildReversalFolders(BASE);

  it("selects every imported or edited link and every active new folder", () => {
    expect(buildReverseRequest(folders, EMPTY_EXCLUSIONS)).toEqual({
      linkIds: [6, 4, 5, 7, 1, 2],
      folderIds: [10],
    });
  });

  it("counts links, folders and links moved to unfiled", () => {
    expect(getReversalCounts(folders, EMPTY_EXCLUSIONS)).toEqual({
      links: 6,
      folders: 1,
      moved: 1,
      edited: 1,
    });
  });

  it("counts edited links that will be removed, per folder and in total", () => {
    const java = byKey(folders, "folder-10");
    expect(getFolderEditedSelectedCount(java, EMPTY_EXCLUSIONS)).toBe(1);
    expect(getFolderEditedSelectedCount(byKey(folders, "folder-20"), EMPTY_EXCLUSIONS)).toBe(0);
    const next = toggleReversalLink(java, 2, EMPTY_EXCLUSIONS);
    expect(getFolderEditedSelectedCount(java, next)).toBe(0);
    expect(getReversalCounts(folders, next).edited).toBe(0);
  });

  it("does not count an edited link that was already reversed", () => {
    const reversed = buildReversalFolders(
      preview(
        folder({ kind: "EXISTING", folderId: 20, links: [link(4, "REVERSED"), link(5, "EDITED")] }),
      ),
      { linkIds: new Set([4]), folderIds: new Set() },
    );
    expect(getReversalCounts(reversed, EMPTY_EXCLUSIONS).edited).toBe(1);
    const done = buildReversalFolders(
      preview(folder({ kind: "EXISTING", folderId: 20, links: [link(5, "REVERSED")] })),
      { linkIds: new Set([5]), folderIds: new Set() },
    );
    expect(getReversalCounts(done, EMPTY_EXCLUSIONS).edited).toBe(0);
  });

  it("marks a link saved after the import as moving to unfiled when its folder goes", () => {
    const java = byKey(folders, "folder-10");
    const outcomes = java.links.map((item) => getReversalLinkOutcome(java, item, EMPTY_EXCLUSIONS));
    expect(outcomes).toEqual(["remove", "remove", "unfiled"]);
  });

  it("keeps the shared folder and only removes its imported links", () => {
    const shared = byKey(folders, "folder-30");
    expect(getFolderCheck(shared, EMPTY_EXCLUSIONS)).toEqual({ checked: true, disabled: false });
    expect(buildReverseRequest(folders, EMPTY_EXCLUSIONS).folderIds).not.toContain(30);
  });
});

describe("toggleReversalLink", () => {
  const folders = buildReversalFolders(BASE);
  const java = byKey(folders, "folder-10");

  it("turns an unchecked link in a removed folder into + 미분류", () => {
    const next = toggleReversalLink(java, 1, EMPTY_EXCLUSIONS);
    expect(getReversalLinkOutcome(java, java.links[0], next)).toBe("unfiled");
    expect(getFolderCheck(java, next).checked).toBe("indeterminate");
    expect(getReversalCounts(folders, next)).toEqual({ links: 5, folders: 1, moved: 2, edited: 1 });
  });

  it("keeps the folder once every imported link in it is unchecked", () => {
    let next = toggleReversalLink(java, 1, EMPTY_EXCLUSIONS);
    next = toggleReversalLink(java, 2, next);
    expect(getFolderCheck(java, next).checked).toBe(false);
    expect(java.links.map((item) => getReversalLinkOutcome(java, item, next))).toEqual([
      "keep",
      "keep",
      "keep",
    ]);
    expect(buildReverseRequest(folders, next).folderIds).toEqual([]);
  });

  it("brings the folder back when a link is checked again", () => {
    let next = toggleReversalLink(java, 1, EMPTY_EXCLUSIONS);
    next = toggleReversalLink(java, 2, next);
    next = toggleReversalLink(java, 2, next);
    expect(buildReverseRequest(folders, next)).toMatchObject({ folderIds: [10] });
    expect(getReversalLinkOutcome(java, java.links[0], next)).toBe("unfiled");
  });

  it("ignores links that cannot be selected", () => {
    expect(toggleReversalLink(java, 3, EMPTY_EXCLUSIONS)).toBe(EMPTY_EXCLUSIONS);
    expect(toggleReversalLink(java, 999, EMPTY_EXCLUSIONS)).toBe(EMPTY_EXCLUSIONS);
  });

  it("treats a link in an existing folder as remove or keep, never unfiled", () => {
    const aws = byKey(folders, "folder-20");
    const next = toggleReversalLink(aws, 4, EMPTY_EXCLUSIONS);
    expect(getReversalLinkOutcome(aws, aws.links[0], next)).toBe("keep");
    expect(getFolderCheck(aws, next).checked).toBe("indeterminate");
  });
});

describe("toggleReversalFolder", () => {
  const folders = buildReversalFolders(BASE);
  const java = byKey(folders, "folder-10");

  it("unchecking a new folder keeps the folder and all its links", () => {
    const next = toggleReversalFolder(java, EMPTY_EXCLUSIONS);
    expect(getFolderCheck(java, next).checked).toBe(false);
    expect(java.links.map((item) => getReversalLinkOutcome(java, item, next))).toEqual([
      "keep",
      "keep",
      "keep",
    ]);
    expect(getReversalCounts(folders, next)).toEqual({ links: 4, folders: 0, moved: 0, edited: 0 });
  });

  it("checking a partly checked folder selects everything again", () => {
    const partly = toggleReversalLink(java, 1, EMPTY_EXCLUSIONS);
    const next = toggleReversalFolder(java, partly);
    expect(getFolderCheck(java, next).checked).toBe(true);
    expect(getReversalCounts(folders, next)).toEqual(getReversalCounts(folders, EMPTY_EXCLUSIONS));
  });

  it("toggles only the links of a folder that is never removed", () => {
    const aws = byKey(folders, "folder-20");
    const next = toggleReversalFolder(aws, EMPTY_EXCLUSIONS);
    expect(getFolderCheck(aws, next).checked).toBe(false);
    expect(buildReverseRequest(folders, next).linkIds).not.toEqual(expect.arrayContaining([4, 5]));
  });

  it("does nothing on a folder without selectable links", () => {
    const deleted = buildReversalFolders(
      preview(folder({ kind: "EXISTING", folderId: 20, links: [link(1, "DELETED")] })),
    )[0];
    expect(toggleReversalFolder(deleted, EMPTY_EXCLUSIONS)).toBe(EMPTY_EXCLUSIONS);
  });
});

describe("selection after the preview reloads", () => {
  it("keeps the user's choices and drops items that are no longer selectable", () => {
    const before = buildReversalFolders(BASE);
    const exclusions: ReversalExclusions = toggleReversalLink(
      byKey(before, "folder-20"),
      4,
      EMPTY_EXCLUSIONS,
    );
    const reloaded = preview(
      folder({ folderId: 10, state: "SHARED", links: [link(1), link(2, "EDITED")] }),
      folder({ kind: "EXISTING", folderId: 20, links: [link(4), link(5, "REVERSED")] }),
    );
    const done = findReversedSince(BASE, reloaded);
    const after = buildReversalFolders(reloaded, done);
    expect(buildReverseRequest(after, exclusions)).toEqual({ linkIds: [1, 2], folderIds: [] });
    expect(hasReversibleItems(after)).toBe(true);
  });
});

describe("findReversedSince", () => {
  it("lists links and folders that became reversed", () => {
    const current = preview(
      folder({
        folderId: 10,
        state: "REVERSED",
        links: [link(1, "REVERSED"), link(2, "REVERSED")],
      }),
      folder({ kind: "EXISTING", folderId: 20, links: [link(4, "REVERSED"), link(5)] }),
    );
    const done = findReversedSince(BASE, current);
    expect([...done.linkIds].sort()).toEqual([1, 2, 4]);
    expect([...done.folderIds]).toEqual([10]);
  });

  it("is empty before the first reload", () => {
    expect(findReversedSince(undefined, BASE).linkIds.size).toBe(0);
  });
});

describe("hasReversibleItems", () => {
  it("is false when only deleted or added links are left", () => {
    const folders = buildReversalFolders(
      preview(
        folder({ kind: "EXISTING", folderId: 20, links: [link(1, "DELETED")] }),
        folder({ folderId: 30, state: "SHARED", links: [link(2, "ADDED_LATER")] }),
      ),
    );
    expect(hasReversibleItems(folders)).toBe(false);
  });
});
