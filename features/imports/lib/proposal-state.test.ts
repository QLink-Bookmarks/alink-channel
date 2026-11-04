import type { Folder } from "@/features/folders/types";

import type { ImportPreview } from "../types";
import type { ImportCandidates } from "./build-import-candidates";
import {
  type ProposalState,
  UNFILED_TARGET,
  createProposalState,
  getActiveLinks,
  getLastPickerTarget,
  getProposalSummary,
  getTargetName,
  isProposalDirty,
  proposalReducer,
} from "./proposal-state";
import { checkRename } from "./rename-check";

const ME = 1;

function folder(id: number, name: string, overrides: Partial<Folder> = {}): Folder {
  return { id, name, isShared: false, shareCounts: 0, linkCounts: 3, ownerId: ME, ...overrides };
}

const MY_FOLDERS: Folder[] = [
  folder(10, "aws"),
  folder(11, "취업", { isShared: true, shareCounts: 2 }),
  folder(12, "읽을거리"),
];

const CANDIDATES: ImportCandidates = {
  folders: [
    { key: "f1", name: "aws", createdAt: "2020-01-01T00:00:00.000Z", sourcePath: "북마크바 / aws" },
    { key: "f2", name: "취업", createdAt: null, sourcePath: "북마크바 / 취업" },
    {
      key: "f3",
      name: "자바",
      createdAt: "2021-01-01T00:00:00.000Z",
      sourcePath: "북마크바 / 자바",
    },
    { key: "f4", name: "저장됨만", createdAt: null, sourcePath: "저장됨만" },
  ],
  links: [
    {
      key: "l1",
      url: "https://u.example.com",
      title: "미분류 1",
      folderKey: null,
      createdAt: null,
    },
    { key: "l2", url: "https://a.example.com", title: "VPC", folderKey: "f1", createdAt: null },
    {
      key: "l3",
      url: "https://j.example.com",
      title: "취업 공고",
      folderKey: "f2",
      createdAt: null,
    },
    {
      key: "l4",
      url: "https://java.example.com",
      title: "Java 21",
      folderKey: "f3",
      createdAt: "2022-02-02T00:00:00.000Z",
    },
    {
      key: "l5",
      url: "https://java2.example.com",
      title: "Effective",
      folderKey: "f3",
      createdAt: null,
    },
    {
      key: "l6",
      url: "https://saved.example.com",
      title: "저장됨",
      folderKey: "f4",
      createdAt: null,
    },
    { key: "l7", url: "https://dup.example.com", title: "중복", folderKey: null, createdAt: null },
  ],
  unsupported: [{ title: "kd", url: "edge://newtab/", path: "즐겨찾기 모음", reason: "NOT_HTTP" }],
  duplicateCount: 0,
};

const PREVIEW: ImportPreview = {
  folders: [
    { key: "f1", matchType: "EXISTING", folderId: 10, suggestedName: "aws" },
    { key: "f2", matchType: "SHARED_CONFLICT", folderId: null, suggestedName: "취업 2" },
    { key: "f3", matchType: "NEW", folderId: null, suggestedName: "자바" },
    { key: "f4", matchType: "NEW", folderId: null, suggestedName: "저장됨만" },
  ],
  links: [
    { key: "l1", status: "NEW" },
    { key: "l2", status: "NEW" },
    { key: "l3", status: "NEW" },
    { key: "l4", status: "NEW" },
    { key: "l5", status: "NEW" },
    { key: "l6", status: "SAVED" },
    { key: "l7", status: "IN_FILE_DUPLICATE" },
  ],
};

function setup() {
  return createProposalState({ candidates: CANDIDATES, preview: PREVIEW, myFolders: MY_FOLDERS });
}

function rename(state: ProposalState, target: string, name: string) {
  const current = state.newFolders.find((item) => item.target === target);
  const check = checkRename(name, {
    currentTarget: target,
    currentName: current?.name ?? null,
    newFolders: state.newFolders,
    myFolders: MY_FOLDERS,
    meId: ME,
  });
  return proposalReducer(state, { type: "rename", target, check });
}

