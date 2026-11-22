import { type Page, type Route, expect, test } from "@playwright/test";

import { envelope, makeDetail, makeLink, mockApi } from "./support/mock-api";

import path from "node:path";

const folder = {
  id: 3,
  ownerId: 1,
  name: "복귀 검증 폴더",
  emoji: "🌸",
  isShared: false,
  shareCounts: 0,
  linkCounts: 1,
};
const link = makeLink({ id: 7, folderId: folder.id, title: "복귀 검증 링크" });
const sharedUrl = "https://example.com/entry-share";
const destination = "/folders/3?linkId=7";
const landing = "웹으로 시작하기";
const checking = "인증 정보를 확인 중입니다…";
const consent = "서비스 이용 동의";
const login = "Google로 계속하기";
const refreshPath = "/api/auth/token/refresh/web";
const googleSdk = "https://accounts.google.com/gsi/client";
const kakaoSdk = "https://t1.kakaocdn.net/kakao_js_sdk/2.7.9/kakao.min.js";

test.beforeEach(({ page }, testInfo) => {
  if (testInfo.title.startsWith("removed address /app ")) return;
  page.on("framenavigated", (frame) => {
    if (frame === page.mainFrame()) {
      expect(new URL(frame.url()).pathname).not.toBe("/app");
    }
  });
});

function json(route: Route, data: unknown, status = 200) {
  return route.fulfill({ status, json: data });
}

function providerPage(route: Route, success: string, cancel: string) {
  return route.fulfill({
    contentType: "text/html; charset=utf-8",
    body: `<a href="${success}">인증 완료</a><a href="${cancel}">인증 취소</a>`,
  });
}

function deferred() {
  let release = () => {};
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { promise, release };
}

async function setUp(
  page: Page,
  options: {
    guest?: boolean;
    needsConsent?: boolean;
    invite?: "success" | "failure";
    share?: boolean;
    profile?: Promise<void>;
    refresh?: Promise<void>;
    profileFailures?: number;
    consentFailures?: number;
    signInFailures?: number;
    cancelPopupOnce?: boolean;
    connectionSessionExpired?: boolean;
    callbackResponse?: Promise<void>;
  } = {},
) {
  let agreed = !options.needsConsent;
  let consentFailures = options.consentFailures ?? 0;
  let profileFailures = options.profileFailures ?? 0;
  let signInFailures = options.signInFailures ?? 0;
  const invite = { folderId: "4", token: "original-invite-token" };
  // Expo's development LogBox can cover the mobile agreement controls.
  await page.addLocatorHandler(page.locator("#error-toast button"), (dismiss) => dismiss.click());
  await page.addInitScript(
    ({ pendingInvite, pendingShare }) => {
      if (!sessionStorage.getItem("entry-fixtures")) {
        sessionStorage.setItem("entry-fixtures", "1");
        if (pendingInvite)
          sessionStorage.setItem("qlink-pending-invite", JSON.stringify(pendingInvite));
        if (pendingShare)
          sessionStorage.setItem("qlink-pending-share", JSON.stringify({ url: pendingShare }));
      }
      Object.assign(window, {
        Kakao: {
          isInitialized: () => true,
          Auth: {
            setAccessToken: () => {},
            authorize: ({ state, redirectUri }: { state: string; redirectUri: string }) => {
              location.href = "/__e2e__/provider?" + new URLSearchParams({ state, redirectUri });
            },
          },
        },
      });
      localStorage.setItem("krk", "U2FsdGVkX1+4Zs+E6h0gXY4Ws+DfG79Q9r/xPhQ/5QA=");
    },
    { pendingInvite: options.invite && invite, pendingShare: options.share && sharedUrl },
  );
  await page.route(kakaoSdk, (route) => route.abort());
  await page.route("https://appleid.cdn-apple.com/**", (route) =>
    route.fulfill({
      contentType: "application/javascript",
      body: `let cancel = ${Boolean(options.cancelPopupOnce)};
      window.AppleID = { auth: {
        init: (config) => { if (!config.usePopup) throw Error("Expected an Apple popup"); },
        signIn: async () => {
          if (cancel) { cancel = false; throw { error: "popup_closed_by_user" }; }
          return { authorization: { id_token: "apple-token" } };
        },
      } };`,
    }),
  );
  await page.route("https://kauth.kakao.com/oauth/token", (route) => {
    const body = new URLSearchParams(route.request().postData() ?? "");
    expect(body.get("redirect_uri")).toBe(new URL("/auth/callback", page.url()).href);
    return json(route, { access_token: "kakao-token", token_type: "bearer", expires_in: 3600 });
  });
  await page.route(googleSdk, (route) =>
    route.fulfill({
      contentType: "application/javascript",
      body: `let cancelGoogle = ${Boolean(options.cancelPopupOnce)};
      window.google = { accounts: { oauth2: { initTokenClient: ({ callback, error_callback }) => ({
      requestAccessToken: () => {
        if (cancelGoogle) { cancelGoogle = false; error_callback({ type: "popup_closed" }); }
        else callback({ access_token: "google-token" });
      },
    }) } } };`,
    }),
  );
  await page.route("https://nid.naver.com/oauth2.0/authorize?*", (route) => {
    const requestUrl = new URL(route.request().url());
    const callback = requestUrl.searchParams.get("redirect_uri");
    expect(callback).toBe(new URL("/auth/callback", page.url()).href);
    const state = encodeURIComponent(requestUrl.searchParams.get("state") ?? "");
    return providerPage(
      route,
      `${callback}#access_token=naver-token&state=${state}`,
      `${callback}#error=access_denied&state=${state}`,
    );
  });
  await page.route("**/__e2e__/provider?*", (route) => {
    const params = new URL(route.request().url()).searchParams;
    const state = encodeURIComponent(params.get("state") ?? "");
    const callback = params.get("redirectUri");
    expect(callback).toBe(new URL("/auth/callback", route.request().url()).href);
    return providerPage(
      route,
      `${callback}?code=e2e-code&state=${state}`,
      `${callback}?error=access_denied&state=${state}`,
    );
  });

  return mockApi(page, {
    seedSession: !options.guest && !options.refresh,
    folders: [folder, { ...folder, id: 4, name: "수락한 초대 폴더" }],
    links: [link],
    details: { 7: makeDetail(link) },
    handlers: {
      [`POST ${refreshPath}`]: async (route) => {
        if (options.refresh) {
          await options.refresh;
          return json(route, envelope({ accessToken: "restored-token" }));
        }
        return json(route, { success: false, data: null }, 401);
      },
      "POST /api/auth/sign": async (route) => {
        await options.callbackResponse;
        if (signInFailures-- > 0) return json(route, { success: false, data: null }, 400);
        return json(route, envelope({ accessToken: "new-access-token" }), 201);
      },
      "GET /api/users/me": async (route) => {
        await options.profile;
        if (profileFailures-- > 0) return json(route, { success: false, data: null }, 500);
        return json(
          route,
          envelope({
            id: 1,
            username: "e2e",
            nickname: "테스터",
            role: "USER",
            allowsPrivacy: agreed,
            allowsAiUsage: agreed,
          }),
        );
      },
      "PUT /api/users/me/agreements": (route) => {
        if (consentFailures-- > 0) return json(route, { success: false, data: null }, 500);
        agreed = true;
        return json(route, envelope({ allowsPrivacy: true, allowsAiUsage: true }));
      },
      "PUT /api/folders/4/members": (route) =>
        options.invite === "failure"
          ? json(route, { success: false, data: null, error: { message: "만료된 초대" } }, 400)
          : json(route, envelope({ folderId: 4 })),
      "POST /api/auth/connection": async (route) => {
        await options.callbackResponse;
        return options.connectionSessionExpired
          ? json(route, { success: false, error: { code: "AUTH_401_0001" } }, 401)
          : json(route, envelope({ id: 9 }), 201);
      },
    },
  });
}

