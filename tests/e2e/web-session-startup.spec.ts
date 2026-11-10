import { type Page, type Route, expect, test } from "@playwright/test";

import { envelope, makeDetail, makeLink, mockApi } from "./support/mock-api";

// #104 web keeps only the access token per tab and restores a new tab once through the refresh cookie.

const REFRESH_PATH = "/api/auth/token/refresh/web";
const CHECKING = "인증 정보를 확인 중입니다…";
const LANDING = "웹으로 시작하기";
const LOGIN = "카카오로 계속하기";
const RELOGIN_TOAST = "다시 로그인해주세요";

const link = makeLink({ id: 7, title: "새 탭에서 연 링크" });

type RefreshReply = "success" | "unauthorized" | "forbidden" | "offline";

const refreshErrors = {
  unauthorized: { status: 401, code: "AUTH_REFRESH_TOKEN_MISSING" },
  forbidden: { status: 403, code: "AUTH_CSRF_TOKEN_INVALID" },
} as const;

function fulfillRefresh(route: Route, reply: RefreshReply, accessToken = "cookie-access-token") {
  if (reply === "offline") {
    return route.abort("internetdisconnected");
  }
  if (reply === "success") {
    return route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify(envelope({ accessToken })),
    });
  }
  const { status, code } = refreshErrors[reply];
  return route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify({ success: false, data: null, error: { code, message: code } }),
  });
}

/** Records every listed text that becomes visible from the first parsed node. */
async function recordTexts(page: Page, texts: string[]) {
  await page.addInitScript((watched) => {
    const target = window as unknown as { __seenTexts: string[] };
    target.__seenTexts = [];
    const isVisible = (text: string) => {
      const result = document.evaluate(
        `//*[normalize-space(text())="${text}"]`,
        document,
        null,
        XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
        null,
      );
      for (let index = 0; index < result.snapshotLength; index += 1) {
        const node = result.snapshotItem(index);
        if (node instanceof Element && node.checkVisibility({ opacityProperty: true })) return true;
      }
      return false;
    };
    const record = () => {
      for (const text of watched) {
        if (!target.__seenTexts.includes(text) && isVisible(text)) target.__seenTexts.push(text);
      }
    };
    new MutationObserver(record).observe(document, {
      attributes: true,
      characterData: true,
      childList: true,
      subtree: true,
    });
    record();
  }, texts);
}

async function seenTexts(page: Page): Promise<string[]> {
  return page.evaluate(() => (window as unknown as { __seenTexts: string[] }).__seenTexts ?? []);
}

async function storedAuthRecord(page: Page) {
  return page.evaluate(() => {
    const raw = window.sessionStorage.getItem("qlink-auth");
    return raw ? (JSON.parse(raw) as Record<string, unknown>) : null;
  });
}

/** A new tab: empty sessionStorage, the refresh endpoint answered by `reply`. */
async function openNewTab(page: Page, reply: RefreshReply | ((route: Route) => Promise<void>)) {
  const state = await mockApi(page, {
    seedSession: false,
    links: [link],
    details: { 7: makeDetail(link) },
    handlers: {
      [`POST ${REFRESH_PATH}`]: (route) =>
        typeof reply === "function" ? reply(route) : fulfillRefresh(route, reply),
    },
  });
  const refreshCalls = () =>
    state.requests.filter((request) => request.path === REFRESH_PATH).length;
  return { state, refreshCalls };
}

function homeScreen(page: Page) {
  return page.getByRole("textbox", { name: "링크 · 요약 · 태그 검색…" }).filter({ visible: true });
}

function landingScreen(page: Page) {
  return page.getByText(LANDING).filter({ visible: true }).first();
}

async function expectNoReloginToast(page: Page) {
  await page.waitForTimeout(500);
  await expect(page.getByText(RELOGIN_TOAST, { exact: true })).toHaveCount(0);
}

