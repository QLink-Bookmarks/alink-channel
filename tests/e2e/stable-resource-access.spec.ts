import { type Page, expect, test } from "@playwright/test";

import { envelope, makeFolders, mockApi, scroll } from "./support/mock-api";

const FOLDER_ID = 118;
const LINK_ID = 229;
const WEB_PATH = `/folders/${FOLDER_ID}`;
const API_PATH = `/api/folders/${FOLDER_ID}`;
const FOLDER_NAME = "도시 산책 기록";
const LONG_URL = `https://example.com/${"long-url-".repeat(22)}`;

test.setTimeout(60_000);

test.beforeEach(async ({ page }) => {
  await page.route(
    /^https:\/\/(?:accounts\.google\.com|appleid\.cdn-apple\.com|t1\.kakaocdn\.net)\//,
    (route) => route.abort(),
  );
});

async function mockPublicFolder(page: Page) {
  const state = {
    headStatus: 200,
    linkStatus: 200,
    linksStatus: 200,
    nextStatus: 200,
    links: [{ id: LINK_ID, title: "오래된 골목길", url: LONG_URL }],
    nextLinks: [] as { id: number; title: string; url: string }[],
    requests: [] as { path: string; token?: string }[],
    personalRowsForAuthenticatedLists: false,
  };
  await page.route(
    (url) =>
      url.pathname === API_PATH ||
      url.pathname === `/api/links/${LINK_ID}` ||
      (["/api/links", "/api/todos"].includes(url.pathname) &&
        url.searchParams.get("folderId") === String(FOLDER_ID)),
    async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      const token = request.headers().authorization;
      state.requests.push({ path: url.pathname, token });
      let status = state.headStatus;
      let response: unknown = envelope({
        id: FOLDER_ID,
        name: FOLDER_NAME,
        emoji: "🗺️",
        myLinkCounts: 0,
      });
      if (url.pathname === `/api/links/${LINK_ID}`) {
        status = state.linkStatus;
        response = envelope({
          id: LINK_ID,
          folderId: FOLDER_ID,
          folderName: FOLDER_NAME,
          folderEmoji: "🗺️",
          title: state.links[0]?.title,
          url: LONG_URL,
          thumbnailUrl: null,
          faviconUrl: null,
          isVideo: false,
          content: { excerpt: null },
          todos: null,
        });
      } else if (url.pathname.endsWith("/links")) {
        const next = url.searchParams.has("cursor");
        status = state.headStatus === 404 ? 404 : next ? state.nextStatus : state.linksStatus;
        const rows = (next ? state.nextLinks : state.links).map((link) => ({
          thumbnailUrl: null,
          faviconUrl: null,
          isVideo: false,
          contentExcerpt: null,
          ...link,
        }));
        response = scroll(rows, !next && state.nextLinks.length ? "opaque-next" : null);
      } else if (url.pathname.endsWith("/todos")) {
        status = 401;
      }
      if (state.personalRowsForAuthenticatedLists && token) {
        if (url.pathname === "/api/links")
          response = scroll([
            {
              id: 700,
              title: "탈퇴 전 개인 링크",
              url: "https://private.example.com",
              isFavorite: false,
            },
          ]);
        if (url.pathname === "/api/todos")
          response = scroll([{ id: 701, title: "탈퇴 전 개인 액션", completedAt: null }]);
      }
      await route.fulfill({
        status,
        json: status === 200 ? response : { success: false, data: null },
      });
    },
  );
  return state;
}

