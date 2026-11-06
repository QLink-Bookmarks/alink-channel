import * as React from "react";

import { type QueryClient, useQuery, useQueryClient } from "@tanstack/react-query";

import { getLinkDetail, getLinks } from "./api";
import { getExcerptRecheckDelay } from "./lib/excerpt-recheck";
import { extractLinkPreview } from "./lib/link-preview/extract-link-preview";
import { isPreviewableUrl } from "./lib/link-preview/link-preview-result";
import type { GetLinksParams, LinkDetailContent } from "./types";

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

// Root of the search dialog's queries (`features/search/queries.ts`).
const SEARCH_QUERY_KEY_ROOT = ["search"] as const;

/**
 * After a link is deleted, moved or changed: refreshes the link lists and the search
 * results only. Not the `["links"]` root — that would also re-run the previews
 * (`staleTime: Infinity`; extracting again uploads the images again) and refetch the
 * details, including the 404 of a deleted link. Details are refreshed by their callers.
 */
function invalidateLinkListAndSearchQueries(queryClient: QueryClient) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: getLinkListsQueryKey() }),
    queryClient.invalidateQueries({ queryKey: SEARCH_QUERY_KEY_ROOT }),
  ]);
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

/**
 * While the detail of `linkId` is open and its body is still being collected
 * (`content.isPending`), silently refetches it 3, 6 and 12 seconds after it opened, at most
 * three times; stops once an excerpt is in. Closing the detail (unmount) clears the timers
 * and opening it again starts over. When an excerpt arrives, the link lists are refreshed
 * once so the card next to (wide) or behind (mobile) the detail gets its line too.
 */
function useLinkDetailExcerptRecheck(
  linkId: number | string,
  content: LinkDetailContent | null | undefined,
) {
  const queryClient = useQueryClient();
  const [recheckCount, setRecheckCount] = React.useState(0);
  const openedAtRef = React.useRef<number | null>(null);
  const wasPendingRef = React.useRef(false);
  const isPending = content?.isPending === true;
  const excerpt = content?.excerpt ?? null;

  React.useEffect(() => {
    openedAtRef.current = Date.now();
    wasPendingRef.current = false;
    setRecheckCount(0);
    return () => {
      openedAtRef.current = null;
    };
  }, [linkId]);

  React.useEffect(() => {
    if (isPending && !excerpt) {
      wasPendingRef.current = true;
      return;
    }
    if (excerpt && wasPendingRef.current) {
      wasPendingRef.current = false;
      void queryClient.invalidateQueries({ queryKey: getLinkListsQueryKey() });
    }
  }, [excerpt, isPending, queryClient]);

  React.useEffect(() => {
    const openedAt = openedAtRef.current;
    if (openedAt == null) {
      return;
    }
    const delay = getExcerptRecheckDelay({
      openedAt,
      now: Date.now(),
      recheckCount,
      content: { excerpt, isPending },
    });
    if (delay == null) {
      return;
    }
    let isCancelled = false;
    const timer = setTimeout(() => {
      void queryClient
        .refetchQueries({ queryKey: getLinkDetailQueryKey(linkId), exact: true })
        .finally(() => {
          if (!isCancelled) {
            setRecheckCount((count) => count + 1);
          }
        });
    }, delay);
    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [excerpt, isPending, linkId, queryClient, recheckCount]);
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
  invalidateLinkListAndSearchQueries,
  useLinkDetailExcerptRecheck,
  useLinkDetailQuery,
  useLinkPreviewQuery,
  useLinksQuery,
};
export type { LinkPreviewQueryOptions };
