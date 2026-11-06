import * as React from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react-native";

import { extractLinkPreview } from "./lib/link-preview/extract-link-preview";
import {
  getLinkDetailQueryKey,
  getLinkPreviewQueryKey,
  getLinksQueryKey,
  invalidateLinkListAndSearchQueries,
  useLinkDetailExcerptRecheck,
  useLinkPreviewQuery,
} from "./queries";
import type { LinkDetailContent, LinkPreview } from "./types";

jest.mock("./api", () => ({}));
jest.mock("./lib/link-preview/extract-link-preview", () => ({
  extractLinkPreview: jest.fn(),
}));

const extract = extractLinkPreview as jest.MockedFunction<typeof extractLinkPreview>;

const URL_A = "https://example.com/a";
const URL_B = "https://example.com/b";

function previewFor(url: string): LinkPreview {
  return { title: `title of ${url}`, thumbnailUrl: null, faviconUrl: null, isVideo: false };
}

type Props = { url: string; immediate: boolean };

function renderPreviewHook(initialProps: Props) {
  const client = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return renderHook(({ url, immediate }: Props) => useLinkPreviewQuery(url, { immediate }), {
    initialProps,
    wrapper,
  });
}

beforeEach(() => {
  jest.useFakeTimers();
  extract.mockReset();
  extract.mockImplementation(async (url: string) => previewFor(url));
});

afterEach(() => {
  jest.useRealTimers();
});

describe("useLinkPreviewQuery", () => {
  it("waits 500ms after typing stops, and shows loading meanwhile", async () => {
    const { result, rerender } = renderPreviewHook({ url: "", immediate: false });
    expect(result.current.isLoading).toBe(false);

    rerender({ url: "https://example.com/", immediate: false });
    act(() => jest.advanceTimersByTime(300));
    rerender({ url: URL_A, immediate: false });
    expect(result.current.isLoading).toBe(true);
    expect(result.current.preview).toBeNull();

    act(() => jest.advanceTimersByTime(499));
    expect(extract).not.toHaveBeenCalled();
    expect(result.current.isLoading).toBe(true);

    act(() => jest.advanceTimersByTime(1));
    await waitFor(() => expect(result.current.preview).toEqual(previewFor(URL_A)));
    expect(extract).toHaveBeenCalledTimes(1);
    expect(extract).toHaveBeenCalledWith(URL_A);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.previewUrl).toBe(URL_A);
  });

  it("fetches right away for a pasted, scanned or shared URL", async () => {
    const { result, rerender } = renderPreviewHook({ url: "", immediate: true });

    rerender({ url: URL_A, immediate: true });
    await waitFor(() => expect(extract).toHaveBeenCalledWith(URL_A));
    await waitFor(() => expect(result.current.preview).toEqual(previewFor(URL_A)));
    expect(result.current.isLoading).toBe(false);
  });

  it("stays loading until the extraction finishes", async () => {
    let finish: (preview: LinkPreview) => void = () => {};
    extract.mockImplementation(
      () =>
        new Promise<LinkPreview>((resolve) => {
          finish = resolve;
        }),
    );
    const { result } = renderPreviewHook({ url: URL_A, immediate: true });

    await waitFor(() => expect(extract).toHaveBeenCalledTimes(1));
    expect(result.current.isLoading).toBe(true);
    expect(result.current.previewUrl).toBeNull();

    await act(async () => finish(previewFor(URL_A)));
    // React Query notifies on its own scheduler tick.
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.preview).toEqual(previewFor(URL_A));
    expect(result.current.previewUrl).toBe(URL_A);
  });

  it("does nothing for a URL that cannot be previewed", () => {
    const { result } = renderPreviewHook({ url: "example.com", immediate: true });
    act(() => jest.advanceTimersByTime(1000));
    expect(extract).not.toHaveBeenCalled();
    expect(result.current).toEqual({ preview: null, isLoading: false, previewUrl: null });
  });

  it("does not show the previous URL's preview while the next one is pending", async () => {
    const { result, rerender } = renderPreviewHook({ url: URL_A, immediate: true });
    await waitFor(() => expect(result.current.preview).toEqual(previewFor(URL_A)));

    rerender({ url: URL_B, immediate: false });
    expect(result.current.preview).toBeNull();
    expect(result.current.isLoading).toBe(true);

    act(() => jest.advanceTimersByTime(500));
    await waitFor(() => expect(result.current.preview).toEqual(previewFor(URL_B)));
    expect(result.current.previewUrl).toBe(URL_B);
  });

  it("reuses a cached preview when returning to an earlier URL (no second upload)", async () => {
    const { result, rerender } = renderPreviewHook({ url: URL_A, immediate: true });
    await waitFor(() => expect(result.current.preview).toEqual(previewFor(URL_A)));
    rerender({ url: URL_B, immediate: true });
    await waitFor(() => expect(result.current.preview).toEqual(previewFor(URL_B)));

    rerender({ url: URL_A, immediate: true });
    await waitFor(() => expect(result.current.preview).toEqual(previewFor(URL_A)));
    expect(extract).toHaveBeenCalledTimes(2);
  });

  it("trims the URL before fetching", async () => {
    const { result } = renderPreviewHook({ url: `  ${URL_A}  `, immediate: true });
    await waitFor(() => expect(result.current.previewUrl).toBe(URL_A));
    expect(extract).toHaveBeenCalledWith(URL_A);
  });
});