for (const signedIn of [false, true]) {
  for (const kind of ["folders", "links"] as const) {
    test(`replaces a denied ${kind} address and shows one toast (signed in: ${signedIn})`, async ({
      page,
    }) => {
      await mockApi(page, { seedSession: signedIn });
      const state = await mockPublicFolder(page);
      const path = kind === "folders" ? WEB_PATH : `/links/${LINK_ID}`;
      const title = kind === "folders" ? "폴더를 찾을 수 없어요" : "찾으시는 링크가 없어요";
      state.headStatus = 404;
      state.linkStatus = 404;

      await page.goto("/privacy");
      await page.goto(path);
      await expect(page).toHaveURL(signedIn ? "/home" : "/");
      await expect(page.getByText(title, { exact: true })).toBeVisible();
      await page.evaluate(() => {
        document.dispatchEvent(new Event("visibilitychange"));
        window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true }));
      });
      await expect(page.getByText(title, { exact: true })).toHaveCount(1);
      await expect(page.getByText("삭제되었거나 접근 권한이 없어요.")).toHaveCount(1);
      expect(
        state.requests.filter(({ path: requestPath }) => requestPath === `/api${path}`),
      ).toEqual([{ path: `/api${path}`, token: signedIn ? "Bearer e2e-access-token" : undefined }]);
      await page.goBack();
      await expect(page).toHaveURL("/privacy");
    });
  }
}

for (const signedIn of [false, true]) {
  test(`opens a narrow folder query as a standalone link (signed in: ${signedIn})`, async ({
    page,
    isMobile,
  }) => {
    test.skip(!isMobile, "The standalone screen opens on narrow web");
    await mockApi(page, { seedSession: signedIn });
    const state = await mockPublicFolder(page);

    await page.goto("/privacy");
    await page.goto(`${WEB_PATH}?linkId=${LINK_ID}`);
    await expect(page).toHaveURL(`/links/${LINK_ID}`);
    await expect(
      page.getByTestId("link-detail").getByRole("heading", { name: state.links[0].title }),
    ).toBeVisible();
    await page.goBack();
    await expect(page).toHaveURL("/privacy");
  });

  test(`opens and reloads the same read-only folder (signed in: ${signedIn})`, async ({
    page,
    isMobile,
  }) => {
    const account = await mockApi(page, { seedSession: signedIn });
    const state = await mockPublicFolder(page);
    state.personalRowsForAuthenticatedLists = signedIn;
    await page.goto(WEB_PATH);
    const heading = page.getByRole("heading", { level: 1, name: new RegExp(FOLDER_NAME) });
    const link = page.getByRole("link", { name: "오래된 골목길" });
    await expect(heading).toBeVisible();
    if (signedIn) {
      await expect(page.getByRole("button", { name: "로그인", exact: true })).toHaveCount(0);
      await expect(page.getByRole("button", { name: "사이드바 열기" })).toHaveCount(0);
    }
    const detailHref = isMobile ? `/links/${LINK_ID}` : `${WEB_PATH}?linkId=${LINK_ID}`;
    await expect(link).toHaveAttribute("href", detailHref);
    await expect(page.getByTestId("link-list-body").getByText("액션", { exact: true })).toHaveCount(
      0,
    );
    await expect(page.getByText("다음 산책 코스 고르기")).toHaveCount(0);
    await expect(page.getByText(/탈퇴 전 개인/)).toHaveCount(0);
    await expect(page.getByRole("checkbox")).toHaveCount(0);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex");
    await link.click();
    await expect(page).toHaveURL(detailHref);
    const detail = page.getByTestId("link-detail");
    await expect(detail.getByRole("heading", { name: "오래된 골목길" })).toBeVisible();
    const notes = detail.getByTestId("link-detail-my-notes");
    await expect(notes.getByTestId("link-detail-folder-row")).toBeVisible();
    await expect(notes.getByTestId("link-detail-todos")).toHaveCount(0);
    await expect(notes.getByText("액션", { exact: true })).toHaveCount(0);
    await expect(notes.getByText("다음 산책 코스 고르기")).toHaveCount(0);
    await expect(notes.getByText("전시 예약하기")).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^공개 설정, / })).toHaveCount(0);
    if (signedIn) {
      await expect(page.getByRole("button", { name: "로그인", exact: true })).toHaveCount(0);
      await expect(page.getByRole("button", { name: "사이드바 열기" })).toHaveCount(0);
    }
    await expect(page.getByRole("checkbox")).toHaveCount(0);
    await page.context().route(LONG_URL, (route) => route.fulfill({ body: "원문" }));
    const opened = page.context().waitForEvent("page");
    await detail.getByRole("link", { name: "원본 열기, example.com" }).click();
    const original = await opened;
    await expect(original).toHaveURL(LONG_URL);
    await original.close();
    await page.reload();
    await expect(page.getByRole("heading", { name: "오래된 골목길" })).toBeVisible();
    if (isMobile) await detail.getByRole("link", { name: new RegExp(FOLDER_NAME) }).click();
    else await detail.getByRole("button", { name: "닫기" }).click();
    await expect(heading).toBeVisible();
    expect(state.requests.map(({ path }) => path)).not.toContain("/api/todos");
    expect(
      account.requests.filter(({ path }) => /^\/api\/(folders|links|todos)\b/.test(path)),
    ).toEqual([]);
    for (const { path, token } of state.requests) {
      expect(token).toBe(
        signedIn && (path === API_PATH || path === `/api/links/${LINK_ID}`)
          ? "Bearer e2e-access-token"
          : undefined,
      );
    }
  });

  test(`read-only cards use small for guests and keep the chosen size for signed-in visitors (signed in: ${signedIn})`, async ({
    page,
    isMobile,
  }) => {
    await mockApi(page, { seedSession: signedIn });
    await page.addInitScript(() => localStorage.setItem("qlink-link-card-size", "large"));
    const state = await mockPublicFolder(page);
    state.links = Array.from({ length: 4 }, (_, index) => ({
      id: LINK_ID + index,
      title: `공개 링크 ${index + 1}`,
      url: LONG_URL,
    }));
    await page.goto(WEB_PATH);
    const cards = page.getByRole("main").getByTestId("link-card");
    await expect(cards).toHaveCount(4);
    await expect
      .poll(async () => {
        const positions = await cards.evaluateAll((nodes) =>
          nodes.map((node) => Math.round(node.getBoundingClientRect().y)),
        );
        return positions.filter((position) => position === positions[0]).length;
      })
      .toBe(signedIn ? (isMobile ? 1 : 3) : isMobile ? 2 : 4);
  });
}

