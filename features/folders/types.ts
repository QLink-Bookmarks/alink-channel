import type { ApiEnvelope } from "@/features/links/types";

type Folder = {
  id: number;
  ownerId?: number;
  ownerNickname?: string | null;
  name: string;
  emoji?: string | null;
  isShared: boolean;
  shareCounts: number;
  linkCounts: number;
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

type FolderOrder = "latest" | "earliest" | "laxico";

type GetFoldersParams = {
  query?: string;
  order?: FolderOrder;
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
  Folder,
  FolderListStatus,
  FolderMember,
  FolderOrder,
  FolderScrollResponse,
  GetFolderMembersResponse,
  GetFolderMembersResponseData,
  GetFoldersParams,
  GetFoldersResponse,
  UpdateFolderRequest,
  UpdateFolderResponse,
};
