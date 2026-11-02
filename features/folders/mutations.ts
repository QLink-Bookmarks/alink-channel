import { getLinkQueryKeyRoot } from "@/features/links/queries";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  acceptFolderInvitation,
  createFolder,
  createFolderInvitation,
  deleteFolderMember,
  updateFolder,
} from "./api";
import { folderQueryKeys } from "./queries";
import type {
  AcceptFolderInvitationRequest,
  CreateFolderInvitationRequest,
  CreateFolderRequest,
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

function useUpdateFolderMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: UpdateFolderRequest }) =>
      updateFolder(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: folderQueryKeys.all });
      queryClient.invalidateQueries({ queryKey: getLinkQueryKeyRoot() });
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

export {
  useAcceptFolderInvitationMutation,
  useCreateFolderInvitationMutation,
  useCreateFolderMutation,
  useDeleteFolderMemberMutation,
  useUpdateFolderMutation,
};
