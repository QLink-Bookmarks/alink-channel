import {
  type BookmarkFolderNode,
  type BookmarkLinkNode,
  type BookmarkNode,
  buildImportCandidates,
  truncateUtf16,
} from "./build-import-candidates";

const NOW = Date.UTC(2026, 10, 3, 9, 0, 0);
const SEC_2024 = String(Date.UTC(2024, 0, 2, 3, 4, 5) / 1000);
const SEC_2023 = String(Date.UTC(2023, 5, 1) / 1000);
const SEC_FUTURE = String(Date.UTC(2030, 0, 1) / 1000);

function link(title: string, url: string, addDate: string | null = null): BookmarkLinkNode {
  return { type: "link", title, url, addDate };
}

function folder(
  name: string,
  children: BookmarkNode[],
  options: { addDate?: string | null; isToolbar?: boolean } = {},
): BookmarkFolderNode {
  return {
    type: "folder",
    name,
    addDate: options.addDate ?? null,
    isToolbar: options.isToolbar ?? false,
    children,
  };
}

function build(children: BookmarkNode[]) {
  return buildImportCandidates({ children }, NOW);
}

describe("buildImportCandidates", () => {
  it("sends links at the top level and right under the bookmark bar to unfiled", () => {
    const result = build([
      link("최상위", "https://top.example.com"),
      folder("즐겨찾기 모음", [link("바로 아래", "https://bar.example.com")], { isToolbar: true }),
    ]);

    expect(result.folders).toEqual([]);
    expect(result.links.map((item) => [item.title, item.folderKey])).toEqual([
      ["최상위", null],
      ["바로 아래", null],
    ]);
  });

  it("finds the bookmark bar by its attribute, not its name", () => {
    const result = build([
      folder("북마크바", [link("a", "https://a.example.com")]),
      folder("Toolbar", [link("b", "https://b.example.com")], { isToolbar: true }),
    ]);

    expect(result.folders.map((item) => item.name)).toEqual(["북마크바"]);
    expect(result.links[1].folderKey).toBeNull();
  });

  it("makes a candidate only from folders that hold links directly, named by their own name", () => {
    const result = build([
      folder(
        "북마크바",
        [
          folder("공부", [
            folder("  자바  ", [link("Java 21", "https://java.example.com")]),
            folder("빈 폴더", []),
          ]),
        ],
        { isToolbar: true },
      ),
    ]);

    expect(result.folders).toEqual([
      { key: "f1", name: "자바", createdAt: null, sourcePath: "북마크바 / 공부 / 자바" },
    ]);
    expect(result.links[0].folderKey).toBe("f1");
  });

  it("merges folders with the same trimmed NFC name and keeps the earliest date", () => {
    const decomposed = "자바".normalize("NFD");
    const result = build([
      folder("자바 ", [link("a", "https://a.example.com")], { addDate: SEC_2024 }),
      folder("기타", [
        folder(decomposed, [link("b", "https://b.example.com")], { addDate: SEC_2023 }),
      ]),
      folder("JAVA", [link("c", "https://c.example.com")]),
    ]);

    expect(result.folders.map((item) => [item.key, item.name, item.createdAt])).toEqual([
      ["f1", "자바", new Date(Number(SEC_2023) * 1000).toISOString()],
      ["f2", "JAVA", null],
    ]);
    expect(result.links.map((item) => item.folderKey)).toEqual(["f1", "f1", "f2"]);
  });

  it("names a blank folder 이름 없는 폴더 and cuts long names at 100 UTF-16 units", () => {
    const long = "가".repeat(120);
    const result = build([
      folder("   ", [link("a", "https://a.example.com")]),
      folder(long, [link("b", "https://b.example.com")]),
    ]);

    expect(result.folders[0].name).toBe("이름 없는 폴더");
    expect(result.folders[1].name).toHaveLength(100);
  });

  it("keeps only http and https, and lists the rest with their path", () => {
    const result = build([
      folder(
        "즐겨찾기 모음",
        [
          link("kd", "edge://newtab/"),
          link("", "javascript:alert(1)"),
          link("사내 위키", "http://intranet.local/wiki"),
          link("로컬", "http://localhost:3000"),
        ],
        { isToolbar: true },
      ),
      link("파일", "file:///Users/me/a.html"),
    ]);

    expect(result.links.map((item) => item.url)).toEqual([
      "http://intranet.local/wiki",
      "http://localhost:3000",
    ]);
    expect(result.unsupported).toEqual([
      { title: "kd", url: "edge://newtab/", path: "즐겨찾기 모음", reason: "NOT_HTTP" },
      {
        title: "javascript:alert(1)",
        url: "javascript:alert(1)",
        path: "즐겨찾기 모음",
        reason: "NOT_HTTP",
      },
      { title: "파일", url: "file:///Users/me/a.html", path: "최상위", reason: "NOT_HTTP" },
    ]);
  });

  it("uses host and path for a blank title and cuts long titles at 300 units", () => {
    const result = build([
      link("   ", "https://docs.example.com/guide/start?x=1"),
      link("", "https://example.com/"),
      link("😀".repeat(200), "https://emoji.example.com"),
    ]);

    expect(result.links[0].title).toBe("docs.example.com/guide/start");
    expect(result.links[1].title).toBe("example.com");
    expect(result.links[2].title).toHaveLength(300);
  });

  it("shows a readable path for a blank title and keeps the raw path when it cannot be decoded", () => {
    const result = build([
      link("", "https://ko.wikipedia.org/wiki/%ED%95%9C%EA%B5%AD"),
      link("", "https://ko.wikipedia.org/wiki/서울"),
      link("", "https://bad.example.com/%E0%A4%A"),
    ]);

    expect(result.links.map((item) => item.title)).toEqual([
      "ko.wikipedia.org/wiki/한국",
      "ko.wikipedia.org/wiki/서울",
      "bad.example.com/%E0%A4%A",
    ]);
  });

  it("does not leave a space at the end of a folder name cut at 100 units", () => {
    const result = build([folder(`${"가".repeat(99)} 나`, [link("a", "https://a.example.com")])]);

    expect(result.folders[0].name).toBe("가".repeat(99));
  });

  it("does not treat links whose addresses cannot be read as duplicates", () => {
    const result = build([
      link("first", "https://example.com/a b"),
      link("second", "https://example.com/a b"),
    ]);

    expect(result.links.map((item) => item.title)).toEqual(["first", "second"]);
    expect(result.duplicateCount).toBe(0);
  });

  it("keeps the first of links whose normalized addresses match", () => {
    const result = build([
      link("first", "https://example.com/docs/"),
      folder("자바", [
        link("second", "HTTPS://EXAMPLE.com/docs?utm_source=x#top"),
        link("other", "https://example.com/other"),
      ]),
    ]);

    expect(result.links.map((item) => item.title)).toEqual(["first", "other"]);
    expect(result.duplicateCount).toBe(1);
  });

  it("does not create a folder whose links were all duplicates", () => {
    const result = build([
      link("first", "https://example.com/a"),
      folder("중복만", [link("again", "https://example.com/a")]),
    ]);

    expect(result.folders).toEqual([]);
  });

  it("turns ADD_DATE into ISO UTC and drops missing, invalid or future dates", () => {
    const result = build([
      link("a", "https://a.example.com", SEC_2024),
      link("b", "https://b.example.com", null),
      link("c", "https://c.example.com", "abc"),
      link("d", "https://d.example.com", SEC_FUTURE),
      link("e", "https://e.example.com", "0"),
    ]);

    expect(result.links.map((item) => item.createdAt)).toEqual([
      "2024-01-02T03:04:05.000Z",
      null,
      null,
      null,
      null,
    ]);
  });

  it("numbers keys in file order", () => {
    const result = build([
      folder("b", [link("1", "https://1.example.com")]),
      link("2", "https://2.example.com"),
      folder("a", [link("3", "https://3.example.com")]),
    ]);

    expect(result.links.map((item) => item.key)).toEqual(["l1", "l2", "l3"]);
    expect(result.folders.map((item) => item.key)).toEqual(["f1", "f2"]);
  });
});

describe("truncateUtf16", () => {
  it("does not split a surrogate pair at the edge", () => {
    expect(truncateUtf16("ab😀", 3)).toBe("ab");
    expect(truncateUtf16("ab😀", 4)).toBe("ab😀");
    expect(truncateUtf16("abc", 5)).toBe("abc");
  });
});
