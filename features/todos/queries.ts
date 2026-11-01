import { useQuery } from "@tanstack/react-query";

import { getTodos } from "./api";
import type { GetTodosParams } from "./types";

const todoQueryKeys = {
  lists: () => ["todos", "list"] as const,
  list: (params: GetTodosParams) => ["todos", "list", params] as const,
};

function useTodosQuery(params: GetTodosParams = {}) {
  const resolvedParams: GetTodosParams = {
    order: "latest",
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

export { todoQueryKeys, useTodosQuery };
