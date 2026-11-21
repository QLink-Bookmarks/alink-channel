import { useInfiniteQuery, useQuery } from "@tanstack/react-query";

import { getPublicFolder, getPublicFolderPage } from "./api";
import type { PublicFolderLists } from "./types";

const publicFolderOptions = {
  gcTime: 0,
  retry: false,
  refetchOnWindowFocus: false,
  refetchOnReconnect: false,
  networkMode: "always",
} as const;

function usePublicFolderQuery(publicId: string, visit: string) {
  return useQuery({
    ...publicFolderOptions,
    queryKey: ["public-folders", publicId, visit],
    queryFn: ({ signal }) => getPublicFolder(publicId, signal),
  });
}

function usePublicFolderListQuery<K extends keyof PublicFolderLists>(
  publicId: string,
  visit: string,
  list: K,
  enabled: boolean,
) {
  return useInfiniteQuery({
    ...publicFolderOptions,
    enabled,
    queryKey: ["public-folders", publicId, visit, list],
    queryFn: ({ pageParam, signal }) => getPublicFolderPage(publicId, list, pageParam, signal),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page, _pages, _cursor, previousCursors) => {
      const next = page.nextCursor;
      return page.hasNext && next != null && !previousCursors.includes(next) ? next : undefined;
    },
  });
}

export { usePublicFolderListQuery, usePublicFolderQuery };
