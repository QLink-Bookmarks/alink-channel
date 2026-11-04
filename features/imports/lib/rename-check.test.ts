import type { Folder } from "@/features/folders/types";

import { type RenameCheckContext, checkRename } from "./rename-check";

const ME = 1;

function folder(id: number, name: string, overrides: Partial<Folder> = {}): Folder {
  return { id, name, isShared: false, shareCounts: 0, linkCounts: 0, ownerId: ME, ...overrides };
}

const CONTEXT: RenameCheckContext = {
  currentTarget: "new:f1",
  currentName: "자바",
  newFolders: [
    { target: "new:f1", name: "자바" },
    { target: "new:f2", name: "DDD" },
  ],
  myFolders: [
    folder(10, "aws"),
    folder(11, "취업", { isShared: true, shareCounts: 2 }),
    folder(12, "남의 공유", { isShared: true, ownerId: 99 }),
  ],
  meId: ME,
};

describe("checkRename", () => {
  it("treats an empty or blank name as blank", () => {
    expect(checkRename("", CONTEXT)).toEqual({ type: "blank" });
    expect(checkRename("   ", CONTEXT)).toEqual({ type: "blank" });
  });

  it("treats the current name with spaces around it as unchanged", () => {
    expect(checkRename("  자바 ", CONTEXT)).toEqual({ type: "same" });
  });

  it("blocks the name of a shared folder I own", () => {
    expect(checkRename(" 취업", CONTEXT)).toEqual({ type: "blocked" });
  });

  it("does not block the name of a folder someone else shared with me", () => {
    expect(checkRename("남의 공유", CONTEXT)).toEqual({ type: "ok", name: "남의 공유" });
  });

  it("merges into my folder with the same name", () => {
    expect(checkRename("aws", CONTEXT)).toEqual({
      type: "merge-existing",
      folderId: 10,
      name: "aws",
    });
  });

  it("merges into another new folder with the same name", () => {
    expect(checkRename("DDD ", CONTEXT)).toEqual({
      type: "merge-new",
      target: "new:f2",
      name: "DDD",
    });
  });

  it("compares case-sensitively after NFC", () => {
    expect(checkRename("AWS", CONTEXT)).toEqual({ type: "ok", name: "AWS" });
    expect(checkRename("aws".normalize("NFD"), CONTEXT).type).toBe("merge-existing");
    expect(checkRename("자바".normalize("NFD"), CONTEXT)).toEqual({ type: "same" });
  });

  it("accepts a new name and returns it trimmed", () => {
    expect(checkRename("  인프라  ", CONTEXT)).toEqual({ type: "ok", name: "인프라" });
  });

  it("checks a name for a folder that does not exist yet", () => {
    const context = { ...CONTEXT, currentTarget: null, currentName: null };
    expect(checkRename("자바", context)).toEqual({
      type: "merge-new",
      target: "new:f1",
      name: "자바",
    });
  });
});
