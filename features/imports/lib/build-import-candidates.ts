import { isHttpUrl, normalizeImportUrl } from "./normalize-import-url";

type BookmarkLinkNode = {
  type: "link";
  title: string;
  url: string;
  addDate: string | null;
};

type BookmarkFolderNode = {
  type: "folder";
  name: string;
  addDate: string | null;
  isToolbar: boolean;
  children: BookmarkNode[];
};

type BookmarkNode = BookmarkLinkNode | BookmarkFolderNode;

type BookmarkTree = {
  children: BookmarkNode[];
};

type ImportCandidateFolder = {
  key: string;
  name: string;
  createdAt: string | null;
  sourcePath: string;
};

type ImportCandidateLink = {
  key: string;
  url: string;
  title: string;
  folderKey: string | null;
  createdAt: string | null;
};

type ImportUnsupportedReason = "NOT_HTTP";

type ImportUnsupportedLink = {
  title: string;
  url: string;
  path: string;
  reason: ImportUnsupportedReason;
};

type ImportCandidates = {
  folders: ImportCandidateFolder[];
  links: ImportCandidateLink[];
  unsupported: ImportUnsupportedLink[];
  duplicateCount: number;
};

const LINK_TITLE_MAX = 300;
const FOLDER_NAME_MAX = 100;
const UNNAMED_FOLDER = "이름 없는 폴더";
const ROOT_PATH_LABEL = "최상위";
const PATH_SEPARATOR = " / ";

function truncateUtf16(text: string, max: number) {
  if (text.length <= max) {
    return text;
  }
  const cut = text.slice(0, max);
  const last = cut.charCodeAt(cut.length - 1);
  return last >= 0xd800 && last <= 0xdbff ? cut.slice(0, -1) : cut;
}

function toFolderName(raw: string) {
  const trimmed = raw.trim().normalize("NFC");
  return truncateUtf16(trimmed || UNNAMED_FOLDER, FOLDER_NAME_MAX).trim();
}

function decodePath(path: string) {
  try {
    return decodeURI(path);
  } catch {
    return path;
  }
}

function getTitleFallback(url: string) {
  try {
    const parsed = new URL(url.trim());
    const path = parsed.pathname === "/" ? "" : decodePath(parsed.pathname);
    return `${parsed.host}${path}`;
  } catch {
    return url.trim();
  }
}

function toLinkTitle(rawTitle: string, url: string) {
  const trimmed = rawTitle.trim();
  return truncateUtf16(trimmed || getTitleFallback(url), LINK_TITLE_MAX);
}

function parseAddDate(raw: string | null, now: number): number | null {
  if (raw == null || raw.trim() === "") {
    return null;
  }
  const value = Number(raw.trim());
  if (!Number.isFinite(value) || value <= 0) {
    return null;
  }
  const ms = value > 1e14 ? value / 1000 : value > 1e11 ? value : value * 1000;
  return ms > now ? null : Math.floor(ms);
}

function toIso(ms: number | null) {
  return ms == null ? null : new Date(ms).toISOString();
}

function formatPath(segments: string[]) {
  return segments.length === 0 ? ROOT_PATH_LABEL : segments.join(PATH_SEPARATOR);
}

type FolderAccumulator = {
  key: string;
  name: string;
  createdAtMs: number | null;
  sourcePath: string;
};

type WalkContext = {
  segments: string[];
  folder: BookmarkFolderNode | null;
};

function buildImportCandidates(tree: BookmarkTree, now = Date.now()): ImportCandidates {
  const folders = new Map<string, FolderAccumulator>();
  const links: ImportCandidateLink[] = [];
  const unsupported: ImportUnsupportedLink[] = [];
  const seenUrls = new Set<string>();
  let duplicateCount = 0;

  function resolveFolderKey(context: WalkContext) {
    const { folder } = context;
    if (!folder || folder.isToolbar) {
      return null;
    }
    const name = toFolderName(folder.name);
    const createdAtMs = parseAddDate(folder.addDate, now);
    const existing = folders.get(name);
    if (existing) {
      if (
        createdAtMs != null &&
        (existing.createdAtMs == null || createdAtMs < existing.createdAtMs)
      ) {
        existing.createdAtMs = createdAtMs;
      }
      return existing.key;
    }
    const key = `f${folders.size + 1}`;
    folders.set(name, {
      key,
      name,
      createdAtMs,
      sourcePath: context.segments.join(PATH_SEPARATOR),
    });
    return key;
  }

  function visitLink(node: BookmarkLinkNode, context: WalkContext) {
    const url = node.url.trim();
    if (!isHttpUrl(url)) {
      unsupported.push({
        title: node.title.trim() || url,
        url,
        path: formatPath(context.segments),
        reason: "NOT_HTTP",
      });
      return;
    }
    const normalized = normalizeImportUrl(url);
    if (normalized != null) {
      if (seenUrls.has(normalized)) {
        duplicateCount += 1;
        return;
      }
      seenUrls.add(normalized);
    }
    links.push({
      key: `l${links.length + 1}`,
      url,
      title: toLinkTitle(node.title, url),
      folderKey: resolveFolderKey(context),
      createdAt: toIso(parseAddDate(node.addDate, now)),
    });
  }

  function walk(nodes: BookmarkNode[], context: WalkContext) {
    for (const node of nodes) {
      if (node.type === "link") {
        visitLink(node, context);
        continue;
      }
      walk(node.children, {
        segments: [...context.segments, node.name.trim() || UNNAMED_FOLDER],
        folder: node,
      });
    }
  }

  walk(tree.children, { segments: [], folder: null });

  return {
    folders: [...folders.values()].map((folder) => ({
      key: folder.key,
      name: folder.name,
      createdAt: toIso(folder.createdAtMs),
      sourcePath: folder.sourcePath,
    })),
    links,
    unsupported,
    duplicateCount,
  };
}

export {
  FOLDER_NAME_MAX,
  LINK_TITLE_MAX,
  UNNAMED_FOLDER,
  buildImportCandidates,
  toFolderName,
  truncateUtf16,
};
export type {
  BookmarkFolderNode,
  BookmarkLinkNode,
  BookmarkNode,
  BookmarkTree,
  ImportCandidateFolder,
  ImportCandidateLink,
  ImportCandidates,
  ImportUnsupportedLink,
  ImportUnsupportedReason,
};
