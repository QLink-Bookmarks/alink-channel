import * as React from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react-native";

import { deleteLink, updateLink } from "./api";
import { useDeleteLinkMutation, useUpdateLinkMutation } from "./mutations";
import { getLinkDetailQueryKey, getLinkPreviewQueryKey } from "./queries";
import type { UpdateLinkRequest } from "./types";

jest.mock("./api", () => ({
  deleteLink: jest.fn(async () => ({ data: null })),
  updateLink: jest.fn(async () => ({ data: null })),
}));

const LINK_ID = 7;

function setup() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { gcTime: Infinity },
      mutations: { gcTime: Infinity, retry: false },
    },
  });
  const keys = {
    list: ["links", "list", { orderKey: "created_at", order: "desc" }],
    search: ["search", "links", "성산일출봉"],
    detail: getLinkDetailQueryKey(LINK_ID),
    otherDetail: getLinkDetailQueryKey(8),
    preview: getLinkPreviewQueryKey("https://example.com/a"),
  };
  for (const key of Object.values(keys)) {
    client.setQueryData(key, { cached: true });
  }
  const invalidate = jest.spyOn(client, "invalidateQueries");
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const isStale = (key: readonly unknown[]) => client.getQueryState(key)?.isInvalidated === true;
  return { client, invalidate, isStale, keys, wrapper };
}

describe("link mutations invalidate lists and search results", () => {
  it("delete: the lists and the search results; the detail without a refetch; not the preview", async () => {
    const { invalidate, isStale, keys, wrapper } = setup();
    const { result } = renderHook(() => useDeleteLinkMutation(LINK_ID), { wrapper });

    await act(async () => {
      await result.current.mutateAsync();
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(deleteLink).toHaveBeenCalledWith(LINK_ID);
    expect(isStale(keys.list)).toBe(true);
    expect(isStale(keys.search)).toBe(true);
    expect(isStale(keys.detail)).toBe(true);
    expect(isStale(keys.otherDetail)).toBe(false);
    expect(isStale(keys.preview)).toBe(false);
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: getLinkDetailQueryKey(LINK_ID),
      refetchType: "none",
    });
  });

  it("update: the lists, the search results and that detail; not the preview", async () => {
    const { invalidate, isStale, keys, wrapper } = setup();
    const { result } = renderHook(() => useUpdateLinkMutation(LINK_ID), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ title: "새 제목" } as UpdateLinkRequest);
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(updateLink).toHaveBeenCalledWith(LINK_ID, { title: "새 제목" });
    expect(isStale(keys.list)).toBe(true);
    expect(isStale(keys.search)).toBe(true);
    expect(isStale(keys.detail)).toBe(true);
    expect(isStale(keys.otherDetail)).toBe(false);
    expect(isStale(keys.preview)).toBe(false);
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: getLinkDetailQueryKey(LINK_ID),
      refetchType: "active",
    });
  });
});
