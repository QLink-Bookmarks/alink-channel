import { PropsWithChildren, useState } from "react";

import { useSignOutEffect } from "@/lib/hooks/use-sign-out-effect";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const QUERY_STALE_TIME_MS = 30_000;

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
