import * as React from "react";

import { useToastStore } from "@/stores/toast-store";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react-native";

import { fetchAllFolders } from "../queries";
import { useFolderRemovalSuccess } from "./use-folder-removal-success";

const mockEvents: string[] = [];
const mockReplace = jest.fn((href: string) => {
  mockEvents.push(`replace:${href}`);
});

jest.mock("expo-router", () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

jest.mock("../queries", () => {
  const actual = jest.requireActual("../queries");
  return { ...actual, fetchAllFolders: jest.fn() };
});

const mockedFetchAllFolders = fetchAllFolders as jest.MockedFunction<typeof fetchAllFolders>;

const FOLDER_ID = 7;

function createClient() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(["folders", "members", FOLDER_ID], { ownerId: 1, members: [] });
  client.setQueryData(["folders", "members", 8], { ownerId: 1, members: [] });
  client.setQueryData(
    ["links", "list", { folderId: FOLDER_ID, orderKey: "created_at", order: "desc" }],
    {},
  );
  client.setQueryData(
    ["links", "list", { folderId: 8, orderKey: "created_at", order: "desc" }],
    {},
  );
  client.setQueryData(["links", "list", { orderKey: "created_at", order: "desc" }], {});
  const invalidate = client.invalidateQueries.bind(client);
  jest.spyOn(client, "invalidateQueries").mockImplementation((filters, options) => {
    mockEvents.push(`invalidate:${JSON.stringify(filters?.queryKey)}`);
    return invalidate(filters, options);
  });
  const remove = client.removeQueries.bind(client);
  jest.spyOn(client, "removeQueries").mockImplementation((filters) => {
    mockEvents.push(`remove:${JSON.stringify(filters?.queryKey)}`);
    return remove(filters);
  });
  return client;
}

function renderSuccessHook(mode: "wide" | "mobile", client = createClient()) {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const view = renderHook(() => useFolderRemovalSuccess({ folderId: FOLDER_ID, mode }), {
    wrapper,
  });
  return { ...view, client };
}

function folderList(ids: number[]) {
  const contents = ids.map((id) => ({
    id,
    name: `폴더 ${id}`,
    isShared: true,
    shareCounts: 2,
    linkCounts: 0,
    myLinkCounts: 0,
  }));
  return { isEmpty: contents.length === 0, contents, hasNext: false, nextCursor: null };
}

beforeEach(() => {
  mockEvents.length = 0;
  mockReplace.mockClear();
  mockedFetchAllFolders.mockReset();
  useToastStore.setState({ items: [] });
});

describe("useFolderRemovalSuccess finish", () => {
  it("navigates first, then drops the folder's caches, then invalidates", () => {
    const { result, client } = renderSuccessHook("wide");

    act(() => result.current.finish({ toast: "폴더를 삭제했어요.", hasDeletedLinks: false }));

    expect(mockEvents[0]).toBe("replace:/home");
    expect(mockEvents.slice(1, 3)).toEqual([
      'remove:["folders","members",7]',
      'remove:["links","list"]',
    ]);
    expect(mockEvents.slice(3)).toEqual([
      'invalidate:["folders"]',
      'invalidate:["links"]',
      'invalidate:["search"]',
      'invalidate:["imports"]',
    ]);
    // Only this folder's members and link lists are dropped.
    expect(client.getQueryData(["folders", "members", FOLDER_ID])).toBeUndefined();
    expect(
      client.getQueryData([
        "links",
        "list",
        { folderId: FOLDER_ID, orderKey: "created_at", order: "desc" },
      ]),
    ).toBe(undefined);
    expect(client.getQueryData(["folders", "members", 8])).toBeDefined();
    expect(
      client.getQueryData([
        "links",
        "list",
        { folderId: 8, orderKey: "created_at", order: "desc" },
      ]),
    ).toBeDefined();
    expect(
      client.getQueryData(["links", "list", { orderKey: "created_at", order: "desc" }]),
    ).toBeDefined();
  });

  it("goes to the folders tab on mobile", () => {
    const { result } = renderSuccessHook("mobile");
    act(() => result.current.finish({ toast: null, hasDeletedLinks: false }));
    expect(mockReplace).toHaveBeenCalledWith("/folders");
  });

  it("also invalidates actions and notifications after deleting links", () => {
    const { result } = renderSuccessHook("wide");
    act(() => result.current.finish({ toast: "폴더를 삭제했어요.", hasDeletedLinks: true }));
    expect(mockEvents).toContain('invalidate:["todos","list"]');
    expect(mockEvents).toContain('invalidate:["notifications"]');
  });

  it("shows the toast once when given, and none when null", () => {
    const { result } = renderSuccessHook("wide");
    act(() => result.current.finish({ toast: "공유 폴더에서 나왔어요.", hasDeletedLinks: false }));
    expect(useToastStore.getState().items.map((item) => item.title)).toEqual([
      "공유 폴더에서 나왔어요.",
    ]);

    useToastStore.setState({ items: [] });
    act(() => result.current.finish({ toast: null, hasDeletedLinks: false }));
    expect(useToastStore.getState().items).toEqual([]);
  });
});

describe("useFolderRemovalSuccess resolvePermissionChange", () => {
  it("ends without a toast when the folder is no longer in my list", async () => {
    mockedFetchAllFolders.mockResolvedValue(folderList([3, 8]));
    const { result } = renderSuccessHook("wide");

    let resolution: string | undefined;
    await act(async () => {
      resolution = await result.current.resolvePermissionChange();
    });

    expect(mockedFetchAllFolders).toHaveBeenCalledTimes(1);
    expect(mockedFetchAllFolders).toHaveBeenCalledWith({ orderKey: "created_at", order: "desc" });
    expect(resolution).toBe("ended");
    expect(mockReplace).toHaveBeenCalledWith("/home");
    expect(useToastStore.getState().items).toEqual([]);
  });

  it("stays and refreshes the folder list when the folder is still mine to see", async () => {
    mockedFetchAllFolders.mockResolvedValue(folderList([FOLDER_ID, 8]));
    const { result } = renderSuccessHook("wide");

    let resolution: string | undefined;
    await act(async () => {
      resolution = await result.current.resolvePermissionChange();
    });

    expect(resolution).toBe("stayed");
    expect(mockReplace).not.toHaveBeenCalled();
    expect(mockEvents).toEqual(['invalidate:["folders"]']);
  });

  it("stays when the folder list cannot be fetched", async () => {
    mockedFetchAllFolders.mockRejectedValue(new Error("network"));
    const { result } = renderSuccessHook("mobile");

    let resolution: string | undefined;
    await act(async () => {
      resolution = await result.current.resolvePermissionChange();
    });

    expect(resolution).toBe("stayed");
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
