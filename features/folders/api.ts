import type { ApiEnvelope } from "@/features/links/types";
import { type ApiRequestConfig, api } from "@/lib/api-client";

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
  Folder,
  GetFolderMembersResponse,
  GetFoldersParams,
  GetFoldersResponse,
  PublicFolder,
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

async function setFolderPrivacy(id: number, payload: { isPublic: boolean }) {
  return api.put<ApiEnvelope<{ isPublic: boolean }>, typeof payload>(
    `/api/folders/${id}/privacy`,
    payload,
  );
}

async function getFolderDetail(id: number, read: ApiRequestConfig) {
  return api.get<ApiEnvelope<Folder | PublicFolder>>(`/api/folders/${id}`, read);
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
  setFolderPrivacy,
  getFolders,
  getFolderDetail,
  transferFolderOwnership,
  updateFolder,
};