async function agree(page: Page) {
  await page.getByRole("button", { name: "다음으로", exact: true }).click();
  await expect(page.getByText(consent, { exact: true })).toBeVisible();
  for (const checkbox of await page.getByRole("checkbox").all()) await checkbox.click();
  await page.getByRole("button", { name: "계속하기" }).click();
}

async function signIn(page: Page) {
  await expect(page).toHaveURL(/\/login$/);
  await page.getByText(login, { exact: true }).click();
}

async function expectHome(page: Page) {
  await expect(page).toHaveURL(/\/home$/);
  await expect(
    page.getByRole("textbox", { name: "링크 · 요약 · 태그 검색…" }).filter({ visible: true }),
  ).toBeVisible();
}

async function expectDestination(page: Page, isMobile: boolean) {
  await expect(page).toHaveURL(isMobile ? /\/links\/7$/ : /\/folders\/3\?linkId=7$/);
  const detail = isMobile ? page : page.getByTestId("detail-panel");
  if (!isMobile) await expect(detail.getByTestId("link-detail-close")).toBeVisible();
  await expect(detail.getByText(link.title, { exact: true }).first()).toBeVisible();
}

for (const status of ["guest", "agreed", "unagreed"] as const) {
  const options = { guest: status === "guest", needsConsent: status !== "agreed" };

  test(`root remains the landing and keeps browser history for ${status}`, async ({ page }) => {
    await setUp(page, options);
    await page.goto("/privacy");
    await page.goto("/");
    await expect(page.getByText(landing).first()).toBeVisible();
    await page.reload();
    await expect(page).toHaveURL("/");
    await expect(page.getByText(landing).first()).toBeVisible();
    await page.goBack();
    await expect(page).toHaveURL("/privacy");
  });

  for (const entry of ["cta", "direct"] as const) {
    test(`app ${entry} reaches home and maintains history for ${status}`, async ({ page }) => {
      await setUp(page, options);
      if (entry === "cta") {
        await page.goto("/");
        await page.getByText(landing, { exact: true }).first().click();
      } else {
        await page.goto("/privacy");
        await page.goto("/home");
        await page.reload();
      }
      if (options.guest) await signIn(page);
      if (options.needsConsent) await agree(page);
      await expectHome(page);
      await page.goBack();
      await expect(page).toHaveURL(entry === "cta" ? "/" : "/privacy");
    });
  }
}

