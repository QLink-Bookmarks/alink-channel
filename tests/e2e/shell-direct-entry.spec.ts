import { type Page, expect, test } from "@playwright/test";

import { isWideProject } from "./support/helpers";
import { makeDetail, makeLink, mockApi } from "./support/mock-api";

// #14 opening an address directly (or reloading it) keeps the shell's redirect target.

const MOBILE = { width: 390, height: 844 };
const WIDE = { width: 1280, height: 800 };

const link = makeLink({ id: 7, title: "바로 연 링크" });

/** Visible markers of the screens a direct entry must never flash before its target. */
const SCREEN_MARKERS = {
  home: { label: "검색", text: "📚 전체 보기" },
  links: { text: "최신순" },
  todos: { text: "미완료" },
  settings: { text: "로그아웃" },
} as const;

type ScreenName = keyof typeof SCREEN_MARKERS;

/**
 * Records every screen marker that becomes visible from the first parsed node, and every
 * address the app writes to the history, so a screen shown for a single frame is caught.
 */
async function recordEntry(page: Page) {
  await page.addInitScript((markers) => {
    const target = window as unknown as { __seenScreens: string[]; __addresses: string[] };
    target.__seenScreens = [];
    target.__addresses = [];

    for (const name of ["pushState", "replaceState"] as const) {
      const original = history[name].bind(history);
      history[name] = (state: unknown, unused: string, url?: string | URL | null) => {
        if (url != null) target.__addresses.push(String(url));
        return original(state, unused, url);
      };
    }

    const isVisible = (node: Node | null) =>
      node instanceof Element && node.checkVisibility({ opacityProperty: true });
    const hasVisibleText = (text: string) => {
      const result = document.evaluate(
        `//*[normalize-space(text())="${text}"]`,
        document,
        null,
        XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
        null,
      );
      for (let index = 0; index < result.snapshotLength; index += 1) {
        if (isVisible(result.snapshotItem(index))) return true;
      }
      return false;
    };
    const hasVisibleLabel = (label: string) =>
      Array.from(document.querySelectorAll(`[aria-label="${label}"]`)).some(isVisible);

    const record = () => {
      for (const [name, marker] of Object.entries(markers)) {
        if (target.__seenScreens.includes(name)) continue;
        const label = "label" in marker ? marker.label : undefined;
        if (hasVisibleText(marker.text) || (label != null && hasVisibleLabel(label))) {
          target.__seenScreens.push(name);
        }
      }
    };

    new MutationObserver(record).observe(document, {
      attributes: true,
      childList: true,
      subtree: true,
    });
    const onFrame = () => {
      record();
      requestAnimationFrame(onFrame);
    };
    requestAnimationFrame(onFrame);
  }, SCREEN_MARKERS);
}

async function seenScreens(page: Page): Promise<ScreenName[]> {
  return page.evaluate(
    () => (window as unknown as { __seenScreens: ScreenName[] }).__seenScreens ?? [],
  );
}

async function writtenAddresses(page: Page): Promise<string[]> {
  return page.evaluate(() => (window as unknown as { __addresses: string[] }).__addresses ?? []);
}

const detailTitle = (page: Page) => page.getByTestId("link-detail-title");
const linkCards = (page: Page) => page.getByTestId("link-card");
const wideTopbarSearch = (page: Page) => page.getByText("⌘/Ctrl + K").first();
const mobileFab = (page: Page) => page.getByRole("button", { name: "새 링크", exact: true });
const notFound = (page: Page) => page.getByText("찾으시는 링크가 없어요");

async function expectMobileDetail(page: Page, id: number) {
  await expect(page).toHaveURL(new RegExp(`/links/${id}$`));
  await expect(detailTitle(page)).toHaveText(link.title);
}

async function expectWideOverlay(page: Page, id: number) {
  await expect(page).toHaveURL(new RegExp(`/links\\?linkId=${id}$`));
  await expect(linkCards(page)).toHaveCount(1);
  await expect(detailTitle(page)).toHaveText(link.title);
}

async function expectNoDetour(page: Page, from?: ScreenName) {
  const seen = await seenScreens(page);
  expect(seen, "home never shows").not.toContain("home");
  if (from) expect(seen, `${from} never shows`).not.toContain(from);
  const addresses = await writtenAddresses(page);
  const homeDetours = addresses.filter((address) => {
    const url = new URL(address, "http://localhost");
    return url.pathname === "/home" && !url.searchParams.has("linkId");
  });
  expect(homeDetours, "never lands on home on the way").toEqual([]);
}

test.beforeEach(async ({ page }) => {
  const response = await page.request.get("/home");
  expect(await response.text(), "the server starts pages with hydration").toContain(
    "__EXPO_ROUTER_HYDRATE__=true",
  );
});

