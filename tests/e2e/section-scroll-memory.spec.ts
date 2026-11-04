import { type Locator, type Page, expect, test } from "@playwright/test";

import { isWideProject } from "./support/helpers";
import { makeDetail, makeFolders, makeLink, mockApi } from "./support/mock-api";

// #42: the folder tab returns to its saved position even when the next batch's loading row
// leaves while the position is being restored.

const FOLDER_COUNT = 80;
const LAST_PAGE_INDEX = 3;
const SAVED_OFFSET = 1460;
const SLOW_BATCH_MS = 2_500;

function sectionList(page: Page) {
  return page.getByLabel("내 폴더 목록", { exact: true });
}

function folderRow(scope: Locator, id: number) {
  return scope.getByRole("button", { name: new RegExp(`^폴더 ${id}, 링크`) });
}

function loadingRow(scope: Locator) {
  return scope.getByLabel("폴더를 더 불러오는 중");
}

async function scrollTop(list: Locator) {
  return list.evaluate((node) => Math.round(node.scrollTop));
}

async function scrollToEnd(list: Locator) {
  await list.evaluate((node) => {
    node.scrollTop = node.scrollHeight;
  });
}

async function goToTab(page: Page, label: "홈" | "폴더", url: RegExp) {
  await page.getByText(label, { exact: true }).last().click();
  await expect(page).toHaveURL(url);
}

async function holdStillFor(list: Locator, offset: number, ms: number) {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    expect(await scrollTop(list)).toBe(offset);
    await list.page().waitForTimeout(100);
  }
}

async function settledScrollTop(list: Locator) {
  await expect
    .poll(async () => {
      const first = await scrollTop(list);
      await list.page().waitForTimeout(200);
      return (await scrollTop(list)) === first;
    })
    .toBe(true);
  return scrollTop(list);
}

/**
 * Leaves the folder tab past its first 20 rows with three of four batches loaded, then comes
 * back. Only 20 rows are drawn at first, so the restore loads the last batch, and it lands
 * while the "폴더를 더 불러오는 중" row may still count in the measured height.
 */
async function leaveWithThreeBatches(page: Page, options: { lastBatchDelayMs?: number } = {}) {
  const state = await mockApi(page, { folders: makeFolders(FOLDER_COUNT, 0) });
  await page.goto("/folders");
  const mine = sectionList(page);
  await expect(folderRow(mine, FOLDER_COUNT)).toBeVisible();
  await scrollToEnd(mine);
  await expect(folderRow(mine, FOLDER_COUNT - 39)).toBeAttached();
  await mine.evaluate((node, offset) => {
    node.scrollTop = offset;
  }, SAVED_OFFSET);
  await expect.poll(() => scrollTop(mine)).toBe(SAVED_OFFSET);
  await expect(folderRow(mine, 1)).toHaveCount(0);

  const lastCursor = `cursor=${LAST_PAGE_INDEX * 20}&`;
  const homeFolders = page.waitForResponse((response) => response.url().includes(lastCursor));
  await goToTab(page, "홈", /\/home$/);
  await homeFolders;
  if (options.lastBatchDelayMs) {
    state.folderPages.delayMs[LAST_PAGE_INDEX] = options.lastBatchDelayMs;
  }
  const sentBefore = state.requests.length;
  await goToTab(page, "폴더", /\/folders$/);
  const list = sectionList(page);
  await expect
    .poll(() => state.requests.slice(sentBefore).some((r) => r.search.includes(lastCursor)))
    .toBe(true);
  return list;
}

