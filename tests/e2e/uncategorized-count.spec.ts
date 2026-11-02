import { type Page, expect, test } from "@playwright/test";

import { isWideProject } from "./support/helpers";
import { makeLink, mockApi } from "./support/mock-api";

function uncategorizedLinks(count: number) {
  return Array.from({ length: count }, (_, index) => makeLink({ id: index + 1 }));
}

async function openFolderList(page: Page) {
  await page.goto(isWideProject() ? "/home" : "/folders");
}

function uncategorizedEntry(page: Page) {
  return page.getByText(isWideProject() ? "🗂️ 미분류" : "미분류", { exact: true }).first();
}

function uncategorizedCountArea(page: Page) {
  return uncategorizedEntry(page).locator("xpath=..");
}

test.describe("uncategorized count", () => {
  for (const { links, label } of [
    { links: 0, label: "0" },
    { links: 37, label: "37" },
    { links: 100, label: "100" },
    { links: 150, label: "100+" },
  ]) {
    test(`shows ${label} for ${links} uncategorized links`, async ({ page }) => {
      await mockApi(page, { links: uncategorizedLinks(links) });

      await openFolderList(page);

      await expect(uncategorizedEntry(page)).toBeVisible();
      const suffix = isWideProject() ? "" : "개";
      await expect(uncategorizedCountArea(page)).toContainText(`${label}${suffix}`);
      if (label === "100") {
        await expect(uncategorizedCountArea(page)).not.toContainText("100+");
      }
    });
  }

  test("hides only the count when the uncategorized query fails, and the entry still opens", async ({
    page,
  }) => {
    test.setTimeout(60_000);
    await mockApi(page, {
      links: uncategorizedLinks(37),
      handlers: {
        "GET /api/links": (route) =>
          route.fulfill({
            status: 500,
            contentType: "application/json",
            body: JSON.stringify({ success: false, data: null, error: { message: "ERR" } }),
          }),
      },
    });

    let failedResponses = 0;
    // The query retries three times, so the fourth failed response is the final one.
    const finalFailure = page.waitForResponse(
      (response) =>
        response.url().includes("/api/links") &&
        response.url().includes("folderId=0") &&
        response.status() === 500 &&
        ++failedResponses === 4,
      { timeout: 30_000 },
    );

    await openFolderList(page);
    await expect(uncategorizedEntry(page)).toBeVisible();
    await finalFailure;
    await expect(uncategorizedCountArea(page)).not.toContainText(/\d/);

    await uncategorizedEntry(page).click();
    await expect(page).toHaveURL(/\/folders\/0$/);
  });
});
