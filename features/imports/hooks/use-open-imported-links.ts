import * as React from "react";

import { useQueryClient } from "@tanstack/react-query";

import { getImport } from "../api";
import { getImportDetailPath } from "../lib/import-paths";
import { getImportedLinksFolderId } from "../lib/import-status-copy";
import { importQueryKeys } from "../queries";

import { type Href, useRouter } from "expo-router";

function useOpenImportedLinks() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const pendingRef = React.useRef(false);
  const [pendingId, setPendingId] = React.useState<number | null>(null);

  const openImportedLinks = React.useCallback(
    async (importId: number) => {
      if (pendingRef.current) {
        return;
      }
      pendingRef.current = true;
      setPendingId(importId);
      try {
        const detail = await queryClient.fetchQuery({
          queryKey: importQueryKeys.detail(importId),
          queryFn: async () => (await getImport(importId)).data,
          retry: false,
        });
        const folderId = getImportedLinksFolderId(detail);
        router.push(
          (folderId == null ? getImportDetailPath(importId) : `/folders/${folderId}`) as Href,
        );
      } catch {
        router.push(getImportDetailPath(importId) as Href);
      } finally {
        pendingRef.current = false;
        setPendingId(null);
      }
    },
    [queryClient, router],
  );

  return { openImportedLinks, pendingId };
}

export { useOpenImportedLinks };