for (const removedPath of ["/app", "/public/folders/116-preview"]) {
  test(`removed address ${removedPath} stays on the not-found page`, async ({ page }) => {
    await setUp(page, { guest: true });
    await page.goto("/privacy");
    await page.goto(removedPath);
    await expect(page.getByText("페이지를 찾을 수 없어요")).toBeVisible();
    await page.reload();
    await expect(page).toHaveURL(removedPath);
    await expect(page.getByText("페이지를 찾을 수 없어요")).toBeVisible();
    await page.goBack();
    await expect(page).toHaveURL("/privacy");
  });
}

test("app waits for session restoration without going through login or landing", async ({
  page,
}) => {
  const refresh = deferred();
  await setUp(page, { refresh: refresh.promise });
  await page.goto("/home");
  await expect(page.getByText(checking)).toBeVisible();
  await expect(page).toHaveURL("/home");
  await expect(page.getByText(login, { exact: true })).toHaveCount(0);
  await expect(page.getByText(landing).filter({ visible: true })).toHaveCount(0);
  await expect(page.getByText(consent)).toHaveCount(0);
  refresh.release();
  await expectHome(page);
});

test("home waits for the restored session before opening a stored share once", async ({ page }) => {
  const refresh = deferred();
  await setUp(page, { refresh: refresh.promise, share: true });
  await page.goto("/privacy");
  await page.goto("/home");
  const field = page.getByRole("textbox", { name: "URL", exact: true });
  await expect(page.getByText(checking)).toBeVisible();
  await expect(page).toHaveURL("/home");
  await expect(field).toHaveCount(0);
  refresh.release();
  await expect(field).toHaveValue(sharedUrl);
  await page.getByRole("button", { name: "닫기", exact: true }).last().click();
  await expectHome(page);
  await expect(field).toHaveCount(0);
  await page.reload();
  await expectHome(page);
  await expect(field).toHaveCount(0);
  await page.goBack();
  await expect(page).toHaveURL("/privacy");
});

test("a stored share opens before the URL requested on home", async ({ page }) => {
  await setUp(page, { guest: true, share: true });
  const requestedUrl = "https://example.com/from-home";
  await page.goto(`/home?linkUrl=${encodeURIComponent(requestedUrl)}`);
  await signIn(page);
  const field = page.getByRole("textbox", { name: "URL", exact: true });
  await expect(field).toHaveValue(sharedUrl);
  await page.getByRole("button", { name: "닫기", exact: true }).last().click();
  await expect
    .poll(() =>
      field.evaluateAll((inputs) => inputs.map((input) => (input as HTMLInputElement).value)),
    )
    .toEqual([requestedUrl]);
  await page.getByRole("button", { name: "닫기", exact: true }).last().click();
  await expectHome(page);
  await expect(field).toHaveCount(0);
});

test("protects content while agreement is being checked and lets the user retry", async ({
  page,
}) => {
  const profile = deferred();
  const state = await setUp(page, { profile: profile.promise, profileFailures: 4 });
  await page.goto("/folders/3");
  await expect(page.getByText(checking)).toBeVisible();
  expect(state.requests.some(({ path }) => path.startsWith("/api/folders/"))).toBe(false);
  profile.release();
  await expect(page.getByRole("button", { name: "다시 시도" })).toBeVisible({ timeout: 12_000 });
  await expect(page.getByText(folder.name).filter({ visible: true })).toHaveCount(0);
  await page.getByRole("button", { name: "다시 시도" }).click();
  await expect(page.getByText(folder.name).filter({ visible: true }).first()).toBeVisible();
});

test("a background profile error preserves the open link form and its input", async ({ page }) => {
  await setUp(page);
  await page.goto(`/home?linkUrl=${encodeURIComponent(sharedUrl)}`);
  const field = page.getByRole("textbox", { name: "URL", exact: true });
  const edited = "https://example.com/unsaved-edit";
  await expect(field).toHaveValue(sharedUrl);
  await field.fill(edited);

  let refetchFailures = 0;
  await page.route(
    (url) => url.pathname === "/api/users/me",
    async (route) => {
      await json(route, { success: false, data: null }, 500);
      refetchFailures++;
    },
  );
  await page.clock.setFixedTime(new Date(Date.now() + 31_000));
  await page.evaluate(() => {
    window.dispatchEvent(new Event("visibilitychange"));
  });

  await expect.poll(() => refetchFailures, { timeout: 12_000 }).toBe(4);
  await expect(field).toHaveValue(edited);
  await expect(page.getByRole("button", { name: "다시 시도" })).toHaveCount(0);
});

