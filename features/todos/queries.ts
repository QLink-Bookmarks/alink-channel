import { useQuery } from "@tanstack/react-query";

import { getTodoCounts, getTodos } from "./api";
import type { GetTodosParams } from "./types";

const todoQueryKeys = {
  lists: () => ["todos", "list"] as const,
  list: (params: GetTodosParams) => ["todos", "list", params] as const,
  // Under `lists()`, so everything that refreshes the lists refreshes the counts too.
  counts: () => ["todos", "list", "counts"] as const,
};

function useTodosQuery(params: GetTodosParams = {}) {
  const resolvedParams: GetTodosParams = {
    size: 50,
    ...params,
  };

  return useQuery({
    queryFn: async () => {
      const response = await getTodos(resolvedParams);
      return response.data;
    },
    queryKey: todoQueryKeys.list(resolvedParams),
  });
}

function useTodoCountsQuery() {
  return useQuery({
    queryFn: async () => {
      const response = await getTodoCounts();
      return response.data;
    },
    queryKey: todoQueryKeys.counts(),
  });
}

export { todoQueryKeys, useTodoCountsQuery, useTodosQuery };
