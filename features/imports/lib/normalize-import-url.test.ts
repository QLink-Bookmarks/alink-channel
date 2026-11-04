import { isHttpUrl, normalizeImportUrl } from "./normalize-import-url";

describe("normalizeImportUrl", () => {
  it("lowercases the scheme and host and drops the default port and fragment", () => {
    expect(normalizeImportUrl("HTTPS://Example.COM:443/Path#section")).toBe(
      "https://example.com/Path",
    );
    expect(normalizeImportUrl("http://example.com:80/a")).toBe("http://example.com/a");
    expect(normalizeImportUrl("http://example.com:8080/a")).toBe("http://example.com:8080/a");
  });

  it("removes tracking parameters and sorts the rest by key", () => {
    expect(
      normalizeImportUrl(
        "https://example.com/a?utm_source=x&b=2&fbclid=1&a=1&gclid=2&igshid=3&mc_cid=4&mc_eid=5",
      ),
    ).toBe("https://example.com/a?a=1&b=2");
  });

  it("drops trailing slashes, including the root path", () => {
    expect(normalizeImportUrl("https://example.com/")).toBe("https://example.com");
    expect(normalizeImportUrl("https://example.com/docs///")).toBe("https://example.com/docs");
  });

  it("treats the same address written differently as equal", () => {
    expect(normalizeImportUrl("https://EXAMPLE.com/docs/?utm_medium=a#top")).toBe(
      normalizeImportUrl("https://example.com/docs"),
    );
  });

  it("returns null for an address it cannot read", () => {
    expect(normalizeImportUrl("not a url")).toBeNull();
    expect(normalizeImportUrl("")).toBeNull();
  });
});

describe("normalizeImportUrl matches the server's toNormalizedUrlOrNull", () => {
  it.each([
    ["https://a.com/s?q=a%20b", "https://a.com/s?q=a+b"],
    ["https://a.com/a/../b", "https://a.com/b"],
    ["https://user:pw@a.com/", "https://a.com/"],
    ["https://ko.wikipedia.org/wiki/한국", "https://ko.wikipedia.org/wiki/%ED%95%9C%EA%B5%AD"],
    ["https://a.com/%2F", "https://a.com/"],
  ])("keeps %s and %s apart", (a, b) => {
    expect(normalizeImportUrl(a)).not.toBeNull();
    expect(normalizeImportUrl(a)).not.toBe(normalizeImportUrl(b));
  });

  it.each([
    ["https://a.com/s?q=a%20b", "https://a.com/s?q=a%20b"],
    ["https://a.com/a/../b", "https://a.com/a/../b"],
    ["https://user:pw@a.com/", "https://user:pw@a.com"],
    ["https://ko.wikipedia.org/wiki/한국", "https://ko.wikipedia.org/wiki/한국"],
    ["https://a.com/?UTM_SOURCE=x&b=1", "https://a.com?b=1"],
    ["https://a.com/?utm_medium=x&Fbclid=2&a=1", "https://a.com?a=1"],
    ["https://a.com/x?fbclidx=1&utm_=2&utm=3", "https://a.com/x?fbclidx=1&utm=3"],
    ["https://a.com/?&&b=2&a=1&", "https://a.com?a=1&b=2"],
    ["https://a.com/?b=2&a=1&a=0", "https://a.com?a=1&a=0&b=2"],
    ["https://A.com/?B=1&a=2", "https://a.com?B=1&a=2"],
    ["https://a.com/?q=한글", "https://a.com?q=한글"],
    ["https://a.com/?x=[1]", "https://a.com?x=[1]"],
    ["http://example.com:080/a", "http://example.com/a"],
    ["https://a.com:/x", "https://a.com/x"],
    ["https://[::1]:8080/x", "https://[::1]:8080/x"],
    ["https://a.com./x", "https://a.com./x"],
    ["\u00a0https://a.com/trim\u00a0", "https://a.com/trim"],
  ])("normalizes %s to %s", (raw, expected) => {
    expect(normalizeImportUrl(raw)).toBe(expected);
  });

  it.each([
    "https://a.com/x y",
    "https://a.com/?q=한글 공백",
    "https://a.com/x\u3000y",
    "https://a.com/#/route|x",
    "https://a.com/x#a#b",
    "https://a.com/p|q",
    "https://a.com/?x={1}",
    "https://a.com/[1]",
    "https://a.com/%zz",
    "https://a_b.com/",
    "https://a-.com/",
    "https://1.2.3/",
    "https://256.1.1.1/",
    "https://한국.com/",
    "https://a@b@c.com/",
    "https://a.com:abc/x",
    "http:///x",
    "http:/a.com/x",
  ])("returns null for %s, so it never counts as a duplicate", (raw) => {
    expect(normalizeImportUrl(raw)).toBeNull();
  });
});

describe("isHttpUrl", () => {
  it("accepts only http and https", () => {
    expect(isHttpUrl("https://example.com")).toBe(true);
    expect(isHttpUrl(" HTTP://intranet.local/wiki")).toBe(true);
    expect(isHttpUrl("edge://newtab/")).toBe(false);
    expect(isHttpUrl("chrome://settings")).toBe(false);
    expect(isHttpUrl("javascript:void(0)")).toBe(false);
    expect(isHttpUrl("file:///Users/me/a.html")).toBe(false);
    expect(isHttpUrl("ftp://example.com")).toBe(false);
  });
});
