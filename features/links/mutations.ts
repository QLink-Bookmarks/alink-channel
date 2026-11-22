import * as React from "react";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  copySharedFolderLink,
  createLink,
  deleteLink,
  patchLink,
  setLinkFavorite,
  setLinkPrivacy,
  updateLink,
} from "./api";
import { getLinkDetailQueryKey, invalidateLinkListAndSearchQueries } from "./queries";
import type {
  CopyLinkRequest,
  CreateLinkRequest,
  LinkDetail,
  PatchLinkRequest,
  SetLinkFavoriteRequest,
  UpdateLinkRequest,
} from "./types";

// The link's detail (deleted: marked stale without a refetch, which would 404), then the
// lists and the search results, so a search right after the change sees it.
function useInvalidateLinkQueries() {
  const queryClient = useQueryClient();

  return React.useCallback(
    (linkId: string | number | null, options: { isDeleted?: boolean } = {}) => {
      if (linkId != null) {
        void queryClient.invalidateQueries({
          queryKey: getLinkDetailQueryKey(linkId),
          refetchType: options.isDeleted ? "none" : "active",
        });
      }
      void invalidateLinkListAndSearchQueries(queryClient);
    },
    [queryClient],
  );
}

function useCreateLinkMutation() {
  const invalidateLinkQueries = useInvalidateLinkQueries();
  return useMutation({
    mutationFn: (payload: CreateLinkRequest) => createLink(payload),
    onSuccess: () => {
      invalidateLinkQueries(null);
    },
  });
}

function useUpdateLinkMutation(linkId: string | number) {
  const invalidateLinkQueries = useInvalidateLinkQueries();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateLinkRequest) => updateLink(linkId, payload),
    onSuccess: (_response, payload) => {
      invalidateLinkQueries(linkId);
      if (payload.isPublic !== undefined) {
        void invalidatePublicLinkQueries(queryClient, linkId);
      }
    },
  });
}

function usePatchLinkMutation(linkId: string | number) {
  const invalidateLinkQueries = useInvalidateLinkQueries();
  return useMutation({
    mutationFn: (payload: PatchLinkRequest) => patchLink(linkId, payload),
    onSuccess: () => {
      invalidateLinkQueries(linkId);
    },
  });
}

function useDeleteLinkMutation(linkId: string | number) {
  const invalidateLinkQueries = useInvalidateLinkQueries();
  return useMutation({
    mutationFn: () => deleteLink(linkId),
    onSuccess: () => {
      invalidateLinkQueries(linkId, { isDeleted: true });
    },
  });
}

function useCopyLinkMutation(linkId: string | number) {
  const invalidateLinkQueries = useInvalidateLinkQueries();
  return useMutation({
    mutationFn: (payload: CopyLinkRequest) => copySharedFolderLink(linkId, payload),
    onSuccess: () => {
      invalidateLinkQueries(linkId);
    },
  });
}

function useSetLinkFavoriteMutation() {
  const invalidateLinkQueries = useInvalidateLinkQueries();
  return useMutation({
    mutationFn: ({
      linkId,
      payload,
    }: {
      linkId: string | number;
      payload: SetLinkFavoriteRequest;
    }) => setLinkFavorite(linkId, payload),
    onSuccess: (_response, { linkId }) => {
      invalidateLinkQueries(linkId);
    },
  });
}

function useSetLinkPrivacyMutation(linkId: number) {
  const queryClient = useQueryClient();
  const queryKey = getLinkDetailQueryKey(linkId);
  return useMutation({
    mutationFn: (isPublic: boolean) => setLinkPrivacy(linkId, { isPublic }),
    onSuccess: async (response) => {
      await queryClient.cancelQueries({ queryKey, exact: true });
      queryClient.setQueryData<LinkDetail>(
        queryKey,
        (detail) => detail && { ...detail, turnsPublicAt: response.data.turnsPublicAt },
      );
      await Promise.all([
        queryClient.invalidateQueries({ queryKey }),
        invalidateLinkListAndSearchQueries(queryClient),
        invalidatePublicLinkQueries(queryClient, linkId),
      ]);
    },
  });
}

function invalidatePublicLinkQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  linkId: number | string,
) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: ["resource-read", "links", Number(linkId)] }),
    queryClient.invalidateQueries({ queryKey: ["folder-read"] }),
  ]);
}

export {
  useCopyLinkMutation,
  useCreateLinkMutation,
  useDeleteLinkMutation,
  usePatchLinkMutation,
  useSetLinkFavoriteMutation,
  useSetLinkPrivacyMutation,
  useUpdateLinkMutation,
};