for (const route of ["/folders/3", "/links/7", "/qr-scan"] as const) {
  test(`agreed user can open, reload and leave ${route}`, async ({ page }) => {
    await setUp(page);
    await page.goto("/privacy");
    await page.goto(route);
    const isLink = route === "/links/7";
    const screen = isLink
      ? link.title
      : route === "/folders/3"
        ? new RegExp(folder.name)
        : "QR 스캔";
    await expect(
      page.getByText(screen, { exact: true }).filter({ visible: true }).first(),
    ).toBeVisible();
    await page.reload();
    await expect(page).toHaveURL(route);
    await expect(
      page.getByText(screen, { exact: true }).filter({ visible: true }).first(),
    ).toBeVisible();
    await page.goBack();
    await expect(page).toHaveURL("/privacy");
  });
}

test("guest resumes the original folder and overlay after reloading login", async ({
  page,
  isMobile,
}) => {
  const state = await setUp(page, { guest: true });
  await page.goto("/privacy");
  await page.goto(destination);
  await expect(page).toHaveURL("/login");
  expect(state.requests.filter(({ path }) => path === "/api/folders/3")).toHaveLength(1);
  expect(state.requests.some(({ path }) => path === "/api/folders")).toBe(false);
  await page.reload();
  await signIn(page);
  await expectDestination(page, isMobile);
  await page.goBack();
  await expect(page).toHaveURL("/privacy");
  await page.goto("/home");
  await expectHome(page);
});

for (const resource of ["/folders/3", "/links/7"] as const) {
  test(`guest login returns to the same direct resource ${resource}`, async ({ page }) => {
    await setUp(page, { guest: true });
    await page.goto(resource);
    await expect(page).toHaveURL("/login");
    await page.reload();
    await signIn(page);
    await expect(page).toHaveURL(resource);
    const label = resource.startsWith("/links") ? link.title : new RegExp(folder.name);
    await expect(page.getByText(label).filter({ visible: true }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "로그인", exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "사이드바 열기" })).toHaveCount(0);
    await page.reload();
    await expect(page).toHaveURL(resource);
  });
}

for (const { entry, expectedReturn } of [
  { entry: "/folders/3", expectedReturn: "/folders/3" },
  { entry: "/links/7", expectedReturn: "/links/7" },
  { entry: destination, expectedReturn: destination },
  { entry: `${destination}&unapproved=1`, expectedReturn: destination },
  { entry: "/folders/3?linkId=invalid&unapproved=1", expectedReturn: "/folders/3" },
]) {
  test(`public sidebar starts login on activation and returns through the callback from ${entry}`, async ({
    page,
    isMobile,
  }) => {
    const resource = entry.split("?")[0];
    const opensOverlay = expectedReturn === destination;
    const state = await setUp(page, { guest: true });
    const folderRead = { id: folder.id, name: folder.name, emoji: folder.emoji };
    const linkRead = {
      id: link.id,
      folderId: folder.id,
      folderName: folder.name,
      folderEmoji: folder.emoji,
      title: link.title,
      url: link.url,
      todos: [],
    };
    const accessTokens: (string | undefined)[] = [];
    await page.route(
      (url) => url.pathname === `/api${resource}`,
      (route) => {
        expect(route.request().method()).toBe("GET");
        const token = route.request().headers().authorization;
        accessTokens.push(token);
        if (opensOverlay && token) return route.fallback();
        return json(route, envelope(resource.startsWith("/links") ? linkRead : folderRead));
      },
    );
    await page.route(
      (url) =>
        ["/api/links", "/api/todos"].includes(url.pathname) &&
        url.searchParams.get("folderId") === String(folder.id),
      (route) => {
        expect(route.request().method()).toBe("GET");
        const token = route.request().headers().authorization;
        if (opensOverlay && token) return route.fallback();
        expect(token).toBeUndefined();
        return json(
          route,
          envelope({ contents: [], isEmpty: true, hasNext: false, nextCursor: null }),
        );
      },
    );

    await page.goto(entry);
    const heading = page.getByRole("heading", {
      name: new RegExp(resource.startsWith("/links") ? link.title : folder.name),
    });
    await expect(heading).toBeVisible();
    const sidebar = isMobile
      ? page.getByRole("dialog", { name: "사이드바" })
      : page.getByRole("navigation", { name: "사이드바" });
    const openSidebar = page.getByRole("button", { name: "사이드바 열기" });
    const sidebarLogin = sidebar.getByRole("button", { name: "로그인", exact: true });
    if (isMobile) {
      await expect(sidebarLogin).toHaveCount(0);
      await page.getByRole("button", { name: "뒤로" }).focus();
      await page.keyboard.press("Tab");
      await expect(openSidebar).toBeFocused();
      await page.keyboard.press("Enter");
      await expect(sidebarLogin).toBeFocused();
      await expect
        .poll(async () => (await sidebar.boundingBox())?.height ?? 0)
        .toBeGreaterThanOrEqual(page.viewportSize()!.height - 1);
      await page.keyboard.press("Escape");
      await expect(sidebar).toHaveCount(0);
      await expect(openSidebar).toBeFocused();
      await openSidebar.click();
      await sidebar.getByRole("button", { name: "닫기" }).click();
      await expect(sidebar).toHaveCount(0);
      await openSidebar.click();
    } else {
      await page.keyboard.press("Tab");
      await expect(sidebarLogin).toBeFocused();
    }
    await expect(sidebarLogin).toBeVisible();
    const sidebarBody = sidebar.getByTestId("guest-sidebar-body");
    const signInGroup = sidebarBody.getByTestId("guest-sidebar-sign-in");
    await expect(
      signInGroup.getByText("ALink에서 북마크 관리를 시작해보세요", { exact: true }),
    ).toBeVisible();
    await expect
      .poll(async () => {
        const body = (await sidebarBody.boundingBox())!;
        const group = (await signInGroup.boundingBox())!;
        const button = (await sidebarLogin.boundingBox())!;
        return Math.max(
          Math.abs(body.x + body.width / 2 - (button.x + button.width / 2)),
          Math.abs(body.y + body.height / 2 - (group.y + group.height / 2)),
        );
      })
      .toBeLessThanOrEqual(2);
    await expect(page).toHaveURL(entry);
    const getReturnDestination = () =>
      page.evaluate(() => sessionStorage.getItem("qlink-return-destination"));
    expect(await getReturnDestination()).toBeNull();
    expect(state.requests.filter(({ path }) => path === "/api/auth/sign")).toHaveLength(0);
    const privateRequests = () =>
      state.requests.filter(({ path }) => /^\/api\/(folders|links|todos)\b/.test(path));
    expect(privateRequests()).toEqual([]);

    if (isMobile) await sidebarLogin.click();
    else await page.keyboard.press("Enter");
    await expect(page).toHaveURL("/login");
    await expect(page.getByText(login, { exact: true })).toBeVisible();
    expect(await getReturnDestination()).toBe(expectedReturn);
    await page.reload();
    await page.getByText("네이버로 계속하기", { exact: true }).click();
    const callback = page.getByRole("link", { name: "인증 완료" });
    expect(new URL((await callback.getAttribute("href"))!).pathname).toBe("/auth/callback");
    await callback.click();
    if (opensOverlay) {
      await expectDestination(page, isMobile);
    } else {
      await expect(page).toHaveURL(expectedReturn);
      await expect(heading).toBeVisible();
      expect(privateRequests()).toEqual([]);
    }
    expect(await getReturnDestination()).toBeNull();
    await expect(openSidebar).toHaveCount(0);
    await expect(page.getByRole("button", { name: "로그인", exact: true })).toHaveCount(0);
    expect(accessTokens).toContain(undefined);
    expect(accessTokens).toContain("Bearer new-access-token");
    expect(state.requests.filter(({ path }) => path === "/api/auth/sign")).toHaveLength(1);
  });
}

