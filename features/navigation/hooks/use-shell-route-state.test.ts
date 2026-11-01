import { renderHook } from "@testing-library/react-native";

import { useShellRouteState } from "./use-shell-route-state";

const mockRoute: { pathname: string; params: Record<string, string> } = {
  pathname: "/home",
  params: {},
};
const mockWideView = { isResolved: true, isWideView: false };

jest.mock("expo-router", () => ({
  usePathname: () => mockRoute.pathname,
  useGlobalSearchParams: () => mockRoute.params,
}));

jest.mock("@/lib/hooks/use-wide-view", () => ({
  useWideViewState: () => mockWideView,
}));

function renderRouteState(
  pathname: string,
  params: Record<string, string> = {},
  wideView: Partial<typeof mockWideView> = {},
) {
  mockRoute.pathname = pathname;
  mockRoute.params = params;
  Object.assign(mockWideView, { isResolved: true, isWideView: false }, wideView);
  return renderHook(() => useShellRouteState()).result.current;
}

describe("useShellRouteState back button on mobile", () => {
  it.each(["/home", "/folders", "/todos", "/settings", "/folders/"])(
    "hides the back button on the tab root %s",
    (pathname) => {
      expect(renderRouteState(pathname).showBackButton).toBe(false);
    },
  );

  it.each([
    "/folders/3",
    "/folders/uncategorized",
    "/links/12",
    "/notifications",
    "/announcements",
    "/announcements/4",
    "/feedbacks",
    "/feedbacks/7",
    "/settings/profile",
  ])("shows the back button below the tab roots on %s", (pathname) => {
    expect(renderRouteState(pathname).showBackButton).toBe(true);
  });

  it("never shows the back button on wide view", () => {
    expect(renderRouteState("/folders/3", {}, { isWideView: true }).showBackButton).toBe(false);
  });
});

describe("useShellRouteState redirects", () => {
  it("applies no redirect before the window width is resolved", () => {
    expect(
      renderRouteState("/links", { linkId: "5" }, { isResolved: false }).redirectHref,
    ).toBeUndefined();
    expect(renderRouteState("/links", {}, { isResolved: false }).redirectHref).toBeUndefined();
  });

  it("keeps wide visitors on /links and /links?linkId", () => {
    expect(renderRouteState("/links", {}, { isWideView: true }).redirectHref).toBeUndefined();
    expect(
      renderRouteState("/links", { linkId: "5" }, { isWideView: true }).redirectHref,
    ).toBeUndefined();
  });

  it("sends wide /folders to home", () => {
    expect(renderRouteState("/folders", {}, { isWideView: true }).redirectHref).toBe("/home");
  });

  it("applies the mobile rules once resolved as mobile", () => {
    expect(renderRouteState("/links").redirectHref).toBe("/home");
    expect(renderRouteState("/home", { linkId: "5" }).redirectHref).toBe("/links/5");
  });
});
