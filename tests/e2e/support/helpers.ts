import { type Locator, type Page, expect, test } from "@playwright/test";

/** Records `window.open` calls instead of opening tabs. Read them with `openedUrls`. */
async function stubWindowOpen(page: Page) {
  await page.addInitScript(() => {
    const opened: string[] = [];
    (window as unknown as { __opened: string[] }).__opened = opened;
    window.open = ((url?: string | URL) => {
      opened.push(String(url));
      return null;
    }) as typeof window.open;
  });
}

async function openedUrls(page: Page): Promise<string[]> {
  return page.evaluate(() => (window as unknown as { __opened: string[] }).__opened ?? []);
}

function isWideProject() {
  return test.info().project.name === "desktop";
}

/** Number of cards in the first row of a grid (cards sharing the first card's top). */
async function firstRowCount(cards: Locator): Promise<number> {
  const boxes = await cards.evaluateAll((nodes) =>
    nodes.map((node) => node.getBoundingClientRect()).map((rect) => Math.round(rect.top)),
  );
  if (boxes.length === 0) return 0;
  return boxes.filter((top) => Math.abs(top - boxes[0]) <= 1).length;
}

async function boxOf(locator: Locator) {
  const box = await locator.boundingBox();
  expect(box, "element should be laid out").not.toBeNull();
  return box as NonNullable<typeof box>;
}

/** Computed CSS value of the first matching element. */
async function cssOf(locator: Locator, property: string): Promise<string> {
  return locator.evaluate(
    (node, prop) => getComputedStyle(node as Element).getPropertyValue(prop),
    property,
  );
}

export { boxOf, cssOf, firstRowCount, isWideProject, openedUrls, stubWindowOpen };
