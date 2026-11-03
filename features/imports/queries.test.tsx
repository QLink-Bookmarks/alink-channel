import * as React from "react";
import { AppState, type AppStateStatus } from "react-native";

import { type InfiniteData, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, renderHook } from "@testing-library/react-native";

import { getImport, getImports } from "./api";
import {
  IMPORT_PAGE_SIZE,
  IMPORT_PROGRESS_REFETCH_INTERVAL_MS,
  getImportsRefetchInterval,
  importQueryKeys,
  retryUnlessImportNotFound,
  useImportQuery,
  useImportsQuery,
} from "./queries";
import type { ImportScrollResponse, ImportSummary } from "./types";

jest.mock("./api", () => ({
  ...jest.requireActual("./api"),
  getImports: jest.fn(),
  getImport: jest.fn(),
  getImportReversalPreview: jest.fn(),
}));

const mockedGetImports = getImports as jest.MockedFunction<typeof getImports>;
const mockedGetImport = getImport as jest.MockedFunction<typeof getImport>;

function serverError(code: string, status: number) {
  return Object.assign(new Error(code), {
    isAxiosError: true,
    response: { status, data: { success: false, data: null, error: { code, message: code } } },
  });
}

function summary(id: number, progress: number): ImportSummary {
  return {
    id,
    fileName: `bookmarks-${id}.html`,
    status: "COMPLETED",
    linkCount: 3,
    folderCount: 1,
    skippedCount: 0,
    failedCount: 0,
    progress,
    isReversible: true,
    createdAt: "2026-11-03T00:00:00Z",
  };
}

function page(contents: ImportSummary[], nextCursor: string | null = null): ImportScrollResponse {
  return { isEmpty: contents.length === 0, contents, nextCursor, hasNext: nextCursor != null };
}

function pages(...items: ImportScrollResponse[]): InfiniteData<ImportScrollResponse> {
  return { pages: items, pageParams: items.map((_, index) => (index === 0 ? undefined : index)) };
}

function serveProgress(sequence: number[]) {
  let call = 0;
  mockedGetImports.mockImplementation(async () => {
    const progress = sequence[Math.min(call, sequence.length - 1)];
    call += 1;
    return { success: true, error: null, data: page([summary(1, progress)]) };
  });
}

const clients: QueryClient[] = [];

function renderImportsQuery(
  initialProps: { isScreenFocused: boolean } = { isScreenFocused: true },
) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  clients.push(client);
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return renderHook((props: { isScreenFocused: boolean }) => useImportsQuery(props), {
    wrapper,
    initialProps,
  });
}

async function advance(ms: number) {
  await act(async () => {
    await jest.advanceTimersByTimeAsync(ms);
  });
}

beforeEach(() => {
  mockedGetImports.mockReset();
  mockedGetImport.mockReset();
});

afterEach(() => {
  cleanup();
  clients.splice(0).forEach((client) => client.clear());
});

describe("importQueryKeys", () => {
  it("nests every key under the imports root", () => {
    expect(importQueryKeys.all).toEqual(["imports"]);
    expect(importQueryKeys.list({ size: 15 })).toEqual(["imports", "list", { size: 15 }]);
    expect(importQueryKeys.detail(3)).toEqual(["imports", "detail", 3]);
    expect(importQueryKeys.reversalPreview(3)).toEqual(["imports", "reversal-preview", 3]);
  });
});

describe("getImportsRefetchInterval", () => {
  it("polls every 10 seconds while a loaded row has progress below 1", () => {
    const data = pages(page([summary(2, 1), summary(1, 0.4)]));

    expect(getImportsRefetchInterval(data, true)).toBe(10_000);
    expect(IMPORT_PROGRESS_REFETCH_INTERVAL_MS).toBe(10_000);
  });

  it("checks rows on every loaded page", () => {
    const data = pages(page([summary(3, 1)], "c1"), page([summary(2, 1), summary(1, 0)]));

    expect(getImportsRefetchInterval(data, true)).toBe(10_000);
  });

  it("stops when every row has finished", () => {
    expect(getImportsRefetchInterval(pages(page([summary(2, 1), summary(1, 1)])), true)).toBe(
      false,
    );
  });

  it("stops when there is no data or no rows", () => {
    expect(getImportsRefetchInterval(undefined, true)).toBe(false);
    expect(getImportsRefetchInterval(pages(page([])), true)).toBe(false);
  });

  it("stops while the history screen is not active", () => {
    expect(getImportsRefetchInterval(pages(page([summary(1, 0)])), false)).toBe(false);
  });
});

