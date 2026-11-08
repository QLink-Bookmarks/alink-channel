import { type Page, expect, test } from "@playwright/test";

import { isWideProject } from "./support/helpers";
import { makeDetail, makeFolders, makeLink, mockApi } from "./support/mock-api";

const FOLDER_COUNT = 45;
const OLDEST_ID = 1;
const LATE_ID = 3;

function folderRequests(state: Awaited<ReturnType<typeof mockApi>>) {
  return state.requests.filter(
    (request) => request.method === "GET" && request.path === "/api/folders",
  );
}

async function expectFolderOpened(page: Page, name: string) {
  await expect(page.getByText("폴더를 찾을 수 없어요")).toHaveCount(0);
  await expect(page.getByText(`📁 ${name}`, { exact: true }).first()).toBeVisible({
    timeout: 15_000,
  });
}

test.describe("folder detail lookup", () => {
  test("opens the oldest of 45 folders from its address, with the folder name as the tab title", async ({
    page,
  }) => {
    const state = await mockApi(page, { folders: makeFolders(FOLDER_COUNT, 4) });

    await page.goto(`/folders/${OLDEST_ID}`);

    await expectFolderOpened(page, `폴더 ${OLDEST_ID}`);
    await expect(page).toHaveTitle(/폴더 1 · ALink/);
    await expect(page.getByText("폴더를 찾을 수 없어요")).toHaveCount(0);
    expect(folderRequests(state).map((request) => request.search)).toEqual([
      "?orderKey=created_at&order=desc&size=20",
      "?orderKey=created_at&order=desc&cursor=20&size=20",
      "?orderKey=created_at&order=desc&cursor=40&size=20",
    ]);
  });

  test("a folder past the first 20 opens on both sides of the 768px/769px boundary", async ({
    page,
  }) => {
    test.skip(!isWideProject(), "resizes a desktop viewport");
    await mockApi(page, { folders: makeFolders(FOLDER_COUNT) });
    const title = `📁 폴더 ${LATE_ID}`;
    const mobileHeader = page.getByRole("button", { name: "뒤로" }).locator("xpath=../..");

    await page.setViewportSize({ width: 769, height: 800 });
    await page.goto(`/folders/${LATE_ID}`);
    await expect(page.getByText(title, { exact: true })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("button", { name: "뒤로" })).toHaveCount(0);

    await page.setViewportSize({ width: 768, height: 800 });
    await expect(mobileHeader).toContainText(title, { timeout: 15_000 });
    await expect(page.getByText("폴더를 찾을 수 없어요")).toHaveCount(0);

    await page.setViewportSize({ width: 769, height: 800 });
    await expect(page.getByRole("button", { name: "뒤로" })).toHaveCount(0);
    await expect(page.getByText(title, { exact: true })).toBeVisible();
  });

  test("reloading a folder past the first 20 keeps it open", async ({ page }) => {
    await mockApi(page, { folders: makeFolders(FOLDER_COUNT) });

    await page.goto(`/folders/${LATE_ID}`);
    await expectFolderOpened(page, `폴더 ${LATE_ID}`);

    await page.reload();
    await expectFolderOpened(page, `폴더 ${LATE_ID}`);
    await expect(page).toHaveTitle(/폴더 3 · ALink/);
  });

  test("mobile header shows the folder name and the folder menu opens", async ({ page }) => {
    test.skip(isWideProject(), "mobile header only");
    await mockApi(page, { folders: makeFolders(FOLDER_COUNT) });

    await page.goto(`/folders/${LATE_ID}`);
    await expect(page.getByText(`📁 폴더 ${LATE_ID}`, { exact: true }).first()).toBeVisible({
      timeout: 15_000,
    });

    await page.getByRole("button", { name: "폴더 수정" }).click();
    await expect(page.getByText("폴더 이름").first()).toBeVisible();
    await expect(page.getByRole("button", { name: "저장" })).toBeVisible();
  });

  test("a link in a folder past the first 20 shows that folder in its detail", async ({ page }) => {
    const folders = makeFolders(FOLDER_COUNT);
    const link = makeLink({
      id: 501,
      folderId: LATE_ID,
      folderName: `폴더 ${LATE_ID}`,
      folderEmoji: "📁",
    });
    await mockApi(page, { folders, links: [link], details: { 501: makeDetail(link) } });

    await page.goto(isWideProject() ? `/folders/${LATE_ID}?linkId=501` : "/links/501");

    await expect(page.getByTestId("link-detail-folder-name")).toHaveText(`📁 폴더 ${LATE_ID}`, {
      timeout: 15_000,
    });
  });

  test("an id that no page holds ends in 폴더를 찾을 수 없어요 after a loading state", async ({
    page,
  }) => {
    const state = await mockApi(page, {
      folders: makeFolders(FOLDER_COUNT),
      folderPages: { delayMs: { 0: 800 } },
    });

    await page.goto("/folders/9999");

    await expect(page.getByRole("progressbar").first()).toBeVisible();
    await expect(page.getByText("폴더를 찾을 수 없어요")).toBeVisible({ timeout: 15_000 });
    expect(folderRequests(state).some((request) => request.path === "/api/folders")).toBe(true);
  });

  test("first-batch failure shows an error with retry instead of not-found, and retry opens the folder", async ({
    page,
  }) => {
    test.setTimeout(60_000);
    const state = await mockApi(page, {
      folders: makeFolders(FOLDER_COUNT),
      folderPages: { failAll: true },
    });

    await page.goto(`/folders/${LATE_ID}`);

    await expect(page.getByRole("main").getByText("폴더를 불러오지 못했어요")).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByText("폴더를 찾을 수 없어요")).toHaveCount(0);

    state.folderPages.failAll = false;
    await page.getByRole("main").getByRole("button", { name: "다시 시도" }).click();

    await expectFolderOpened(page, `폴더 ${LATE_ID}`);
  });

  test("next-batch failure while looking up shows retry, and retry continues to the folder", async ({
    page,
  }) => {
    test.setTimeout(60_000);
    const state = await mockApi(page, {
      folders: makeFolders(FOLDER_COUNT),
      folderPages: { failPages: new Set([1]) },
    });

    await page.goto(`/folders/${LATE_ID}`);

    await expect(page.getByRole("main").getByText("폴더를 불러오지 못했어요")).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByText("폴더를 찾을 수 없어요")).toHaveCount(0);

    state.folderPages.failPages.clear();
    await page.getByRole("main").getByRole("button", { name: "다시 시도" }).click();

    await expectFolderOpened(page, `폴더 ${LATE_ID}`);
  });

  test("uncategorized detail still opens with its links", async ({ page }) => {
    await mockApi(page, {
      folders: makeFolders(FOLDER_COUNT),
      links: [makeLink({ id: 601, title: "미분류 링크" })],
    });

    await page.goto("/folders/0");

    await expect(page.getByText("미분류").first()).toBeVisible();
    await expect(page.getByText("미분류 링크").first()).toBeVisible();
    await expect(page.getByText("폴더를 찾을 수 없어요")).toHaveCount(0);
  });
});