test.describe("signed in direct entry", () => {
  test.skip(() => !isWideProject(), "widths are set per test");

  test.beforeEach(async ({ page }) => {
    await mockApi(page, { links: [link], details: { 7: makeDetail(link) } });
    await recordEntry(page);
  });

  const mobileEntries: [string, ScreenName][] = [
    ["/links?linkId=7", "links"],
    ["/todos?linkId=7", "todos"],
    ["/home?linkId=7", "home"],
  ];

  for (const [path, from] of mobileEntries) {
    test(`mobile ${path} opens that link's detail`, async ({ page }) => {
      await page.setViewportSize(MOBILE);
      await page.goto(path);
      await expectMobileDetail(page, 7);
      await expectNoDetour(page, from);
    });
  }

  test("wide /settings?linkId opens all links with the detail overlay", async ({ page }) => {
    await page.setViewportSize(WIDE);
    await page.goto("/settings?linkId=7");
    await expectWideOverlay(page, 7);
    await expectNoDetour(page, "settings");
  });

  test("wide /folders?linkId opens all links with the detail overlay", async ({ page }) => {
    await page.setViewportSize(WIDE);
    await page.goto("/folders?linkId=7");
    await expectWideOverlay(page, 7);
    await expectNoDetour(page);
  });

  test("mobile /links/:id opens the detail page", async ({ page }) => {
    await page.setViewportSize(MOBILE);
    await page.goto("/links/7");
    await expectMobileDetail(page, 7);
    await expectNoDetour(page, "links");
  });

  test("wide /links/:id opens all links with the detail overlay", async ({ page }) => {
    await page.setViewportSize(WIDE);
    await page.goto("/links/7");
    await expectWideOverlay(page, 7);
    await expectNoDetour(page);
  });

  test("mobile reload keeps the redirected detail", async ({ page }) => {
    await page.setViewportSize(MOBILE);
    await page.goto("/todos?linkId=7");
    await expectMobileDetail(page, 7);
    await page.reload();
    await expectMobileDetail(page, 7);
    await expectNoDetour(page, "todos");
  });

  test("wide reload keeps the detail overlay", async ({ page }) => {
    await page.setViewportSize(WIDE);
    await page.goto("/settings?linkId=7");
    await expectWideOverlay(page, 7);
    await page.reload();
    await expectWideOverlay(page, 7);
    await expectNoDetour(page, "settings");
  });

  test("wide /folders still goes to home", async ({ page }) => {
    await page.setViewportSize(WIDE);
    await page.goto("/folders");
    await expect(page).toHaveURL(/\/home$/);
    await expect(wideTopbarSearch(page)).toBeVisible();
  });

  test("wide /share still goes to home", async ({ page }) => {
    await page.setViewportSize(WIDE);
    await page.goto("/share");
    await expect(page).toHaveURL(/\/home$/);
    await expect(wideTopbarSearch(page)).toBeVisible();
  });

  test("mobile /links still goes to home", async ({ page }) => {
    await page.setViewportSize(MOBILE);
    await page.goto("/links");
    await expect(page).toHaveURL(/\/home$/);
    await expect(mobileFab(page)).toBeVisible();
  });

  test("mobile missing link shows not found instead of home", async ({ page }) => {
    test.setTimeout(60_000);
    await page.setViewportSize(MOBILE);
    await page.goto("/todos?linkId=999");
    await expect(page).toHaveURL(/\/links\/999$/);
    await expect(notFound(page)).toBeVisible({ timeout: 30_000 });
    await expectNoDetour(page, "todos");
  });

  test("wide missing link shows not found in the overlay instead of home", async ({ page }) => {
    test.setTimeout(60_000);
    await page.setViewportSize(WIDE);
    await page.goto("/settings?linkId=999");
    await expect(page).toHaveURL(/\/links\?linkId=999$/);
    await expect(notFound(page)).toBeVisible({ timeout: 30_000 });
    await expectNoDetour(page, "settings");
  });

  test("wide missing link overlay closes back to the screen without the link", async ({ page }) => {
    test.setTimeout(60_000);
    await page.setViewportSize(WIDE);
    await page.goto("/home?linkId=999");
    await expect(notFound(page)).toBeVisible({ timeout: 30_000 });
    await page.getByRole("button", { name: "닫기", exact: true }).click();
    await expect(page).toHaveURL(/\/home$/);
    await expect(notFound(page)).toHaveCount(0);
    await expect(linkCards(page).first()).toBeVisible();
  });

  test("mobile card tap still opens the detail", async ({ page }) => {
    await page.setViewportSize(MOBILE);
    await page.goto("/home");
    await page.getByTestId("link-card-body").first().click();
    await expectMobileDetail(page, 7);
  });

  test("wide card tap still opens the detail overlay", async ({ page }) => {
    await page.setViewportSize(WIDE);
    await page.goto("/home");
    await page.getByTestId("link-card-body").first().click();
    await expectWideOverlay(page, 7);
  });

  test("crossing 768/769 on the detail swaps page and overlay", async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 800 });
    await page.goto("/links/7");
    await expectMobileDetail(page, 7);

    await page.setViewportSize({ width: 769, height: 800 });
    await expectWideOverlay(page, 7);

    await page.setViewportSize({ width: 768, height: 800 });
    await expectMobileDetail(page, 7);
  });
});

test.describe("signed out direct entry", () => {
  test.skip(() => !isWideProject(), "widths are set per test");

  for (const [path, viewport] of [
    ["/todos?linkId=7", MOBILE],
    ["/links/7", MOBILE],
    ["/settings?linkId=7", WIDE],
  ] as const) {
    test(`${viewport.width}px ${path} goes to login`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.goto(path);
      await expect(page).toHaveURL(/\/login$/);
    });
  }
});
