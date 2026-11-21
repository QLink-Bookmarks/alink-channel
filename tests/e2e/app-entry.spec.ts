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

function json(route: Route, data: unknown, status = 200) {
  return route.fulfill({ status, json: data });
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
  } = {},
) {
  let agreed = !options.needsConsent;
  let consentFailures = options.consentFailures ?? 0;
  let profileFailures = options.profileFailures ?? 0;
  let signInFailures = options.signInFailures ?? 0;
  const invite = { folderId: "4", token: "original-invite-token" };
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
            authorize: ({ state }: { state: string }) => {
              location.href = "/__e2e__/provider?kakao=" + encodeURIComponent(state);
            },
          },
        },
      });
      localStorage.setItem("krk", "U2FsdGVkX1+4Zs+E6h0gXY4Ws+DfG79Q9r/xPhQ/5QA=");
    },
    { pendingInvite: options.invite && invite, pendingShare: options.share && sharedUrl },
  );
  await page.route(kakaoSdk, (route) => route.abort());
  await page.route("https://appleid.cdn-apple.com/**", (route) => route.abort());
  await page.route("https://kauth.kakao.com/oauth/token", (route) =>
    json(route, { access_token: "kakao-token", token_type: "bearer", expires_in: 3600 }),
  );
  await page.route(googleSdk, (route) =>
    route.fulfill({
      contentType: "application/javascript",
      body: `window.google = { accounts: { oauth2: { initTokenClient: ({ callback }) => ({
      requestAccessToken: () => callback({ access_token: "google-token" }),
    }) } } };`,
    }),
  );
  await page.route("https://nid.naver.com/oauth2.0/authorize?*", (route) => {
    const requestUrl = new URL(route.request().url());
    const callbackOrigin = requestUrl.searchParams.get("redirect_uri")!;
    const state = requestUrl.searchParams.get("state")!;
    return route.fulfill({
      status: 302,
      headers: {
        location: `${callbackOrigin}/__e2e__/provider?naver=${encodeURIComponent(state)}`,
      },
    });
  });
  await page.route("**/__e2e__/provider?*", (route) => {
    const params = new URL(route.request().url()).searchParams;
    const state = encodeURIComponent(params.get("kakao") ?? params.get("naver") ?? "");
    const success = params.has("kakao")
      ? `/?code=e2e-code&state=${state}`
      : `/#access_token=naver-token&state=${state}`;
    const cancel = params.has("kakao")
      ? `/?error=access_denied&state=${state}`
      : `/#error=access_denied&state=${state}`;
    return route.fulfill({
      contentType: "text/html; charset=utf-8",
      body: `<a href="${success}">인증 완료</a><a href="${cancel}">인증 취소</a>`,
    });
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
      "POST /api/auth/sign": (route) => {
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
      "POST /api/auth/connection": (route) => json(route, envelope({ id: 9 }), 201),
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
  await expect(page.getByText(link.title, { exact: true }).first()).toBeVisible();
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
        await page.goto("/app");
        await page.reload();
      }
      if (options.guest) await signIn(page);
      if (options.needsConsent) await agree(page);
      await expectHome(page);
      await page.goBack();
      await expect(page).toHaveURL(entry === "cta" ? "/" : "/privacy");
    });
  }

  test(`public folder address stays outside the gate for ${status}`, async ({ page }) => {
    await setUp(page, options);
    await page.goto("/privacy");
    const publicFolder = "/public/folders/116-preview";
    await page.goto(publicFolder);
    await page.reload();
    await expect(page).toHaveURL(publicFolder);
    await expect(page.getByText(login, { exact: true })).toHaveCount(0);
    await page.goBack();
    await expect(page).toHaveURL("/privacy");
  });
}

test("app waits for session restoration without going through login or landing", async ({
  page,
}) => {
  const refresh = deferred();
  await setUp(page, { refresh: refresh.promise });
  await page.goto("/app");
  await expect(page.getByText(checking)).toBeVisible();
  await expect(page).toHaveURL("/app");
  await expect(page.getByText(login, { exact: true })).toHaveCount(0);
  await expect(page.getByText(landing).filter({ visible: true })).toHaveCount(0);
  await expect(page.getByText(consent)).toHaveCount(0);
  refresh.release();
  await expectHome(page);
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
  await expect(page.getByRole("button", { name: "다시 확인" })).toBeVisible({ timeout: 12_000 });
  await expect(page.getByText(folder.name).filter({ visible: true })).toHaveCount(0);
  await page.getByRole("button", { name: "다시 확인" }).click();
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
  await expect(page.getByRole("button", { name: "다시 확인" })).toHaveCount(0);
});

for (const route of ["/folders/3", "/links/7", "/qr-scan"] as const) {
  test(`agreed user can open, reload and leave ${route}`, async ({ page, isMobile }) => {
    await setUp(page);
    await page.goto("/privacy");
    await page.goto(route);
    const isLink = route === "/links/7";
    const screen = isLink
      ? link.title
      : route === "/folders/3"
        ? new RegExp(folder.name)
        : "QR 스캔";
    const expectedUrl = isLink && !isMobile ? "/links?linkId=7" : route;
    await expect(
      page.getByText(screen, { exact: true }).filter({ visible: true }).first(),
    ).toBeVisible();
    await page.reload();
    await expect(page).toHaveURL(expectedUrl);
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
  expect(state.requests.some(({ path }) => path.startsWith("/api/folders/"))).toBe(false);
  await page.reload();
  await signIn(page);
  await expectDestination(page, isMobile);
  await page.goBack();
  await expect(page).toHaveURL("/privacy");
  await page.goto("/app");
  await expectHome(page);
});

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
    await expect(page).toHaveURL(/\/__e2e__\/provider/);
    await page.goBack();
    await expectHome(page);
    await page.goto(callbackAddress);
    await expect(page).toHaveURL("/");
    await expect(page.getByText(landing, { exact: true }).first()).toBeVisible();
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
      await expect(page.getByText(landing, { exact: true }).first()).toBeVisible();
      const connections = () =>
        state.requests.filter(({ path }) => path === "/api/auth/connection");
      expect(connections()).toHaveLength(0);

      await page.goto(currentCallback!);
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

test("account connection from Settings shows the outcome and goes home", async ({ page }) => {
  await setUp(page);
  await page.goto("/settings");
  await page.getByLabel("계정 연결 추가").click();
  await page.getByText("카카오 계정 연결", { exact: true }).click();
  await page.getByRole("link", { name: "인증 완료" }).click();
  await expect(page.getByText("계정을 연결했어요.")).toBeVisible();
  await expectHome(page);
});

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
    await page.goto("/app");
    const sharedUrlField = page.getByRole("textbox", { name: "URL", exact: true });
    if (share) {
      await expect(sharedUrlField).toHaveValue(sharedUrl);
      await page.getByRole("button", { name: "닫기", exact: true }).last().click();
    }
    await expect(page).toHaveURL("/folders/3");
    await expect(
      page.getByText(new RegExp(folder.name)).filter({ visible: true }).first(),
    ).toBeVisible();
    expect(inviteRequests()).toHaveLength(1);
    await page.goto("/app");
    await expectHome(page);
    await expect(sharedUrlField).toHaveCount(0);
    if (!isAccepted) {
      await page.goto("/invite?folderId=4&token=original-invite-token");
      await expect(page.getByText("만료된 초대")).toBeVisible();
      expect(inviteRequests()).toHaveLength(2);
    }
  });
}
