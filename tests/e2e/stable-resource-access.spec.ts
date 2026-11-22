import { type Page, expect, test } from "@playwright/test";

import { envelope, mockApi, scroll } from "./support/mock-api";

const FOLDER_ID = 118;
const LINK_ID = 229;
const WEB_PATH = `/folders/${FOLDER_ID}`;
const API_PATH = `/api/folders/${FOLDER_ID}`;
const FOLDER_NAME = "도시 산책 기록";
const LONG_URL = `https://example.com/${"long-url-".repeat(22)}`;

async function mockPublicFolder(page: Page) {
  const state = {
    headStatus: 200,
    linksStatus: 200,
    nextStatus: 200,
    todosStatus: 200,
    links: [{ id: LINK_ID, title: "오래된 골목길", url: LONG_URL }],
    nextLinks: [] as { id: number; title: string; url: string }[],
    todos: [
      { linkId: LINK_ID, title: "다음 산책 코스 고르기", isCompleted: false },
      { linkId: LINK_ID, title: "전시 예약하기", isCompleted: true },
    ],
    authorization: [] as (string | undefined)[],
    requests: [] as string[],
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
      state.authorization.push(request.headers().authorization);
      state.requests.push(url.pathname);
      let status = state.headStatus;
      let response: unknown = envelope({ id: FOLDER_ID, name: FOLDER_NAME, emoji: "🗺️" });
      if (url.pathname === `/api/links/${LINK_ID}`) {
        status = state.headStatus;
        response = envelope({
          id: LINK_ID,
          folderId: FOLDER_ID,
          folderName: FOLDER_NAME,
          folderEmoji: "🗺️",
          title: state.links[0]?.title,
          url: LONG_URL,
          todos: state.todos.map(({ title, isCompleted }) => ({ title, isCompleted })),
        });
      } else if (url.pathname.endsWith("/links")) {
        const next = url.searchParams.has("cursor");
        status = state.headStatus === 404 ? 404 : next ? state.nextStatus : state.linksStatus;
        response = next
          ? scroll(state.nextLinks)
          : scroll(state.links, state.nextLinks.length ? "opaque-next" : null);
      } else if (url.pathname.endsWith("/todos")) {
        status = state.headStatus === 404 ? 404 : state.todosStatus;
        response = scroll(state.todos);
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
  test(`opens and reloads the same read-only folder (signed in: ${signedIn})`, async ({ page }) => {
    const account = await mockApi(page, { seedSession: signedIn });
    const state = await mockPublicFolder(page);
    await page.goto(WEB_PATH);
    const heading = page.getByRole("heading", { level: 1, name: new RegExp(FOLDER_NAME) });
    const link = page.getByRole("link", { name: "오래된 골목길" });
    await expect(heading).toBeVisible();
    await expect(link).toHaveAttribute("href", `/links/${LINK_ID}`);
    await expect(page.getByText(LONG_URL)).toBeVisible();
    await expect(page.getByText("완료", { exact: true })).toBeVisible();
    await expect(page.getByText("미완료", { exact: true })).toBeVisible();
    await page.getByText("다음 산책 코스 고르기").click();
    await expect(page.getByText("미완료", { exact: true })).toBeVisible();
    await expect(page.getByRole("checkbox")).toHaveCount(0);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex");
    await link.click();
    await expect(page).toHaveURL(new RegExp(`/links/${LINK_ID}$`));
    await expect(page.getByRole("heading", { name: "오래된 골목길" })).toBeVisible();
    await expect(page.getByRole("checkbox")).toHaveCount(0);
    await page.context().route(LONG_URL, (route) => route.fulfill({ body: "원문" }));
    const opened = page.context().waitForEvent("page");
    await page.getByRole("link", { name: LONG_URL }).click();
    const original = await opened;
    await expect(original).toHaveURL(LONG_URL);
    await original.close();
    await page.reload();
    await expect(page.getByRole("heading", { name: "오래된 골목길" })).toBeVisible();
    await page.getByRole("link", { name: new RegExp(FOLDER_NAME) }).click();
    await expect(heading).toBeVisible();
    expect(state.authorization.length).toBeGreaterThanOrEqual(6);
    expect(
      account.requests.filter(({ path }) => /^\/api\/(folders|links|todos)\b/.test(path)),
    ).toEqual([]);
    expect(
      state.authorization.every(
        (value) => value === (signedIn ? "Bearer e2e-access-token" : undefined),
      ),
    ).toBe(true);
  });
}

test("recovers from header and individual list failures and shows both types of empty state", async ({
  page,
}) => {
  await mockApi(page, { seedSession: false });
  const state = await mockPublicFolder(page);
  state.headStatus = 503;
  state.todosStatus = 503;
  state.links = [];
  await page.goto(WEB_PATH);
  await expect(page.getByText("폴더를 불러오지 못했어요", { exact: true })).toBeVisible();
  state.headStatus = 200;
  await page.getByRole("button", { name: "다시 시도" }).click();
  await expect(page.getByText("아직 공개한 링크가 없어요.")).toBeVisible();
  await expect(page.getByText("할 일을 불러오지 못했어요.")).toBeVisible();
  state.todosStatus = 200;
  state.todos = [];
  await page.getByRole("button", { name: "할 일 다시 불러오기" }).click();
  await expect(page.getByText("아직 공개한 항목이 없어요.")).toBeVisible();
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
  await page.getByRole("button", { name: "링크 더 보기" }).click();
  await expect(page.getByText("다음 링크를 불러오지 못했어요.")).toBeVisible();
  await expect(page.getByRole("link", { name: "오래된 골목길" })).toBeVisible();
  state.nextStatus = 200;
  await page.getByRole("button", { name: "링크 다시 불러오기" }).click();
  await expect(page.getByRole("link", { name: "산책하며 만나는 건축" })).toBeVisible();
  await expect(page.getByRole("link", { name: "오래된 골목길" })).toHaveCount(1);
  await page.reload();
  await expect(page.getByRole("button", { name: "링크 더 보기" })).toBeVisible();
  state.headStatus = 404;
  await page.getByRole("button", { name: "링크 더 보기" }).click();
  await expect(page.getByText("이 주소로 폴더를 열 수 없어요.")).toBeVisible();
  await expect(page.getByText(FOLDER_NAME, { exact: false })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "오래된 골목길" })).toHaveCount(0);
  await expect(page.getByText("다음 산책 코스 고르기")).toHaveCount(0);
  await page.reload();
  await expect(page).toHaveURL(/\/login$/);
});

