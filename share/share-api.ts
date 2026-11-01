import type {
  AiProviderWithModels,
  AiSummaryRequest,
  AiSummaryResponse,
  GetAiProviderModelsResponse,
} from "@/features/ai/types";
import type { Folder, GetFoldersResponse } from "@/features/folders/types";
import type { NativeImageFile, UploadImageResponse } from "@/features/images/types";
import type { CreateLinkRequest, CreateLinkResponse } from "@/features/links/types";
import { KEYCHAIN_OPTIONS } from "@/lib/session-storage";

import { type AxiosRequestConfig, create, isAxiosError } from "axios";
import * as SecureStore from "expo-secure-store";

const AUTH_STORAGE_KEY = "qlink-auth";

type Tokens = { accessToken: string | null; refreshToken: string | null };

async function loadTokens(): Promise<Tokens> {
  try {
    const raw = await SecureStore.getItemAsync(AUTH_STORAGE_KEY, KEYCHAIN_OPTIONS);
    if (!raw) return { accessToken: null, refreshToken: null };
    const parsed = JSON.parse(raw) as Partial<Tokens>;
    return {
      accessToken: typeof parsed.accessToken === "string" ? parsed.accessToken : null,
      refreshToken: typeof parsed.refreshToken === "string" ? parsed.refreshToken : null,
    };
  } catch {
    return { accessToken: null, refreshToken: null };
  }
}

async function saveTokens(tokens: Tokens): Promise<void> {
  try {
    await SecureStore.setItemAsync(AUTH_STORAGE_KEY, JSON.stringify(tokens), KEYCHAIN_OPTIONS);
  } catch {}
}

const client = create({
  baseURL: process.env.EXPO_PUBLIC_API_BASE_URL,
  headers: { Accept: "application/json" },
});

function randomUuid(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (c?.randomUUID) return c.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    return (ch === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function isAuth401(error: unknown): boolean {
  if (!isAxiosError(error) || error.response?.status !== 401) return false;
  const data = error.response.data as { error?: { code?: string } } | undefined;
  return typeof data?.error?.code === "string" && data.error.code.startsWith("AUTH_401");
}

function extractErrorMessage(error: unknown): string {
  if (isAxiosError(error)) {
    const data = error.response?.data as { error?: { message?: string } } | undefined;
    if (data?.error?.message) return data.error.message;
  }
  return "요청에 실패했어요. 잠시 후 다시 시도해주세요.";
}

async function refreshTokens(refreshToken: string | null): Promise<Tokens | null> {
  try {
    const response = await client.post<{
      data: { accessToken: string; refreshToken: string } | null;
    }>(
      "/api/auth/token/refresh/native",
      { refreshToken },
      { headers: { csrf_token: randomUuid() } },
    );
    const next = response.data?.data;
    if (!next?.accessToken) return null;
    const tokens: Tokens = {
      accessToken: next.accessToken,
      refreshToken: next.refreshToken ?? refreshToken,
    };
    await saveTokens(tokens);
    return tokens;
  } catch {
    return null;
  }
}

async function authed<T>(config: AxiosRequestConfig): Promise<T> {
  const tokens = await loadTokens();
  const send = (token: string | null) =>
    client.request<T>({
      ...config,
      headers: {
        ...config.headers,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
  try {
    return (await send(tokens.accessToken)).data;
  } catch (error) {
    if (isAuth401(error)) {
      const next = await refreshTokens(tokens.refreshToken);
      if (next?.accessToken) {
        return (await send(next.accessToken)).data;
      }
    }
    throw error;
  }
}

async function hasAuth(): Promise<boolean> {
  const { accessToken, refreshToken } = await loadTokens();
  return Boolean(accessToken || refreshToken);
}

async function fetchFolders(): Promise<Folder[]> {
  const res = await authed<GetFoldersResponse>({
    method: "get",
    url: "/api/folders",
    params: { order: "latest", size: 50 },
  });
  return res.data?.contents ?? [];
}

async function fetchProviderModels(): Promise<AiProviderWithModels[]> {
  const res = await authed<GetAiProviderModelsResponse>({
    method: "get",
    url: "/api/ai/providers/models?isMine=true",
  });
  return res.data ?? [];
}

// Uploads a downloaded main image to the link preview storage and returns its URL.
// RN's FormData takes the `{ uri, name, type }` descriptor; Content-Type is left to
// the networking layer so it adds the multipart boundary.
async function uploadSharedPreviewImage(file: NativeImageFile): Promise<string> {
  const form = new FormData();
  form.append("image", file as unknown as Blob);
  const res = await authed<UploadImageResponse>({
    method: "post",
    url: "/api/images",
    params: { purpose: "LINK_PREVIEW" },
    data: form,
  });
  return res.data.url;
}

async function createSharedLink(input: {
  url: string;
  title: string;
  folderId: number | null;
  thumbnailUrl: string | null;
}): Promise<CreateLinkResponse> {
  const body: CreateLinkRequest = {
    url: input.url,
    title: input.title,
    thumbnailUrl: input.thumbnailUrl,
    tags: [],
    sourceType: "INPUT",
    folderId: input.folderId,
    todos: [],
  };
  return authed<CreateLinkResponse>({ method: "post", url: "/api/links", data: body });
}

async function requestSharedAiSummary(input: {
  url: string;
  title: string;
  folderId: number | null;
  userProviderId: number;
  modelId: number;
  generateTodo: boolean;
  thumbnailUrl: string | null;
}): Promise<AiSummaryResponse> {
  const body: AiSummaryRequest = {
    url: input.url,
    thumbnailUrl: input.thumbnailUrl,
    title: input.title || null,
    folderId: input.folderId,
    userProviderId: input.userProviderId,
    modelId: input.modelId,
    generateTodo: input.generateTodo,
  };
  return authed<AiSummaryResponse>({ method: "put", url: "/api/links/ai", data: body });
}

export {
  createSharedLink,
  extractErrorMessage,
  fetchFolders,
  fetchProviderModels,
  hasAuth,
  requestSharedAiSummary,
  uploadSharedPreviewImage,
};
