import * as React from "react";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  copySharedFolderLink,
  createLink,
  deleteLink,
  patchLink,
  setLinkFavorite,
  updateLink,
} from "./api";
import { getLinkDetailQueryKey, invalidateLinkListAndSearchQueries } from "./queries";
import type {
  CopyLinkRequest,
  CreateLinkRequest,
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
  return useMutation({
    mutationFn: (payload: UpdateLinkRequest) => updateLink(linkId, payload),
    onSuccess: () => {
      invalidateLinkQueries(linkId);
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

export {
  useCopyLinkMutation,
  useCreateLinkMutation,
  useDeleteLinkMutation,
  usePatchLinkMutation,
  useSetLinkFavoriteMutation,
  useUpdateLinkMutation,
};