test("keeps the narrow folder list for invalid overlay IDs", async ({ page, isMobile }) => {
  test.skip(!isMobile, "The folder remains open on narrow web");
  await mockApi(page, { seedSession: false });
  const state = await mockPublicFolder(page);
  for (const invalidId of ["text", "0", "-1", "1.5", "1e2"]) {
    await page.goto(`${WEB_PATH}?linkId=${invalidId}`);
    await expect(page.getByRole("link", { name: state.links[0].title })).toBeVisible();
    await expect(page).toHaveURL(`${WEB_PATH}?linkId=${invalidId}`);
    await expect(page.getByTestId("link-detail")).toHaveCount(0);
  }
  expect(state.requests.some(({ path }) => path.startsWith("/api/links/"))).toBe(false);
});

test("keeps the member folder list for an invalid narrow overlay ID", async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, "The folder remains open on narrow web");
  await mockApi(page, { folders: makeFolders(1) });
  await page.goto("/folders/1?linkId=0");
  await expect(page.getByRole("heading", { name: /폴더 1/ }).first()).toBeVisible();
  await expect(page).toHaveURL("/folders/1");
  await expect(page.getByTestId("link-detail")).toHaveCount(0);
});

test("keeps a denied link notice inside the wide public folder panel", async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, "The public panel opens on wide web");
  await mockApi(page, { seedSession: false });
  const state = await mockPublicFolder(page);
  state.linkStatus = 404;

  const path = `${WEB_PATH}?linkId=${LINK_ID}`;
  await page.goto(path);
  const panel = page.getByTestId("detail-panel");
  await expect(panel.getByText("찾으시는 링크가 없어요", { exact: true })).toBeVisible();
  await expect(page).toHaveURL(path);
  await expect(page.getByText("삭제되었거나 접근 권한이 없어요.")).toHaveCount(0);
  await panel.getByRole("button", { name: "닫기" }).click();
  await expect(page).toHaveURL(WEB_PATH);
  await expect(page.getByRole("link", { name: state.links[0].title })).toBeVisible();
});

