import type { Folder } from "@/features/folders/types";

import type { ImportPreview } from "../types";
import type { ImportCandidates, ImportUnsupportedLink } from "./build-import-candidates";
import type { RenameCheck } from "./rename-check";

const UNFILED_TARGET = "unfiled";

type ProposalTarget = string;

type ProposalLink = {
  key: string;
  url: string;
  title: string;
  createdAt: string | null;
  target: ProposalTarget;
  isRemoved: boolean;
};

type ProposalNewFolderOrigin = "file" | "picker";

type ProposalNewFolder = {
  target: ProposalTarget;
  name: string;
  originalName: string;
  sourcePath: string | null;
  createdAt: string | null;
  conflictWith: string | null;
  origin: ProposalNewFolderOrigin;
};

type ProposalSkippedLink = {
  key: string;
  url: string;
  title: string;
};

type ProposalChange =
  | { type: "remove"; linkTitle: string; excludedFolder: string | null }
  | { type: "move"; linkTitle: string; toName: string; excludedFolder: string | null }
  | { type: "merge"; fromName: string; count: number; toKind: "existing" | "new"; toName: string }
  | { type: "rename-blocked"; name: string };

type ProposalSnapshot = {
  links: ProposalLink[];
  newFolders: ProposalNewFolder[];
};

type ProposalState = ProposalSnapshot & {
  existingNames: Record<number, string>;
  skipped: ProposalSkippedLink[];
  unsupported: ImportUnsupportedLink[];
  initialSignature: string;
  undo: ProposalSnapshot | null;
  lastChange: ProposalChange | null;
  nextPickerIndex: number;
};

type ProposalAction =
  | { type: "move"; linkKey: string; target: ProposalTarget; targetName: string }
  | { type: "remove"; linkKey: string }
  | { type: "rename"; target: ProposalTarget; check: RenameCheck }
  | { type: "add-picker-folder"; name: string }
  | { type: "discard-unused-picker-folders" }
  | { type: "undo" }
  | { type: "dismiss-change" };

type ProposalSummary = {
  addCount: number;
  newFolderCount: number;
  skipCount: number;
  unsupportedCount: number;
};

function getExistingTarget(folderId: number) {
  return `existing:${folderId}`;
}

function getNewTarget(key: string) {
  return `new:${key}`;
}

function getExistingFolderId(target: ProposalTarget) {
  return target.startsWith("existing:") ? Number(target.slice("existing:".length)) : null;
}

function isNewTarget(target: ProposalTarget) {
  return target.startsWith("new:");
}

function getActiveLinks(state: ProposalSnapshot, target: ProposalTarget) {
  return state.links.filter((link) => !link.isRemoved && link.target === target);
}

function countTargetLinks(state: ProposalSnapshot, target: ProposalTarget) {
  let count = 0;
  for (const link of state.links) {
    if (!link.isRemoved && link.target === target) {
      count += 1;
    }
  }
  return count;
}

function getSignature(state: ProposalSnapshot) {
  const links = state.links.map((link) => [link.key, link.target, link.isRemoved]);
  const folders = state.newFolders
    .filter((folder) => folder.origin === "file" || countTargetLinks(state, folder.target) > 0)
    .map((folder) => [folder.target, folder.name]);
  return JSON.stringify([links, folders]);
}

type CreateProposalStateInput = {
  candidates: ImportCandidates;
  preview: ImportPreview;
  myFolders: readonly Folder[];
};

