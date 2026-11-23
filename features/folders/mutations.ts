import { invalidateLinkListAndSearchQueries } from "@/features/links/queries";
import { todoQueryKeys } from "@/features/todos/queries";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  acceptFolderInvitation,
  createFolder,
  createFolderInvitation,
  deleteFolder,
  deleteFolderMember,
  setFolderPrivacy,
  transferFolderOwnership,
  updateFolder,
} from "./api";
import { folderQueryKeys } from "./queries";
import type {
  AcceptFolderInvitationRequest,
  CreateFolderInvitationRequest,
  CreateFolderRequest,
  DeleteFolderParams,
  Folder,
  UpdateFolderRequest,
} from "./types";

function useCreateFolderMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateFolderRequest) => createFolder(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: folderQueryKeys.all });
    },
  });
}

function useInvalidateFolderWrites() {
  const queryClient = useQueryClient();
  return (id: number, visibilityChanged: boolean) => {
    const invalidations = [
      queryClient.invalidateQueries({ queryKey: folderQueryKeys.all }),
      invalidateLinkListAndSearchQueries(queryClient),
      queryClient.invalidateQueries({ queryKey: ["resource-read", "folders", id] }),
    ];
    if (visibilityChanged) {
      invalidations.push(
        queryClient.invalidateQueries({ queryKey: ["links", "detail"] }),
        queryClient.invalidateQueries({ queryKey: ["resource-read", "links"] }),
        queryClient.invalidateQueries({ queryKey: ["folder-read", id] }),
        queryClient.invalidateQueries({ queryKey: todoQueryKeys.lists() }),
      );
    }
    return Promise.all(invalidations);
  };
}

function useUpdateFolderMutation() {
  const invalidate = useInvalidateFolderWrites();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: UpdateFolderRequest }) =>
      updateFolder(id, payload),
    onSuccess: (_response, { id }) => invalidate(id, false),
  });
}

function useSetFolderPrivacyMutation() {
  const invalidate = useInvalidateFolderWrites();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, isPublic }: { id: number; isPublic: boolean }) =>
      setFolderPrivacy(id, { isPublic }),
    onError: (_error, { id }) => invalidate(id, true),
    onSuccess: async (response, { id }) => {
      const queryKey = folderQueryKeys.detail(id);
      await queryClient.cancelQueries({ queryKey, exact: true });
      queryClient.setQueryData<Folder>(
        queryKey,
        (folder) => folder && { ...folder, isPublic: response.data.isPublic },
      );
      await invalidate(id, true);
    },
  });
}

function useCreateFolderInvitationMutation() {
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: CreateFolderInvitationRequest }) =>
      createFolderInvitation(id, payload),
  });
}

function useAcceptFolderInvitationMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: AcceptFolderInvitationRequest }) =>
      acceptFolderInvitation(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: folderQueryKeys.all });
    },
  });
}

function useDeleteFolderMemberMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, memberId }: { id: number; memberId: number }) =>
      deleteFolderMember(id, memberId),
    onSuccess: (_response, variables) => {
      queryClient.invalidateQueries({ queryKey: folderQueryKeys.all });
      queryClient.invalidateQueries({ queryKey: folderQueryKeys.members(variables.id) });
    },
  });
}

// Delete and transfer leave cache updates to `useFolderRemovalSuccess`, which navigates away
// first: invalidating while the folder screen is open would show its not-found state.
function useDeleteFolderMutation() {
  return useMutation({
    mutationFn: ({ id, params }: { id: number; params: DeleteFolderParams }) =>
      deleteFolder(id, params),
  });
}

function useTransferFolderOwnershipMutation() {
  return useMutation({
    mutationFn: ({ id, ownerId }: { id: number; ownerId: number }) =>
      transferFolderOwnership(id, { ownerId }),
  });
}

// Leaving my own membership: same request as removing a member, but the cache updates wait
// for `useFolderRemovalSuccess` after the navigation, as with delete and transfer.
function useLeaveFolderMutation() {
  return useMutation({
    mutationFn: ({ id, memberId }: { id: number; memberId: number }) =>
      deleteFolderMember(id, memberId),
  });
}

export {
  useAcceptFolderInvitationMutation,
  useCreateFolderInvitationMutation,
  useCreateFolderMutation,
  useDeleteFolderMemberMutation,
  useDeleteFolderMutation,
  useLeaveFolderMutation,
  useSetFolderPrivacyMutation,
  useTransferFolderOwnershipMutation,
  useUpdateFolderMutation,
};
