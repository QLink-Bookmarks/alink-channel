import type {
  ImportFolderKind,
  ImportReversalPreview,
  ReversalFolderState,
  ReversalLinkState,
  ReverseImportRequest,
} from "../types";

type ReversalLinkItem = {
  linkId: number;
  title: string;
  url: string;
  state: ReversalLinkState;
  isDone: boolean;
};

type ReversalFolderItem = {
  key: string;
  kind: ImportFolderKind;
  state: ReversalFolderState;
  folderId: number | null;
  name: string;
  emoji: string | null;
  isRemovable: boolean;
  isDone: boolean;
  links: ReversalLinkItem[];
};

type ReversalExclusions = {
  linkIds: ReadonlySet<number>;
};

type ReversalDone = {
  linkIds: ReadonlySet<number>;
  folderIds: ReadonlySet<number>;
};

type ReversalLinkOutcome = "remove" | "unfiled" | "keep" | "deleted" | "done";

type ReversalFolderCheck = {
  checked: boolean | "indeterminate";
  disabled: boolean;
};

type ReversalCounts = {
  links: number;
  folders: number;
  moved: number;
};

const EMPTY_EXCLUSIONS: ReversalExclusions = { linkIds: new Set() };
const EMPTY_DONE: ReversalDone = { linkIds: new Set(), folderIds: new Set() };

const REMOVABLE_LINK_STATES: ReadonlySet<ReversalLinkState> = new Set(["IMPORTED", "EDITED"]);

function getFolderRank(kind: ImportFolderKind, state: ReversalFolderState) {
  if (kind === "UNFILED") return 0;
  if (kind === "EXISTING") return 1;
  if (state === "SHARED") return 2;
  return 3;
}

function getReversalFolderKey(
  folder: { kind: ImportFolderKind; folderId?: number | null },
  index: number,
) {
  if (folder.folderId != null) {
    return `folder-${folder.folderId}`;
  }
  return folder.kind === "UNFILED" ? "unfiled" : `${folder.kind.toLowerCase()}-${index}`;
}

function buildReversalFolders(
  preview: ImportReversalPreview | undefined,
  done: ReversalDone = EMPTY_DONE,
): ReversalFolderItem[] {
  if (!preview) {
    return [];
  }
  const items = preview.folders.flatMap((folder, index): ReversalFolderItem[] => {
    const folderId = folder.folderId ?? null;
    const isFolderDone =
      folder.state === "REVERSED" && folderId != null && done.folderIds.has(folderId);
    if (folder.state === "REVERSED" && !isFolderDone) {
      return [];
    }
    const links = folder.links
      .filter((link) => link.state !== "REVERSED" || done.linkIds.has(link.linkId))
      .map((link) => ({
        linkId: link.linkId,
        title: link.title,
        url: link.url,
        state: link.state,
        isDone: link.state === "REVERSED",
      }));
    const isRemovable = folder.kind === "NEW" && folder.state === "ACTIVE";
    if (links.length === 0 && !isRemovable && !isFolderDone) {
      return [];
    }
    return [
      {
        key: getReversalFolderKey(folder, index),
        kind: folder.kind,
        state: folder.state,
        folderId,
        name: folder.name,
        emoji: folder.emoji ?? null,
        isRemovable,
        isDone: isFolderDone,
        links,
      },
    ];
  });
  return items
    .map((item, index) => ({ item, index }))
    .sort(
      (a, b) =>
        getFolderRank(a.item.kind, a.item.state) - getFolderRank(b.item.kind, b.item.state) ||
        a.index - b.index,
    )
    .map(({ item }) => item);
}

function isLinkSelectable(link: ReversalLinkItem) {
  return REMOVABLE_LINK_STATES.has(link.state) && !link.isDone;
}

function isLinkSelected(link: ReversalLinkItem, exclusions: ReversalExclusions) {
  return isLinkSelectable(link) && !exclusions.linkIds.has(link.linkId);
}

function getSelectableLinks(folder: ReversalFolderItem) {
  return folder.links.filter(isLinkSelectable);
}

function getFolderSelectedCount(folder: ReversalFolderItem, exclusions: ReversalExclusions) {
  return folder.links.filter((link) => isLinkSelected(link, exclusions)).length;
}

function isFolderRemoved(folder: ReversalFolderItem, exclusions: ReversalExclusions) {
  return folder.isRemovable && getFolderSelectedCount(folder, exclusions) > 0;
}

function getFolderCheck(
  folder: ReversalFolderItem,
  exclusions: ReversalExclusions,
): ReversalFolderCheck {
  const selectable = getSelectableLinks(folder);
  const selected = getFolderSelectedCount(folder, exclusions);
  if (selectable.length === 0) {
    return { checked: false, disabled: true };
  }
  if (selected === selectable.length) return { checked: true, disabled: false };
  if (selected === 0) return { checked: false, disabled: false };
  return { checked: "indeterminate", disabled: false };
}