function targetsOf(state: ProposalState) {
  return Object.fromEntries(state.links.map((link) => [link.key, link.target]));
}

describe("createProposalState", () => {
  it("places links into existing, numbered and new folders from the preview", () => {
    const state = setup();

    expect(targetsOf(state)).toEqual({
      l1: UNFILED_TARGET,
      l2: "existing:10",
      l3: "new:f2",
      l4: "new:f3",
      l5: "new:f3",
    });
    expect(state.newFolders.map((item) => [item.target, item.name, item.conflictWith])).toEqual([
      ["new:f2", "취업 2", "취업"],
      ["new:f3", "자바", null],
    ]);
  });

  it("moves saved links to the skip list and drops in-file duplicates silently", () => {
    const state = setup();

    expect(state.skipped.map((item) => item.key)).toEqual(["l6"]);
    expect(state.links.some((item) => item.key === "l7")).toBe(false);
    expect(state.newFolders.some((item) => item.name === "저장됨만")).toBe(false);
  });

  it("treats an EXISTING match whose folder is not among my plain folders as a new folder", () => {
    const state = createProposalState({
      candidates: CANDIDATES,
      preview: {
        ...PREVIEW,
        folders: PREVIEW.folders.map((item) =>
          item.key === "f1" ? { ...item, folderId: 999 } : item,
        ),
      },
      myFolders: MY_FOLDERS,
    });

    expect(targetsOf(state).l2).toBe("new:f1");
  });

  it("counts links, new folders, skipped and unsupported links", () => {
    expect(getProposalSummary(setup())).toEqual({
      addCount: 5,
      newFolderCount: 2,
      skipCount: 1,
      unsupportedCount: 1,
    });
  });
});

