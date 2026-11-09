import type { Folder } from "@/features/folders/types";

import type { ImportPreview } from "../types";
import type { ImportCandidates, ImportUnsupportedLink } from "./build-import-candidates";
import type { RenameCheck } from "./rename-check";

const UNFILED_TARGET = "unfiled";
const UNDO_LIMIT = 10;
const RECENT_LIMIT = 3;

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
  | { type: "remove-all"; folderName: string; count: number; excludedFolder: string | null }
  | { type: "restore-all"; folderName: string; count: number; includedFolder: string | null }
  | { type: "restore"; linkTitle: string; toName: string; includedFolder: string | null };

type ProposalNotice = { type: "rename-blocked"; name: string };

type ProposalSnapshot = {
  links: ProposalLink[];
  newFolders: ProposalNewFolder[];
};

type ProposalHistoryEntry = {
  snapshot: ProposalSnapshot;
  change: ProposalChange;
};

type ProposalStatusMode = "change" | "undone" | "notice" | "hidden";

type ProposalState = ProposalSnapshot & {
  existingNames: Record<number, string>;
  skipped: ProposalSkippedLink[];
  unsupported: ImportUnsupportedLink[];
  initialSignature: string;
  history: ProposalHistoryEntry[];
  statusMode: ProposalStatusMode;
  notice: ProposalNotice | null;
  recentTargets: ProposalTarget[];
  pickerNames: Record<ProposalTarget, string>;
  nextPickerIndex: number;
};

type ProposalAction =
  | { type: "move"; linkKey: string; target: ProposalTarget; targetName: string }
  | { type: "remove"; linkKey: string }
  | { type: "remove-all"; target: ProposalTarget }
  | { type: "restore-all"; target: ProposalTarget }
  | { type: "restore"; linkKey: string }
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
  removedCount: number;
};

type ProposalStatusLine =
  | { kind: "change"; change: ProposalChange; isAfterUndo: boolean; depth: number }
  | { kind: "notice"; notice: ProposalNotice };

