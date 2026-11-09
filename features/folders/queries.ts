import * as React from "react";

import {
  type QueryClient,
  useInfiniteQuery,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { getFolderMembers, getFolders } from "./api";
import {
  findFolderInPages,
  flattenFolderPages,
  getNextFolderCursor,
  isFolderId,
} from "./lib/folder-pages";
import type { FolderScrollResponse, GetFoldersParams } from "./types";

const FOLDER_PAGE_SIZE = 20;
const MAX_FOLDER_PAGES = 500;
const COMMON_CURSOR_MALFORMED_CODE = "COM_400_0004";
const FOLDER_LIST_SORT = { orderKey: "created_at", order: "desc" } as const;

type FolderListParams = Pick<GetFoldersParams, "orderKey" | "order" | "query">;
type FolderPagesParams = typeof FOLDER_LIST_SORT & { size: number };

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
  const listParams: FolderListParams = {
    orderKey: params.orderKey ?? FOLDER_LIST_SORT.orderKey,
    order: params.order ?? FOLDER_LIST_SORT.order,
    query: params.query,
  };

  return useQuery({
    enabled: options?.enabled ?? true,
    queryFn: () => fetchAllFolders(listParams),
    queryKey: folderQueryKeys.list(listParams),
  });
}

const cursorRestartMarks = new WeakMap<QueryClient, number | "pending">();

function isCursorMalformedError(error: unknown) {
  const response = (error as { response?: { data?: unknown } } | null)?.response;
  const code = (response?.data as { error?: { code?: unknown } } | undefined)?.error?.code;
  return code === COMMON_CURSOR_MALFORMED_CODE;
}

function useRestartingFolderPagesQuery(options?: { enabled?: boolean }) {
  const queryClient = useQueryClient();
  const pagesQuery = useInfiniteQuery({
    enabled: options?.enabled ?? true,
    getNextPageParam: (lastPage: FolderScrollResponse, _allPages, lastPageParam) => {
      const nextCursor = getNextFolderCursor(lastPage);
      return nextCursor === lastPageParam ? undefined : nextCursor;
    },
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) => {
      const response = await getFolders({
        ...FOLDER_LIST_SORT,
        cursor: pageParam,
        size: FOLDER_PAGE_SIZE,
      });
      return response.data;
    },
    queryKey: folderQueryKeys.infinite({ ...FOLDER_LIST_SORT, size: FOLDER_PAGE_SIZE }),
  });
  const { refetch, dataUpdatedAt } = pagesQuery;
  const isCursorMalformed =
    pagesQuery.isFetchNextPageError && isCursorMalformedError(pagesQuery.error);
  const isRestartPending =
    isCursorMalformed && cursorRestartMarks.get(queryClient) !== dataUpdatedAt;

  React.useEffect(() => {
    if (!isRestartPending || cursorRestartMarks.get(queryClient) === "pending") {
      return;
    }
    cursorRestartMarks.set(queryClient, "pending");
    void refetch({ cancelRefetch: false }).then((result) => {
      cursorRestartMarks.set(queryClient, result.dataUpdatedAt);
    });
  }, [isRestartPending, queryClient, refetch]);

  return { pagesQuery, isRestartPending };
}

function useFolderPagesQuery(options?: { enabled?: boolean }) {
  const { pagesQuery, isRestartPending } = useRestartingFolderPagesQuery(options);
  return isRestartPending
    ? { ...pagesQuery, isError: false, isFetchNextPageError: false }
    : pagesQuery;
}

function useFolderQuery(id: number, options?: { enabled?: boolean }) {
  const isValidId = isFolderId(id);
  const enabled = (options?.enabled ?? true) && isValidId;
  const { pagesQuery, isRestartPending } = useRestartingFolderPagesQuery({ enabled });
  const { fetchNextPage, hasNextPage, isFetchingNextPage, isFetchNextPageError, refetch } =
    pagesQuery;
  const folder = enabled ? findFolderInPages(pagesQuery.data?.pages, id) : undefined;
  const loadedPageCount = pagesQuery.data?.pages.length ?? 0;
  const hasPages = loadedPageCount > 0;
  const isError =
    enabled && !folder && pagesQuery.isError && !pagesQuery.isFetching && !isRestartPending;
  const shouldFetchNext =
    enabled &&
    hasPages &&
    !folder &&
    hasNextPage &&
    !isFetchingNextPage &&
    !isFetchNextPageError &&
    !isRestartPending &&
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

type FolderMembersQueryOptions = {
  /** Retries after a failure; the app default applies when omitted. */
  retry?: number;
  /** `"always"` refetches on mount even when cached members are fresh. */
  refetchOnMount?: "always";
};

function useFolderMembersQuery(
  id: number,
  enabled = true,
  options: FolderMembersQueryOptions = {},
) {
  return useQuery({
    enabled,
    queryFn: async () => {
      const response = await getFolderMembers(id);
      return response.data;
    },
    queryKey: folderQueryKeys.members(id),
    ...(options.retry !== undefined ? { retry: options.retry } : null),
    ...(options.refetchOnMount ? { refetchOnMount: options.refetchOnMount } : null),
  });
}

export type { FolderMembersQueryOptions };
export {
  FOLDER_LIST_SORT,
  FOLDER_PAGE_SIZE,
  MAX_FOLDER_PAGES,
  fetchAllFolders,
  folderQueryKeys,
  useFolderMembersQuery,
  useFolderPagesQuery,
  useFolderQuery,
  useFoldersQuery,
};
