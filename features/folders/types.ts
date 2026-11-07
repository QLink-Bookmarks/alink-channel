import type { ApiEnvelope } from "@/features/links/types";
import type { SortDirection } from "@/lib/list-sort";

type Folder = {
  id: number;
  ownerId?: number;
  ownerNickname?: string | null;
  name: string;
  emoji?: string | null;
  isShared: boolean;
  shareCounts: number;
  linkCounts: number;
  /** Links in this folder that the caller put in. */
  myLinkCounts: number;
};

type FolderListStatus = {
  isInitialLoading: boolean;
  isInitialError: boolean;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  isFetchNextPageError: boolean;
};

type FolderScrollResponse = {
  isEmpty: boolean;
  contents: Folder[];
  nextCursor: string | null;
  hasNext: boolean;
};

type GetFoldersResponse = ApiEnvelope<FolderScrollResponse>;

type FolderMember = {
  userId: number;
  role: string;
  userNickname: string;
  avatarEmoji?: string | null;
  avatarUrl?: string | null;
};

type GetFolderMembersResponseData = {
  ownerId: number;
  ownerNickname: string;
  members: FolderMember[];
};

type GetFolderMembersResponse = ApiEnvelope<GetFolderMembersResponseData>;

type DeleteFolderMemberResponse = ApiEnvelope<null>;

/**
 * `DELETE /api/folders/{id}` query. Omitted `onDelete` detaches the links; `cascade` deletes
 * them; `move` needs `targetFolderId`.
 */
type DeleteFolderParams =
  | { onDelete?: undefined; targetFolderId?: undefined }
  | { onDelete: "cascade"; targetFolderId?: undefined }
  | { onDelete: "move"; targetFolderId: number };

type DeleteFolderResponse = ApiEnvelope<null>;

type TransferFolderOwnershipRequest = {
  ownerId: number;
};

type TransferFolderOwnershipResponse = ApiEnvelope<null>;

type FolderOrderKey = "created_at";

type GetFoldersParams = {
  query?: string;
  orderKey?: FolderOrderKey;
  order?: SortDirection;
  cursor?: string;
  size?: number;
};

type CreateFolderRequest = {
  name: string;
  emoji?: string | null;
  isShared?: boolean | null;
};

type CreateFolderResponse = ApiEnvelope<{ id: number }>;

type CreateFolderInvitationRequest = {
  durationDays?: number | null;
};

type CreateFolderInvitationResponse = ApiEnvelope<{ invitation: string }>;

type AcceptFolderInvitationRequest = {
  invitation: string;
};

type AcceptFolderInvitationResponse = ApiEnvelope<{ folderId: number }>;

type UpdateFolderRequest = {
  name: string;
  emoji?: string | null;
  isShared?: boolean | null;
};

type UpdateFolderResponse = ApiEnvelope<{ id: number }>;

export type {
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
  FolderListStatus,
  FolderMember,
  FolderOrderKey,
  FolderScrollResponse,
  GetFolderMembersResponse,
  GetFolderMembersResponseData,
  GetFoldersParams,
  GetFoldersResponse,
  TransferFolderOwnershipRequest,
  TransferFolderOwnershipResponse,
  UpdateFolderRequest,
  UpdateFolderResponse,
};