test.describe("new tab in a signed-in browser", () => {
  test("/ shows the checking screen, then home, never the landing or login", async ({ page }) => {
    let release: () => void = () => {};
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    const { refreshCalls } = await openNewTab(page, async (route) => {
      await held;
      await fulfillRefresh(route, "success");
    });
    await recordTexts(page, [LANDING, LOGIN]);

    await page.goto("/");
    await expect(page.getByText(CHECKING, { exact: true })).toBeVisible();
    release();

    await expect(page).toHaveURL(/\/home$/);
    await expect(homeScreen(page)).toBeVisible();
    expect(await seenTexts(page)).toEqual([]);
    expect(refreshCalls()).toBe(1);
    expect(await storedAuthRecord(page)).toEqual({ accessToken: "cookie-access-token" });
  });

  test("reloading the restored tab several times makes no refresh call", async ({ page }) => {
    const { refreshCalls } = await openNewTab(page, "success");

    await page.goto("/");
    await expect(page).toHaveURL(/\/home$/);
    for (let count = 0; count < 3; count += 1) {
      await page.reload();
      await expect(homeScreen(page)).toBeVisible();
    }

    expect(refreshCalls()).toBe(1);
    expect(await storedAuthRecord(page)).toEqual({ accessToken: "cookie-access-token" });
    await expectNoReloginToast(page);
  });

  test("a link detail address opens that link, not the login screen", async ({ page }) => {
    await openNewTab(page, "success");
    await recordTexts(page, [LANDING, LOGIN]);

    await page.goto("/links/7");

    await expect(page.getByText(link.title).first()).toBeVisible();
    expect(page.url()).not.toContain("/login");
    expect(await seenTexts(page)).toEqual([]);
  });

  test("/login never shows the login screen and opens home", async ({ page }) => {
    await openNewTab(page, "success");
    await recordTexts(page, [LANDING, LOGIN]);

    await page.goto("/login");

    await expect(page).toHaveURL(/\/home$/);
    await expect(homeScreen(page)).toBeVisible();
    expect(await seenTexts(page)).toEqual([]);
  });

  test("a folder invite link opens the invite acceptance, not a login request", async ({
    page,
  }) => {
    const { state } = await openNewTab(page, "success");
    await recordTexts(page, [LOGIN]);

    await page.goto("/invite?token=invite-token&folderId=3");

    await expect
      .poll(() =>
        state.requests.some((r) => r.method === "PUT" && r.path === "/api/folders/3/members"),
      )
      .toBe(true);
    expect(await seenTexts(page)).toEqual([]);
  });

  test("two tabs opened at once both open home", async ({ page, context }) => {
    const second = await context.newPage();
    await openNewTab(page, "success");
    await openNewTab(second, "success");

    await Promise.all([page.goto("/"), second.goto("/")]);

    await expect(page).toHaveURL(/\/home$/);
    await expect(second).toHaveURL(/\/home$/);
    await second.close();
  });

  test("a duplicated tab starts from its copied token without the checking screen", async ({
    page,
  }) => {
    const state = await mockApi(page, {
      links: [link],
      handlers: { [`POST ${REFRESH_PATH}`]: (route) => fulfillRefresh(route, "success") },
    });
    await recordTexts(page, [CHECKING, LOGIN]);

    await page.goto("/home");

    await expect(homeScreen(page)).toBeVisible();
    expect(await seenTexts(page)).toEqual([]);
    expect(state.requests.filter((request) => request.path === REFRESH_PATH)).toHaveLength(0);
  });

  test("an account with required consent left opens the agreements screen", async ({ page }) => {
    await mockApi(page, {
      seedSession: false,
      handlers: {
        [`POST ${REFRESH_PATH}`]: (route) => fulfillRefresh(route, "success"),
        "GET /api/users/me": (route) =>
          route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify(
              envelope({
                id: 1,
                username: "e2e",
                nickname: "테스터",
                role: "USER",
                avatarEmoji: "🌸",
                allowsPrivacy: false,
                allowsAiUsage: false,
              }),
            ),
          }),
      },
    });

    await page.goto("/");

    await expect(page).toHaveURL(/\/agreements$/);
  });

  test("after a browser restart the first tab is restored from the cookie", async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    const { refreshCalls } = await openNewTab(page, "success");

    await page.goto("/");

    await expect(page).toHaveURL(/\/home$/);
    expect(refreshCalls()).toBe(1);
    await context.close();
  });
});

