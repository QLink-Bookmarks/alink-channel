import type { ApiEnvelope } from "@/features/links/types";
import { api } from "@/lib/api-client";

import type {
  AcceptFolderInvitationRequest,
  AcceptFolderInvitationResponse,
  CreateFolderInvitationRequest,
  CreateFolderInvitationResponse,
  CreateFolderRequest,
  CreateFolderResponse,
  DeleteFolderMemberResponse,
  DeleteFolderParams,
  DeleteFolderResponse,
  FolderPrivacy,
  GetFolderMembersResponse,
  GetFoldersParams,
  GetFoldersResponse,
  PublicFolder,
  PublicFolderLists,
  PublicFolderPage,
  TransferFolderOwnershipRequest,
  TransferFolderOwnershipResponse,
  UpdateFolderRequest,
  UpdateFolderResponse,
} from "./types";

async function getFolders(params: GetFoldersParams = {}) {
  return api.get<GetFoldersResponse>("/api/folders", { params });
}

async function getFolderMembers(id: number) {
  return api.get<GetFolderMembersResponse>(`/api/folders/${id}/members`);
}

async function createFolder(payload: CreateFolderRequest) {
  return api.post<CreateFolderResponse, CreateFolderRequest>("/api/folders", payload);
}

async function createFolderInvitation(id: number, payload: CreateFolderInvitationRequest) {
  return api.post<CreateFolderInvitationResponse, CreateFolderInvitationRequest>(
    `/api/folders/${id}`,
    payload,
  );
}

async function acceptFolderInvitation(id: number, payload: AcceptFolderInvitationRequest) {
  return api.put<AcceptFolderInvitationResponse, AcceptFolderInvitationRequest>(
    `/api/folders/${id}/members`,
    payload,
  );
}

async function updateFolder(id: number, payload: UpdateFolderRequest) {
  return api.put<UpdateFolderResponse, UpdateFolderRequest>(`/api/folders/${id}`, payload);
}

async function getFolderPrivacy(id: number, signal?: AbortSignal) {
  return api.get<ApiEnvelope<FolderPrivacy>>(`/api/folders/${id}/privacy`, { signal });
}

async function getPublicFolderData<T>(
  publicId: string,
  list: string,
  params: { cursor?: string } | undefined,
  signal: AbortSignal,
) {
  const path = `/api/public-folders/${encodeURIComponent(publicId)}${list}`;
  const response = await api.get<ApiEnvelope<T>>(path, {
    authToken: null,
    adapter: "fetch",
    fetchOptions: { cache: "no-store" },
    withCredentials: false,
    params,
    signal,
  });
  return response.data;
}

function getPublicFolder(publicId: string, signal: AbortSignal) {
  return getPublicFolderData<PublicFolder>(publicId, "", undefined, signal);
}

function getPublicFolderPage<K extends keyof PublicFolderLists>(
  publicId: string,
  list: K,
  cursor: string | undefined,
  signal: AbortSignal,
) {
  return getPublicFolderData<PublicFolderPage<PublicFolderLists[K]>>(
    publicId,
    `/${list}`,
    { cursor },
    signal,
  );
}

async function deleteFolderMember(id: number, memberId: number) {
  return api.delete<DeleteFolderMemberResponse>(`/api/folders/${id}/members/${memberId}`);
}

async function deleteFolder(id: number, params: DeleteFolderParams = {}) {
  const query = params.onDelete
    ? params.onDelete === "move"
      ? { onDelete: params.onDelete, targetFolderId: params.targetFolderId }
      : { onDelete: params.onDelete }
    : undefined;
  return api.delete<DeleteFolderResponse>(`/api/folders/${id}`, { params: query });
}

async function transferFolderOwnership(id: number, payload: TransferFolderOwnershipRequest) {
  return api.put<TransferFolderOwnershipResponse, TransferFolderOwnershipRequest>(
    `/api/folders/${id}/owner`,
    payload,
  );
}

export {
  acceptFolderInvitation,
  createFolder,
  createFolderInvitation,
  deleteFolder,
  deleteFolderMember,
  getFolderMembers,
  getFolderPrivacy,
  getFolders,
  getPublicFolder,
  getPublicFolderPage,
  transferFolderOwnership,
  updateFolder,
};
