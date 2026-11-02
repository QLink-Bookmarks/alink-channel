import { getRedirectHref, isMobileTabRootPath } from "./routes";
import type { RouteParams } from "./types";

function redirect(isWideView: boolean, pathname: string, searchParams: RouteParams = {}) {
  return getRedirectHref({ isWideView, pathname, searchParams });
}

describe("getRedirectHref on mobile", () => {
  it("opens the link detail page for /links?linkId", () => {
    expect(redirect(false, "/links", { linkId: "5" })).toBe("/links/5");
    expect(redirect(false, "/links/", { linkId: "5" })).toBe("/links/5");
  });

  it("sends /links without a link to home", () => {
    expect(redirect(false, "/links")).toBe("/home");
    expect(redirect(false, "/links/")).toBe("/home");
  });

  it.each(["/home", "/folders", "/folders/3", "/todos", "/notifications"])(
    "opens the link detail page for %s?linkId",
    (pathname) => {
      expect(redirect(false, pathname, { linkId: "5" })).toBe("/links/5");
    },
  );

  it("encodes the link id", () => {
    expect(redirect(false, "/home", { linkId: "a b" })).toBe("/links/a%20b");
  });

  it("reads the first value of a repeated linkId", () => {
    expect(redirect(false, "/links", { linkId: ["5", "6"] })).toBe("/links/5");
  });

  it("stays on the link detail page it already shows", () => {
    expect(redirect(false, "/links/5", { linkId: "5" })).toBeUndefined();
  });

  it.each(["/home", "/folders", "/folders/3", "/todos", "/settings", "/links/5"])(
    "keeps %s without a linkId",
    (pathname) => {
      expect(redirect(false, pathname)).toBeUndefined();
    },
  );

  it("sends /share to home", () => {
    expect(redirect(false, "/share")).toBe("/home");
    expect(redirect(false, "/share", { linkId: "5" })).toBe("/home");
  });
});

describe("getRedirectHref on wide", () => {
  it("sends /folders to home", () => {
    expect(redirect(true, "/folders")).toBe("/home");
  });

  it("keeps /links with or without a linkId", () => {
    expect(redirect(true, "/links")).toBeUndefined();
    expect(redirect(true, "/links", { linkId: "5" })).toBeUndefined();
  });

  it.each(["/home", "/folders/3", "/todos"])("opens the overlay in place on %s", (pathname) => {
    expect(redirect(true, pathname, { linkId: "5" })).toBeUndefined();
  });

  it.each(["/settings", "/notifications", "/announcements"])(
    "moves %s?linkId to all links with the overlay",
    (pathname) => {
      expect(redirect(true, pathname, { linkId: "5" })).toBe("/links?linkId=5");
    },
  );

  it.each(["/home", "/folders/3", "/todos", "/settings", "/links/5"])(
    "keeps %s without a linkId",
    (pathname) => {
      expect(redirect(true, pathname)).toBeUndefined();
    },
  );

  it("sends /share to home", () => {
    expect(redirect(true, "/share")).toBe("/home");
  });
});

describe("isMobileTabRootPath", () => {
  it.each(["/home", "/folders", "/todos", "/settings", "/folders/", "/settings/"])(
    "treats %s as a bottom tab root",
    (pathname) => {
      expect(isMobileTabRootPath(pathname)).toBe(true);
    },
  );

  it.each([
    "/",
    "/links",
    "/links/5",
    "/folders/3",
    "/folders/0",
    "/todos/1",
    "/settings/profile",
    "/notifications",
    "/announcements",
    "/feedbacks",
    "/homepage",
  ])("does not treat %s as a bottom tab root", (pathname) => {
    expect(isMobileTabRootPath(pathname)).toBe(false);
  });
});
