import { type Locator, type Page, type Route, expect, test } from "@playwright/test";

import { envelope, mockApi } from "./support/mock-api";

// #103: 설정 › 연결된 계정 — every connect result is visible. Success and 409 close the
// sheet/dialog with their toast, any other failure shows 연결에 실패했어요. above everything,
// and only a provider cancel keeps the sheet open without a toast. The Kakao/Naver redirect
// return follows the same rule.

type GoogleBehavior = "token" | "close";

const GOOGLE_SDK = "https://accounts.google.com/gsi/client";
const KAKAO_SDK = "https://t1.kakaocdn.net/kakao_js_sdk/2.7.9/kakao.min.js";
const KAKAO_TOKEN = "https://kauth.kakao.com/oauth/token";
const NAVER_SDK = "https://static.nid.naver.com/js/naveridlogin_js_sdk_2.0.2.js";
const KAKAO_STATE = "kakao:e2e";
// The Kakao web SDK keeps its REST key AES-encrypted in localStorage under `krk`; this is
// "e2e-rest-key", so the code exchange runs even when no Kakao keys are configured.
const KAKAO_REST_KEY_ENTRY = "U2FsdGVkX1+4Zs+E6h0gXY4Ws+DfG79Q9r/xPhQ/5QA=";

const GOOGLE_SDK_STUB = `window.google = { accounts: { oauth2: { initTokenClient: (config) => ({
  requestAccessToken: () => setTimeout(() => (window.__googleRequests += 1) && window.__googleBehavior === "close"
    ? config.error_callback && config.error_callback({ type: "popup_closed" })
    : config.callback({ access_token: "google-web-token" }), 300),
}) } } };`;
const NAVER_SDK_STUB = `window.naver = { LoginWithNaverId: class {
  init() {}
  getLoginStatus(callback) { this.accessToken = { accessToken: "naver-web-token" }; callback(true); }
} };`;

function connectionResponse(status: number, code?: string) {
  const body = code
    ? { success: false, data: null, error: { code, message: code } }
    : { success: true, data: { id: 9 }, error: null };
  return { status, contentType: "application/json", body: JSON.stringify(body) };
}

async function setUp(
  page: Page,
  options: { connection: { status: number; code?: string }; google?: GoogleBehavior },
) {
  const providers = [{ id: 1, type: "KAKAO" }];
  await page.addInitScript((behavior) => {
    Object.assign(window, {
      __googleBehavior: behavior,
      __googleRequests: 0,
      Kakao: {
        isInitialized: () => true,
        init: () => {},
        Auth: { setAccessToken: () => {}, authorize: () => {} },
      },
    });
  }, options.google ?? "token");
  const script = (body: string) => (route: Route) =>
    route.fulfill({ status: 200, contentType: "application/javascript", body });
  await page.route(GOOGLE_SDK, script(GOOGLE_SDK_STUB));
  await page.route(KAKAO_SDK, (route) => route.abort());
  await page.route(NAVER_SDK, script(NAVER_SDK_STUB));
  await page.route(KAKAO_TOKEN, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "access-control-allow-origin": "*" },
      body: JSON.stringify({
        token_type: "bearer",
        access_token: "kakao-web-token",
        expires_in: 3600,
        refresh_token: "r",
        refresh_token_expires_in: 7200,
      }),
    }),
  );
  return mockApi(page, {
    handlers: {
      "GET /api/users/me/settings": (route) =>
        route.fulfill({
          contentType: "application/json",
          body: JSON.stringify(
            envelope({
              display: { theme: "light", accent: "gray" },
              behavior: { allowsReminderNotification: false },
              ai: { defaultProvider: null, defaultModel: null },
              providers,
            }),
          ),
        }),
      "POST /api/auth/connection": async (route) => {
        const { status, code } = options.connection;
        if (status === 201) {
          const provider = (route.request().postDataJSON() as { provider: string }).provider;
          providers.push({ id: providers.length + 1, type: provider });
        }
        await route.fulfill(connectionResponse(status, code));
      },
    },
  });
}

async function openConnectSheet(page: Page) {
  await page.goto("/settings");
  await page.getByLabel("계정 연결 추가").click();
  await expect(page.getByText("계정 연결", { exact: true })).toBeVisible();
}

/** The toast is the topmost element at its own centre, so nothing (sheet, backdrop) covers it. */
async function expectOnTop(toast: Locator) {
  await expect(toast).toBeVisible();
  const covered = await toast.evaluate((node) => {
    const rect = node.getBoundingClientRect();
    const top = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
    return !(top && (node === top || node.contains(top) || top.contains(node)));
  });
  expect(covered).toBe(false);
}

function connectionRequests(state: Awaited<ReturnType<typeof setUp>>) {
  return state.requests.filter(
    (request) => request.method === "POST" && request.path === "/api/auth/connection",
  );
}

