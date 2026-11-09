import type { Folder } from "@/features/folders/types";

import type { ImportPreview } from "../types";
import type { ImportCandidates } from "./build-import-candidates";
import {
  buildStartRequest,
  buildStartRequestBody,
  getStartRequestSignature,
  resolveClientRequestId,
} from "./build-start-request";
import { createProposalState, getLastPickerTarget, proposalReducer } from "./proposal-state";

const ME = 1;

function folder(id: number, name: string, overrides: Partial<Folder> = {}): Folder {
  return {
    id,
    name,
    isShared: false,
    shareCounts: 0,
    linkCounts: 3,
    myLinkCounts: 3,
    ownerId: ME,
    ...overrides,
  };
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

describe("buildStartRequest", () => {
  it("sends only target folders with links, existing ones by id, new ones with their date", () => {
    let state = setup();
    state = proposalReducer(state, { type: "remove", linkKey: "l3" });
    state = proposalReducer(state, { type: "add-picker-folder", name: "인프라" });
    state = proposalReducer(state, {
      type: "move",
      linkKey: "l5",
      target: getLastPickerTarget(state),
      targetName: "인프라",
    });

    expect(
      buildStartRequest({
        state,
        clientRequestId: "0b5e5c1e-3b1c-4b8a-9d3e-1f2a3b4c5d6e",
        fileName: " bookmarks.html ",
      }),
    ).toEqual({
      clientRequestId: "0b5e5c1e-3b1c-4b8a-9d3e-1f2a3b4c5d6e",
      fileName: "bookmarks.html",
      folders: [
        { key: "existing:10", folderId: 10, name: "aws" },
        { key: "new:f3", name: "자바", createdAt: "2021-01-01T00:00:00.000Z" },
        { key: "new:p1", name: "인프라", createdAt: null },
      ],
      links: [
        {
          key: "l1",
          url: "https://u.example.com",
          title: "미분류 1",
          folderKey: null,
          createdAt: null,
        },
        {
          key: "l2",
          url: "https://a.example.com",
          title: "VPC",
          folderKey: "existing:10",
          createdAt: null,
        },
        {
          key: "l4",
          url: "https://java.example.com",
          title: "Java 21",
          folderKey: "new:f3",
          createdAt: "2022-02-02T00:00:00.000Z",
        },
        {
          key: "l5",
          url: "https://java2.example.com",
          title: "Effective",
          folderKey: "new:p1",
          createdAt: null,
        },
      ],
    });
  });

  it("leaves out a folder emptied with 모두 빼기, and sends links put back into their folder", () => {
    let state = proposalReducer(setup(), { type: "remove-all", target: "new:f3" });
    state = proposalReducer(state, { type: "remove", linkKey: "l1" });
    state = proposalReducer(state, { type: "restore", linkKey: "l4" });
    const request = buildStartRequest({ state, clientRequestId: "id", fileName: "a.html" });

    expect(request.folders.map((item) => item.key)).toEqual(["existing:10", "new:f2", "new:f3"]);
    expect(request.links.map((link) => [link.key, link.folderKey])).toEqual([
      ["l2", "existing:10"],
      ["l3", "new:f2"],
      ["l4", "new:f3"],
    ]);

    const emptied = proposalReducer(setup(), { type: "remove-all", target: "new:f3" });
    const emptiedRequest = buildStartRequest({
      state: emptied,
      clientRequestId: "id",
      fileName: "a.html",
    });
    expect(emptiedRequest.folders.map((item) => item.key)).not.toContain("new:f3");
    expect(emptiedRequest.links.map((link) => link.key)).not.toContain("l5");
  });

  it("cuts a long file name at 255 units", () => {
    const request = buildStartRequest({
      state: setup(),
      clientRequestId: "id",
      fileName: `${"a".repeat(300)}.html`,
    });
    expect(request.fileName).toHaveLength(255);
  });
});

describe("resolveClientRequestId", () => {
  function signatureOf(state: ReturnType<typeof setup>, fileName = "a.html") {
    return getStartRequestSignature(buildStartRequestBody({ state, fileName }));
  }

  it("keeps the same id while the request body does not change", () => {
    let count = 0;
    const createId = () => `id-${(count += 1)}`;
    const first = resolveClientRequestId(null, signatureOf(setup()), createId);
    const again = resolveClientRequestId(first, signatureOf(setup()), createId);

    expect(first.id).toBe("id-1");
    expect(again).toBe(first);
    expect(count).toBe(1);
  });

  it("makes a new id once the links, folders or file name change", () => {
    let count = 0;
    const createId = () => `id-${(count += 1)}`;
    const base = resolveClientRequestId(null, signatureOf(setup()), createId);
    const removed = proposalReducer(setup(), { type: "remove", linkKey: "l1" });

    expect(resolveClientRequestId(base, signatureOf(removed), createId).id).toBe("id-2");
    expect(resolveClientRequestId(base, signatureOf(setup(), "b.html"), createId).id).toBe("id-3");
  });

  it("gives the same body after an undo the same signature", () => {
    const state = setup();
    const removed = proposalReducer(state, { type: "remove", linkKey: "l1" });
    const restored = proposalReducer(removed, { type: "undo" });

    expect(signatureOf(restored)).toBe(signatureOf(state));
    expect(signatureOf(removed)).not.toBe(signatureOf(state));
  });
});
