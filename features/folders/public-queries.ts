import { getPublicFolderLinks } from "@/features/links/api";
import { resourceReadOptions } from "@/features/navigation/lib/resource-read";
import { getPublicFolderTodos } from "@/features/todos/api";
import { useInfiniteQuery } from "@tanstack/react-query";

import type { PublicFolderLists, PublicFolderPage } from "./types";

const fetchPages = { links: getPublicFolderLinks, todos: getPublicFolderTodos };

function usePublicFolderListQuery<K extends keyof PublicFolderLists>(
  folderId: number,
  authToken: string | null,
  visit: string,
  list: K,
) {
  return useInfiniteQuery({
    gcTime: 0,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    queryKey: ["folder-read", folderId, visit, list],
    queryFn: async ({ pageParam, signal }) => {
      const response = await fetchPages[list](
        folderId,
        pageParam,
        resourceReadOptions(authToken, signal),
      );
      return response.data as PublicFolderPage<PublicFolderLists[K]>;
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page, _pages, _cursor, previousCursors) => {
      const next = page.nextCursor;
      return page.hasNext && next != null && !previousCursors.includes(next) ? next : undefined;
    },
  });
}

export { usePublicFolderListQuery };