for (const { label, href, fromLink } of [
  { label: "홈", href: "/home", fromLink: false },
  { label: "폴더", href: "/folders", fromLink: true },
  { label: "액션", href: "/todos", fromLink: false },
  { label: "설정", href: "/settings", fromLink: true },
]) {
  test(`guest mobile tab ${label} passes through login and opens ${href}`, async ({
    page,
    isMobile,
  }) => {
    test.skip(!isMobile, "The bottom navigation is mobile only.");
    const account = await setUp(page, { guest: true });
    const resource = fromLink ? `/links/${link.id}` : `/folders/${folder.id}`;
    const received: string[] = [];
    await page.route(
      (url) =>
        url.pathname === `/api${resource}` ||
        (["/api/links", "/api/todos"].includes(url.pathname) &&
          url.searchParams.get("folderId") === String(folder.id)),
      (route) => {
        const request = route.request();
        if (request.headers().authorization) return route.fallback();
        expect(request.method()).toBe("GET");
        const { pathname } = new URL(request.url());
        received.push(pathname);
        if (pathname === `/api${resource}`) {
          const read = fromLink
            ? {
                id: link.id,
                title: link.title,
                url: link.url,
                folderId: folder.id,
                folderName: folder.name,
                folderEmoji: folder.emoji,
                todos: [],
              }
            : { id: folder.id, name: folder.name, emoji: folder.emoji };
          return json(route, envelope(read));
        }
        return json(route, envelope({ contents: [], isEmpty: true, hasNext: false }));
      },
    );
    await page.goto(resource);
    await expect(
      page.getByRole("heading", { name: new RegExp(fromLink ? link.title : folder.name) }),
    ).toBeVisible();
    const tabs = page.getByRole("navigation", { name: "하단 내비게이션" });
    await expect(tabs.getByRole("button")).toHaveText(["홈", "폴더", "액션", "설정"]);
    await expect(tabs.getByRole("button", { name: "폴더" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(received).toContain(`/api${resource}`);
    if (href === "/home") {
      await page.getByRole("button", { name: "사이드바 열기" }).tap();
      await page
        .getByRole("dialog", { name: "사이드바" })
        .getByRole("button", { name: "로그인", exact: true })
        .tap();
      await expect(page).toHaveURL("/login");
      await page.goBack();
      await expect(page).toHaveURL(resource);
      await expect(tabs).toBeVisible();
    }

    await tabs.getByRole("button", { name: label, exact: true }).tap();
    await expect(page).toHaveURL("/login");
    await expect(page.getByRole("heading", { name: new RegExp(folder.name) })).toHaveCount(0);
    expect(account.requests.filter(({ path }) => path !== refreshPath)).toEqual([]);
    await signIn(page);
    await expect(page).toHaveURL(href);
    await expect(tabs.getByRole("button", { name: label, exact: true })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });
}

test("consent reload and failed save preserve the original destination", async ({
  page,
  isMobile,
}) => {
  await setUp(page, { needsConsent: true, consentFailures: 1 });
  await page.goto("/privacy");
  await page.goto(destination);
  await expect(page).toHaveURL("/agreements");
  await page.reload();
  await agree(page);
  await expect(page.getByRole("button", { name: "계속하기" })).toBeEnabled();
  await expect(page).toHaveURL("/agreements");
  await page.getByRole("button", { name: "계속하기" }).click();
  await expectDestination(page, isMobile);
  await page.goBack();
  await expect(page).toHaveURL("/privacy");
});

for (const guest of [true, false]) {
  test(`QR is protected for ${guest ? "guest" : "unagreed user"}`, async ({ page }) => {
    await setUp(page, { guest, needsConsent: true });
    await page.goto("/qr-scan");
    if (guest) await signIn(page);
    await expect(page).toHaveURL("/agreements");
    await expect(page.getByText("QR 스캔", { exact: true })).toHaveCount(0);
    await agree(page);
    await expect(page).toHaveURL("/qr-scan");
    await expect(page.getByText("QR 스캔", { exact: true }).first()).toBeVisible();
  });
}

test("privacy and invite are reachable by a guest", async ({ page }) => {
  await setUp(page, { guest: true });
  await page.goto("/privacy");
  await expect(page.getByText(/제1조 \(수집하는 개인정보 항목\)/)).toBeVisible();
  await page.goto("/invite?folderId=4&token=invite");
  await expect(page.getByText(/초대를 수락하려면 먼저 로그인/)).toBeVisible();
  await expect(page).toHaveURL(/\/invite\?/);
});

test("direct login runs consent and opens home", async ({ page }) => {
  await setUp(page, { guest: true, needsConsent: true });
  await page.goto("/login");
  await signIn(page);
  await agree(page);
  await expectHome(page);
});

for (const label of ["external", "missing", "auth"]) {
  test(`rejects the ${label} return value`, async ({ page }) => {
    await setUp(page, { guest: true });
    const fixtureUrl = `/__e2e__/return-destination.html?case=${label}`;
    await page.route(`**/return-destination.html?*`, (route) =>
      route.fulfill({
        path: path.resolve("tests/e2e/fixtures/return-destination.html"),
      }),
    );
    await page.goto(fixtureUrl);
    await signIn(page);
    await expectHome(page);
  });
}

for (const provider of ["카카오로 계속하기", "네이버로 계속하기"]) {
  test(`OAuth callback returns to the destination once via ${provider}`, async ({
    page,
    isMobile,
  }) => {
    const state = await setUp(page, { guest: true, needsConsent: true });
    await page.goto(destination);
    await page.getByText(provider, { exact: true }).click();
    const callback = page.getByRole("link", { name: "인증 완료" });
    const callbackAddress = (await callback.getAttribute("href"))!;
    await callback.click();
    await agree(page);
    await expectDestination(page, isMobile);
    await page.goBack();
    await expect(page).toHaveURL(
      provider === "네이버로 계속하기"
        ? /^https:\/\/nid\.naver\.com\/oauth2\.0\/authorize/
        : /\/__e2e__\/provider/,
    );
    await page.goBack();
    await expectHome(page);
    await page.goto(callbackAddress);
    await expect(page).toHaveURL("/");
    await expect(
      page.getByText(landing, { exact: true }).filter({ visible: true }).first(),
    ).toBeVisible();
    expect(state.requests.filter(({ path }) => path === "/api/auth/sign")).toHaveLength(1);

    if (provider === "네이버로 계속하기") {
      await page.goto("/settings");
      await page.getByLabel("계정 연결 추가").click();
      await page.getByText("카카오 계정 연결", { exact: true }).click();
      const currentCallback = await page
        .getByRole("link", { name: "인증 완료" })
        .getAttribute("href");

      await page.goto(callbackAddress);
      await expect(page).toHaveURL("/");
      await expect(
        page.getByText(landing, { exact: true }).filter({ visible: true }).first(),
      ).toBeVisible();
      const connections = () =>
        state.requests.filter(({ path }) => path === "/api/auth/connection");
      expect(connections()).toHaveLength(0);

      const rootReturn = new URL(currentCallback!);
      rootReturn.pathname = "/";
      await page.goto(rootReturn.href);
      await expect(page.getByText(landing, { exact: true }).first()).toBeVisible();
      await page.reload();
      await expect(page).toHaveURL(rootReturn.href);
      await expect(page.getByText(landing, { exact: true }).first()).toBeVisible();
      expect(connections()).toHaveLength(0);

      await page.goto(currentCallback!);
      await expect(page).toHaveURL("/settings");
      await expect(page.getByText("계정을 연결했어요.")).toBeVisible();
      expect(connections().map(({ body }) => body)).toEqual([
        { provider: "KAKAO", token: "kakao-token", platform: "WEB" },
      ]);
    }
  });
}

test("cancelled and failed external login can retry the original flow", async ({
  page,
  isMobile,
}) => {
  await setUp(page, { guest: true, signInFailures: 1 });
  await page.goto(destination);
  for (const [provider, result] of [
    ["카카오로 계속하기", "인증 취소"],
    ["네이버로 계속하기", "인증 취소"],
    ["카카오로 계속하기", "인증 완료"],
    ["네이버로 계속하기", "인증 완료"],
  ]) {
    await expect(page).toHaveURL("/login");
    await page.getByText(provider, { exact: true }).click();
    await page.getByRole("link", { name: result }).click();
  }
  await expectDestination(page, isMobile);
});

test("a fresh tab with an unsolicited callback cleans the URL and opens landing", async ({
  page,
}) => {
  const state = await setUp(page, { guest: true });
  await page.goto("/privacy");
  await page.goto("/auth/callback?code=unsolicited&state=kakao:unknown");
  await expect(page).toHaveURL("/");
  await expect(
    page.getByText(landing, { exact: true }).filter({ visible: true }).first(),
  ).toBeVisible();
  await page.reload();
  await expect(page).toHaveURL("/");
  await page.goBack();
  await expect(page).toHaveURL("/privacy");
  expect(state.requests.filter(({ path }) => path === "/api/auth/sign")).toHaveLength(0);
});

for (const provider of ["카카오", "네이버"]) {
  test(`${provider} redirect connection returns to Settings on cancel and success`, async ({
    page,
  }) => {
    const state = await setUp(page);
    await page.goto("/settings");
    const connections = () => state.requests.filter(({ path }) => path === "/api/auth/connection");

    for (const result of ["인증 취소", "인증 완료"]) {
      await page.getByLabel("계정 연결 추가").click();
      await page.getByText(`${provider} 계정 연결`, { exact: true }).click();
      await page.getByRole("link", { name: result }).click();
      await expect(page).toHaveURL("/settings");
      await expect(page.getByLabel("계정 연결 추가")).toBeVisible();
      if (result === "인증 취소") {
        expect(connections()).toHaveLength(0);
        await expect(page.getByText("연결에 실패했어요.")).toHaveCount(0);
      }
    }
    await expect(page.getByText("계정을 연결했어요.")).toBeVisible();
    expect(connections()).toHaveLength(1);
    await page.reload();
    await expect(page).toHaveURL("/settings");
    await expect(page.getByText("계정을 연결했어요.")).toHaveCount(0);
    expect(connections()).toHaveLength(1);
  });
}

for (const { session, expiredAtApi } of [
  { session: "missing at callback", expiredAtApi: false },
  { session: "rejected by the connection API", expiredAtApi: true },
]) {
  test(`a connection session ${session} shows failure after reauthentication in Settings`, async ({
    page,
  }) => {
    const state = await setUp(page, { guest: true, connectionSessionExpired: expiredAtApi });
    await page.addInitScript(() => {
      if (!sessionStorage.getItem("connection-session-seeded")) {
        sessionStorage.setItem("connection-session-seeded", "1");
        sessionStorage.setItem("qlink-auth", JSON.stringify({ accessToken: "expired-session" }));
      }
    });
    await page.goto("/settings");
    await page.getByLabel("계정 연결 추가").click();
    await page.getByText("카카오 계정 연결", { exact: true }).click();

    const providerReturn = page.getByRole("link", { name: "인증 완료" });
    await expect(providerReturn).toBeVisible();
    if (!expiredAtApi) await page.evaluate(() => sessionStorage.removeItem("qlink-auth"));
    const kakaoExchanges: string[] = [];
    page.on("request", (request) => {
      if (request.url() === "https://kauth.kakao.com/oauth/token") {
        kakaoExchanges.push(request.method());
      }
    });
    await providerReturn.click();
    await expect(page).toHaveURL("/login");
    await expect(page.getByText("연결에 실패했어요.")).toHaveCount(0);
    const connectionPath = "/api/auth/connection";
    const authRequests = () =>
      state.requests
        .filter(({ path }) => path === connectionPath || path === refreshPath)
        .map(({ path }) => path);
    const expectedRequests = expiredAtApi ? [connectionPath, refreshPath] : [refreshPath];
    expect(authRequests()).toEqual(expectedRequests);

    // Complete reauthentication through a full-page provider redirect.
    await page.getByText("네이버로 계속하기", { exact: true }).click();
    await page.getByRole("link", { name: "인증 완료" }).click();
    await expect(page).toHaveURL("/settings");
    await expect(page.getByLabel("계정 연결 추가")).toBeVisible();
    await expect(page.getByText("연결에 실패했어요.")).toBeVisible();
    expect(kakaoExchanges).toHaveLength(expiredAtApi ? 1 : 0);
    expect(authRequests()).toEqual(expectedRequests);

    await page.reload();
    await expect(page.getByLabel("계정 연결 추가")).toBeVisible();
    await expect(page.getByText("연결에 실패했어요.")).toHaveCount(0);
  });
}

for (const { mode, provider, apiPath } of [
  { mode: "login", provider: "네이버로 계속하기", apiPath: "/api/auth/sign" },
  { mode: "connect", provider: "카카오 계정 연결", apiPath: "/api/auth/connection" },
]) {
  test(`the ${mode} callback scrubs credentials and does not replay on reload during a request`, async ({
    page,
  }) => {
    const response = deferred();
    try {
      const guest = mode === "login";
      const state = await setUp(page, { guest, callbackResponse: response.promise });
      await page.goto(guest ? destination : "/settings");
      if (!guest) await page.getByLabel("계정 연결 추가").click();
      await page.getByText(provider, { exact: true }).click();
      await page.getByRole("link", { name: "인증 완료" }).click();

      const requests = () => state.requests.filter(({ path }) => path === apiPath).length;
      await expect.poll(requests).toBe(1);
      await expect(page).toHaveURL("/auth/callback");
      await expect(page.getByText(checking).filter({ visible: true })).toBeVisible();
      await page.reload();
      await expect(page).toHaveURL("/");
      await expect(
        page.getByText(landing, { exact: true }).filter({ visible: true }).first(),
      ).toBeVisible();
      expect(requests()).toBe(1);
    } finally {
      response.release();
    }
  });
}

for (const provider of ["Apple", "Google"]) {
  test(`${provider} popup login retries after closure and resumes the protected destination`, async ({
    page,
    isMobile,
  }) => {
    const state = await setUp(page, { guest: true, needsConsent: true, cancelPopupOnce: true });
    await page.goto(destination);
    const button = page.getByText(`${provider}로 계속하기`, { exact: true });
    await button.click();
    await expect(page).toHaveURL("/login");
    await expect(page.getByText("로그인에 실패했어요")).toHaveCount(0);
    expect(state.requests.filter(({ path }) => path === "/api/auth/sign")).toHaveLength(0);
    await button.click();
    await agree(page);
    await expectDestination(page, isMobile);
    expect(
      state.requests.filter(({ path }) => path === "/api/auth/sign").map(({ body }) => body),
    ).toEqual([
      {
        provider: provider.toUpperCase(),
        token: `${provider.toLowerCase()}-token`,
        platform: "WEB",
      },
    ]);
  });

  test(`${provider} popup connection retries after closure and stays on Settings`, async ({
    page,
  }) => {
    const state = await setUp(page, { cancelPopupOnce: true });
    await page.goto("/settings");
    await page.getByLabel("계정 연결 추가").click();
    const button = page.getByText(`${provider}로 계속하기`, { exact: true });
    await button.click();
    await expect(page.getByText("계정 연결", { exact: true }).first()).toBeVisible();
    const connections = () => state.requests.filter(({ path }) => path === "/api/auth/connection");
    expect(connections()).toHaveLength(0);
    await button.click();
    await expect(page.getByText("계정을 연결했어요.")).toBeVisible();
    await expect(page).toHaveURL("/settings");
    expect(connections().map(({ body }) => body)).toEqual([
      {
        provider: provider.toUpperCase(),
        token: `${provider.toLowerCase()}-token`,
        platform: "WEB",
      },
    ]);
  });
}

for (const [invite, share] of [
  ["success", false],
  ["success", true],
  ["failure", true],
] as const) {
  test(`invite ${invite}, share=${share}, then resume the protected destination`, async ({
    page,
  }) => {
    const state = await setUp(page, { needsConsent: true, invite, share });
    await page.goto("/folders/3");
    await agree(page);
    await expect(page).toHaveURL(/\/invite\?/);
    const isAccepted = invite === "success";
    await page
      .getByRole("button", { name: isAccepted ? "폴더로 이동" : "홈", exact: true })
      .click();
    await expect(page).toHaveURL(isAccepted ? "/folders/4" : "/home");
    const inviteRequests = () =>
      state.requests.filter(({ path }) => path === "/api/folders/4/members");
    expect(inviteRequests().map(({ body }) => body)).toEqual([
      { invitation: "original-invite-token" },
    ]);
    const sharedUrlField = page.getByRole("textbox", { name: "URL", exact: true });
    if (!isAccepted) await expectHome(page);
    await expect(sharedUrlField).toHaveCount(0);
    await page.reload();
    if (isAccepted) await page.goto("/home");
    if (share) {
      await expect(sharedUrlField).toHaveValue(sharedUrl);
      await page.getByRole("button", { name: "닫기", exact: true }).last().click();
    }
    await expect(page).toHaveURL("/folders/3");
    await expect(
      page.getByText(new RegExp(folder.name)).filter({ visible: true }).first(),
    ).toBeVisible();
    expect(inviteRequests()).toHaveLength(1);
    await page.goto("/home");
    await expectHome(page);
    await expect(sharedUrlField).toHaveCount(0);
    if (!isAccepted) {
      await page.goto("/invite?folderId=4&token=original-invite-token");
      await expect(page.getByText("만료된 초대")).toBeVisible();
      expect(inviteRequests()).toHaveLength(2);
    }
  });
}
