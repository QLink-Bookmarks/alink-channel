import type { PublicFolderLists, PublicFolderPage } from "@/features/folders/types";
import { type ApiRequestConfig, api } from "@/lib/api-client";

import { LinkAccessDenied } from "./lib/is-link-not-found";
import type {
  ApiEnvelope,
  CopyLinkRequest,
  CopyLinkResponse,
  CreateLinkRequest,
  CreateLinkResponse,
  DeleteLinkResponse,
  GetLinksParams,
  GetLinksResponse,
  LinkDetail,
  LinkDetailResponse,
  LinkPreviewResponse,
  PatchLinkRequest,
  PublicLinkDetail,
  SetLinkFavoriteRequest,
  SetLinkFavoriteResponse,
  UpdateLinkRequest,
} from "./types";

async function createLink(payload: CreateLinkRequest) {
  return api.post<CreateLinkResponse, CreateLinkRequest>("/api/links", payload);
}

async function getLinkDetail(linkId: string | number) {
  const response = await api.get<ApiEnvelope<LinkDetail | PublicLinkDetail>>(
    `/api/links/${linkId}`,
  );
  const detail = response.data;
  if (!detail || !("sourceType" in detail)) throw new LinkAccessDenied();
  return { ...response, data: detail };
}

function getLinkAccess(linkId: number, read: ApiRequestConfig) {
  return api.get<ApiEnvelope<LinkDetail | PublicLinkDetail>>(`/api/links/${linkId}`, read);
}

function getPublicFolderLinks(
  folderId: number,
  cursor: string | undefined,
  read: ApiRequestConfig,
) {
  return api.get<ApiEnvelope<PublicFolderPage<PublicFolderLists["links"]>>>("/api/links", {
    ...read,
    params: { folderId, cursor },
  });
}

async function getLinks(params: GetLinksParams = {}) {
  return api.get<GetLinksResponse>("/api/links", { params });
}

// The preview API may live on its own host, so the full URL comes from the
// environment. It uses the same bearer token; cookies are not needed.
async function getLinkPreview(url: string, config: { timeout?: number } = {}) {
  const previewApiUrl = process.env.EXPO_PUBLIC_LINK_PREVIEW_URL;
  if (!previewApiUrl) {
    throw new Error("EXPO_PUBLIC_LINK_PREVIEW_URL is not set");
  }
  return api.post<LinkPreviewResponse, { url: string }>(
    previewApiUrl,
    { url },
    { ...config, withCredentials: false },
  );
}

async function updateLink(linkId: string | number, payload: UpdateLinkRequest) {
  return api.put<LinkDetailResponse, UpdateLinkRequest>(`/api/links/${linkId}`, payload);
}

async function patchLink(linkId: string | number, payload: PatchLinkRequest) {
  return api.patch<LinkDetailResponse, PatchLinkRequest>(`/api/links/${linkId}`, payload);
}

async function deleteLink(linkId: string | number) {
  return api.delete<DeleteLinkResponse>(`/api/links/${linkId}`);
}

async function setLinkFavorite(linkId: string | number, payload: SetLinkFavoriteRequest) {
  return api.put<SetLinkFavoriteResponse, SetLinkFavoriteRequest>(
    `/api/links/${linkId}/favorite`,
    payload,
  );
}

async function copySharedFolderLink(linkId: string | number, payload: CopyLinkRequest) {
  return api.post<CopyLinkResponse, CopyLinkRequest>(`/api/links/${linkId}/copy`, payload);
}

export {
  copySharedFolderLink,
  createLink,
  deleteLink,
  getLinkDetail,
  getLinkAccess,
  getPublicFolderLinks,
  getLinkPreview,
  getLinks,
  patchLink,
  setLinkFavorite,
  updateLink,
};
