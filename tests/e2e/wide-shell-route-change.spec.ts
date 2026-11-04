import { type Page, expect, test } from "@playwright/test";

import { isWideProject } from "./support/helpers";
import { makeDetail, makeFolders, makeLink, mockApi } from "./support/mock-api";

// #45 the wide new link dialog follows the route, and the top bar search uses a line icon.

const URL_PLACEHOLDER = "https://www.example.com";

function newLinkDialog(page: Page) {
  return page.getByRole("dialog", { name: "새 링크 추가" });
}

async function openNewLinkWithFolderPopover(page: Page) {
  await page.getByText("새 링크", { exact: true }).first().click();
  await expect(newLinkDialog(page)).toBeVisible();
  await newLinkDialog(page).getByPlaceholder(URL_PLACEHOLDER).fill("https://example.com/typed");
  await newLinkDialog(page)
    .getByRole("button", { name: /AI 자동 분류/ })
    .first()
    .click();
  await expect(page.getByText("공유 폴더", { exact: true }).last()).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(2);
}

test.describe("wide new link dialog on a route change", () => {
  test.beforeEach(() => {
    test.skip(!isWideProject(), "wide dialog");
  });

  test("going back to another screen closes the dialog and its folder popover, and reopening starts empty", async ({
    page,
  }) => {
    await mockApi(page, { folders: makeFolders(3, 1) });
    await page.goto("/home");
    await page.getByRole("button", { name: "알림", exact: true }).click();
    await expect(page).toHaveURL(/\/notifications$/);
    await openNewLinkWithFolderPopover(page);

    await page.goBack();

    await expect(page).toHaveURL(/\/home$/);
    await expect(newLinkDialog(page)).toHaveCount(0);
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await page.getByRole("button", { name: "알림", exact: true }).click();
    await expect(page).toHaveURL(/\/notifications$/);

    await page.getByText("새 링크", { exact: true }).first().click();
    await expect(newLinkDialog(page).getByPlaceholder(URL_PLACEHOLDER)).toHaveValue("");
  });

  test("saving from another screen closes the dialog and opens the new link's detail", async ({
    page,
  }) => {
    const saved = makeLink({ id: 41, url: "https://example.com/saved", title: "저장한 링크" });
    await mockApi(page, {
      links: [saved],
      details: { 41: makeDetail(saved) },
      folders: makeFolders(3, 0),
      handlers: {
        "POST /api/links": (route) =>
          route.fulfill({
            contentType: "application/json",
            body: JSON.stringify({ success: true, data: { id: 41 }, error: null }),
          }),
      },
    });
    await page.goto("/settings");
    await page.getByText("새 링크", { exact: true }).first().click();
    await newLinkDialog(page).getByPlaceholder(URL_PLACEHOLDER).fill("https://example.com/saved");
    await newLinkDialog(page).getByPlaceholder("AI 생성으로 자동 정리해보세요").fill("저장한 링크");

    await newLinkDialog(page).getByRole("button", { name: "저장", exact: true }).click();

    await expect(page).toHaveURL(/\/links\?linkId=41$/);
    await expect(newLinkDialog(page)).toHaveCount(0);
    await expect(page.getByTestId("link-detail-title")).toHaveText("저장한 링크");
  });
});

test.describe("wide top bar search icon", () => {
  test.beforeEach(() => {
    test.skip(!isWideProject(), "wide top bar");
  });

  test("the search field shows a line icon instead of the emoji and still opens search", async ({
    page,
  }) => {
    await mockApi(page);
    await page.goto("/home");
    const field = page.getByPlaceholder("링크 · 요약 · 태그 검색…");
    const topbar = page.locator("div", { has: field }).filter({ hasText: "⌘/Ctrl + K" }).last();
    await expect(topbar).toBeVisible();
    await expect(topbar.getByText("🔍")).toHaveCount(0);
    await expect(topbar.locator("svg").first()).toBeVisible();

    await topbar.locator("svg").first().click();
    await expect(page.getByRole("dialog")).toBeVisible();
  });
});
