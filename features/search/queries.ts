import { getLinks } from "@/features/links/api";
import { useQuery } from "@tanstack/react-query";

import { searchWeb } from "./api";

const LINK_SEARCH_SIZE = 8;

function getLinkSearchQueryKey(query: string) {
  return ["search", "links", query] as const;
}

function getWebSearchQueryKey(query: string) {
  return ["search", "web", query] as const;
}

function useLinkSearchQuery(query: string, enabled: boolean) {
  const trimmed = query.trim();
  return useQuery({
    enabled: enabled && trimmed.length > 0,
    queryFn: async () => {
      const response = await getLinks({
        query: trimmed,
        orderKey: "created_at",
        order: "desc",
        size: LINK_SEARCH_SIZE,
      });
      return response.data;
    },
    queryKey: getLinkSearchQueryKey(trimmed),
  });
}

function useWebSearchQuery(query: string, enabled: boolean) {
  const trimmed = query.trim();
  return useQuery({
    enabled: enabled && trimmed.length > 0,
    queryFn: () => searchWeb(trimmed),
    queryKey: getWebSearchQueryKey(trimmed),
  });
}

export { getLinkSearchQueryKey, getWebSearchQueryKey, useLinkSearchQuery, useWebSearchQuery };