describe("invalidateLinkListAndSearchQueries", () => {
  it("invalidates the link lists and the search results only", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } });
    const listKey = getLinksQueryKey({ order: "latest", size: 30 });
    const searchKey = ["search", "links", "제주"] as const;
    const previewKey = getLinkPreviewQueryKey("https://example.com/a");
    const detailKey = getLinkDetailQueryKey(7);
    for (const key of [listKey, searchKey, previewKey, detailKey]) {
      client.setQueryData(key, {});
    }

    await invalidateLinkListAndSearchQueries(client);

    const isInvalidated = (key: readonly unknown[]) =>
      client.getQueryState(key)?.isInvalidated ?? false;
    expect(isInvalidated(listKey)).toBe(true);
    expect(isInvalidated(searchKey)).toBe(true);
    expect(isInvalidated(previewKey)).toBe(false);
    expect(isInvalidated(detailKey)).toBe(false);
  });
});

describe("useLinkDetailExcerptRecheck", () => {
  const pending: LinkDetailContent = { excerpt: null, isPending: true };

  function renderRecheck(initial: LinkDetailContent | null | undefined, linkId: number = 7) {
    const client = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } });
    // `invalidateQueries` refetches through `refetchQueries` too, so the detail refetches
    // are the calls for the detail key.
    const refetchSpy = jest.spyOn(client, "refetchQueries").mockResolvedValue(undefined);
    const invalidateQueries = jest.spyOn(client, "invalidateQueries");
    const refetchQueries = {
      calls: () => refetchSpy.mock.calls.filter(([filters]) => filters?.queryKey?.[1] === "detail"),
    };
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const rendered = renderHook(
      ({ id, content }: { id: number; content: LinkDetailContent | null | undefined }) =>
        useLinkDetailExcerptRecheck(id, content),
      { initialProps: { id: linkId, content: initial }, wrapper },
    );
    return { ...rendered, invalidateQueries, refetchQueries };
  }

  async function advance(ms: number) {
    await act(async () => {
      await jest.advanceTimersByTimeAsync(ms);
    });
  }

  it("refetches the detail 3, 6 and 12 seconds after opening, then stops", async () => {
    const { refetchQueries } = renderRecheck(pending);

    await advance(2999);
    expect(refetchQueries.calls()).toHaveLength(0);
    await advance(1);
    expect(refetchQueries.calls()).toHaveLength(1);
    expect(refetchQueries.calls().at(-1)).toEqual([
      { queryKey: getLinkDetailQueryKey(7), exact: true },
    ]);
    await advance(3000);
    expect(refetchQueries.calls()).toHaveLength(2);
    await advance(6000);
    expect(refetchQueries.calls()).toHaveLength(3);
    await advance(30_000);
    expect(refetchQueries.calls()).toHaveLength(3);
  });

  it("stops once the excerpt is in and refreshes the link lists once", async () => {
    const { invalidateQueries, refetchQueries, rerender } = renderRecheck(pending);

    await advance(3000);
    expect(refetchQueries.calls()).toHaveLength(1);
    rerender({ id: 7, content: { excerpt: "본문 앞부분…", isPending: false } });
    await advance(30_000);

    expect(refetchQueries.calls()).toHaveLength(1);
    expect(invalidateQueries.mock.calls.map(([filters]) => filters?.queryKey)).toEqual([
      ["links", "list"],
    ]);
  });

  it("never refetches a detail that is not pending", async () => {
    for (const content of [undefined, null, { excerpt: null, isPending: false }]) {
      const { invalidateQueries, refetchQueries, unmount } = renderRecheck(content);
      await advance(30_000);
      expect(refetchQueries.calls()).toHaveLength(0);
      expect(invalidateQueries).not.toHaveBeenCalled();
      unmount();
    }
  });

  it("does not refresh the lists for an excerpt that was already there", async () => {
    const { invalidateQueries } = renderRecheck({ excerpt: "본문 앞부분…", isPending: false });
    await advance(30_000);
    expect(invalidateQueries).not.toHaveBeenCalled();
  });

  it("clears the timers when the detail closes", async () => {
    const { refetchQueries, unmount } = renderRecheck(pending);
    await advance(1000);
    unmount();
    await advance(30_000);
    expect(refetchQueries.calls()).toHaveLength(0);
  });

  it("starts over for another link", async () => {
    const { refetchQueries, rerender } = renderRecheck(pending, 7);
    await advance(3000);
    await advance(3000);
    expect(refetchQueries.calls()).toHaveLength(2);

    rerender({ id: 8, content: pending });
    await advance(2999);
    expect(refetchQueries.calls()).toHaveLength(2);
    await advance(1);
    expect(refetchQueries.calls()).toHaveLength(3);
    expect(refetchQueries.calls().at(-1)).toEqual([
      { queryKey: getLinkDetailQueryKey(8), exact: true },
    ]);
  });
});