describe("proposalReducer", () => {
  it("removes a link, updates the counts and puts it back on undo", () => {
    const state = setup();
    const removed = proposalReducer(state, { type: "remove", linkKey: "l2" });

    expect(getProposalSummary(removed).addCount).toBe(4);
    expect(removed.lastChange).toEqual({ type: "remove", linkTitle: "VPC", excludedFolder: null });
    expect(isProposalDirty(removed)).toBe(true);

    const restored = proposalReducer(removed, { type: "undo" });
    expect(getProposalSummary(restored).addCount).toBe(5);
    expect(restored.lastChange).toBeNull();
    expect(isProposalDirty(restored)).toBe(false);
  });

  it("excludes a new folder whose last link leaves, and includes it again when a link comes back", () => {
    let state = setup();
    state = proposalReducer(state, {
      type: "move",
      linkKey: "l3",
      target: UNFILED_TARGET,
      targetName: "미분류",
    });

    expect(state.lastChange).toEqual({
      type: "move",
      linkTitle: "취업 공고",
      toName: "미분류",
      excludedFolder: "취업 2",
    });
    expect(getProposalSummary(state).newFolderCount).toBe(1);
    expect(state.newFolders.some((item) => item.target === "new:f2")).toBe(true);

    state = proposalReducer(state, {
      type: "move",
      linkKey: "l1",
      target: "new:f2",
      targetName: "취업 2",
    });
    expect(getProposalSummary(state).newFolderCount).toBe(2);
  });

  it("only remembers the last change for undo", () => {
    let state = setup();
    state = proposalReducer(state, { type: "remove", linkKey: "l1" });
    state = proposalReducer(state, { type: "remove", linkKey: "l2" });
    state = proposalReducer(state, { type: "undo" });

    expect(getActiveLinks(state, UNFILED_TARGET)).toHaveLength(0);
    expect(getActiveLinks(state, "existing:10")).toHaveLength(1);
    expect(proposalReducer(state, { type: "undo" })).toBe(state);
  });

  it("renames a new folder without an undo entry", () => {
    const state = rename(setup(), "new:f3", "  자바 정리 ");

    expect(getTargetName(state, "new:f3")).toBe("자바 정리");
    expect(state.undo).toBeNull();
    expect(isProposalDirty(state)).toBe(true);
  });

  it("a rename replaces an older undo, so undo after it does not revert the rename", () => {
    let state = proposalReducer(setup(), {
      type: "move",
      linkKey: "l1",
      target: "new:f3",
      targetName: "자바",
    });
    expect(state.undo).not.toBeNull();
    state = rename(state, "new:f3", "자바 정리");

    expect(state.undo).toBeNull();
    expect(state.lastChange).toBeNull();
    const after = proposalReducer(state, { type: "undo" });
    expect(after).toBe(state);
    expect(getTargetName(after, "new:f3")).toBe("자바 정리");
    expect(getActiveLinks(after, "new:f3").map((link) => link.key)).toEqual(["l1", "l4", "l5"]);
  });

  it("ignores a blank or unchanged name", () => {
    const state = setup();
    expect(rename(state, "new:f3", "   ")).toBe(state);
    expect(rename(state, "new:f3", "자바 ")).toBe(state);
  });

  it("keeps the name and reports it when the new name belongs to my shared folder", () => {
    const state = rename(setup(), "new:f3", "취업");

    expect(getTargetName(state, "new:f3")).toBe("자바");
    expect(state.lastChange).toEqual({ type: "rename-blocked", name: "자바" });
  });

  it("merges into my folder with the same name and undoes the merge", () => {
    const merged = rename(setup(), "new:f3", "aws");

    expect(getActiveLinks(merged, "existing:10").map((link) => link.key)).toEqual([
      "l2",
      "l4",
      "l5",
    ]);
    expect(merged.newFolders.some((item) => item.target === "new:f3")).toBe(false);
    expect(merged.lastChange).toEqual({
      type: "merge",
      fromName: "자바",
      count: 2,
      toKind: "existing",
      toName: "aws",
    });
    expect(getProposalSummary(merged).newFolderCount).toBe(1);

    const restored = proposalReducer(merged, { type: "undo" });
    expect(getActiveLinks(restored, "new:f3")).toHaveLength(2);
    expect(isProposalDirty(restored)).toBe(false);
  });

  it("merges two new folders into one", () => {
    const merged = rename(setup(), "new:f3", "취업 2");

    expect(getActiveLinks(merged, "new:f2").map((link) => link.key)).toEqual(["l3", "l4", "l5"]);
    expect(merged.newFolders.map((item) => item.target)).toEqual(["new:f2"]);
    expect(merged.lastChange).toMatchObject({ type: "merge", toKind: "new", toName: "취업 2" });
  });

  it("adds a folder from the picker, and drops it when nothing moved into it", () => {
    let state = proposalReducer(setup(), { type: "add-picker-folder", name: "인프라" });
    const target = getLastPickerTarget(state);

    expect(target).toBe("new:p1");
    expect(getTargetName(state, target)).toBe("인프라");
    expect(isProposalDirty(state)).toBe(false);
    expect(getProposalSummary(state).newFolderCount).toBe(2);

    state = proposalReducer(state, { type: "discard-unused-picker-folders" });
    expect(state.newFolders.some((item) => item.target === target)).toBe(false);
  });

  it("keeps a picker folder that received a link and counts it as new", () => {
    let state = proposalReducer(setup(), { type: "add-picker-folder", name: "인프라" });
    const target = getLastPickerTarget(state);
    state = proposalReducer(state, { type: "move", linkKey: "l1", target, targetName: "인프라" });
    state = proposalReducer(state, { type: "discard-unused-picker-folders" });

    expect(getProposalSummary(state).newFolderCount).toBe(3);
    expect(getTargetName(state, target)).toBe("인프라");
  });

  it("drops an empty picker folder again when the move into it is undone", () => {
    let state = proposalReducer(setup(), { type: "add-picker-folder", name: "인프라" });
    const target = getLastPickerTarget(state);
    state = proposalReducer(state, { type: "move", linkKey: "l1", target, targetName: "인프라" });
    state = proposalReducer(state, { type: "undo" });

    expect(state.newFolders.some((item) => item.target === target)).toBe(false);
  });

  it("closes the status line and forgets the undo entry", () => {
    let state = proposalReducer(setup(), { type: "remove", linkKey: "l1" });
    state = proposalReducer(state, { type: "dismiss-change" });

    expect(state.lastChange).toBeNull();
    expect(state.undo).toBeNull();
  });
});
