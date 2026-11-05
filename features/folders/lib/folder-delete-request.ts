import type { DeleteFolderParams } from "../types";

/** How the caller's links are handled: (a) move or detach, (b) delete with the folder. */
type FolderLinkChoice = "keep" | "delete";

type FolderDeleteRequestInput = {
  isShared: boolean;
  choice: FolderLinkChoice;
  /** Personal (a) target; `null` is 미분류. Ignored for shared folders and for (b). */
  targetFolderId: number | null;
};

/**
 * Maps the confirm's choice to the delete query (#165 section 2):
 * personal (a) 미분류 → detach, personal (a) folder → `move` + target, (b) → `cascade`,
 * shared (a) → detach.
 */
function buildFolderDeleteParams({
  isShared,
  choice,
  targetFolderId,
}: FolderDeleteRequestInput): DeleteFolderParams {
  if (choice === "delete") {
    return { onDelete: "cascade" };
  }
  if (isShared || targetFolderId == null) {
    return {};
  }
  return { onDelete: "move", targetFolderId };
}

type FolderLinkCounts = {
  /** Every link in the folder (`linkCounts`). */
  total: number;
  /** The caller's links (`myLinkCounts`). */
  mine: number;
  /** Links other users put in (`linkCounts - myLinkCounts`). */
  others: number;
};

function getFolderLinkCounts(folder: { linkCounts: number; myLinkCounts: number }) {
  const total = Math.max(0, folder.linkCounts);
  const mine = Math.min(total, Math.max(0, folder.myLinkCounts));
  return { total, mine, others: total - mine } satisfies FolderLinkCounts;
}

/**
 * Whether the delete needs the folder name typed again: personal (b) with own links, or a
 * shared folder that has links or other members.
 */
function needsFolderNameConfirm(
  input:
    | { isShared: false; choice: FolderLinkChoice; myLinkCount: number }
    | { isShared: true; linkCount: number; otherMemberCount: number },
) {
  if (input.isShared) {
    return input.linkCount > 0 || input.otherMemberCount > 0;
  }
  return input.choice === "delete" && input.myLinkCount > 0;
}

export { buildFolderDeleteParams, getFolderLinkCounts, needsFolderNameConfirm };
export type { FolderDeleteRequestInput, FolderLinkChoice, FolderLinkCounts };
