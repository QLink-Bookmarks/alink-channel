import type { ImportCandidateLink, ImportCandidates } from "./build-import-candidates";

const IMPORT_RANGE_SIZE = 3000;

type ImportRangePlace =
  | { kind: "edge" }
  | { kind: "unfiled" }
  | { kind: "folder"; name: string; isMiddle: boolean };

type ImportRange = {
  index: number;
  start: number;
  end: number;
  count: number;
  from: ImportRangePlace;
  to: ImportRangePlace;
};

function formatNumber(value: number) {
  return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function needsRangeSelection(candidates: ImportCandidates, size = IMPORT_RANGE_SIZE) {
  return candidates.links.length > size;
}

function getPlace(
  links: ImportCandidateLink[],
  position: number,
  folderNames: Map<string, string>,
  side: "from" | "to",
): ImportRangePlace {
  const link = links[position];
  if (!link.folderKey) {
    return { kind: "unfiled" };
  }
  const neighbours = side === "from" ? links.slice(0, position) : links.slice(position + 1);
  return {
    kind: "folder",
    name: folderNames.get(link.folderKey) ?? "",
    isMiddle: neighbours.some((other) => other.folderKey === link.folderKey),
  };
}

function splitImportRanges(candidates: ImportCandidates, size = IMPORT_RANGE_SIZE): ImportRange[] {
  const { links } = candidates;
  const folderNames = new Map(candidates.folders.map((folder) => [folder.key, folder.name]));
  const ranges: ImportRange[] = [];
  for (let offset = 0; offset < links.length; offset += size) {
    const endIndex = Math.min(offset + size, links.length) - 1;
    ranges.push({
      index: ranges.length,
      start: offset + 1,
      end: endIndex + 1,
      count: endIndex - offset + 1,
      from: offset === 0 ? { kind: "edge" } : getPlace(links, offset, folderNames, "from"),
      to:
        endIndex === links.length - 1
          ? { kind: "edge" }
          : getPlace(links, endIndex, folderNames, "to"),
    });
  }
  return ranges;
}

function selectImportRange(candidates: ImportCandidates, range: ImportRange): ImportCandidates {
  const links = candidates.links.slice(range.start - 1, range.end);
  const usedFolderKeys = new Set(links.map((link) => link.folderKey));
  return {
    ...candidates,
    links,
    folders: candidates.folders.filter((folder) => usedFolderKeys.has(folder.key)),
  };
}

function describePlace(place: ImportRangePlace, edgeText: string) {
  if (place.kind === "edge") {
    return edgeText;
  }
  if (place.kind === "unfiled") {
    return "미분류 링크";
  }
  return `‘${place.name}’ 폴더${place.isMiddle ? " 중간" : ""}`;
}

function getImportRangeLabel(range: ImportRange) {
  return `${formatNumber(range.start)}~${formatNumber(range.end)}번째`;
}

function describeImportRange(range: ImportRange, size = IMPORT_RANGE_SIZE) {
  const text = `${describePlace(range.from, "처음")}부터 ${describePlace(range.to, "끝")}까지`;
  return range.count < size ? `${text} · ${formatNumber(range.count)}개` : text;
}

export {
  IMPORT_RANGE_SIZE,
  describeImportRange,
  formatNumber,
  getImportRangeLabel,
  needsRangeSelection,
  selectImportRange,
  splitImportRanges,
};
export type { ImportRange, ImportRangePlace };
