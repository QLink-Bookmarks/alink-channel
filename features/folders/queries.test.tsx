import * as React from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react-native";

import { getFolderMembers, getFolders } from "./api";
import {
  FOLDER_LIST_SORT,
  MAX_FOLDER_PAGES,
  fetchAllFolders,
  folderQueryKeys,
  useFolderMembersQuery,
  useFolderPagesQuery,
  useFolderQuery,
  useFoldersQuery,
} from "./queries";
import type { Folder, GetFoldersParams } from "./types";

jest.mock("./api", () => ({ getFolders: jest.fn(), getFolderMembers: jest.fn() }));

const mockedGetFolders = getFolders as jest.MockedFunction<typeof getFolders>;
const mockedGetFolderMembers = getFolderMembers as jest.MockedFunction<typeof getFolderMembers>;

function makeFolders(count: number): Folder[] {
  return Array.from({ length: count }, (_, index) => {
    const id = count - index;
    return {
      id,
      name: `폴더 ${id}`,
      isShared: id % 3 === 0,
      shareCounts: 0,
      linkCounts: 0,
      myLinkCounts: 0,
    };
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

    const result = await fetchAllFolders(FOLDER_LIST_SORT);

    expect(result.contents).toHaveLength(45);
    expect(result.contents.at(-1)?.id).toBe(1);
    expect(result.hasNext).toBe(false);
    expect(result.nextCursor).toBeNull();
    expect(mockedGetFolders.mock.calls.map(([params]) => [params?.cursor, params?.size])).toEqual([
      [undefined, 20],
      ["20", 20],
      ["40", 20],
    ]);
    for (const [params] of mockedGetFolders.mock.calls) {
      expect(params).toMatchObject({ orderKey: "created_at", order: "desc" });
    }
  });

  it("stops after one request when the first page is the last", async () => {
    serve(makeFolders(20));

    const result = await fetchAllFolders(FOLDER_LIST_SORT);

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

    await fetchAllFolders(FOLDER_LIST_SORT);

    expect(mockedGetFolders).toHaveBeenCalledTimes(MAX_FOLDER_PAGES);
  });

  it("stops when the server repeats the same cursor", async () => {
    mockedGetFolders.mockResolvedValue({
      success: true,
      error: null,
      data: { isEmpty: false, contents: makeFolders(1), nextCursor: "same", hasNext: true },
    } as Awaited<ReturnType<typeof getFolders>>);

    const result = await fetchAllFolders(FOLDER_LIST_SORT);

    expect(result.contents).toHaveLength(1);
    expect(mockedGetFolders).toHaveBeenCalledTimes(2);
  });

  it("returns an empty list for an account without folders", async () => {
    serve([]);

    const result = await fetchAllFolders(FOLDER_LIST_SORT);

    expect(result.isEmpty).toBe(true);
    expect(result.contents).toEqual([]);
  });
});

