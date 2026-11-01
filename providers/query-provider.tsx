import { PropsWithChildren, useState } from "react";

import { useSignOutEffect } from "@/lib/hooks/use-sign-out-effect";
import { QUERY_STALE_TIME_MS } from "@/lib/query-config";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

export function QueryProvider({ children }: PropsWithChildren) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: 3,
            staleTime: QUERY_STALE_TIME_MS,
          },
        },
      }),
  );
  useSignOutEffect(() => {
    queryClient.clear();
  });

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
