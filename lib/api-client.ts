import { Platform } from "react-native";

import { REQUESTER_HEADERS } from "@/lib/requester-header";
import {
  getAccessTokenFromStore,
  getRefreshTokenFromStore,
  syncAuthFromStorage,
  useAuthStore,
} from "@/stores/auth";
import { useToastStore } from "@/stores/toast-store";

import { type AxiosError, type AxiosRequestConfig, create, isAxiosError } from "axios";

type RefreshResponse = {
  success: boolean;
  data: { accessToken: string; refreshToken: string } | null;
  error: { code: string; message: string } | null;
};

export type ApiRequestConfig<D = unknown> = AxiosRequestConfig<D> & {
  authToken?: string | null;
};

const REFRESH_PATHS = ["/api/auth/token/refresh/web", "/api/auth/token/refresh/native"];
const CSRF_REQUIRED_PATHS = [...REFRESH_PATHS, "/api/auth/signout"];

function randomUuid(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (c?.randomUUID) return c.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    return (ch === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export const apiClient = create({
  baseURL: process.env.EXPO_PUBLIC_API_BASE_URL,
  headers: {
    Accept: "application/json",
    ...REQUESTER_HEADERS,
  },
  withCredentials: true,
});

apiClient.interceptors.request.use((config) => {
  const explicit = (config as ApiRequestConfig).authToken;
  const token = explicit === undefined ? getAccessTokenFromStore() : explicit;
  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  } else if (config.headers) {
    delete config.headers.Authorization;
  }
  const url = config.url ?? "";
  if (CSRF_REQUIRED_PATHS.some((path) => url.endsWith(path))) {
    config.headers = config.headers ?? {};
    config.headers.csrf_token = randomUuid();
  }
  return config;
});

let refreshPromise: Promise<string | null> | null = null;

async function performRefresh(): Promise<string | null> {
  try {
    if (Platform.OS !== "web") {
      // The iOS share extension may have already refreshed (and rotated) the
      // shared-keychain tokens. Adopt those before refreshing so we don't send a
      // stale, already-consumed refresh token.
      await syncAuthFromStorage();
    }
    const response =
      Platform.OS === "web"
        ? await apiClient.post<RefreshResponse>("/api/auth/token/refresh/web")
        : await apiClient.post<RefreshResponse>("/api/auth/token/refresh/native", {
            refreshToken: getRefreshTokenFromStore(),
          });
    const tokens = response.data.data;
    if (!tokens?.accessToken) {
      return null;
    }
    useAuthStore.getState().authenticate({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken ?? null,
    });
    return tokens.accessToken;
  } catch {
    return null;
  }
}

function ensureRefresh(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = performRefresh().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

function isAuth401(error: AxiosError): boolean {
  if (error.response?.status !== 401) {
    return false;
  }
  const data = error.response.data as { error?: { code?: string } } | undefined;
  return typeof data?.error?.code === "string" && data.error.code.startsWith("AUTH_401");
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    if (!isAxiosError(error) || !error.config) {
      throw error;
    }
    const requestUrl = error.config.url ?? "";
    if (REFRESH_PATHS.some((path) => requestUrl.endsWith(path))) {
      throw error;
    }
    const retryable = error.config as ApiRequestConfig & { __retriedAuth?: boolean };
    if (retryable.__retriedAuth) {
      throw error;
    }
    if (!isAuth401(error)) {
      throw error;
    }
    const nextToken = await ensureRefresh();
    if (!nextToken) {
      useAuthStore.getState().signOut();
      useToastStore.getState().showToast({
        title: "다시 로그인해주세요",
        description: "인증 정보가 만료됐어요.",
        variant: "warning",
        sourceKey: "auth-refresh-failed",
        dismissible: true,
      });
      throw error;
    }
    retryable.__retriedAuth = true;
    if (retryable.authToken !== undefined) {
      retryable.authToken = nextToken;
    }
    return apiClient.request(retryable);
  },
);

export const api = {
  async get<TResponse>(url: string, config?: ApiRequestConfig) {
    const response = await apiClient.get<TResponse>(url, config);
    return response.data;
  },

  async post<TResponse, TBody = unknown>(
    url: string,
    data?: TBody,
    config?: ApiRequestConfig<TBody>,
  ) {
    const response = await apiClient.post<TResponse>(url, data, config);
    return response.data;
  },

  async put<TResponse, TBody = unknown>(
    url: string,
    data?: TBody,
    config?: ApiRequestConfig<TBody>,
  ) {
    const response = await apiClient.put<TResponse>(url, data, config);
    return response.data;
  },

  async patch<TResponse, TBody = unknown>(
    url: string,
    data?: TBody,
    config?: ApiRequestConfig<TBody>,
  ) {
    const response = await apiClient.patch<TResponse>(url, data, config);
    return response.data;
  },

  async delete<TResponse>(url: string, config?: ApiRequestConfig) {
    const response = await apiClient.delete<TResponse>(url, config);
    return response.data;
  },
};
