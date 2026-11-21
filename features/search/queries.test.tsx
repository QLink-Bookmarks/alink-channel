import type { ReactNode } from "react";

import { getLinks } from "@/features/links/api";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react-native";

import { useLinkSearchQuery } from "./queries";

jest.mock("@/features/links/api", () => ({ getLinks: jest.fn() }));

it("requests eight ordered links per cursor for the trimmed search term", async () => {
  const fetchLinks = jest.mocked(getLinks);
  fetchLinks.mockResolvedValueOnce({
    success: true,
    data: { contents: [], isEmpty: true, hasNext: true, nextCursor: "next" },
    error: null,
  });
  fetchLinks.mockResolvedValueOnce({
    success: true,
    data: { contents: [], isEmpty: true, hasNext: false, nextCursor: null },
    error: null,
  });
  const client = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const { result, rerender } = renderHook(
    ({ term, enabled }: { term: string; enabled: boolean }) => useLinkSearchQuery(term, enabled),
    { wrapper, initialProps: { term: "  여행  ", enabled: false } },
  );

  expect(fetchLinks).not.toHaveBeenCalled();
  rerender({ term: "   ", enabled: true });
  expect(fetchLinks).not.toHaveBeenCalled();
  rerender({ term: "  여행  ", enabled: true });
  await waitFor(() => expect(result.current.hasNextPage).toBe(true));
  await act(async () => {
    await result.current.fetchNextPage();
  });
  await waitFor(() => expect(result.current.hasNextPage).toBe(false));
  const params = { query: "여행", size: 8, orderKey: "created_at", order: "desc" };
  expect(fetchLinks.mock.calls).toEqual([
    [{ ...params, cursor: undefined }],
    [{ ...params, cursor: "next" }],
  ]);
});
