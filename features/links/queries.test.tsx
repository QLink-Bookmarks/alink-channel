import * as React from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react-native";

import { extractLinkPreview } from "./lib/link-preview/extract-link-preview";
import { useLinkPreviewQuery } from "./queries";
import type { LinkPreview } from "./types";

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