test("retries a standalone link after a network error and a server error", async ({ page }) => {
  await mockApi(page, { seedSession: false });
  const state = await mockPublicFolder(page);
  const path = `/links/${LINK_ID}`;
  await page.route(
    (url) => url.pathname === `/api${path}`,
    (route) => route.abort(),
    { times: 1 },
  );
  state.linkStatus = 503;

  await page.goto(path);
  const error = page.getByText("링크를 불러오지 못했어요", { exact: true });
  const retry = page.getByRole("button", { name: "다시 시도" });
  await expect(error).toBeVisible();
  await retry.click();
  await expect.poll(() => state.requests.length).toBe(1);
  await expect(error).toBeVisible();
  await expect(page).toHaveURL(path);
  state.linkStatus = 200;
  await retry.click();
  await expect(
    page.getByTestId("link-detail").getByRole("heading", { name: state.links[0].title }),
  ).toBeVisible();
});

test("recovers from folder and link list failures, then shows the empty state", async ({
  page,
}) => {
  await mockApi(page, { seedSession: false });
  const state = await mockPublicFolder(page);
  state.headStatus = 503;
  state.linksStatus = 503;
  state.links = [];
  await page.goto(WEB_PATH);
  await expect(page.getByText("폴더를 불러오지 못했어요", { exact: true })).toBeVisible();
  state.headStatus = 200;
  await page.getByRole("button", { name: "다시 시도" }).click();
  await expect(page.getByText("링크를 불러오지 못했어요", { exact: true })).toBeVisible();
  state.linksStatus = 200;
  await page.getByRole("button", { name: "다시 시도" }).click();
  await expect(page.getByText("아직 공개한 링크가 없어요.")).toBeVisible();
  expect(state.requests.map(({ path }) => path)).not.toContain("/api/todos");
});

test("retains rows on a paging failure and clears the whole view on withdrawal", async ({
  page,
}) => {
  await mockApi(page, { seedSession: false });
  const state = await mockPublicFolder(page);
  state.nextLinks = [
    { id: LINK_ID + 1, title: "산책하며 만나는 건축", url: "https://sema.seoul.go.kr/" },
  ];
  state.nextStatus = 503;
  await page.goto(WEB_PATH);
  await expect(page.getByText("링크를 불러오지 못했어요", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "오래된 골목길" })).toBeVisible();
  state.nextStatus = 200;
  await page.getByRole("button", { name: "다시 시도" }).click();
  await expect(page.getByRole("link", { name: "산책하며 만나는 건축" })).toBeVisible();
  await expect(page.getByRole("link", { name: "오래된 골목길" })).toHaveCount(1);
  state.nextStatus = 503;
  await page.reload();
  const retry = page.getByRole("button", { name: "다시 시도" });
  await expect(retry).toBeVisible();
  state.nextStatus = 404;
  await retry.click();
  await expect(page).toHaveURL("/");
  await expect(page.getByText("폴더를 찾을 수 없어요", { exact: true })).toHaveCount(1);
  await expect(page).not.toHaveTitle(new RegExp(FOLDER_NAME));
  await expect(page.getByText(FOLDER_NAME, { exact: false })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "오래된 골목길" })).toHaveCount(0);
  await expect(page.getByText("다음 산책 코스 고르기")).toHaveCount(0);
  state.headStatus = 404;
  await page.reload();
  await expect(page).toHaveURL("/");
  state.headStatus = 200;
  state.links = [];
  state.nextLinks = [];
  await page.goto(WEB_PATH);
  await expect(page.getByRole("heading", { name: new RegExp(FOLDER_NAME) })).toBeVisible();
  await expect(page.getByText("아직 공개한 링크가 없어요.")).toBeVisible();
  await expect(page.getByText("오래된 골목길")).toHaveCount(0);
});

