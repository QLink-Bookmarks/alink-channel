import {
  getBackHref,
  getMobileTabActiveItem,
  getRedirectHref,
  getRouteTitle,
  getWideSidebarActiveItem,
  isKnownShellPath,
  isMobileTabRootPath,
} from "./routes";
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

  it("moves /folders?linkId to all links with the overlay", () => {
    expect(redirect(true, "/folders", { linkId: "5" })).toBe("/links?linkId=5");
    expect(redirect(true, "/folders/", { linkId: "a b" })).toBe("/links?linkId=a%20b");
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

describe("bookmark import routes", () => {
  it.each(["/settings/imports", "/settings/imports/12"])("knows %s as a shell path", (pathname) => {
    expect(isKnownShellPath(pathname)).toBe(true);
  });

  it("does not know deeper import paths", () => {
    expect(isKnownShellPath("/settings/imports/12/more")).toBe(false);
  });

  it("titles the list and the detail", () => {
    expect(getRouteTitle("/settings/imports", {}, false)).toBe("북마크 가져오기");
    expect(getRouteTitle("/settings/imports/", {}, true)).toBe("북마크 가져오기");
    expect(getRouteTitle("/settings/imports/12", { id: "12" }, false)).toBe("가져오기 기록");
  });

  it("goes back from the detail to the list and from the list to settings", () => {
    expect(getBackHref("/settings/imports/12")).toBe("/settings/imports");
    expect(getBackHref("/settings/imports")).toBe("/settings");
  });

  it.each(["/settings/imports", "/settings/imports/12"])(
    "keeps the settings tab active on %s",
    (pathname) => {
      expect(getMobileTabActiveItem(pathname)).toBe("settings");
      expect(isMobileTabRootPath(pathname)).toBe(false);
      expect(getWideSidebarActiveItem(pathname)).toBeNull();
    },
  );

  it.each(["/settings/imports", "/settings/imports/12"])("keeps %s in place", (pathname) => {
    expect(redirect(true, pathname)).toBeUndefined();
    expect(redirect(false, pathname)).toBeUndefined();
  });
});