function withIds<T>(set: ReadonlySet<T>, ids: T[], include: boolean) {
  const next = new Set(set);
  for (const id of ids) {
    if (include) {
      next.add(id);
    } else {
      next.delete(id);
    }
  }
  return next;
}

function toggleReversalFolder(
  folder: ReversalFolderItem,
  exclusions: ReversalExclusions,
): ReversalExclusions {
  const check = getFolderCheck(folder, exclusions);
  if (check.disabled) {
    return exclusions;
  }
  const linkIds = getSelectableLinks(folder).map((link) => link.linkId);
  return { linkIds: withIds(exclusions.linkIds, linkIds, check.checked === true) };
}

function toggleReversalLink(
  folder: ReversalFolderItem,
  linkId: number,
  exclusions: ReversalExclusions,
): ReversalExclusions {
  const link = folder.links.find((item) => item.linkId === linkId);
  if (!link || !isLinkSelectable(link)) {
    return exclusions;
  }
  return { linkIds: withIds(exclusions.linkIds, [linkId], isLinkSelected(link, exclusions)) };
}

function getReversalLinkOutcome(
  folder: ReversalFolderItem,
  link: ReversalLinkItem,
  exclusions: ReversalExclusions,
): ReversalLinkOutcome {
  if (link.state === "DELETED") return "deleted";
  if (link.isDone) return "done";
  if (isLinkSelected(link, exclusions)) return "remove";
  return isFolderRemoved(folder, exclusions) ? "unfiled" : "keep";
}

function getReversalCounts(
  folders: ReversalFolderItem[],
  exclusions: ReversalExclusions,
): ReversalCounts {
  let links = 0;
  let removedFolders = 0;
  let moved = 0;
  for (const folder of folders) {
    const removed = isFolderRemoved(folder, exclusions);
    if (removed) removedFolders += 1;
    for (const link of folder.links) {
      const outcome = getReversalLinkOutcome(folder, link, exclusions);
      if (outcome === "remove") links += 1;
      if (outcome === "unfiled") moved += 1;
    }
  }
  return { links, folders: removedFolders, moved };
}

function buildReverseRequest(
  folders: ReversalFolderItem[],
  exclusions: ReversalExclusions,
): ReverseImportRequest {
  const linkIds: number[] = [];
  const folderIds: number[] = [];
  for (const folder of folders) {
    if (isFolderRemoved(folder, exclusions) && folder.folderId != null) {
      folderIds.push(folder.folderId);
    }
    for (const link of folder.links) {
      if (isLinkSelected(link, exclusions)) linkIds.push(link.linkId);
    }
  }
  return { linkIds, folderIds };
}

function hasReversibleItems(folders: ReversalFolderItem[]) {
  return folders.some((folder) => folder.links.some((link) => isLinkSelectable(link)));
}

function findReversedSince(
  initial: ImportReversalPreview | undefined,
  current: ImportReversalPreview | undefined,
): ReversalDone {
  if (!initial || !current) {
    return EMPTY_DONE;
  }
  const wasRemovableLink = new Set(
    initial.folders
      .flatMap((folder) => folder.links)
      .filter((link) => REMOVABLE_LINK_STATES.has(link.state))
      .map((link) => link.linkId),
  );
  const wasRemovableFolder = new Set(
    initial.folders
      .filter((folder) => folder.kind === "NEW" && folder.state === "ACTIVE")
      .flatMap((folder) => (folder.folderId != null ? [folder.folderId] : [])),
  );
  const linkIds = new Set(
    current.folders
      .flatMap((folder) => folder.links)
      .filter((link) => link.state === "REVERSED" && wasRemovableLink.has(link.linkId))
      .map((link) => link.linkId),
  );
  const folderIds = new Set(
    current.folders
      .filter(
        (folder) =>
          folder.state === "REVERSED" &&
          folder.folderId != null &&
          wasRemovableFolder.has(folder.folderId),
      )
      .flatMap((folder) => (folder.folderId != null ? [folder.folderId] : [])),
  );
  return { linkIds, folderIds };
}

export {
  EMPTY_EXCLUSIONS,
  buildReversalFolders,
  buildReverseRequest,
  findReversedSince,
  getFolderCheck,
  getFolderSelectedCount,
  getReversalCounts,
  getReversalLinkOutcome,
  hasReversibleItems,
  isFolderRemoved,
  isLinkSelectable,
  isLinkSelected,
  toggleReversalFolder,
  toggleReversalLink,
};
export type {
  ReversalCounts,
  ReversalDone,
  ReversalExclusions,
  ReversalFolderCheck,
  ReversalFolderItem,
  ReversalLinkItem,
  ReversalLinkOutcome,
};
