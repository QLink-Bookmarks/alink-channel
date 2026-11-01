import {
  decodeHtmlEntities,
  getThumbnailCandidatesFromMeta,
  parseLinkPreviewHtml,
  resolveHttpUrl,
} from "./parse-link-preview-html";

const PAGE_URL = "https://example.com/posts/1";

describe("parseLinkPreviewHtml", () => {
  describe("title", () => {
    it("prefers og:title over <title>", () => {
      const html = `<title>Document title</title><meta property="og:title" content="OG title">`;
      expect(parseLinkPreviewHtml(html, PAGE_URL).title).toBe("OG title");
    });

    it("falls back to <title> when og:title is missing or blank", () => {
      expect(parseLinkPreviewHtml("<title>Document title</title>", PAGE_URL).title).toBe(
        "Document title",
      );
      const blankOg = `<meta property="og:title" content="   "><title>Document title</title>`;
      expect(parseLinkPreviewHtml(blankOg, PAGE_URL).title).toBe("Document title");
    });

    it("does not use twitter:title", () => {
      const html = `<meta name="twitter:title" content="Twitter title">`;
      expect(parseLinkPreviewHtml(html, PAGE_URL).title).toBeNull();
    });

    it("is null when the page has no title", () => {
      expect(parseLinkPreviewHtml("<p>no title</p>", PAGE_URL).title).toBeNull();
      expect(parseLinkPreviewHtml("<title>  \n </title>", PAGE_URL).title).toBeNull();
    });

    it("collapses whitespace and decodes entities", () => {
      const html = `<title>\n  Tom &amp; Jerry &#39;s  &#x2F; show \n</title>`;
      expect(parseLinkPreviewHtml(html, PAGE_URL).title).toBe("Tom & Jerry 's / show");
    });

    it("cuts the title to 300 characters", () => {
      const long = "가".repeat(350);
      const title = parseLinkPreviewHtml(
        `<meta property="og:title" content="${long}">`,
        PAGE_URL,
      ).title;
      expect(title).toHaveLength(300);
    });

    it("reads attributes in any order, with either quote style or unquoted", () => {
      expect(
        parseLinkPreviewHtml(`<meta content='Single' property='og:title'>`, PAGE_URL).title,
      ).toBe("Single");
      expect(parseLinkPreviewHtml(`<meta property=og:title content=Bare>`, PAGE_URL).title).toBe(
        "Bare",
      );
    });

    it("keeps a '>' inside a quoted attribute value", () => {
      const html = `<meta property="og:title" content="a > b">`;
      expect(parseLinkPreviewHtml(html, PAGE_URL).title).toBe("a > b");
    });
  });

  describe("main image candidates", () => {
    it("lists every og:image, then every twitter:image, without duplicates", () => {
      const html = `
        <meta name="twitter:image" content="https://cdn.example.com/twitter.jpg">
        <meta property="og:image" content="https://cdn.example.com/og-1.jpg">
        <meta property="og:image" content="https://cdn.example.com/og-2.jpg">
        <meta name="twitter:image" content="https://cdn.example.com/og-1.jpg">`;
      expect(parseLinkPreviewHtml(html, PAGE_URL).thumbnailCandidates).toEqual([
        "https://cdn.example.com/og-1.jpg",
        "https://cdn.example.com/og-2.jpg",
        "https://cdn.example.com/twitter.jpg",
      ]);
    });

    it("resolves relative addresses against the page", () => {
      const html = `<meta property="og:image" content="../images/a.png?w=1&amp;h=2">`;
      expect(parseLinkPreviewHtml(html, PAGE_URL).thumbnailCandidates).toEqual([
        "https://example.com/images/a.png?w=1&h=2",
      ]);
    });

    it("resolves relative addresses against <base href> when the page has one", () => {
      const html = `<base href="/static/"><meta property="og:image" content="img/a.png">`;
      expect(parseLinkPreviewHtml(html, PAGE_URL).thumbnailCandidates).toEqual([
        "https://example.com/static/img/a.png",
      ]);
    });

    it("drops non-http(s) candidates", () => {
      const html = `
        <meta property="og:image" content="data:image/png;base64,AAAA">
        <meta property="og:image" content="javascript:alert(1)">
        <meta name="twitter:image" content="//cdn.example.com/b.jpg">`;
      expect(parseLinkPreviewHtml(html, PAGE_URL).thumbnailCandidates).toEqual([
        "https://cdn.example.com/b.jpg",
      ]);
    });

    it("does not read favicons", () => {
      const html = `<link rel="icon" href="/favicon.png">`;
      expect(parseLinkPreviewHtml(html, PAGE_URL).thumbnailCandidates).toEqual([]);
    });
  });

  describe("isVideo", () => {
    it.each([
      [`<meta property="og:type" content="video.other">`, true],
      [`<meta property="og:type" content="Video">`, true],
      [`<meta property="og:video" content="https://example.com/v.mp4">`, true],
      [`<meta name="twitter:card" content="player">`, true],
      [`<meta name="twitter:card" content="Player">`, true],
      [`<meta property="og:type" content="article">`, false],
      [`<meta name="twitter:card" content="summary_large_image">`, false],
      [`<meta property="og:video:url" content="https://example.com/v.mp4">`, false],
      ["<p>plain page</p>", false],
    ])("%s → %s", (html, expected) => {
      expect(parseLinkPreviewHtml(html, PAGE_URL).isVideo).toBe(expected);
    });
  });
});

