import type { Folder } from "@/features/folders/types";

import {
  type ProposalNewFolder,
  type ProposalState,
  type ProposalTarget,
  UNFILED_TARGET,
  getExistingTarget,
} from "../../lib/proposal-state";

type ProposalFolderEntries = {
  unfiled: { target: ProposalTarget; addCount: number };
  mine: { target: ProposalTarget; folder: Folder; addCount: number }[];
  shared: { folder: Folder; conflictTarget: ProposalTarget | null }[];
  added: { target: ProposalTarget; folder: ProposalNewFolder; addCount: number }[];
};

type ProposalSelection =
  | { kind: "target"; target: ProposalTarget }
  | { kind: "shared"; folderId: number }
  | { kind: "skipped" }
  | { kind: "unsupported" }
  | { kind: "removed" };

function getProposalFolders(
  state: ProposalState,
  myFolders: readonly Folder[],
): ProposalFolderEntries {
  const counts = new Map<ProposalTarget, number>();
  for (const link of state.links) {
    if (!link.isRemoved) {
      counts.set(link.target, (counts.get(link.target) ?? 0) + 1);
    }
  }
  const conflictByName = new Map<string, ProposalTarget>();
  for (const folder of state.newFolders) {
    if (folder.conflictWith) {
      conflictByName.set(folder.conflictWith, folder.target);
    }
  }
  return {
    unfiled: { target: UNFILED_TARGET, addCount: counts.get(UNFILED_TARGET) ?? 0 },
    mine: myFolders
      .filter((folder) => !folder.isShared)
      .map((folder) => {
        const target = getExistingTarget(folder.id);
        return { target, folder, addCount: counts.get(target) ?? 0 };
      }),
    shared: myFolders
      .filter((folder) => folder.isShared)
      .map((folder) => ({
        folder,
        conflictTarget: conflictByName.get(folder.name.trim()) ?? null,
      })),
    added: state.newFolders.map((folder) => ({
      target: folder.target,
      folder,
      addCount: counts.get(folder.target) ?? 0,
    })),
  };
}

function getInitialSelection(entries: ProposalFolderEntries): ProposalSelection {
  if (entries.unfiled.addCount > 0) {
    return { kind: "target", target: entries.unfiled.target };
  }
  const first =
    entries.mine.find((entry) => entry.addCount > 0) ??
    entries.added.find((entry) => entry.addCount > 0);
  return { kind: "target", target: first?.target ?? UNFILED_TARGET };
}

function isSameSelection(a: ProposalSelection | null, b: ProposalSelection) {
  if (!a || a.kind !== b.kind) {
    return false;
  }
  if (a.kind === "target" && b.kind === "target") {
    return a.target === b.target;
  }
  if (a.kind === "shared" && b.kind === "shared") {
    return a.folderId === b.folderId;
  }
  return true;
}

export { getInitialSelection, getProposalFolders, isSameSelection };
export type { ProposalFolderEntries, ProposalSelection };