function createProposalState({
  candidates,
  preview,
  myFolders,
}: CreateProposalStateInput): ProposalState {
  const previewFolders = new Map(preview.folders.map((folder) => [folder.key, folder]));
  const previewLinks = new Map(preview.links.map((link) => [link.key, link.status]));
  const myFolderIds = new Set(myFolders.filter((folder) => !folder.isShared).map((f) => f.id));
  const existingNames: Record<number, string> = {};
  for (const folder of myFolders) {
    if (!folder.isShared) {
      existingNames[folder.id] = folder.name;
    }
  }

  const targetByFolderKey = new Map<string, ProposalTarget>();
  const newFolders: ProposalNewFolder[] = [];
  for (const folder of candidates.folders) {
    const match = previewFolders.get(folder.key);
    const folderId = match?.folderId ?? null;
    if (match?.matchType === "EXISTING" && folderId != null && myFolderIds.has(folderId)) {
      targetByFolderKey.set(folder.key, getExistingTarget(folderId));
      continue;
    }
    const target = getNewTarget(folder.key);
    targetByFolderKey.set(folder.key, target);
    const name = match?.suggestedName || folder.name;
    newFolders.push({
      target,
      name,
      originalName: name,
      sourcePath: folder.sourcePath,
      createdAt: folder.createdAt,
      conflictWith: match?.matchType === "SHARED_CONFLICT" ? folder.name : null,
      origin: "file",
    });
  }

  const links: ProposalLink[] = [];
  const skipped: ProposalSkippedLink[] = [];
  for (const link of candidates.links) {
    const status = previewLinks.get(link.key) ?? "NEW";
    if (status === "IN_FILE_DUPLICATE") {
      continue;
    }
    if (status === "SAVED") {
      skipped.push({ key: link.key, url: link.url, title: link.title });
      continue;
    }
    links.push({
      key: link.key,
      url: link.url,
      title: link.title,
      createdAt: link.createdAt,
      target: link.folderKey
        ? (targetByFolderKey.get(link.folderKey) ?? UNFILED_TARGET)
        : UNFILED_TARGET,
      isRemoved: false,
    });
  }

  const snapshot: ProposalSnapshot = {
    links,
    newFolders: newFolders.filter((folder) => links.some((link) => link.target === folder.target)),
  };

  return {
    ...snapshot,
    existingNames,
    skipped,
    unsupported: candidates.unsupported,
    initialSignature: getSignature(snapshot),
    undo: null,
    lastChange: null,
    nextPickerIndex: 1,
  };
}

function getTargetName(state: ProposalState, target: ProposalTarget) {
  if (target === UNFILED_TARGET) {
    return "미분류";
  }
  const existingId = getExistingFolderId(target);
  if (existingId != null) {
    return state.existingNames[existingId] ?? "";
  }
  return state.newFolders.find((folder) => folder.target === target)?.name ?? "";
}

function getExcludedFolderName(next: ProposalSnapshot, source: ProposalTarget) {
  if (!isNewTarget(source) || countTargetLinks(next, source) > 0) {
    return null;
  }
  return next.newFolders.find((folder) => folder.target === source)?.name ?? null;
}

function takeSnapshot(state: ProposalState): ProposalSnapshot {
  return { links: state.links, newFolders: state.newFolders };
}

function dropUnusedPickerFolders(state: ProposalSnapshot): ProposalNewFolder[] {
  return state.newFolders.filter(
    (folder) => folder.origin === "file" || countTargetLinks(state, folder.target) > 0,
  );
}

