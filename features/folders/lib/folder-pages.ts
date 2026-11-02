import type { Folder, FolderScrollResponse } from "../types";

const UNCATEGORIZED_FOLDER_ID = 0;

type FolderPage = Pick<FolderScrollResponse, "contents" | "hasNext" | "nextCursor">;

type FolderSections = {
  mine: Folder[];
  shared: Folder[];
};

function getNextFolderCursor(page: Pick<FolderPage, "hasNext" | "nextCursor">) {
  return page.hasNext && page.nextCursor ? page.nextCursor : undefined;
}

function flattenFolderPages(pages: readonly FolderPage[] | undefined): Folder[] {
  const seen = new Set<number>();
  const folders: Folder[] = [];
  for (const page of pages ?? []) {
    for (const folder of page.contents) {
      if (seen.has(folder.id)) {
        continue;
      }
      seen.add(folder.id);
      folders.push(folder);
    }
  }
  return folders;
}

function splitFoldersBySection(
  pages: readonly FolderPage[] | undefined,
  options?: { limit?: number },
): FolderSections {
  const sections: FolderSections = { mine: [], shared: [] };
  const folders = flattenFolderPages(pages);
  for (const folder of folders.slice(0, options?.limit ?? folders.length)) {
    (folder.isShared ? sections.shared : sections.mine).push(folder);
  }
  return sections;
}

function findFolderInPages(pages: readonly FolderPage[] | undefined, id: number) {
  for (const page of pages ?? []) {
    const folder = page.contents.find((entry) => entry.id === id);
    if (folder) {
      return folder;
    }
  }
  return undefined;
}

function isFolderId(id: number) {
  return Number.isInteger(id) && id > 0;
}

type FolderFetchState = {
  hasOpenSection: boolean;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  isFetchNextPageError: boolean;
};

type FolderListMetrics = {
  contentHeight: number;
  viewportHeight: number;
};

function isFolderListShort({ contentHeight, viewportHeight }: FolderListMetrics) {
  return viewportHeight > 0 && contentHeight <= viewportHeight + 1;
}

function shouldFetchMoreFolders(
  state: FolderFetchState,
  trigger: { endReached: boolean } & Partial<FolderListMetrics>,
) {
  if (!state.hasOpenSection || !state.hasNextPage) {
    return false;
  }
  if (state.isFetchingNextPage || state.isFetchNextPageError) {
    return false;
  }
  const isShort =
    trigger.contentHeight != null &&
    trigger.viewportHeight != null &&
    isFolderListShort({
      contentHeight: trigger.contentHeight,
      viewportHeight: trigger.viewportHeight,
    });
  return trigger.endReached || isShort;
}

type ScrollRestoreDecision =
  | { type: "none" }
  | { type: "scroll"; offset: number }
  | { type: "fetchMore" }
  | { type: "wait" };

function resolveScrollRestore({
  savedOffset,
  contentHeight,
  viewportHeight,
  hasNextPage,
  isFetchingNextPage,
  isFetchNextPageError,
}: FolderListMetrics & {
  savedOffset: number;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  isFetchNextPageError: boolean;
}): ScrollRestoreDecision {
  if (savedOffset <= 0) {
    return { type: "none" };
  }
  if (viewportHeight <= 0 || contentHeight <= 0) {
    return { type: "wait" };
  }
  const maxOffset = Math.max(0, contentHeight - viewportHeight);
  if (maxOffset >= savedOffset) {
    return { type: "scroll", offset: savedOffset };
  }
  if (hasNextPage && !isFetchNextPageError) {
    return isFetchingNextPage ? { type: "wait" } : { type: "fetchMore" };
  }
  return { type: "scroll", offset: maxOffset };
}

export {
  UNCATEGORIZED_FOLDER_ID,
  findFolderInPages,
  flattenFolderPages,
  getNextFolderCursor,
  isFolderId,
  isFolderListShort,
  resolveScrollRestore,
  shouldFetchMoreFolders,
  splitFoldersBySection,
};
export type { FolderFetchState, FolderPage, FolderSections, ScrollRestoreDecision };
