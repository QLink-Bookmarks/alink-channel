import * as React from "react";

import { useQuery } from "@tanstack/react-query";

import { getLinkDetail, getLinks } from "./api";
import { extractLinkPreview } from "./lib/link-preview/extract-link-preview";
import { isPreviewableUrl } from "./lib/link-preview/link-preview-result";
import type { GetLinksParams } from "./types";

const LINK_PREVIEW_TYPING_DEBOUNCE_MS = 500;

function getLinkQueryKeyRoot() {
  return ["links"] as const;
}

function getLinkDetailQueryKey(linkId?: string | number | null) {
  return ["links", "detail", linkId == null ? null : String(linkId)] as const;
}

function getLinksQueryKey(params: GetLinksParams) {
  return ["links", "list", params] as const;
}

function getLinkListsQueryKey() {
  return ["links", "list"] as const;
}

function getLinkPreviewQueryKey(url: string) {
  return ["links", "preview", url] as const;
}

type LinkPreviewQueryOptions = {
  // true for a URL that was pasted, scanned from a QR code or shared; false for
  // one being typed, which waits 500ms after the last keystroke.
  immediate: boolean;
};

// The URL the preview is fetched for: follows `url` right away when `immediate`,
// otherwise 500ms after it stops changing. A URL that cannot be previewed clears
// it right away.
function usePreviewRequestUrl(url: string, immediate: boolean) {
  const trimmedUrl = url.trim();
  const targetUrl = isPreviewableUrl(trimmedUrl) ? trimmedUrl : "";
  const [requestUrl, setRequestUrl] = React.useState(immediate ? targetUrl : "");

  React.useEffect(() => {
    if (immediate || !targetUrl) {
      setRequestUrl(targetUrl);
      return;
    }
    const timer = setTimeout(() => setRequestUrl(targetUrl), LINK_PREVIEW_TYPING_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [immediate, targetUrl]);

  return { requestUrl, targetUrl };
}

function useLinkPreviewQuery(url: string, { immediate }: LinkPreviewQueryOptions) {
  const { requestUrl, targetUrl } = usePreviewRequestUrl(url, immediate);
  const query = useQuery({
    enabled: Boolean(requestUrl),
    queryFn: () => extractLinkPreview(requestUrl),
    queryKey: getLinkPreviewQueryKey(requestUrl),
    // Each run uploads images, so a URL is never extracted twice while cached:
    // returning to an earlier URL reuses its preview.
    retry: false,
    staleTime: Infinity,
  });

  const isCurrent = Boolean(targetUrl) && requestUrl === targetUrl;
  return {
    // The preview of the URL as it is now; null while it is pending or when the
    // URL cannot be previewed.
    preview: isCurrent ? (query.data ?? null) : null,
    // True from the moment a previewable URL is entered until its preview is in,
    // including the typing debounce.
    isLoading: Boolean(targetUrl) && (!isCurrent || query.isPending),
    // The URL `preview` belongs to; null whenever `preview` is null.
    previewUrl: isCurrent && query.data ? requestUrl : null,
  };
}

function useLinkDetailQuery(linkId?: string | number | null) {
  return useQuery({
    enabled: Boolean(linkId),
    queryFn: async () => {
      const response = await getLinkDetail(linkId as string | number);
      return response.data;
    },
    queryKey: getLinkDetailQueryKey(linkId),
  });
}

function useLinksQuery(params: GetLinksParams = {}) {
  const resolvedParams: GetLinksParams = {
    order: "latest",
    size: 30,
    ...params,
  };

  return useQuery({
    queryFn: async () => {
      const response = await getLinks(resolvedParams);
      return response.data;
    },
    queryKey: getLinksQueryKey(resolvedParams),
  });
}

export {
  getLinkDetailQueryKey,
  getLinkListsQueryKey,
  getLinkPreviewQueryKey,
  getLinkQueryKeyRoot,
  getLinksQueryKey,
  useLinkDetailQuery,
  useLinkPreviewQuery,
  useLinksQuery,
};
export type { LinkPreviewQueryOptions };
