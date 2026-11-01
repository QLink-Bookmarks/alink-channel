import * as React from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react-native";

import { getFolders } from "./api";
import { MAX_FOLDER_PAGES, fetchAllFolders, useFolderQuery } from "./queries";
import type { Folder, GetFoldersParams } from "./types";

jest.mock("./api", () => ({ getFolders: jest.fn(), getFolderMembers: jest.fn() }));

const mockedGetFolders = getFolders as jest.MockedFunction<typeof getFolders>;

function makeFolders(count: number): Folder[] {
  return Array.from({ length: count }, (_, index) => {
    const id = count - index;
    return { id, name: `폴더 ${id}`, isShared: id % 3 === 0, shareCounts: 0, linkCounts: 0 };
  });
}

function serve(folders: Folder[], options: { failPages?: Set<number> } = {}) {
  mockedGetFolders.mockImplementation(async (params: GetFoldersParams = {}) => {
    const size = params.size ?? folders.length;
    const offset = Number(params.cursor ?? 0);
    if (options.failPages?.has(Math.floor(offset / size))) {
      throw new Error("network");
    }
    const end = offset + size;
    const hasNext = end < folders.length;
    return {
      success: true,
      error: null,
      data: {
        isEmpty: false,
        contents: folders.slice(offset, end),
        nextCursor: hasNext ? String(end) : null,
        hasNext,
      },
    } as Awaited<ReturnType<typeof getFolders>>;
  });
}

function createClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
}

function renderFolderQuery(id: number, client = createClient()) {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return renderHook(() => useFolderQuery(id), { wrapper });
}

beforeEach(() => {
  mockedGetFolders.mockReset();
});

describe("fetchAllFolders", () => {
  it("follows cursors 20 at a time until the last page", async () => {
    serve(makeFolders(45));

    const result = await fetchAllFolders({ order: "latest" });

    expect(result.contents).toHaveLength(45);
    expect(result.contents.at(-1)?.id).toBe(1);
    expect(result.hasNext).toBe(false);
    expect(result.nextCursor).toBeNull();
    expect(mockedGetFolders.mock.calls.map(([params]) => [params?.cursor, params?.size])).toEqual([
      [undefined, 20],
      ["20", 20],
      ["40", 20],
    ]);
  });

  it("stops after one request when the first page is the last", async () => {
    serve(makeFolders(20));

    const result = await fetchAllFolders({ order: "latest" });

    expect(result.contents).toHaveLength(20);
    expect(mockedGetFolders).toHaveBeenCalledTimes(1);
  });

  it("stops at the page cap", async () => {
    mockedGetFolders.mockImplementation(async (params: GetFoldersParams = {}) => {
      const next = String(Number(params.cursor ?? 0) + 1);
      return {
        success: true,
        error: null,
        data: { isEmpty: false, contents: [], nextCursor: next, hasNext: true },
      } as Awaited<ReturnType<typeof getFolders>>;
    });

    await fetchAllFolders({ order: "latest" });

    expect(mockedGetFolders).toHaveBeenCalledTimes(MAX_FOLDER_PAGES);
  });

  it("stops when the server repeats the same cursor", async () => {
    mockedGetFolders.mockResolvedValue({
      success: true,
      error: null,
      data: { isEmpty: false, contents: makeFolders(1), nextCursor: "same", hasNext: true },
    } as Awaited<ReturnType<typeof getFolders>>);

    const result = await fetchAllFolders({ order: "latest" });

    expect(result.contents).toHaveLength(1);
    expect(mockedGetFolders).toHaveBeenCalledTimes(2);
  });

  it("returns an empty list for an account without folders", async () => {
    serve([]);

    const result = await fetchAllFolders({ order: "latest" });

    expect(result.isEmpty).toBe(true);
    expect(result.contents).toEqual([]);
  });
});

describe("useFolderQuery", () => {
  it("fetches next pages until the folder appears", async () => {
    serve(makeFolders(45));

    const { result } = renderFolderQuery(1);

    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.folder?.id).toBe(1));
    expect(result.current.isNotFound).toBe(false);
    expect(mockedGetFolders).toHaveBeenCalledTimes(3);
  });

  it("stops at the first page that holds the folder", async () => {
    serve(makeFolders(45));

    const { result } = renderFolderQuery(40);

    await waitFor(() => expect(result.current.folder?.id).toBe(40));
    expect(mockedGetFolders).toHaveBeenCalledTimes(1);
  });

  it("reports not found only after the last page", async () => {
    serve(makeFolders(45));

    const { result } = renderFolderQuery(9999);

    await waitFor(() => expect(result.current.isNotFound).toBe(true));
    expect(result.current.isLoading).toBe(false);
    expect(mockedGetFolders).toHaveBeenCalledTimes(3);
  });

  it("shares pages between two lookups of the same folder without duplicate requests", async () => {
    serve(makeFolders(45));
    const client = createClient();

    const first = renderFolderQuery(5, client);
    const second = renderFolderQuery(5, client);

    await waitFor(() => expect(first.result.current.folder?.id).toBe(5));
    await waitFor(() => expect(second.result.current.folder?.id).toBe(5));
    expect(mockedGetFolders.mock.calls.map(([params]) => params?.cursor)).toEqual([
      undefined,
      "20",
      "40",
    ]);
  });

  it("stops asking for next pages when the server repeats the last cursor", async () => {
    mockedGetFolders.mockResolvedValue({
      success: true,
      error: null,
      data: { isEmpty: false, contents: makeFolders(1), nextCursor: "same", hasNext: true },
    } as Awaited<ReturnType<typeof getFolders>>);

    const { result } = renderFolderQuery(9999);

    await waitFor(() => expect(result.current.isNotFound).toBe(true));
    expect(mockedGetFolders).toHaveBeenCalledTimes(2);
  });

  it("reports not found without a request for an invalid id", () => {
    serve(makeFolders(5));

    const { result } = renderFolderQuery(Number.NaN);

    expect(result.current.isNotFound).toBe(true);
    expect(mockedGetFolders).not.toHaveBeenCalled();
  });

  it("reports an error instead of not found when a next page fails, and retry continues", async () => {
    const failPages = new Set([1]);
    serve(makeFolders(45), { failPages });

    const { result } = renderFolderQuery(1);

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.isNotFound).toBe(false);
    expect(result.current.isLoading).toBe(false);
    const callsBeforeRetry = mockedGetFolders.mock.calls.length;

    failPages.clear();
    act(() => {
      result.current.retry();
      result.current.retry();
    });

    await waitFor(() => expect(result.current.isError).toBe(false));
    expect(result.current.isLoading || Boolean(result.current.folder)).toBe(true);
    await waitFor(() => expect(result.current.folder?.id).toBe(1));
    expect(mockedGetFolders.mock.calls.length - callsBeforeRetry).toBe(2);
  });

  it("reports an error when the first page fails, and retry refetches", async () => {
    const failPages = new Set([0]);
    serve(makeFolders(45), { failPages });

    const { result } = renderFolderQuery(30);

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.isNotFound).toBe(false);

    failPages.clear();
    act(() => result.current.retry());

    await waitFor(() => expect(result.current.folder?.id).toBe(30));
  });
});