test("checks the public address again after returning through browser history", async ({
  page,
}) => {
  await mockApi(page, { seedSession: false });
  const state = await mockPublicFolder(page);
  await page.goto(WEB_PATH);
  await expect(page.getByRole("heading", { name: new RegExp(FOLDER_NAME) })).toBeVisible();
  await page.goto("/privacy");
  state.headStatus = 404;
  await page.goBack();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { name: new RegExp(FOLDER_NAME) })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "오래된 골목길" })).toHaveCount(0);
});

test("wraps a long title and address inside one link row", async ({ page }) => {
  await mockApi(page, { seedSession: false });
  const state = await mockPublicFolder(page);
  const title = "오래된골목길산책기록".repeat(22);
  state.links = [{ id: LINK_ID, title, url: LONG_URL }];
  state.todos = [];
  await page.goto(WEB_PATH);
  const link = page.getByRole("link", { name: title });
  const row = page.getByRole("listitem").filter({ has: link });
  const address = row.getByText(LONG_URL, { exact: true });
  await expect(row).toHaveCount(1);
  await expect(address).toBeVisible();
  const rowBox = (await row.boundingBox())!;
  const titleBox = (await link.boundingBox())!;
  const addressBox = (await address.boundingBox())!;
  expect(titleBox.height).toBeGreaterThan(24);
  expect(titleBox.y + titleBox.height).toBeLessThanOrEqual(addressBox.y);
  for (const box of [titleBox, addressBox]) {
    expect(box.x).toBeGreaterThanOrEqual(rowBox.x);
    expect(box.x + box.width).toBeLessThanOrEqual(rowBox.x + rowBox.width + 1);
  }
});
