import * as React from "react";

import { useInfiniteQuery, useQuery } from "@tanstack/react-query";

import { getFolderMembers, getFolders } from "./api";
import {
  findFolderInPages,
  flattenFolderPages,
  getNextFolderCursor,
  isFolderId,
} from "./lib/folder-pages";
import type { FolderOrder, FolderScrollResponse, GetFoldersParams } from "./types";

const FOLDER_PAGE_SIZE = 20;
const MAX_FOLDER_PAGES = 500;

type FolderListParams = Pick<GetFoldersParams, "order" | "query">;
type FolderPagesParams = { order: FolderOrder; size: number };

const folderQueryKeys = {
  all: ["folders"] as const,
  list: (params: FolderListParams) => ["folders", "list", params] as const,
  infinite: (params: FolderPagesParams) => ["folders", "infinite", params] as const,
  members: (id: number) => ["folders", "members", id] as const,
};

async function fetchAllFolders(params: FolderListParams): Promise<FolderScrollResponse> {
  const pages: FolderScrollResponse[] = [];
  const seenCursors = new Set<string>();
  let cursor: string | undefined;
  while (pages.length < MAX_FOLDER_PAGES) {
    const response = await getFolders({ ...params, cursor, size: FOLDER_PAGE_SIZE });
    pages.push(response.data);
    const nextCursor = getNextFolderCursor(response.data);
    if (!nextCursor || seenCursors.has(nextCursor)) {
      break;
    }
    seenCursors.add(nextCursor);
    cursor = nextCursor;
  }
  const contents = flattenFolderPages(pages);
  return { isEmpty: contents.length === 0, contents, hasNext: false, nextCursor: null };
}

function useFoldersQuery(params: GetFoldersParams = {}, options?: { enabled?: boolean }) {
  const listParams: FolderListParams = { order: params.order ?? "latest", query: params.query };

  return useQuery({
    enabled: options?.enabled ?? true,
    queryFn: () => fetchAllFolders(listParams),
    queryKey: folderQueryKeys.list(listParams),
  });
}

function useFolderPagesQuery(options?: { order?: FolderOrder; enabled?: boolean }) {
  const order = options?.order ?? "latest";

  return useInfiniteQuery({
    enabled: options?.enabled ?? true,
    getNextPageParam: (lastPage: FolderScrollResponse, _allPages, lastPageParam) => {
      const nextCursor = getNextFolderCursor(lastPage);
      return nextCursor === lastPageParam ? undefined : nextCursor;
    },
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) => {
      const response = await getFolders({ order, cursor: pageParam, size: FOLDER_PAGE_SIZE });
      return response.data;
    },
    queryKey: folderQueryKeys.infinite({ order, size: FOLDER_PAGE_SIZE }),
  });
}

function useFolderQuery(id: number, options?: { enabled?: boolean }) {
  const isValidId = isFolderId(id);
  const enabled = (options?.enabled ?? true) && isValidId;
  const pagesQuery = useFolderPagesQuery({ enabled });
  const { fetchNextPage, hasNextPage, isFetchingNextPage, isFetchNextPageError, refetch } =
    pagesQuery;
  const folder = enabled ? findFolderInPages(pagesQuery.data?.pages, id) : undefined;
  const loadedPageCount = pagesQuery.data?.pages.length ?? 0;
  const hasPages = loadedPageCount > 0;
  const isError = enabled && !folder && pagesQuery.isError && !pagesQuery.isFetching;
  const shouldFetchNext =
    enabled &&
    hasPages &&
    !folder &&
    hasNextPage &&
    !isFetchingNextPage &&
    !isFetchNextPageError &&
    !pagesQuery.isRefetching;

  React.useEffect(() => {
    if (shouldFetchNext) {
      void fetchNextPage({ cancelRefetch: false });
    }
  }, [fetchNextPage, loadedPageCount, shouldFetchNext]);

  const retry = React.useCallback(() => {
    if (isFetchNextPageError) {
      void fetchNextPage({ cancelRefetch: false });
      return;
    }
    void refetch({ cancelRefetch: false });
  }, [fetchNextPage, isFetchNextPageError, refetch]);

  const isNotFound =
    (options?.enabled ?? true) &&
    !folder &&
    !isError &&
    (!isValidId || (hasPages && !hasNextPage && !isFetchingNextPage));
  const isLoading = enabled && !folder && !isError && !isNotFound;

  return { folder, isError, isLoading, isNotFound, retry };
}

function useFolderMembersQuery(id: number, enabled = true) {
  return useQuery({
    enabled,
    queryFn: async () => {
      const response = await getFolderMembers(id);
      return response.data;
    },
    queryKey: folderQueryKeys.members(id),
  });
}

export {
  FOLDER_PAGE_SIZE,
  MAX_FOLDER_PAGES,
  fetchAllFolders,
  folderQueryKeys,
  useFolderMembersQuery,
  useFolderPagesQuery,
  useFolderQuery,
  useFoldersQuery,
};
