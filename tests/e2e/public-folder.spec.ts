import { type Page, expect, test } from "@playwright/test";

import { envelope, mockApi, scroll } from "./support/mock-api";

const PUBLIC_ID = "857efcec-99fe-4d0f-a6e1-74ffdb2534c4";
const WEB_PATH = `/public/folders/${PUBLIC_ID}`;
const API_PATH = `/api/public-folders/${PUBLIC_ID}`;
const FOLDER_NAME = "도시 산책 기록";
const LONG_URL = `https://example.com/${"long-url-".repeat(22)}`;

async function mockPublicFolder(page: Page) {
  const state = {
    headStatus: 200,
    linksStatus: 200,
    nextStatus: 200,
    todosStatus: 200,
    links: [{ title: "오래된 골목길", url: LONG_URL }],
    nextLinks: [] as { title: string; url: string }[],
    todos: [
      { title: "다음 산책 코스 고르기", isCompleted: false },
      { title: "전시 예약하기", isCompleted: true },
    ],
    authorization: [] as (string | undefined)[],
  };
  await page.route(`**${API_PATH}**`, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    state.authorization.push(request.headers().authorization);
    let status = state.headStatus;
    let response: unknown = envelope({ name: FOLDER_NAME, emoji: "🗺️" });
    if (url.pathname.endsWith("/links")) {
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
  });
  return state;
}

for (const signedIn of [false, true]) {
  test(`opens and reloads the same read-only folder (signed in: ${signedIn})`, async ({ page }) => {
    if (signedIn) await mockApi(page);
    const state = await mockPublicFolder(page);
    await page.goto(WEB_PATH);
    const heading = page.getByRole("heading", { level: 1, name: new RegExp(FOLDER_NAME) });
    const link = page.getByRole("link", { name: "오래된 골목길" });
    await expect(heading).toBeVisible();
    await expect(link).toHaveAttribute("href", LONG_URL);
    await expect(link).toHaveAttribute("target", "_blank");
    await expect(page.getByText(LONG_URL)).toBeVisible();
    await expect(page.getByText("완료", { exact: true })).toBeVisible();
    await expect(page.getByText("미완료", { exact: true })).toBeVisible();
    await page.getByText("다음 산책 코스 고르기").click();
    await expect(page.getByText("미완료", { exact: true })).toBeVisible();
    await expect(page.getByRole("checkbox")).toHaveCount(0);
    await expect(page.getByRole("main")).toContainText("읽기 전용");
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex");
    await page.context().route(LONG_URL, (route) => route.fulfill({ body: "원문" }));
    const opened = page.context().waitForEvent("page");
    await link.click();
    const original = await opened;
    await expect(original).toHaveURL(LONG_URL);
    await original.close();
    await page.reload();
    await expect(heading).toBeVisible();
    await expect(link).toBeVisible();
    expect(state.authorization.length).toBeGreaterThanOrEqual(6);
    expect(state.authorization.every((value) => value === undefined)).toBe(true);
  });
}

test("recovers from header and individual list failures and shows both types of empty state", async ({
  page,
}) => {
  const state = await mockPublicFolder(page);
  state.headStatus = 503;
  state.todosStatus = 503;
  state.links = [];
  await page.goto(WEB_PATH);
  await expect(page.getByText("폴더를 불러오지 못했어요.")).toBeVisible();
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
  const state = await mockPublicFolder(page);
  state.nextLinks = [{ title: "산책하며 만나는 건축", url: "https://sema.seoul.go.kr/" }];
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
  await expect(page.getByText("이 주소로 폴더를 열 수 없어요.")).toBeVisible();
});

test("checks the public address again after returning through browser history", async ({
  page,
}) => {
  const state = await mockPublicFolder(page);
  await page.goto(WEB_PATH);
  await expect(page.getByRole("heading", { name: new RegExp(FOLDER_NAME) })).toBeVisible();
  await page.goto("/privacy");
  state.headStatus = 404;
  await page.goBack();
  await expect(page.getByText("이 주소로 폴더를 열 수 없어요.")).toBeVisible();
  await expect(page.getByRole("heading", { name: new RegExp(FOLDER_NAME) })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "오래된 골목길" })).toHaveCount(0);
});

test("uses the browser color scheme for the anonymous folder", async ({ page }) => {
  await mockPublicFolder(page);
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto(WEB_PATH);
  const main = page.getByRole("main");
  await expect(main).toContainText(FOLDER_NAME);
  const background = () =>
    main.evaluate((element) => getComputedStyle(element).getPropertyValue("--background").trim());
  const light = await background();
  await page.emulateMedia({ colorScheme: "dark" });
  await expect.poll(background).not.toBe(light);
});