type ProposalRemovedGroup = {
  target: ProposalTarget;
  restoreTarget: ProposalTarget;
  isGone: boolean;
  links: ProposalLink[];
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
    history: [],
    statusMode: "hidden",
    notice: null,
    recentTargets: [],
    pickerNames: {},
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
  return (
    state.newFolders.find((folder) => folder.target === target)?.name ??
    state.pickerNames[target] ??
    ""
  );
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

function isReceivingTarget(state: ProposalState, target: ProposalTarget) {
  if (target === UNFILED_TARGET) {
    return true;
  }
  const existingId = getExistingFolderId(target);
  if (existingId != null) {
    return state.existingNames[existingId] != null;
  }
  return state.newFolders.some((folder) => folder.target === target);
}

function getRestoreTarget(state: ProposalState, target: ProposalTarget) {
  return isReceivingTarget(state, target) ? target : UNFILED_TARGET;
}

function getIncludedFolderName(state: ProposalState, destination: ProposalTarget) {
  if (!isNewTarget(destination) || countTargetLinks(state, destination) > 0) {
    return null;
  }
  return state.newFolders.find((folder) => folder.target === destination)?.name ?? null;
}

function pushChange(
  state: ProposalState,
  next: Partial<ProposalState>,
  change: ProposalChange,
): ProposalState {
  const history = [...state.history, { snapshot: takeSnapshot(state), change }].slice(-UNDO_LIMIT);
  return { ...state, ...next, history, statusMode: "change", notice: null };
}

function rememberTarget(recent: ProposalTarget[], target: ProposalTarget) {
  return [target, ...recent.filter((item) => item !== target)].slice(0, RECENT_LIMIT);
}

function restoreSnapshot(state: ProposalState, snapshot: ProposalSnapshot): ProposalSnapshot {
  const currentNames = new Map(state.newFolders.map((folder) => [folder.target, folder.name]));
  const newFolders = snapshot.newFolders.map((folder) => {
    const name = currentNames.get(folder.target);
    return name == null || name === folder.name ? folder : { ...folder, name };
  });
  const restored = { links: snapshot.links, newFolders };
  return { links: restored.links, newFolders: dropUnusedPickerFolders(restored) };
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
      return pushChange(
        state,
        { links, recentTargets: rememberTarget(state.recentTargets, action.target) },
        {
          type: "move",
          linkTitle: link.title,
          toName: action.targetName,
          excludedFolder: getExcludedFolderName(next, link.target),
        },
      );
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
      return pushChange(
        state,
        { links },
        {
          type: "remove",
          linkTitle: link.title,
          excludedFolder: getExcludedFolderName(next, link.target),
        },
      );
    }
    case "remove-all": {
      const count = countTargetLinks(state, action.target);
      if (count === 0) {
        return state;
      }
      const links = state.links.map((item) =>
        !item.isRemoved && item.target === action.target ? { ...item, isRemoved: true } : item,
      );
      return pushChange(
        state,
        { links },
        {
          type: "remove-all",
          folderName: getTargetName(state, action.target),
          count,
          excludedFolder: isNewTarget(action.target) ? getTargetName(state, action.target) : null,
        },
      );
    }
    case "restore-all": {
      const destination = getRestoreTarget(state, action.target);
      let count = 0;
      const links = state.links.map((item) => {
        if (!item.isRemoved || item.target !== action.target) {
          return item;
        }
        count += 1;
        return { ...item, target: destination, isRemoved: false };
      });
      if (count === 0) {
        return state;
      }
      return pushChange(
        state,
        { links },
        {
          type: "restore-all",
          folderName: getTargetName(state, destination),
          count,
          includedFolder: getIncludedFolderName(state, destination),
        },
      );
    }
    case "restore": {
      const link = state.links.find((item) => item.key === action.linkKey);
      if (!link || !link.isRemoved) {
        return state;
      }
      const destination = getRestoreTarget(state, link.target);
      const links = state.links.map((item) =>
        item.key === action.linkKey ? { ...item, target: destination, isRemoved: false } : item,
      );
      return pushChange(
        state,
        { links },
        {
          type: "restore",
          linkTitle: link.title,
          toName: getTargetName(state, destination),
          includedFolder: getIncludedFolderName(state, destination),
        },
      );
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
        return {
          ...state,
          statusMode: "notice",
          notice: { type: "rename-blocked", name: folder.name },
        };
      }
      if (check.type === "ok") {
        return {
          ...state,
          newFolders: state.newFolders.map((item) =>
            item.target === action.target ? { ...item, name: check.name } : item,
          ),
          pickerNames:
            folder.origin === "picker"
              ? { ...state.pickerNames, [action.target]: check.name }
              : state.pickerNames,
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
      return pushChange(
        state,
        {
          links,
          newFolders: state.newFolders.filter((item) => item.target !== action.target),
          existingNames:
            check.type === "merge-existing"
              ? { ...state.existingNames, [check.folderId]: check.name }
              : state.existingNames,
          recentTargets: state.recentTargets.map((item) =>
            item === action.target ? destination : item,
          ),
        },
        {
          type: "merge",
          fromName: folder.name,
          count,
          toKind: check.type === "merge-existing" ? "existing" : "new",
          toName: check.name,
        },
      );
    }
    case "add-picker-folder": {
      const target = getNewTarget(`p${state.nextPickerIndex}`);
      return {
        ...state,
        pickerNames: { ...state.pickerNames, [target]: action.name },
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
      const entry = state.history[state.history.length - 1];
      if (!entry) {
        return state;
      }
      const history = state.history.slice(0, -1);
      return {
        ...state,
        ...restoreSnapshot(state, entry.snapshot),
        history,
        statusMode: history.length > 0 ? "undone" : "hidden",
        notice: null,
      };
    }
    case "dismiss-change":
      return state.statusMode === "hidden"
        ? state
        : { ...state, statusMode: "hidden", notice: null };
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
    removedCount: state.links.length - addCount,
  };
}

function getStatusLine(state: ProposalState): ProposalStatusLine | null {
  if (state.statusMode === "notice" && state.notice) {
    return { kind: "notice", notice: state.notice };
  }
  const entry = state.history[state.history.length - 1];
  if (!entry || (state.statusMode !== "change" && state.statusMode !== "undone")) {
    return null;
  }
  return {
    kind: "change",
    change: entry.change,
    isAfterUndo: state.statusMode === "undone",
    depth: state.history.length,
  };
}

function getRemovedLinkCount(state: ProposalState, target: ProposalTarget) {
  let count = 0;
  for (const link of state.links) {
    if (link.isRemoved && link.target === target) {
      count += 1;
    }
  }
  return count;
}

function getRemovedGroups(
  state: ProposalState,
  order: readonly ProposalTarget[],
): ProposalRemovedGroup[] {
  const byTarget = new Map<ProposalTarget, ProposalLink[]>();
  for (const link of state.links) {
    if (link.isRemoved) {
      const list = byTarget.get(link.target);
      if (list) {
        list.push(link);
      } else {
        byTarget.set(link.target, [link]);
      }
    }
  }
  const rank = new Map(order.map((target, index) => [target, index]));
  return [...byTarget.entries()]
    .sort(([a], [b]) => (rank.get(a) ?? order.length) - (rank.get(b) ?? order.length))
    .map(([target, links]) => {
      const restoreTarget = getRestoreTarget(state, target);
      return { target, restoreTarget, isGone: restoreTarget !== target, links };
    });
}

function getRecentTargets(state: ProposalState) {
  return state.recentTargets.filter((target) => isReceivingTarget(state, target));
}

function isProposalDirty(state: ProposalState) {
  return getSignature(state) !== state.initialSignature;
}

export {
  UNDO_LIMIT,
  UNFILED_TARGET,
  countTargetLinks,
  createProposalState,
  getActiveLinks,
  getExistingFolderId,
  getExistingTarget,
  getLastPickerTarget,
  getNewTarget,
  getProposalSummary,
  getRecentTargets,
  getRemovedGroups,
  getRemovedLinkCount,
  getStatusLine,
  getTargetName,
  isNewTarget,
  isProposalDirty,
  proposalReducer,
};
export type {
  CreateProposalStateInput,
  ProposalAction,
  ProposalChange,
  ProposalHistoryEntry,
  ProposalLink,
  ProposalNewFolder,
  ProposalNewFolderOrigin,
  ProposalNotice,
  ProposalRemovedGroup,
  ProposalSkippedLink,
  ProposalState,
  ProposalStatusLine,
  ProposalSummary,
  ProposalTarget,
};
