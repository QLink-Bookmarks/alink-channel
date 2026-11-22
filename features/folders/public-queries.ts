import { getPublicFolderLinks } from "@/features/links/api";
import type { ApiEnvelope } from "@/features/links/types";
import { resourceReadOptions } from "@/features/navigation/lib/resource-read";
import { getPublicFolderTodos } from "@/features/todos/api";
import type { ApiRequestConfig } from "@/lib/api-client";
import { useInfiniteQuery } from "@tanstack/react-query";

import type { PublicFolderLists, PublicFolderPage } from "./types";

const fetchPages: {
  [K in keyof PublicFolderLists]: (
    folderId: number,
    cursor: string | undefined,
    read: ApiRequestConfig,
  ) => Promise<ApiEnvelope<PublicFolderPage<PublicFolderLists[K]>>>;
} = { links: getPublicFolderLinks, todos: getPublicFolderTodos };

function usePublicFolderListQuery<K extends keyof PublicFolderLists>(
  folderId: number,
  visit: string,
  list: K,
  enabled: boolean,
) {
  return useInfiniteQuery({
    enabled,
    gcTime: 0,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    queryKey: ["folder-read", folderId, visit, list],
    queryFn: async ({ pageParam, signal }) => {
      const response = await fetchPages[list](
        folderId,
        pageParam,
        resourceReadOptions(null, signal),
      );
      if (!response.success || !response.data) throw new Error("Invalid public folder list");
      return response.data;
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page, _pages, _cursor, previousCursors) => {
      const next = page.nextCursor;
      return page.hasNext && next != null && !previousCursors.includes(next) ? next : undefined;
    },
  });
}

export { usePublicFolderListQuery };
