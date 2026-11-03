import { type Locator, type Page, expect, test } from "@playwright/test";

import { contrast, luminance, over, parseColor } from "./support/color";
import { boxOf, isWideProject } from "./support/helpers";
import { type MockLink, makeFolders, makeLink, mockApi, settingsHandler } from "./support/mock-api";

function mockWithTheme(page: Page, theme: "light" | "dark", links: MockLink[]) {
  return mockApi(page, {
    folders: makeFolders(3, 0),
    links,
    handlers: { "GET /api/users/me/settings": settingsHandler(theme, "gray") },
  });
}

function helper(page: Page) {
  return page.getByText("와이드뷰 키보드 단축키 안내").locator("xpath=..");
}

async function helperColors(page: Page) {
  const box = helper(page);
  const read = (locator: Locator, property: string) =>
    locator.evaluate(
      (node, prop) => getComputedStyle(node as Element).getPropertyValue(prop),
      property,
    );
  const pageBackground = await page
    .getByRole("main")
    .evaluate((node) => getComputedStyle(node.parentElement as Element).backgroundColor);
  return {
    background: parseColor(await read(box, "background-color")),
    border: parseColor(await read(box, "border-top-color")),
    borderWidth: await read(box, "border-top-width"),
    labels: await Promise.all(
      ["검색", "새 링크"].map(async (label) =>
        parseColor(await read(box.getByText(label, { exact: true }), "color")),
      ),
    ),
    page: parseColor(pageBackground),
  };
}

async function scrollMainToEnd(page: Page) {
  await expect
    .poll(() =>
      page.getByRole("main").evaluate((main) => {
        const scroller = Array.from(main.querySelectorAll<HTMLElement>("*")).find(
          (node) =>
            ["auto", "scroll"].includes(getComputedStyle(node).overflowY) &&
            node.scrollHeight > node.clientHeight + 1,
        );
        if (!scroller) return false;
        scroller.scrollTop = scroller.scrollHeight;
        return scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 1;
      }),
    )
    .toBe(true);
}

test.describe("wide keyboard shortcut helper (#27)", () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!isWideProject(), "wide only");
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "platform", { get: () => "MacIntel" });
    });
  });

  test("dark mode: a dark translucent helper with a border and readable labels, and the last card ends above it", async ({
    page,
  }) => {
    const links = Array.from({ length: 15 }, (_, index) => makeLink({ id: index + 1 }));
    await mockWithTheme(page, "dark", links);
    await page.goto("/links");
    await expect(page.locator("html")).toHaveClass(/dark/);
    await expect(page.getByTestId("link-card")).toHaveCount(15);
    await expect(helper(page)).toBeVisible();

    const colors = await helperColors(page);
    expect(colors.background.a).toBeGreaterThan(0.8);
    expect(colors.background.a).toBeLessThan(1);
    const surface = over(colors.background, colors.page);
    expect(luminance(surface)).toBeLessThan(0.05);
    expect(colors.borderWidth).toBe("1px");
    expect(colors.border.a).toBe(1);
    for (const label of colors.labels) {
      expect(contrast(label, surface)).toBeGreaterThanOrEqual(4.5);
    }

    await scrollMainToEnd(page);
    const helperBox = await boxOf(helper(page));
    const lastCard = await boxOf(page.getByTestId("link-card").last());
    expect(lastCard.y + lastCard.height).toBeLessThanOrEqual(helperBox.y);
  });

  test("light mode: the helper labels reach 4.5:1 against its background", async ({ page }) => {
    await mockWithTheme(page, "light", [makeLink({ id: 1 })]);
    await page.goto("/links");
    await expect(page.locator("html")).not.toHaveClass(/dark/);
    await expect(helper(page)).toBeVisible();

    const colors = await helperColors(page);
    const surface = over(colors.background, colors.page);
    for (const label of colors.labels) {
      expect(contrast(label, surface)).toBeGreaterThanOrEqual(4.5);
    }
  });

  test("the wide home also ends its content above the helper", async ({ page }) => {
    const links = Array.from({ length: 12 }, (_, index) => makeLink({ id: index + 1 }));
    await mockApi(page, { folders: makeFolders(3, 0), links });
    await page.goto("/home");
    await expect(helper(page)).toBeVisible();
    await expect(page.getByTestId("link-card").first()).toBeVisible();

    await scrollMainToEnd(page);
    const helperBox = await boxOf(helper(page));
    const bottom = await page.getByRole("main").evaluate((main) => {
      const scroller = Array.from(main.querySelectorAll<HTMLElement>("*")).find(
        (node) =>
          ["auto", "scroll"].includes(getComputedStyle(node).overflowY) &&
          node.scrollHeight > node.clientHeight + 1,
      );
      const leaves = Array.from(scroller?.querySelectorAll<HTMLElement>("*") ?? []).filter(
        (node) => node.childElementCount === 0 && node.getBoundingClientRect().height > 0,
      );
      return Math.max(...leaves.map((node) => node.getBoundingClientRect().bottom));
    });
    expect(bottom).toBeLessThanOrEqual(helperBox.y);
  });
});
