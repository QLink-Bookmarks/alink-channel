import * as React from "react";

import { UNCATEGORIZED_FOLDER_ID } from "@/features/folders/lib/folder-pages";
import { useFolderQuery } from "@/features/folders/queries";
import { useLinkDetailQuery } from "@/features/links/queries";
import { useWideView } from "@/lib/hooks/use-wide-view";

import { getRouteTitle, normalizePathname, readParamValue } from "../routes";
import type { RouteParams } from "../types";

import { useGlobalSearchParams, usePathname } from "expo-router";

const APP_NAME = "ALink";
const BRAND_TITLE = "에이링크 ALink — AI가 도와주는 북마크 아카이브";
const NOT_FOUND_TITLE = "페이지를 찾을 수 없음";

function useDocumentTitle() {
  const pathname = normalizePathname(usePathname());
  const searchParams = useGlobalSearchParams() as RouteParams;
  const isWideView = useWideView();
  const folderId = readParamValue(searchParams.id);

  // Detail-resource ids: a link detail path (or the wide-view overlay linkId)
  // and a folder detail path. The queries below stay disabled off these routes,
  // so they never fire on unauthenticated screens.
  const linkId = /^\/links\/[^/]+$/.test(pathname)
    ? pathname.split("/")[2]
    : readParamValue(searchParams.linkId);
  const folderDetailId = /^\/folders\/([^/]+)$/.exec(pathname)?.[1];

  const linkDetailQuery = useLinkDetailQuery(linkId);
  const folderQuery = useFolderQuery(Number(folderDetailId), {
    enabled: Boolean(folderDetailId) && Number(folderDetailId) !== UNCATEGORIZED_FOLDER_ID,
  });

  const linkTitle = linkId ? linkDetailQuery.data?.title?.trim() : undefined;
  const folderName = folderDetailId ? folderQuery.folder?.name : undefined;
  const resourceTitle = linkTitle || folderName || undefined;

  const routeTitle = getRouteTitle(pathname, { id: folderId }, isWideView);

  React.useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }
    const base = resourceTitle ?? routeTitle;
    document.title = base && base !== NOT_FOUND_TITLE ? `${base} · ${APP_NAME}` : BRAND_TITLE;
  }, [resourceTitle, routeTitle]);
}

export { useDocumentTitle };