describe("getThumbnailCandidatesFromMeta", () => {
  it("reads og:image, then twitter:image, resolved against the page", () => {
    expect(
      getThumbnailCandidatesFromMeta(
        { "twitter:image": "/twitter.png", "og:image": "https://cdn.example.com/og.png" },
        PAGE_URL,
      ),
    ).toEqual(["https://cdn.example.com/og.png", "https://example.com/twitter.png"]);
  });

  it("drops duplicates, blanks and non-strings", () => {
    expect(
      getThumbnailCandidatesFromMeta(
        {
          "og:image": "https://cdn.example.com/a.png",
          "twitter:image": "https://cdn.example.com/a.png",
        },
        PAGE_URL,
      ),
    ).toEqual(["https://cdn.example.com/a.png"]);
    expect(
      getThumbnailCandidatesFromMeta({ "og:image": "  ", "twitter:image": 3 }, PAGE_URL),
    ).toEqual([]);
  });

  it("returns nothing without meta", () => {
    expect(getThumbnailCandidatesFromMeta(undefined, PAGE_URL)).toEqual([]);
    expect(getThumbnailCandidatesFromMeta("og:image", PAGE_URL)).toEqual([]);
  });
});

describe("resolveHttpUrl", () => {
  const base = "https://example.com/a/b/page.html?q=1#top";

  it.each([
    ["img.png", "https://example.com/a/b/img.png"],
    ["./img.png", "https://example.com/a/b/img.png"],
    ["../img.png", "https://example.com/a/img.png"],
    ["../../../../img.png", "https://example.com/img.png"],
    ["/img.png", "https://example.com/img.png"],
    ["//cdn.example.com/img.png", "https://cdn.example.com/img.png"],
    ["?page=2", "https://example.com/a/b/page.html?page=2"],
    ["#section", "https://example.com/a/b/page.html?q=1#section"],
    ["", "https://example.com/a/b/page.html?q=1"],
    ["  img.png  ", "https://example.com/a/b/img.png"],
  ])("resolves %j", (ref, expected) => {
    expect(resolveHttpUrl(ref, base)).toBe(expected);
  });

  it("keeps absolute http(s) URLs intact (no trailing slash added)", () => {
    expect(resolveHttpUrl("https://cdn.example.com/p.jpg", base)).toBe(
      "https://cdn.example.com/p.jpg",
    );
    expect(resolveHttpUrl("http://cdn.example.com/a/./b/../p.jpg?x=1", base)).toBe(
      "http://cdn.example.com/a/p.jpg?x=1",
    );
  });

  it("resolves against a base without a path", () => {
    expect(resolveHttpUrl("img.png", "https://example.com")).toBe("https://example.com/img.png");
    expect(resolveHttpUrl("?a=1", "https://example.com")).toBe("https://example.com/?a=1");
  });

  it("rejects other schemes and unusable bases", () => {
    expect(resolveHttpUrl("data:image/png;base64,AA", base)).toBeNull();
    expect(resolveHttpUrl("ftp://example.com/a.png", base)).toBeNull();
    expect(resolveHttpUrl("img.png", "not a url")).toBeNull();
    expect(resolveHttpUrl("https://exa mple.com/a.png", base)).toBeNull();
  });
});

describe("decodeHtmlEntities", () => {
  it("decodes named, decimal and hex entities and leaves unknown ones", () => {
    expect(decodeHtmlEntities("&lt;a&gt; &quot;x&quot; &#65;&#x42; &copy; &#0;")).toBe(
      '<a> "x" AB &copy; &#0;',
    );
  });
});
