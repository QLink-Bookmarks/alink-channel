import { type Page, expect, test } from "@playwright/test";

import { isWideProject } from "./support/helpers";
import { makeFolders, mockApi } from "./support/mock-api";

const NONE_LABEL = /^없음/;

function sheet(page: Page) {
  return page.getByRole("slider", { name: "Bottom Sheet" });
}

// The step title sits in the sheet's fixed head, above the scrolling body (#88).
function stepTitle(page: Page, name: string) {
  return page.getByRole("heading", { name, exact: true });
}

function closeButton(page: Page) {
  return page.getByRole("button", { name: "닫기", exact: true });
}

function backButton(page: Page) {
  return page.getByRole("button", { name: "뒤로", exact: true });
}

async function settledSheetTop(page: Page) {
  let previous = (await sheet(page).boundingBox())?.y ?? null;
  let steadyReads = 0;
  await expect
    .poll(
      async () => {
        const current = (await sheet(page).boundingBox())?.y ?? null;
        const viewportHeight = page.viewportSize()?.height ?? 0;
        const isSteady = current !== null && current < viewportHeight - 40 && current === previous;
        steadyReads = isSteady ? steadyReads + 1 : 0;
        previous = current;
        return steadyReads >= 2;
      },
      { intervals: [250] },
    )
    .toBe(true);
  return previous as number;
}

async function openFolderStep(page: Page) {
  await mockApi(page, { folders: makeFolders(12, 3) });
  await page.goto("/home");
  await page.getByRole("button", { name: "새 링크", exact: true }).click();
  await expect(stepTitle(page, "새 링크 추가")).toBeVisible();
  await settledSheetTop(page);
  await expect(closeButton(page)).toBeVisible();
  await expect(backButton(page)).toHaveCount(0);

  await sheet(page)
    .getByRole("button", { name: /^폴더, / })
    .click();
  await expect(stepTitle(page, "폴더 선택")).toBeVisible();
  await expect(page.getByRole("radio", { name: NONE_LABEL })).toBeVisible();
}

async function expectSheetClosed(page: Page) {
  await expect(page.getByText("폴더 선택", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "새 링크", exact: true })).toBeVisible();
}

test.describe("new link sheet folder step (#27)", () => {
  test.beforeEach(() => {
    test.skip(isWideProject(), "mobile new link sheet");
  });

  test("the folder step shows only 뒤로, and 뒤로 returns to the first step with 닫기 again", async ({
    page,
  }) => {
    await openFolderStep(page);
    await expect(backButton(page)).toBeVisible();
    await expect(closeButton(page)).toHaveCount(0);

    await backButton(page).click();
    await expect(stepTitle(page, "새 링크 추가")).toBeVisible();
    await expect(closeButton(page)).toBeVisible();
    await expect(backButton(page)).toHaveCount(0);
  });

  test("the AI provider step also shows only 뒤로, and 뒤로 brings 닫기 back", async ({ page }) => {
    await openFolderStep(page);
    await backButton(page).click();
    await expect(stepTitle(page, "새 링크 추가")).toBeVisible();

    await sheet(page)
      .getByRole("button", { name: /^AI 제공자, / })
      .click();
    await expect(stepTitle(page, "AI 제공자 선택")).toBeVisible();
    await expect(backButton(page)).toBeVisible();
    await expect(closeButton(page)).toHaveCount(0);

    await backButton(page).click();
    await expect(stepTitle(page, "새 링크 추가")).toBeVisible();
    await expect(closeButton(page)).toBeVisible();
    await expect(backButton(page)).toHaveCount(0);
  });

  test("the folder step still closes when the outside is pressed", async ({ page }) => {
    await openFolderStep(page);
    await settledSheetTop(page);
    await page
      .getByRole("button", { name: "Bottom sheet backdrop" })
      .click({ position: { x: 195, y: 40 } });
    await expectSheetClosed(page);
  });

  test("the folder step still closes when dragged down, and the next sheet opens on the first step with 닫기", async ({
    page,
  }) => {
    await openFolderStep(page);
    const top = await settledSheetTop(page);
    const box = await sheet(page).boundingBox();
    const x = (box?.x ?? 0) + (box?.width ?? 0) / 2;
    const y = top - 14;
    await page.mouse.move(x, y);
    await page.mouse.down();
    for (let step = 1; step <= 12; step += 1) {
      await page.mouse.move(x, y + step * 40);
    }
    await page.mouse.up();
    await expectSheetClosed(page);

    await page.getByRole("button", { name: "새 링크", exact: true }).click();
    await expect(stepTitle(page, "새 링크 추가")).toBeVisible();
    await expect(closeButton(page)).toBeVisible();
    await expect(backButton(page)).toHaveCount(0);
  });
});
