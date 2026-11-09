import { type Page, expect, test } from "@playwright/test";

import { boxOf, isWideProject } from "./support/helpers";
import { makeFolders, mockApi } from "./support/mock-api";

function dialog(page: Page) {
  return page.getByRole("dialog", { name: "새 링크 추가" });
}

function actions(page: Page) {
  return ["저장", "AI 정리"].map((label) =>
    dialog(page).getByRole("button", { name: label, exact: true }),
  );
}

async function scrollFieldsToEnd(page: Page) {
  return dialog(page).evaluate((node) => {
    const scroller = Array.from(node.querySelectorAll<HTMLElement>("*")).find(
      (element) =>
        ["auto", "scroll"].includes(getComputedStyle(element).overflowY) &&
        element.scrollHeight > element.clientHeight + 1,
    );
    if (!scroller) return false;
    scroller.scrollTop = scroller.scrollHeight;
    return true;
  });
}

test.describe("wide new link dialog actions (#27)", () => {
  test.beforeEach(() => {
    test.skip(!isWideProject(), "wide dialog");
  });

  for (const height of [620, 800]) {
    test(`at 1280×${height} 저장 and AI 정리 are on screen from the start and stay put while the fields scroll`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: 1280, height });
      await mockApi(page, { folders: makeFolders(3, 0) });
      await page.goto("/home");
      await page.getByText("새 링크", { exact: true }).first().click();
      await expect(dialog(page)).toBeVisible();
      await dialog(page)
        .getByRole("button", { name: /^메모·액션/ })
        .click();
      await dialog(page).getByText("액션 추가", { exact: true }).click();
      await dialog(page).getByText("액션 추가", { exact: true }).click();
      await page.waitForTimeout(400);

      const frame = await boxOf(dialog(page));
      expect(frame.y + frame.height).toBeLessThanOrEqual(height);
      const before: number[] = [];
      for (const button of actions(page)) {
        await expect(button).toBeInViewport({ ratio: 1 });
        const box = await boxOf(button);
        expect(box.y + box.height).toBeLessThanOrEqual(frame.y + frame.height);
        before.push(Math.round(box.y));
      }

      const scrolled = await scrollFieldsToEnd(page);
      if (height === 620) expect(scrolled).toBe(true);
      for (const [index, button] of actions(page).entries()) {
        expect(Math.round((await boxOf(button)).y)).toBe(before[index]);
      }
      await expect(dialog(page).getByText("액션 추가", { exact: true })).toBeInViewport();
    });
  }
});