test.describe("계정 연결 시트", () => {
  test("201 closes the sheet, shows the success toast and adds the chip", async ({ page }) => {
    const state = await setUp(page, { connection: { status: 201 } });
    await openConnectSheet(page);

    await page.getByText("Google로 계속하기").click();

    await expectOnTop(page.getByText("계정을 연결했어요."));
    await expect(page.getByText("계정 연결", { exact: true })).toHaveCount(0);
    await expect(page.getByLabel("GOOGLE 연결됨")).toBeVisible();
    expect(connectionRequests(state).map((request) => request.body)).toEqual([
      { provider: "GOOGLE", token: "google-web-token", platform: "WEB" },
    ]);
  });

  for (const [code, title] of [
    ["AUTH_409_0001", "이미 연결된 계정이에요."],
    ["AUTH_409_0002", "이미 다른 사용자에 연결된 계정이에요."],
  ]) {
    test(`409 ${code} closes the sheet with its notice`, async ({ page }) => {
      await setUp(page, { connection: { status: 409, code } });
      await openConnectSheet(page);

      await page.getByText("Google로 계속하기").click();

      await expectOnTop(page.getByText(title));
      await expect(page.getByText("계정 연결", { exact: true })).toHaveCount(0);
      await expect(page.getByLabel("GOOGLE 연결됨")).toHaveCount(0);
    });
  }

  test("500 shows the failure toast uncovered by the sheet", async ({ page }) => {
    await setUp(page, { connection: { status: 500, code: "COMMON_500_0001" } });
    await openConnectSheet(page);

    await page.getByText("Google로 계속하기").click();

    await expectOnTop(page.getByText("연결에 실패했어요."));
    await expect(page.getByText("잠시 후 다시 시도해주세요.")).toBeVisible();
    await expect(page.getByText("계정 연결", { exact: true })).toHaveCount(0);
    await expect(page.getByLabel("GOOGLE 연결됨")).toHaveCount(0);
  });

  test("closing the provider popup keeps the sheet open without a toast", async ({ page }) => {
    const state = await setUp(page, { connection: { status: 201 }, google: "close" });
    await openConnectSheet(page);
    const google = page.getByText("Google로 계속하기");
    const popupRequests = () =>
      page.evaluate(() => (window as unknown as { __googleRequests: number }).__googleRequests);

    await google.click();
    await expect.poll(popupRequests).toBe(1);

    await expect(page.getByText("계정 연결", { exact: true })).toBeVisible();
    await expect(page.getByText("연결에 실패했어요.")).toHaveCount(0);
    await expect(page.getByText("계정을 연결했어요.")).toHaveCount(0);
    await google.click();
    await expect.poll(popupRequests).toBe(2);
    expect(connectionRequests(state)).toHaveLength(0);
  });
});

test.describe("카카오·네이버 연결 리다이렉트 복귀", () => {
  async function returnFrom(page: Page, path: string) {
    await page.addInitScript(
      ({ state, restKey }) => {
        window.sessionStorage.setItem("qlink.oauth.state", state);
        window.sessionStorage.setItem("qlink.oauth.mode", "connect");
        if (!window.localStorage.getItem("krk")) window.localStorage.setItem("krk", restKey);
      },
      { state: KAKAO_STATE, restKey: KAKAO_REST_KEY_ENTRY },
    );
    await page.goto(path);
  }

  test("a Kakao connect return with a 500 shows the failure toast", async ({ page }) => {
    const state = await setUp(page, { connection: { status: 500, code: "COMMON_500_0001" } });

    await returnFrom(page, `/?code=e2e-code&state=${encodeURIComponent(KAKAO_STATE)}`);

    await expectOnTop(page.getByText("연결에 실패했어요."));
    expect(connectionRequests(state).map((request) => request.body)).toEqual([
      { provider: "KAKAO", token: "kakao-web-token", platform: "WEB" },
    ]);
  });

  test("a Naver connect return with a 500 shows the failure toast", async ({ page }) => {
    const state = await setUp(page, { connection: { status: 500, code: "COMMON_500_0001" } });

    await returnFrom(page, "/#access_token=naver-web-token&state=n");

    await expectOnTop(page.getByText("연결에 실패했어요."));
    expect(connectionRequests(state).map((request) => request.body)).toEqual([
      { provider: "NAVER", token: "naver-web-token", platform: "WEB" },
    ]);
  });

  test("a Kakao connect return with a 201 shows the success toast", async ({ page }) => {
    await setUp(page, { connection: { status: 201 } });

    await returnFrom(page, `/?code=e2e-code&state=${encodeURIComponent(KAKAO_STATE)}`);

    await expectOnTop(page.getByText("계정을 연결했어요."));
  });
});
