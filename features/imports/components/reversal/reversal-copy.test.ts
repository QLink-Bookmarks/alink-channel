import { buildReversalFolders } from "../../lib/reversal-selection";
import { getReversalFolderLabel } from "./reversal-copy";

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