test.describe("folder tab scroll memory", () => {
  test.beforeEach(() => {
    test.skip(isWideProject(), "mobile folder tab only");
  });

  test("making a folder from the move window near the 30th folder returns to that exact spot", async ({
    page,
  }) => {
    const link = makeLink({ id: 1, folderId: 15, folderName: "폴더 15", folderEmoji: "📁" });
    await mockApi(page, {
      folders: makeFolders(45, 0),
      links: [link],
      details: { 1: makeDetail(link) },
    });
    await page.goto("/folders");
    const mine = sectionList(page);
    await expect(folderRow(mine, 45)).toBeVisible();
    const target = folderRow(mine, 15);
    await expect
      .poll(
        async () => {
          await scrollToEnd(mine);
          return target.isVisible();
        },
        { timeout: 20_000 },
      )
      .toBe(true);
    await target.scrollIntoViewIfNeeded();
    const saved = await scrollTop(mine);
    expect(saved).toBeGreaterThan(0);

    await target.click();
    await expect(page).toHaveURL(/\/folders\/15$/);
    await page.getByText("링크 1", { exact: true }).first().click();
    await expect(page.getByTestId("link-detail-title")).toBeVisible();
    await page.getByRole("button", { name: /^폴더 이동, 현재/ }).click();
    await page.getByRole("button", { name: "내 폴더에 폴더 추가" }).click();
    await page.getByPlaceholder("예: 디자인 레퍼런스").fill("이동 창에서 만든 폴더");
    await page.getByRole("button", { name: "저장", exact: true }).last().click();
    await expect(page.getByRole("radio", { name: "이동 창에서 만든 폴더" })).toBeVisible();
    await expect(page.getByRole("button", { name: "취소", exact: true })).toHaveCount(1);
    await page.getByRole("button", { name: "취소", exact: true }).click();
    await page.getByRole("button", { name: "뒤로" }).click();
    await expect(page).not.toHaveURL(/\/links\/1$/);

    await goToTab(page, "폴더", /\/folders$/);
    const list = sectionList(page);
    await expect(folderRow(list, 1)).toBeAttached();
    await expect.poll(() => scrollTop(list)).toBe(saved);
    await holdStillFor(list, saved, 500);
    await expect(folderRow(list, 16)).toBeInViewport();
  });

  test("returning while rows are still drawn keeps restoring right after the loading row leaves", async ({
    page,
  }) => {
    const list = await leaveWithThreeBatches(page);
    await expect(folderRow(list, 1)).toBeAttached();
    await expect(loadingRow(list)).toHaveCount(0);
    await expect.poll(() => scrollTop(list)).toBe(SAVED_OFFSET);
    await holdStillFor(list, SAVED_OFFSET, 500);
    await expect(folderRow(list, FOLDER_COUNT - 28)).toBeInViewport();

    await goToTab(page, "홈", /\/home$/);
    await goToTab(page, "폴더", /\/folders$/);
    await expect.poll(() => scrollTop(sectionList(page))).toBe(SAVED_OFFSET);
  });

  test("a spot reached while the next batch loads stays after the loading row leaves", async ({
    page,
  }) => {
    const list = await leaveWithThreeBatches(page, { lastBatchDelayMs: SLOW_BATCH_MS });
    await expect(loadingRow(list)).toBeVisible();
    await expect.poll(() => scrollTop(list)).toBe(SAVED_OFFSET);

    await expect(loadingRow(list)).toHaveCount(0, { timeout: SLOW_BATCH_MS + 5_000 });
    await expect(folderRow(list, 1)).toBeAttached();
    await holdStillFor(list, SAVED_OFFSET, 500);
  });

  test("scrolling by hand during a restore stops it and keeps the spot the user moved to", async ({
    page,
  }) => {
    const list = await leaveWithThreeBatches(page, { lastBatchDelayMs: SLOW_BATCH_MS });
    await expect(loadingRow(list)).toBeVisible();
    await expect.poll(() => scrollTop(list)).toBe(SAVED_OFFSET);

    await list.hover();
    await page.mouse.wheel(0, -600);
    await expect.poll(() => scrollTop(list)).toBeLessThan(SAVED_OFFSET - 300);
    const moved = await settledScrollTop(list);
    await expect(loadingRow(list)).toBeVisible();

    await expect(loadingRow(list)).toHaveCount(0, { timeout: SLOW_BATCH_MS + 5_000 });
    await expect(folderRow(list, 1)).toBeAttached();
    await holdStillFor(list, moved, 800);

    await goToTab(page, "홈", /\/home$/);
    await goToTab(page, "폴더", /\/folders$/);
    await expect.poll(() => scrollTop(sectionList(page))).toBe(moved);
  });
});
