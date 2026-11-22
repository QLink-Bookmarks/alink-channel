import type { ApiRequestConfig } from "@/lib/api-client";

function resourceReadOptions(authToken: string | null, signal: AbortSignal): ApiRequestConfig {
  return {
    authToken,
    signal,
    adapter: "fetch",
    fetchOptions: { cache: "no-store" },
    withCredentials: false,
  };
}

export { resourceReadOptions };