function proposalReducer(state: ProposalState, action: ProposalAction): ProposalState {
  switch (action.type) {
    case "move": {
      const link = state.links.find((item) => item.key === action.linkKey);
      if (!link || link.isRemoved || link.target === action.target) {
        return state;
      }
      const links = state.links.map((item) =>
        item.key === action.linkKey ? { ...item, target: action.target } : item,
      );
      const next = { links, newFolders: state.newFolders };
      return {
        ...state,
        links,
        undo: takeSnapshot(state),
        lastChange: {
          type: "move",
          linkTitle: link.title,
          toName: action.targetName,
          excludedFolder: getExcludedFolderName(next, link.target),
        },
      };
    }
    case "remove": {
      const link = state.links.find((item) => item.key === action.linkKey);
      if (!link || link.isRemoved) {
        return state;
      }
      const links = state.links.map((item) =>
        item.key === action.linkKey ? { ...item, isRemoved: true } : item,
      );
      const next = { links, newFolders: state.newFolders };
      return {
        ...state,
        links,
        undo: takeSnapshot(state),
        lastChange: {
          type: "remove",
          linkTitle: link.title,
          excludedFolder: getExcludedFolderName(next, link.target),
        },
      };
    }
    case "rename": {
      const folder = state.newFolders.find((item) => item.target === action.target);
      if (!folder) {
        return state;
      }
      const { check } = action;
      if (check.type === "blank" || check.type === "same") {
        return state;
      }
      if (check.type === "blocked") {
        return { ...state, lastChange: { type: "rename-blocked", name: folder.name } };
      }
      if (check.type === "ok") {
        return {
          ...state,
          newFolders: state.newFolders.map((item) =>
            item.target === action.target ? { ...item, name: check.name } : item,
          ),
          undo: null,
          lastChange: null,
        };
      }
      const destination =
        check.type === "merge-existing" ? getExistingTarget(check.folderId) : check.target;
      let count = 0;
      const links = state.links.map((link) => {
        if (link.target !== action.target) {
          return link;
        }
        if (!link.isRemoved) {
          count += 1;
        }
        return { ...link, target: destination };
      });
      if (check.type === "merge-existing" && state.existingNames[check.folderId] == null) {
        return state;
      }
      return {
        ...state,
        links,
        newFolders: state.newFolders.filter((item) => item.target !== action.target),
        existingNames:
          check.type === "merge-existing"
            ? { ...state.existingNames, [check.folderId]: check.name }
            : state.existingNames,
        undo: takeSnapshot(state),
        lastChange: {
          type: "merge",
          fromName: folder.name,
          count,
          toKind: check.type === "merge-existing" ? "existing" : "new",
          toName: check.name,
        },
      };
    }
    case "add-picker-folder": {
      const target = getNewTarget(`p${state.nextPickerIndex}`);
      return {
        ...state,
        nextPickerIndex: state.nextPickerIndex + 1,
        newFolders: [
          ...state.newFolders,
          {
            target,
            name: action.name,
            originalName: action.name,
            sourcePath: null,
            createdAt: null,
            conflictWith: null,
            origin: "picker",
          },
        ],
      };
    }
    case "discard-unused-picker-folders": {
      const newFolders = dropUnusedPickerFolders(state);
      return newFolders.length === state.newFolders.length ? state : { ...state, newFolders };
    }
    case "undo": {
      if (!state.undo) {
        return state;
      }
      const restored = { links: state.undo.links, newFolders: state.undo.newFolders };
      return {
        ...state,
        links: restored.links,
        newFolders: dropUnusedPickerFolders(restored),
        undo: null,
        lastChange: null,
      };
    }
    case "dismiss-change":
      return state.lastChange ? { ...state, lastChange: null, undo: null } : state;
    default:
      return state;
  }
}

function getLastPickerTarget(state: ProposalState) {
  return getNewTarget(`p${state.nextPickerIndex - 1}`);
}

function getProposalSummary(state: ProposalState): ProposalSummary {
  const activeTargets = new Set<ProposalTarget>();
  let addCount = 0;
  for (const link of state.links) {
    if (!link.isRemoved) {
      addCount += 1;
      activeTargets.add(link.target);
    }
  }
  return {
    addCount,
    newFolderCount: state.newFolders.filter((folder) => activeTargets.has(folder.target)).length,
    skipCount: state.skipped.length,
    unsupportedCount: state.unsupported.length,
  };
}

function isProposalDirty(state: ProposalState) {
  return getSignature(state) !== state.initialSignature;
}

export {
  UNFILED_TARGET,
  countTargetLinks,
  createProposalState,
  getActiveLinks,
  getExistingFolderId,
  getExistingTarget,
  getLastPickerTarget,
  getNewTarget,
  getProposalSummary,
  getTargetName,
  isNewTarget,
  isProposalDirty,
  proposalReducer,
};
export type {
  CreateProposalStateInput,
  ProposalAction,
  ProposalChange,
  ProposalLink,
  ProposalNewFolder,
  ProposalNewFolderOrigin,
  ProposalSkippedLink,
  ProposalState,
  ProposalSummary,
  ProposalTarget,
};
