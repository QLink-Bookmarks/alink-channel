import type { ApiRequestConfig } from "@/lib/api-client";

import { isAxiosError } from "axios";

function resourceReadOptions(authToken: string | null, signal: AbortSignal): ApiRequestConfig {
  return {
    authToken,
    signal,
    adapter: "fetch",
    fetchOptions: { cache: "no-store" },
    withCredentials: false,
  };
}

function isUnavailableResource(error: unknown) {
  return isAxiosError(error) && error.response?.status === 404;
}

export { isUnavailableResource, resourceReadOptions };