test("checks the public address again after returning through browser history", async ({
  page,
}) => {
  await mockApi(page, { seedSession: false });
  const state = await mockPublicFolder(page);
  await page.goto(WEB_PATH);
  await expect(page.getByRole("heading", { name: new RegExp(FOLDER_NAME) })).toBeVisible();
  await expect(page).toHaveTitle(new RegExp(FOLDER_NAME));
  await page.goto("/privacy");
  state.headStatus = 404;
  await page.goBack();
  await expect(page).toHaveURL("/");
  await expect(page.getByText("폴더를 찾을 수 없어요", { exact: true })).toHaveCount(1);
  await expect(page.getByRole("heading", { name: new RegExp(FOLDER_NAME) })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "오래된 골목길" })).toHaveCount(0);
});

test("keeps a long title within the existing link card", async ({ page, isMobile }) => {
  await mockApi(page, { seedSession: false });
  const state = await mockPublicFolder(page);
  const title = "오래된골목길산책기록".repeat(22);
  state.links = [{ id: LINK_ID, title, url: LONG_URL }];
  await page.goto(WEB_PATH);
  const link = page.getByRole("link", { name: title });
  await expect(link).toHaveAttribute(
    "href",
    isMobile ? `/links/${LINK_ID}` : `${WEB_PATH}?linkId=${LINK_ID}`,
  );
  const box = (await link.boundingBox())!;
  expect(box.x + box.width).toBeLessThanOrEqual(page.viewportSize()!.width);
});

test("restores the system color scheme for an anonymous folder and link", async ({ page }) => {
  await mockApi(page, { seedSession: false });
  await mockPublicFolder(page);
  for (const path of [WEB_PATH, `/links/${LINK_ID}`]) {
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto(path);
    const heading = page.getByRole("heading", { level: 1 });
    await expect(heading).toBeVisible();
    const background = () =>
      heading.evaluate((element) =>
        getComputedStyle(element).getPropertyValue("--background").trim(),
      );
    const light = await background();
    await page.emulateMedia({ colorScheme: "dark" });
    await expect.poll(background).not.toBe(light);
  }
});

test("uses the same denied state for a signed-in visitor when the link list is withdrawn", async ({
  page,
}) => {
  await mockApi(page);
  const state = await mockPublicFolder(page);
  await page.goto(WEB_PATH);
  await expect(page.getByRole("link", { name: "오래된 골목길" })).toBeVisible();
  await expect(page).toHaveTitle(new RegExp(FOLDER_NAME));
  state.linksStatus = 404;
  await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
  await expect(page).toHaveURL("/home");
  await expect(page.getByText("폴더를 찾을 수 없어요", { exact: true })).toHaveCount(1);
  await expect(page).not.toHaveTitle(new RegExp(FOLDER_NAME));
  await expect(page.getByText("다음 산책 코스 고르기")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "오래된 골목길" })).toHaveCount(0);
  state.headStatus = 404;
  await page.goto(WEB_PATH);
  await expect(page).toHaveURL("/home");
  await expect(page.getByText("폴더를 찾을 수 없어요", { exact: true })).toHaveCount(1);
  await expect(page).not.toHaveTitle(new RegExp(FOLDER_NAME));
});

test("keeps the personal overlay read-write controls hidden for a public link projection", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "The personal overlay opens on desktop");
  await mockApi(page);
  const state = await mockPublicFolder(page);
  await page.goto(`/links?linkId=${LINK_ID}`);
  await expect(page.getByText("찾으시는 링크가 없어요")).toBeVisible();
  await expect(page.getByTestId("link-detail-edit")).toHaveCount(0);
  await expect(page.getByText(state.links[0].title, { exact: true })).toHaveCount(0);
  await page.goto(`/links/${LINK_ID}`);
  await expect(page.getByRole("heading", { name: state.links[0].title })).toBeVisible();
  await expect(page.getByTestId("link-detail-edit")).toHaveCount(0);
});
