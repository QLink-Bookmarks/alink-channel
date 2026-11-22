import { getPublicFolderLinks } from "@/features/links/api";
import type { GetLinksParams } from "@/features/links/types";
import { resourceReadOptions } from "@/features/navigation/lib/resource-read";
import { useInfiniteQuery } from "@tanstack/react-query";

function usePublicFolderLinksQuery(
  folderId: number,
  visit: string,
  enabled: boolean,
  options: Pick<GetLinksParams, "order" | "size">,
) {
  return useInfiniteQuery({
    enabled,
    gcTime: 0,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    queryKey: ["folder-read", folderId, visit, options],
    queryFn: async ({ pageParam, signal }) => {
      const response = await getPublicFolderLinks(
        { ...options, folderId, cursor: pageParam },
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

export { usePublicFolderLinksQuery };
