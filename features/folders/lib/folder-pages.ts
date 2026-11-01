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

export {
  UNCATEGORIZED_FOLDER_ID,
  findFolderInPages,
  flattenFolderPages,
  getNextFolderCursor,
  isFolderId,
  splitFoldersBySection,
};
export type { FolderPage, FolderSections };
