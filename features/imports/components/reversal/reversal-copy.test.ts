import { buildReversalFolders } from "../../lib/reversal-selection";
import {
  getReversalFolderLabel,
  getReversalHint,
  getReversalSuccessMessage,
} from "./reversal-copy";

describe("getReversalFolderLabel", () => {
  it("shows the app's own label for the unfiled group the server sends without a name", () => {
    const [unfiled] = buildReversalFolders({
      folders: [
        {
          kind: "UNFILED",
          state: "ACTIVE",
          folderId: null,
          name: null,
          emoji: null,
          links: [{ linkId: 1, title: "링크", url: "https://u.test/1", state: "IMPORTED" }],
        },
      ],
    });
    expect(unfiled.name).toBeNull();
    expect(getReversalFolderLabel(unfiled)).toEqual({ name: "미분류", emoji: "🗂️" });
  });

  it("keeps the server's name and emoji for a named folder", () => {
    const [named] = buildReversalFolders({
      folders: [
        {
          kind: "NEW",
          state: "ACTIVE",
          folderId: 10,
          name: "자바",
          emoji: "☕",
          links: [{ linkId: 2, title: "링크", url: "https://u.test/2", state: "IMPORTED" }],
        },
      ],
    });
    expect(getReversalFolderLabel(named)).toEqual({ name: "자바", emoji: "☕" });
  });
});

describe("getReversalHint", () => {
  const counts = { links: 6, folders: 1, moved: 0, edited: 0 };

  it("asks to pick something when nothing is selected", () => {
    expect(
      getReversalHint({ links: 0, folders: 0, moved: 0, edited: 0 }, { hasError: false }),
    ).toEqual({
      text: "지울 항목을 골라 주세요.",
      editedNote: null,
    });
  });

  it("names links as the subject of the move to unfiled", () => {
    expect(getReversalHint({ ...counts, moved: 1 }, { hasError: false }).text).toBe(
      "링크 6개 · 폴더 1개를 지우고, 링크 1개는 미분류로 옮겨요.",
    );
    expect(getReversalHint(counts, { hasError: false }).text).toBe("링크 6개 · 폴더 1개를 지워요.");
  });

  it("adds the edited-link note only when an edited link will be removed", () => {
    expect(getReversalHint(counts, { hasError: false }).editedNote).toBeNull();
    expect(getReversalHint({ ...counts, edited: 2 }, { hasError: false }).editedNote).toBe(
      "수정한 링크 2개 포함",
    );
  });

  it("speaks about what is left after a failed attempt", () => {
    expect(getReversalHint({ ...counts, links: 3, edited: 1 }, { hasError: true })).toEqual({
      text: "남은 링크 3개 · 폴더 1개를 지워요.",
      editedNote: "수정한 링크 1개 포함",
    });
  });
});

describe("getReversalSuccessMessage", () => {
  it("names removed links and folders and the links moved to unfiled", () => {
    expect(getReversalSuccessMessage({ links: 6, folders: 1, moved: 1 })).toBe(
      "링크 6개와 폴더 1개를 지웠어요. 링크 1개는 미분류로 옮겼어요.",
    );
  });

  it("omits the parts that are zero", () => {
    expect(getReversalSuccessMessage({ links: 3, folders: 0, moved: 0 })).toBe(
      "링크 3개를 지웠어요.",
    );
    expect(getReversalSuccessMessage({ links: 0, folders: 2, moved: 4 })).toBe(
      "폴더 2개를 지웠어요. 링크 4개는 미분류로 옮겼어요.",
    );
  });

  it("formats large counts with separators", () => {
    expect(getReversalSuccessMessage({ links: 2000, folders: 12, moved: 0 })).toBe(
      "링크 2,000개와 폴더 12개를 지웠어요.",
    );
  });

  it("falls back to a plain done sentence when nothing is counted", () => {
    expect(getReversalSuccessMessage({ links: 0, folders: 0, moved: 0 })).toBe(
      "되돌리기를 끝냈어요.",
    );
  });
});
