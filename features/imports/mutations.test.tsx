import * as React from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, renderHook } from "@testing-library/react-native";

import { reverseImport, startImport } from "./api";
import {
  ImportSummaryMissingError,
  useReverseImportMutation,
  useStartImportMutation,
} from "./mutations";
import type { ImportSummary, ImportSummaryResponse, StartImportRequest } from "./types";

jest.mock("./api", () => ({
  createImportPreview: jest.fn(),
  startImport: jest.fn(),
  reverseImport: jest.fn(),
}));

const mockedStartImport = startImport as jest.MockedFunction<typeof startImport>;
const mockedReverseImport = reverseImport as jest.MockedFunction<typeof reverseImport>;

const SUMMARY: ImportSummary = {
  id: 5,
  fileName: "bookmarks.html",
  status: "COMPLETED",
  linkCount: 2,
  folderCount: 1,
  skippedCount: 0,
  failedCount: 0,
  progress: 0,
  isReversible: true,
  createdAt: "2026-11-03T00:00:00Z",
};

const START_REQUEST: StartImportRequest = {
  clientRequestId: "6f1c2a8e-3b9d-4c1e-9f2a-0d7b5e4c3a21",
  fileName: "bookmarks.html",
  folders: [{ key: "f1", folderId: null, name: "개발", createdAt: null }],
  links: [{ key: "l1", url: "https://example.com", title: "예시", folderKey: "f1" }],
};

const clients: QueryClient[] = [];

function renderWithClient<T>(useHook: () => T) {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false, gcTime: Infinity },
    },
  });
  clients.push(client);
  const invalidateQueries = jest.spyOn(client, "invalidateQueries");
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const rendered = renderHook(useHook, { wrapper });
  const invalidatedKeys = () => invalidateQueries.mock.calls.map(([filters]) => filters?.queryKey);
  return { ...rendered, invalidatedKeys };
}

const success = (data: ImportSummary): ImportSummaryResponse => ({
  success: true,
  data,
  error: null,
});

beforeEach(() => {
  mockedStartImport.mockReset();
  mockedReverseImport.mockReset();
});

afterEach(() => {
  cleanup();
  clients.splice(0).forEach((client) => client.clear());
});

describe("useStartImportMutation", () => {
  it("resolves with the summary and invalidates imports, links, folders and search", async () => {
    mockedStartImport.mockResolvedValue(success(SUMMARY));
    const { result, invalidatedKeys } = renderWithClient(() => useStartImportMutation());

    let summary: ImportSummary | undefined;
    await act(async () => {
      summary = await result.current.mutateAsync(START_REQUEST);
    });

    expect(mockedStartImport).toHaveBeenCalledWith(START_REQUEST);
    expect(summary).toEqual(SUMMARY);
    expect(invalidatedKeys()).toEqual([["imports"], ["links"], ["folders"], ["search"]]);
  });

  it.each([
    ["success is false", { success: false, data: SUMMARY, error: null }],
    ["data is null", { success: true, data: null, error: null }],
  ])("rejects with ImportSummaryMissingError when %s", async (_label, response) => {
    mockedStartImport.mockResolvedValue(response as unknown as ImportSummaryResponse);
    const { result, invalidatedKeys } = renderWithClient(() => useStartImportMutation());

    let caught: unknown;
    await act(async () => {
      await result.current.mutateAsync(START_REQUEST).catch((error: unknown) => {
        caught = error;
      });
    });

    expect(caught).toBeInstanceOf(ImportSummaryMissingError);
    expect(invalidatedKeys()).toEqual([]);
  });
});

describe("useReverseImportMutation", () => {
  it("resolves with the summary and also invalidates todo lists", async () => {
    const reversed: ImportSummary = { ...SUMMARY, status: "UNDONE", isReversible: false };
    mockedReverseImport.mockResolvedValue(success(reversed));
    const { result, invalidatedKeys } = renderWithClient(() => useReverseImportMutation());

    let summary: ImportSummary | undefined;
    await act(async () => {
      summary = await result.current.mutateAsync({
        id: 5,
        payload: { linkIds: [1, 2], folderIds: [9] },
      });
    });

    expect(mockedReverseImport).toHaveBeenCalledWith(5, { linkIds: [1, 2], folderIds: [9] });
    expect(summary).toEqual(reversed);
    expect(invalidatedKeys()).toEqual([
      ["imports"],
      ["links"],
      ["folders"],
      ["search"],
      ["todos", "list"],
    ]);
  });

  it.each([
    ["success is false", { success: false, data: SUMMARY, error: null }],
    ["data is null", { success: true, data: null, error: null }],
  ])("rejects with ImportSummaryMissingError when %s", async (_label, response) => {
    mockedReverseImport.mockResolvedValue(response as unknown as ImportSummaryResponse);
    const { result, invalidatedKeys } = renderWithClient(() => useReverseImportMutation());

    let caught: unknown;
    await act(async () => {
      await result.current
        .mutateAsync({ id: 5, payload: { linkIds: [1], folderIds: [] } })
        .catch((error: unknown) => {
          caught = error;
        });
    });

    expect(caught).toBeInstanceOf(ImportSummaryMissingError);
    expect(invalidatedKeys()).toEqual([]);
  });
});
