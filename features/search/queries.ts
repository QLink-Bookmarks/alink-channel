import { useLinkPagesQuery } from "@/features/links/queries";
import { useQuery } from "@tanstack/react-query";

import { searchWeb } from "./api";

const LINK_SEARCH_SIZE = 8;

function getWebSearchQueryKey(query: string) {
  return ["search", "web", query] as const;
}

function useLinkSearchQuery(query: string, enabled: boolean) {
  const trimmed = query.trim();
  return useLinkPagesQuery({ query: trimmed, size: LINK_SEARCH_SIZE }, enabled && !!trimmed);
}

function useWebSearchQuery(query: string, enabled: boolean) {
  const trimmed = query.trim();
  return useQuery({
    enabled: enabled && trimmed.length > 0,
    queryFn: () => searchWeb(trimmed),
    queryKey: getWebSearchQueryKey(trimmed),
  });
}

export { getWebSearchQueryKey, useLinkSearchQuery, useWebSearchQuery };
