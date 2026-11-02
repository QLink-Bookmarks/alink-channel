import * as React from "react";

import { splitFoldersBySection } from "../lib/folder-pages";
import { useFolderPagesQuery } from "../queries";
import type { FolderListStatus } from "../types";

function useFolderSectionData() {
  const pagesQuery = useFolderPagesQuery();
  const { fetchNextPage, refetch } = pagesQuery;

  const sections = React.useMemo(
    () => splitFoldersBySection(pagesQuery.data?.pages),
    [pagesQuery.data?.pages],
  );

  const hasPages = Boolean(pagesQuery.data);
  const isInitialError = !hasPages && pagesQuery.isError && !pagesQuery.isFetching;
  const status: FolderListStatus = {
    isInitialLoading: !hasPages && !isInitialError,
    isInitialError,
    hasNextPage: pagesQuery.hasNextPage,
    isFetchingNextPage: pagesQuery.isFetchingNextPage,
    isFetchNextPageError: pagesQuery.isFetchNextPageError && !pagesQuery.isFetchingNextPage,
  };

  const fetchMore = React.useCallback(() => {
    void fetchNextPage({ cancelRefetch: false });
  }, [fetchNextPage]);

  const retry = React.useCallback(() => {
    if (isInitialError) {
      void refetch({ cancelRefetch: false });
      return;
    }
    void fetchNextPage({ cancelRefetch: false });
  }, [fetchNextPage, isInitialError, refetch]);

  return { sections, status, fetchMore, retry };
}

export { useFolderSectionData };
