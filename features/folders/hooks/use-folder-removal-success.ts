import * as React from "react";

import { importQueryKeys } from "@/features/imports/queries";
import { getLinkListsQueryKey, getLinkQueryKeyRoot } from "@/features/links/queries";
import type { GetLinksParams } from "@/features/links/types";
import { notificationQueryKeys } from "@/features/notifications/queries";
import { todoQueryKeys } from "@/features/todos/queries";
import { useToastStore } from "@/stores/toast-store";
import { type Query, useQueryClient } from "@tanstack/react-query";

import { FOLDER_LIST_SORT, fetchAllFolders, folderQueryKeys } from "../queries";

import { type Href, useRouter } from "expo-router";

const SEARCH_QUERY_KEY_ROOT = ["search"] as const;
const WIDE_DESTINATION = "/home";
const MOBILE_DESTINATION = "/folders";

type FolderRemovalFinishOptions = {
  /** Success toast; `null` ends without one. */
  toast: string | null;
  /** The delete removed links (b), so actions and notifications change too. */
  hasDeletedLinks: boolean;
};

type FolderPermissionResolution = "ended" | "stayed";

function isFolderLinkListQuery(folderId: number) {
  return (query: Query) => {
    const params = query.queryKey[2] as GetLinksParams | undefined;
    return params?.folderId === folderId;
  };
}

/**
 * After a delete, transfer or leave: navigate away first (so the folder screen never shows
 * its not-found state), drop the folder's members and link lists without refetching, then
 * invalidate what the change touched and show the toast.
 */
function useFolderRemovalSuccess({
  folderId,
  mode,
}: {
  folderId: number;
  mode: "wide" | "mobile";
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const showToast = useToastStore((state) => state.showToast);

  const finish = React.useCallback(
    ({ toast, hasDeletedLinks }: FolderRemovalFinishOptions) => {
      router.replace((mode === "wide" ? WIDE_DESTINATION : MOBILE_DESTINATION) as Href);

      queryClient.removeQueries({ queryKey: folderQueryKeys.members(folderId) });
      queryClient.removeQueries({
        queryKey: getLinkListsQueryKey(),
        predicate: isFolderLinkListQuery(folderId),
      });

      const queryKeys = [
        folderQueryKeys.all,
        getLinkQueryKeyRoot(),
        SEARCH_QUERY_KEY_ROOT,
        importQueryKeys.all,
        ...(hasDeletedLinks ? [todoQueryKeys.lists(), notificationQueryKeys.all] : []),
      ];
      for (const queryKey of queryKeys) {
        void queryClient.invalidateQueries({ queryKey });
      }

      if (toast) {
        showToast({
          durationMs: 3000,
          sourceKey: "folder-removal",
          title: toast,
          variant: "success",
        });
      }
    },
    [folderId, mode, queryClient, router, showToast],
  );

  // FOLDER_DIFFERENT_OWNER: refetch the folder list. Without the folder my access has ended,
  // so finish without a toast; otherwise stay, and the header follows my current role.
  const resolvePermissionChange =
    React.useCallback(async (): Promise<FolderPermissionResolution> => {
      let isStillListed = true;
      try {
        const folders = await fetchAllFolders(FOLDER_LIST_SORT);
        isStillListed = folders.contents.some((folder) => folder.id === folderId);
      } catch {
        isStillListed = true;
      }
      if (!isStillListed) {
        finish({ toast: null, hasDeletedLinks: false });
        return "ended";
      }
      void queryClient.invalidateQueries({ queryKey: folderQueryKeys.all });
      return "stayed";
    }, [finish, folderId, queryClient]);

  return { finish, resolvePermissionChange };
}

export { useFolderRemovalSuccess };
export type { FolderPermissionResolution, FolderRemovalFinishOptions };
