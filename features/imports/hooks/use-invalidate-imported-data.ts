import * as React from "react";

import { folderQueryKeys } from "@/features/folders/queries";
import { getLinkQueryKeyRoot } from "@/features/links/queries";
import { todoQueryKeys } from "@/features/todos/queries";
import { type QueryClient, useQueryClient } from "@tanstack/react-query";

import { importQueryKeys } from "../queries";

const SEARCH_QUERY_KEY_ROOT = ["search"] as const;

type InvalidateImportedDataOptions = {
  includeTodos?: boolean;
};

function invalidateImportedData(
  queryClient: QueryClient,
  { includeTodos = false }: InvalidateImportedDataOptions = {},
) {
  const queryKeys = [
    importQueryKeys.all,
    getLinkQueryKeyRoot(),
    folderQueryKeys.all,
    SEARCH_QUERY_KEY_ROOT,
    ...(includeTodos ? [todoQueryKeys.lists()] : []),
  ];
  return Promise.all(queryKeys.map((queryKey) => queryClient.invalidateQueries({ queryKey })));
}

function useInvalidateImportedData() {
  const queryClient = useQueryClient();
  return React.useCallback(
    (options?: InvalidateImportedDataOptions) => invalidateImportedData(queryClient, options),
    [queryClient],
  );
}

export { invalidateImportedData, useInvalidateImportedData };
export type { InvalidateImportedDataOptions };
