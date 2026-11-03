import * as React from "react";
import { AppState, type AppStateStatus } from "react-native";

import { type InfiniteData, useInfiniteQuery, useQuery } from "@tanstack/react-query";

import { getImport, getImportErrorName, getImportReversalPreview, getImports } from "./api";
import type { GetImportsParams, ImportScrollResponse } from "./types";

const IMPORT_PAGE_SIZE = 15;
const IMPORT_PROGRESS_REFETCH_INTERVAL_MS = 10_000;

type ImportListParams = Pick<GetImportsParams, "size">;

const importQueryKeys = {
  all: ["imports"] as const,
  lists: () => ["imports", "list"] as const,
  list: (params: ImportListParams) => ["imports", "list", params] as const,
  details: () => ["imports", "detail"] as const,
  detail: (id: number) => ["imports", "detail", id] as const,
  reversalPreviews: () => ["imports", "reversal-preview"] as const,
  reversalPreview: (id: number) => ["imports", "reversal-preview", id] as const,
};

function hasPendingImportProgress(data: InfiniteData<ImportScrollResponse> | undefined) {
  return data?.pages.some((page) => page.contents.some((summary) => summary.progress < 1)) ?? false;
}

function getImportsRefetchInterval(
  data: InfiniteData<ImportScrollResponse> | undefined,
  isActive: boolean,
) {
  if (!isActive || !hasPendingImportProgress(data)) {
    return false;
  }
  return IMPORT_PROGRESS_REFETCH_INTERVAL_MS;
}

function subscribeAppState(onChange: () => void) {
  const subscription = AppState.addEventListener("change", onChange);
  return () => subscription.remove();
}

function isAppStateActive(state: AppStateStatus | null | undefined) {
  return state !== "background" && state !== "inactive";
}

function useIsAppActive() {
  return React.useSyncExternalStore(
    subscribeAppState,
    () => isAppStateActive(AppState.currentState),
    () => true,
  );
}

type ImportsQueryOptions = {
  enabled?: boolean;
  isScreenFocused: boolean;
};

const IMPORT_RECORD_MAX_RETRIES = 3;

function retryUnlessImportNotFound(failureCount: number, error: unknown) {
  return (
    getImportErrorName(error) !== "IMPORT_NOT_FOUND" && failureCount < IMPORT_RECORD_MAX_RETRIES
  );
}

function useImportsQuery(options: ImportsQueryOptions) {
  const isAppActive = useIsAppActive();
  const isActive = options.isScreenFocused && isAppActive;
  const params: ImportListParams = { size: IMPORT_PAGE_SIZE };

  return useInfiniteQuery({
    enabled: options.enabled ?? true,
    getNextPageParam: (lastPage: ImportScrollResponse, _allPages, lastPageParam) => {
      if (!lastPage.hasNext || !lastPage.nextCursor) {
        return undefined;
      }
      return lastPage.nextCursor === lastPageParam ? undefined : lastPage.nextCursor;
    },
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) => {
      const response = await getImports({ cursor: pageParam, size: IMPORT_PAGE_SIZE });
      return response.data;
    },
    queryKey: importQueryKeys.list(params),
    refetchInterval: (query) => getImportsRefetchInterval(query.state.data, isActive),
    refetchIntervalInBackground: false,
  });
}

function useImportQuery(id: number, options?: { enabled?: boolean }) {
  return useQuery({
    enabled: (options?.enabled ?? true) && Number.isFinite(id),
    queryFn: async () => {
      const response = await getImport(id);
      return response.data;
    },
    queryKey: importQueryKeys.detail(id),
    retry: retryUnlessImportNotFound,
  });
}

function useImportReversalPreviewQuery(id: number, options?: { enabled?: boolean }) {
  return useQuery({
    enabled: (options?.enabled ?? true) && Number.isFinite(id),
    queryFn: async () => {
      const response = await getImportReversalPreview(id);
      return response.data;
    },
    queryKey: importQueryKeys.reversalPreview(id),
    retry: retryUnlessImportNotFound,
  });
}

export {
  IMPORT_PAGE_SIZE,
  IMPORT_PROGRESS_REFETCH_INTERVAL_MS,
  getImportsRefetchInterval,
  hasPendingImportProgress,
  importQueryKeys,
  retryUnlessImportNotFound,
  useImportQuery,
  useImportReversalPreviewQuery,
  useImportsQuery,
};
export type { ImportsQueryOptions };