describe("useFoldersQuery", () => {
  it("asks for the newest folders first by default, under a key that names the sort", async () => {
    serve(makeFolders(3));
    const client = createClient();
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useFoldersQuery({ size: 15 }), { wrapper });

    await waitFor(() => expect(result.current.data?.contents).toHaveLength(3));
    expect(mockedGetFolders).toHaveBeenCalledWith({
      orderKey: "created_at",
      order: "desc",
      query: undefined,
      cursor: undefined,
      size: 20,
    });
    expect(
      client.getQueryData(folderQueryKeys.list({ ...FOLDER_LIST_SORT, query: undefined })),
    ).toBe(result.current.data);
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
    expect(mockedGetFolders.mock.calls.map(([params]) => params)).toEqual([
      { orderKey: "created_at", order: "desc", cursor: undefined, size: 20 },
      { orderKey: "created_at", order: "desc", cursor: "20", size: 20 },
      { orderKey: "created_at", order: "desc", cursor: "40", size: 20 },
    ]);
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

function cursorMalformedError() {
  return Object.assign(new Error("Request failed with status code 400"), {
    isAxiosError: true,
    response: {
      status: 400,
      data: {
        success: false,
        data: null,
        error: { code: "COM_400_0004", message: "커서 형식이 올바르지 않습니다." },
      },
    },
  });
}

function servePage(folders: Folder[], nextCursor: string | null) {
  return {
    success: true,
    error: null,
    data: { isEmpty: folders.length === 0, contents: folders, nextCursor, hasNext: !!nextCursor },
  } as Awaited<ReturnType<typeof getFolders>>;
}

function requestedCursors() {
  return mockedGetFolders.mock.calls.map(([params]) => params?.cursor ?? "first");
}

function renderFolderPages(client = createClient(), seenErrors: boolean[] = []) {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return renderHook(
    () => {
      const query = useFolderPagesQuery();
      seenErrors.push(query.isFetchNextPageError || query.isError);
      return query;
    },
    { wrapper },
  );
}

function waitForSettledPages(
  client: QueryClient,
  query: { current: { data?: unknown; isFetching: boolean } },
) {
  return waitFor(() => {
    const [pagesQuery] = client.getQueryCache().findAll({ queryKey: ["folders", "infinite"] });
    expect(pagesQuery?.state.fetchStatus).toBe("idle");
    expect(query.current.isFetching).toBe(false);
    expect(query.current.data).toBe(pagesQuery?.state.data);
  });
}

describe("useFolderPagesQuery", () => {
  it("reads again from the first page when the next page cursor is malformed, without reporting an error meanwhile", async () => {
    const folders = makeFolders(45);
    let firstPageCursor = "stale";
    mockedGetFolders.mockImplementation(async (params: GetFoldersParams = {}) => {
      if (params.cursor === undefined) {
        return servePage(folders.slice(0, 20), firstPageCursor);
      }
      if (params.cursor === "stale") {
        firstPageCursor = "20";
        throw cursorMalformedError();
      }
      const offset = Number(params.cursor);
      const end = offset + 20;
      return servePage(folders.slice(offset, end), end < folders.length ? String(end) : null);
    });

    const seenErrors: boolean[] = [];
    const client = createClient();
    const { result } = renderFolderPages(client, seenErrors);
    await waitFor(() => expect(result.current.data?.pages).toHaveLength(1));

    await act(async () => {
      await result.current.fetchNextPage();
    });

    await waitFor(() => expect(requestedCursors()).toStrictEqual(["first", "stale", "first"]));
    expect(seenErrors).not.toContain(true);
    await waitForSettledPages(client, result);
    expect(result.current.isFetchNextPageError).toBe(false);
    expect(result.current.data?.pages).toHaveLength(1);
    expect(result.current.data?.pages[0].nextCursor).toBe("20");

    await act(async () => {
      await result.current.fetchNextPage();
    });

    await waitFor(() => expect(result.current.data?.pages).toHaveLength(2));
    expect(result.current.data?.pages[1].contents[0].id).toBe(25);
  });

  it("restarts once for two mounted hooks, and leaves a second malformed cursor in a row to the retry button", async () => {
    mockedGetFolders.mockImplementation(async (params: GetFoldersParams = {}) => {
      if (params.cursor === undefined) {
        return servePage(makeFolders(20), "bad");
      }
      throw cursorMalformedError();
    });
    const client = createClient();
    const first = renderFolderPages(client);
    const second = renderFolderPages(client);
    await waitFor(() => expect(first.result.current.data?.pages).toHaveLength(1));

    await act(async () => {
      await first.result.current.fetchNextPage();
    });
    await waitFor(() => expect(requestedCursors()).toStrictEqual(["first", "bad", "first"]));
    await waitForSettledPages(client, first.result);

    await act(async () => {
      await first.result.current.fetchNextPage();
    });
    await waitFor(() => expect(first.result.current.isFetchNextPageError).toBe(true));
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
    expect(first.result.current.isFetchNextPageError).toBe(true);
    expect(second.result.current.isFetchNextPageError).toBe(true);
    expect(requestedCursors()).toStrictEqual(["first", "bad", "first", "bad"]);
  });

  it("restarts again when a malformed cursor comes back after a next page loaded", async () => {
    let generation = 0;
    mockedGetFolders.mockImplementation(async (params: GetFoldersParams = {}) => {
      if (params.cursor === undefined) {
        return servePage(makeFolders(20), `g${generation}-p1`);
      }
      const [cursorGeneration, page] = params.cursor.split("-");
      if (cursorGeneration !== `g${generation}`) {
        throw cursorMalformedError();
      }
      return servePage(makeFolders(20), page === "p1" ? `g${generation}-p2` : `g${generation}-p3`);
    });

    const client = createClient();
    const { result } = renderFolderPages(client);
    await waitFor(() => expect(result.current.data?.pages).toHaveLength(1));
    generation = 1;

    await act(async () => {
      await result.current.fetchNextPage();
    });
    await waitFor(() => expect(requestedCursors()).toStrictEqual(["first", "g0-p1", "first"]));
    await waitForSettledPages(client, result);

    await act(async () => {
      await result.current.fetchNextPage();
    });
    await waitFor(() => expect(result.current.data?.pages).toHaveLength(2));
    generation = 2;

    await act(async () => {
      await result.current.fetchNextPage();
    });
    await waitFor(() =>
      expect(requestedCursors()).toStrictEqual([
        "first",
        "g0-p1",
        "first",
        "g1-p1",
        "g1-p2",
        "first",
        "g2-p1",
      ]),
    );
    await waitForSettledPages(client, result);
    expect(result.current.isFetchNextPageError).toBe(false);
    expect(result.current.data?.pages).toHaveLength(2);
    expect(result.current.data?.pages[1].nextCursor).toBe("g2-p2");
  });

  it("restarts again when a malformed cursor comes back after a refetch without new pages", async () => {
    let generation = 0;
    mockedGetFolders.mockImplementation(async (params: GetFoldersParams = {}) => {
      if (params.cursor === undefined) {
        return servePage(makeFolders(20), `g${generation}-p1`);
      }
      if (!params.cursor.startsWith(`g${generation}-`)) {
        throw cursorMalformedError();
      }
      return servePage(makeFolders(20), null);
    });
    const client = createClient();
    const { result } = renderFolderPages(client);
    await waitFor(() => expect(result.current.data?.pages).toHaveLength(1));
    generation = 1;

    await act(async () => {
      await result.current.fetchNextPage();
    });
    await waitFor(() => expect(requestedCursors()).toStrictEqual(["first", "g0-p1", "first"]));
    await waitForSettledPages(client, result);

    await act(async () => {
      await client.invalidateQueries({ queryKey: ["folders"] });
    });
    await waitForSettledPages(client, result);
    generation = 2;

    await act(async () => {
      await result.current.fetchNextPage();
    });
    await waitFor(() =>
      expect(requestedCursors()).toStrictEqual([
        "first",
        "g0-p1",
        "first",
        "first",
        "g1-p1",
        "first",
      ]),
    );
    await waitForSettledPages(client, result);
    expect(result.current.isFetchNextPageError).toBe(false);
    expect(result.current.data?.pages[0].nextCursor).toBe("g2-p1");
  });

  it("keeps other next page errors for the retry button", async () => {
    serve(makeFolders(45), { failPages: new Set([1]) });

    const { result } = renderFolderPages();
    await waitFor(() => expect(result.current.data?.pages).toHaveLength(1));
    await act(async () => {
      await result.current.fetchNextPage();
    });

    await waitFor(() => expect(result.current.isFetchNextPageError).toBe(true));
    expect(mockedGetFolders).toHaveBeenCalledTimes(2);
  });
});

describe("useFolderQuery during a cursor restart", () => {
  it("keeps loading instead of reporting an error while it reads again from the first page", async () => {
    let firstPageCursor = "stale";
    const folders = makeFolders(45);
    mockedGetFolders.mockImplementation(async (params: GetFoldersParams = {}) => {
      if (params.cursor === undefined) {
        return servePage(folders.slice(0, 20), firstPageCursor);
      }
      if (params.cursor === "stale") {
        firstPageCursor = "20";
        throw cursorMalformedError();
      }
      const offset = Number(params.cursor);
      const end = offset + 20;
      return servePage(folders.slice(offset, end), end < folders.length ? String(end) : null);
    });
    const seenErrors: boolean[] = [];
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={createClient()}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(
      () => {
        const query = useFolderQuery(1);
        seenErrors.push(query.isError);
        return query;
      },
      { wrapper },
    );

    await waitFor(() => expect(result.current.folder?.id).toBe(1));
    expect(seenErrors).not.toContain(true);
    expect(requestedCursors()).toStrictEqual(["first", "stale", "first", "20", "40"]);
  });
});

describe("useFolderMembersQuery", () => {
  const members = { ownerId: 1, ownerNickname: "테스터", members: [] };

  function renderMembers(
    client: QueryClient,
    options?: Parameters<typeof useFolderMembersQuery>[2],
  ) {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    return renderHook(() => useFolderMembersQuery(7, true, options), { wrapper });
  }

  beforeEach(() => {
    mockedGetFolderMembers.mockReset();
  });

  it("retries once when asked, then reports the error", async () => {
    mockedGetFolderMembers.mockRejectedValue(new Error("network"));
    const client = new QueryClient({
      defaultOptions: { queries: { retry: 3, retryDelay: 0, gcTime: Infinity } },
    });
    const { result } = renderMembers(client, { retry: 1 });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(mockedGetFolderMembers).toHaveBeenCalledTimes(2);
  });

  it("refetches fresh cached members on mount with refetchOnMount always", async () => {
    mockedGetFolderMembers.mockResolvedValue({
      success: true,
      error: null,
      data: members,
    } as Awaited<ReturnType<typeof getFolderMembers>>);
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: 60_000, gcTime: Infinity } },
    });
    client.setQueryData(folderQueryKeys.members(7), members);

    const cached = renderMembers(client);
    await waitFor(() => expect(cached.result.current.data).toEqual(members));
    expect(mockedGetFolderMembers).not.toHaveBeenCalled();
    cached.unmount();

    const fresh = renderMembers(client, { refetchOnMount: "always" });
    await waitFor(() => expect(fresh.result.current.isFetchedAfterMount).toBe(true));
    expect(mockedGetFolderMembers).toHaveBeenCalledTimes(1);
  });
});
