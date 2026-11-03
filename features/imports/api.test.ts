import { api } from "@/lib/api-client";

import {
  IMPORT_ERROR_CODES,
  createImportPreview,
  getImport,
  getImportErrorName,
  getImportReversalPreview,
  getImports,
  reverseImport,
  startImport,
} from "./api";
import type { CreateImportPreviewRequest, StartImportRequest } from "./types";

jest.mock("@/lib/api-client", () => ({
  api: {
    get: jest.fn(async () => ({ success: true, data: null, error: null })),
    post: jest.fn(async () => ({ success: true, data: null, error: null })),
  },
}));

const get = api.get as jest.Mock;
const post = api.post as jest.Mock;

beforeEach(() => {
  get.mockClear();
  post.mockClear();
});

describe("createImportPreview", () => {
  it("posts folders and links to /api/import-previews", async () => {
    const payload: CreateImportPreviewRequest = {
      folders: [{ key: "f1", name: "개발" }],
      links: [
        { key: "l1", url: "https://example.com/a" },
        { key: "l2", url: "https://example.com/b" },
      ],
    };

    await createImportPreview(payload);

    expect(post).toHaveBeenCalledTimes(1);
    expect(post).toHaveBeenCalledWith("/api/import-previews", payload);
  });
});

describe("startImport", () => {
  it("posts the full start request to /api/imports without a per-request timeout", async () => {
    const payload: StartImportRequest = {
      clientRequestId: "6f1c2a8e-3b9d-4c1e-9f2a-0d7b5e4c3a21",
      fileName: "bookmarks_2026_11_03.html",
      folders: [
        { key: "f1", folderId: 12, name: "개발", createdAt: null },
        { key: "f2", folderId: null, name: "여행", createdAt: "2024-05-01T00:00:00Z" },
      ],
      links: [
        {
          key: "l1",
          url: "https://example.com/a",
          title: "A",
          folderKey: "f1",
          createdAt: "2024-05-02T00:00:00Z",
        },
        { key: "l2", url: "https://example.com/b", title: "B", folderKey: null, createdAt: null },
      ],
    };

    await startImport(payload);

    expect(post).toHaveBeenCalledTimes(1);
    const [path, body, config] = post.mock.calls[0];
    expect(path).toBe("/api/imports");
    expect(body).toEqual(payload);
    expect(config).toBeUndefined();
  });
});

describe("getImports", () => {
  it("gets /api/imports with cursor and size as query params", async () => {
    await getImports({ cursor: "abc", size: 15 });

    expect(get).toHaveBeenCalledWith("/api/imports", { params: { cursor: "abc", size: 15 } });
  });

  it("sends no params on the first page by default", async () => {
    await getImports();

    expect(get).toHaveBeenCalledWith("/api/imports", { params: {} });
  });
});

describe("import record endpoints", () => {
  it("gets the detail at /api/imports/{id}", async () => {
    await getImport(42);

    expect(get).toHaveBeenCalledWith("/api/imports/42");
  });

  it("gets the reversal preview at /api/imports/{id}/reversal-preview", async () => {
    await getImportReversalPreview(42);

    expect(get).toHaveBeenCalledWith("/api/imports/42/reversal-preview");
  });

  it("posts link and folder ids to /api/imports/{id}/reversals", async () => {
    await reverseImport(42, { linkIds: [1, 2], folderIds: [9] });

    expect(post).toHaveBeenCalledTimes(1);
    expect(post).toHaveBeenCalledWith("/api/imports/42/reversals", {
      linkIds: [1, 2],
      folderIds: [9],
    });
  });
});

describe("getImportErrorName", () => {
  const axiosError = (code: unknown, status = 400) => ({
    isAxiosError: true,
    response: { status, data: { success: false, data: null, error: { code, message: "x" } } },
  });

  it.each([
    ["IMPORT_400_0001", "IMPORT_LINKS_EMPTY"],
    ["IMPORT_400_0005", "IMPORT_FOLDER_KEY_NOT_FOUND"],
    ["IMPORT_400_0011", "IMPORT_REVERSAL_ITEM_INVALID"],
    ["IMPORT_404_0002", "IMPORT_NOT_FOUND"],
    ["IMPORT_404_0003", "IMPORT_PREVIEW_OWNER_NOT_FOUND"],
    ["IMPORT_422_0002", "IMPORT_REVERSAL_FOLDER_SHARED"],
    ["COM_400_0004", "COMMON_CURSOR_MALFORMED"],
  ])("maps server code %s to %s", (code, name) => {
    expect(getImportErrorName(axiosError(code))).toBe(name);
  });

  it("does not map the unused IMPORT_422_0001", () => {
    expect(getImportErrorName(axiosError("IMPORT_422_0001", 422))).toBeNull();
    expect(Object.values(IMPORT_ERROR_CODES)).not.toContain("IMPORT_422_0001");
  });

  it("returns null for unknown codes, network errors and non-errors", () => {
    expect(getImportErrorName(axiosError("LINK_404_0001", 404))).toBeNull();
    expect(getImportErrorName(axiosError(undefined, 500))).toBeNull();
    expect(getImportErrorName(new Error("Network Error"))).toBeNull();
    expect(getImportErrorName(null)).toBeNull();
  });

  it("keeps every code unique", () => {
    const codes = Object.values(IMPORT_ERROR_CODES);
    expect(new Set(codes).size).toBe(codes.length);
  });
});