test.describe("new tab when the refresh does not succeed", () => {
  for (const reply of ["unauthorized", "forbidden", "offline"] as const) {
    test(`${reply}: / shows the landing without an error notice`, async ({ page }) => {
      const { refreshCalls } = await openNewTab(page, reply);

      await page.goto("/");

      await expect(landingScreen(page)).toBeVisible();
      expect(page.url()).not.toContain("/home");
      expect(refreshCalls()).toBe(1);
      await expectNoReloginToast(page);
    });
  }

  test("a link detail address shows the login screen without an error notice", async ({ page }) => {
    await openNewTab(page, "unauthorized");

    await page.goto("/links/7");

    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByText(LOGIN).first()).toBeVisible();
    await expectNoReloginToast(page);
  });

  test("offline then back online: reloading restores home", async ({ page }) => {
    let reply: RefreshReply = "offline";
    await openNewTab(page, (route) => fulfillRefresh(route, reply));

    await page.goto("/");
    await expect(landingScreen(page)).toBeVisible();
    reply = "success";
    await page.reload();

    await expect(page).toHaveURL(/\/home$/);
  });

  test("a refresh slower than the wait cap shows the landing and a late success is dropped", async ({
    page,
  }) => {
    let answer: () => void = () => {};
    const answered = new Promise<void>((resolve) => {
      answer = resolve;
    });
    await openNewTab(page, async (route) => {
      await answered;
      await fulfillRefresh(route, "success");
    });
    const failed: string[] = [];
    const finished: string[] = [];
    page.on("requestfailed", (request) => failed.push(request.url()));
    page.on("requestfinished", (request) => finished.push(request.url()));

    await page.goto("/");
    await expect(landingScreen(page)).toBeVisible({ timeout: 8_000 });
    answer();

    await expect.poll(() => finished.some((url) => url.endsWith(REFRESH_PATH))).toBe(true);
    await page.waitForTimeout(1_000);
    expect(failed.filter((url) => url.endsWith(REFRESH_PATH))).toEqual([]);
    expect(page.url()).not.toContain("/home");
    await expect(landingScreen(page)).toBeVisible();
    expect(await storedAuthRecord(page)).toBeNull();
    await expectNoReloginToast(page);
  });

  test("signed out, then a browser restart, opens the landing", async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await openNewTab(page, "unauthorized");

    await page.goto("/");

    await expect(landingScreen(page)).toBeVisible();
    await expectNoReloginToast(page);
    await context.close();
  });
});

test.describe("tab session record", () => {
  test("a legacy record with a refresh token is rewritten with the access token only", async ({
    page,
  }) => {
    const state = await mockApi(page, { links: [link] });

    await page.goto("/home");
    await expect(homeScreen(page)).toBeVisible();

    await expect.poll(() => storedAuthRecord(page)).toEqual({ accessToken: "e2e-access-token" });
    expect(state.requests.filter((request) => request.path === REFRESH_PATH)).toHaveLength(0);
  });

  test("a social login return does not call the refresh endpoint", async ({ page }) => {
    const { refreshCalls } = await openNewTab(page, "success");

    await page.goto("/?code=abc&state=kakao:unknown");
    await expect(landingScreen(page)).toBeVisible();

    expect(refreshCalls()).toBe(0);
  });

  test("two expired access tokens in a row are refreshed and retried without a notice", async ({
    page,
  }) => {
    let validToken = "rotated-1";
    let issued = 0;
    await mockApi(page, {
      links: [link],
      seedSession: false,
      handlers: {
        [`POST ${REFRESH_PATH}`]: (route) => {
          issued += 1;
          return fulfillRefresh(route, "success", validToken);
        },
      },
    });
    await page.route(
      (url) => url.pathname.startsWith("/api/") && url.pathname !== REFRESH_PATH,
      (route) => {
        if (route.request().headers().authorization === `Bearer ${validToken}`) {
          return route.fallback();
        }
        return route.fulfill({
          status: 401,
          contentType: "application/json",
          body: JSON.stringify({
            success: false,
            data: null,
            error: { code: "AUTH_401_0001", message: "expired" },
          }),
        });
      },
    );
    await page.addInitScript(() => {
      if (window.sessionStorage.getItem("e2e-seeded")) return;
      window.sessionStorage.setItem("e2e-seeded", "1");
      window.sessionStorage.setItem("qlink-auth", JSON.stringify({ accessToken: "expired-0" }));
    });

    await page.goto("/home");
    await expect(homeScreen(page)).toBeVisible();
    await expect.poll(() => storedAuthRecord(page)).toEqual({ accessToken: "rotated-1" });
    const issuedBefore = issued;
    expect(issuedBefore).toBeGreaterThan(0);

    validToken = "rotated-2";
    await page.reload();
    await expect(homeScreen(page)).toBeVisible();
    await expect.poll(() => issued).toBeGreaterThan(issuedBefore);
    await expect.poll(() => storedAuthRecord(page)).toEqual({ accessToken: "rotated-2" });

    await expectNoReloginToast(page);
  });
});

test.describe("sign out", () => {
  test("sends no refresh token and returns to the landing", async ({ page }) => {
    const state = await mockApi(page);

    await page.goto("/settings");
    await page.getByRole("button", { name: "로그아웃" }).first().click();
    await page.getByRole("button", { name: "로그아웃" }).last().click();

    await expect(page.getByText("로그아웃 되었어요")).toBeVisible();
    await expect(landingScreen(page)).toBeVisible();
    const signOut = state.requests.find(
      (request) => request.method === "DELETE" && request.path === "/api/auth/signout",
    );
    expect(signOut?.body ?? {}).not.toHaveProperty("refreshToken");
  });
});