describe("useImportsQuery", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("requests the first page with size 15", async () => {
    serveProgress([1]);

    const { result } = renderImportsQuery();
    await advance(0);

    expect(result.current.isSuccess).toBe(true);
    expect(IMPORT_PAGE_SIZE).toBe(15);
    expect(mockedGetImports).toHaveBeenCalledWith({ cursor: undefined, size: 15 });
  });

  it("refetches every 10 seconds until progress reaches 1, then stops", async () => {
    serveProgress([0, 0.5, 1]);

    const { result } = renderImportsQuery();
    await advance(0);
    expect(mockedGetImports).toHaveBeenCalledTimes(1);

    await advance(9_900);
    expect(mockedGetImports).toHaveBeenCalledTimes(1);

    await advance(100);
    expect(mockedGetImports).toHaveBeenCalledTimes(2);

    await advance(10_000);
    expect(mockedGetImports).toHaveBeenCalledTimes(3);
    await advance(10);
    expect(result.current.data?.pages[0].contents[0].progress).toBe(1);

    await advance(30_000);
    expect(mockedGetImports).toHaveBeenCalledTimes(3);
  });

  it("does not poll when every row is already finished", async () => {
    serveProgress([1]);

    renderImportsQuery();
    await advance(0);
    await advance(30_000);

    expect(mockedGetImports).toHaveBeenCalledTimes(1);
  });

  it("pauses while the screen is unfocused and resumes when it is focused again", async () => {
    serveProgress([0]);

    const { rerender } = renderImportsQuery();
    await advance(0);
    expect(mockedGetImports).toHaveBeenCalledTimes(1);

    rerender({ isScreenFocused: false });
    await advance(30_000);
    expect(mockedGetImports).toHaveBeenCalledTimes(1);

    rerender({ isScreenFocused: true });
    await advance(10_000);
    expect(mockedGetImports).toHaveBeenCalledTimes(2);
  });

  it("pauses while the app is in the background", async () => {
    serveProgress([0]);
    let notify: ((state: AppStateStatus) => void) | undefined;
    const addEventListener = jest
      .spyOn(AppState, "addEventListener")
      .mockImplementation((_type, listener) => {
        notify = listener as (state: AppStateStatus) => void;
        return { remove: jest.fn() } as ReturnType<typeof AppState.addEventListener>;
      });
    const appState = AppState as { currentState: unknown };
    const originalState = appState.currentState;
    appState.currentState = "active";

    try {
      renderImportsQuery();
      await advance(0);
      expect(mockedGetImports).toHaveBeenCalledTimes(1);

      appState.currentState = "background";
      await act(async () => notify?.("background"));
      await advance(30_000);
      expect(mockedGetImports).toHaveBeenCalledTimes(1);

      appState.currentState = "active";
      await act(async () => notify?.("active"));
      await advance(10_000);
      expect(mockedGetImports).toHaveBeenCalledTimes(2);
    } finally {
      appState.currentState = originalState;
      addEventListener.mockRestore();
    }
  });
});

describe("retryUnlessImportNotFound", () => {
  it("never retries IMPORT_NOT_FOUND", () => {
    expect(retryUnlessImportNotFound(0, serverError("IMPORT_404_0002", 404))).toBe(false);
  });

  it("retries other failures up to 3 times", () => {
    const error = serverError("COM_500_0001", 500);

    expect(retryUnlessImportNotFound(0, error)).toBe(true);
    expect(retryUnlessImportNotFound(2, error)).toBe(true);
    expect(retryUnlessImportNotFound(3, error)).toBe(false);
    expect(retryUnlessImportNotFound(0, new Error("Network Error"))).toBe(true);
  });
});

describe("useImportQuery", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  function renderImportQuery(id: number) {
    const client = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } });
    clients.push(client);
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    return renderHook(() => useImportQuery(id), { wrapper });
  }

  it("shows not found after a single request", async () => {
    mockedGetImport.mockRejectedValue(serverError("IMPORT_404_0002", 404));

    const { result } = renderImportQuery(7);
    await advance(0);
    await advance(30_000);

    expect(mockedGetImport).toHaveBeenCalledTimes(1);
    expect(mockedGetImport).toHaveBeenCalledWith(7);
    expect(result.current.isError).toBe(true);
  });

  it("retries a server error 3 times before failing", async () => {
    mockedGetImport.mockRejectedValue(serverError("COM_500_0001", 500));

    const { result } = renderImportQuery(7);
    await advance(0);
    await advance(30_000);

    expect(mockedGetImport).toHaveBeenCalledTimes(4);
    expect(result.current.isError).toBe(true);
  });
});
