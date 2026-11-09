import type { ImportCandidates } from "./build-import-candidates";
import {
  describeImportRange,
  formatNumber,
  getImportRangeLabel,
  needsRangeSelection,
  selectImportRange,
  splitImportRanges,
} from "./split-import-ranges";

function makeCandidates(layout: [string | null, number][]): ImportCandidates {
  const folders: ImportCandidates["folders"] = [];
  const links: ImportCandidates["links"] = [];
  for (const [name, count] of layout) {
    let folderKey: string | null = null;
    if (name) {
      const existing = folders.find((folder) => folder.name === name);
      folderKey = existing?.key ?? `f${folders.length + 1}`;
      if (!existing) {
        folders.push({ key: folderKey, name, createdAt: null, sourcePath: name });
      }
    }
    for (let index = 0; index < count; index += 1) {
      const n = links.length + 1;
      links.push({
        key: `l${n}`,
        url: `https://example.com/${n}`,
        title: `링크 ${n}`,
        folderKey,
        createdAt: null,
      });
    }
  }
  return { folders, links, unsupported: [], duplicateCount: 0 };
}

describe("splitImportRanges", () => {
  it("needs no range selection for exactly 3,000 links", () => {
    const candidates = makeCandidates([["a", 3000]]);
    expect(needsRangeSelection(candidates)).toBe(false);
    expect(splitImportRanges(candidates)).toHaveLength(1);
  });

  it("splits 5,200 links into 1~3,000 and 3,001~5,200 in file order", () => {
    const candidates = makeCandidates([
      [null, 100],
      ["공부", 2000],
      ["자바", 2000],
      ["여행", 1100],
    ]);
    expect(needsRangeSelection(candidates)).toBe(true);

    const ranges = splitImportRanges(candidates);
    expect(ranges.map((range) => [range.start, range.end, range.count])).toEqual([
      [1, 3000, 3000],
      [3001, 5200, 2200],
    ]);
    expect(ranges.map(getImportRangeLabel)).toEqual(["1~3,000번째", "3,001~5,200번째"]);
    expect(ranges.map((range) => describeImportRange(range))).toEqual([
      "처음부터 ‘자바’ 폴더 중간까지",
      "‘자바’ 폴더 중간부터 끝까지 · 2,200개",
    ]);
  });

  it("says where a range starts when it begins at a new folder", () => {
    const candidates = makeCandidates([
      ["a", 3000],
      [null, 10],
    ]);
    const ranges = splitImportRanges(candidates);
    expect(describeImportRange(ranges[0])).toBe("처음부터 ‘a’ 폴더까지");
    expect(describeImportRange(ranges[1])).toBe("미분류 링크부터 끝까지 · 10개");
  });

  it("selects only the links of the range and the folders that hold them", () => {
    const candidates = makeCandidates([
      ["a", 2999],
      ["b", 2],
      ["c", 5],
    ]);
    const [, second] = splitImportRanges(candidates);
    const selected = selectImportRange(candidates, second);

    expect(selected.links.map((link) => link.key)).toEqual([
      "l3001",
      "l3002",
      "l3003",
      "l3004",
      "l3005",
      "l3006",
    ]);
    expect(selected.folders.map((folder) => folder.name)).toEqual(["b", "c"]);
  });

  it("formats numbers with commas", () => {
    expect(formatNumber(5200)).toBe("5,200");
    expect(formatNumber(999)).toBe("999");
    expect(formatNumber(1234567)).toBe("1,234,567");
  });
});
