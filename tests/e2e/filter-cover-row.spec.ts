import { type Locator, type Page, expect, test } from "@playwright/test";

import { isWideProject } from "./support/helpers";
import {
  type MockLink,
  type MockTodo,
  makeDetail,
  makeFolders,
  makeLink,
  mockApi,
  settingsHandler,
} from "./support/mock-api";

// #79: the filter row's cover — how it opens and closes, the auto close, the pill, the keyboard,
// the accessible names, the row at 320–769px and reduced motion. The sorting and filtering itself
// is in link-sort-filter.spec.ts and todo-status-filter.spec.ts.

const IDLE_MS = 1600;
// The open animation is 240ms; this leaves room for it to end.
const OPEN_SETTLE_MS = 300;

const TITLES: Record<number, string> = {
  1: "다람쥐 도토리",
  2: "가나 초콜릿",
  3: "마늘빵 굽기",
};

function buildLinks(): MockLink[] {
  return Object.entries(TITLES).map(([id, title]) =>
    makeLink({
      id: Number(id),
      title,
      createdAt: new Date(Date.UTC(2026, 9, Number(id), 9, 0)).toISOString(),
      folderId: 1,
      folderName: "공부",
      folderEmoji: "📚",
      isFavorite: Number(id) === 2,
    }),
  );
}

async function mockLinks(page: Page) {
  const links = buildLinks();
  return mockApi(page, {
    links,
    details: Object.fromEntries(links.map((link) => [link.id, makeDetail(link)])),
  });
}

/** The mobile home on web mobile, the wide 전체 보기 on web wide. */
function listPath() {
  return isWideProject() ? "/links" : "/home";
}

function row(page: Page) {
  return page.getByTestId("link-filter-row");
}

function coverButton(page: Page) {
  return page.getByTestId("link-filter-row-button");
}

function cover(page: Page) {
  return page.getByRole("group", { name: "정렬·필터", exact: true });
}

function favoriteToggle(page: Page) {
  return page.getByRole("switch", { name: "바로가기만 보기" });
}

function sortChip(page: Page, name: string | RegExp) {
  return page.getByRole("radio", { name, exact: typeof name === "string" });
}

async function expectOpen(page: Page) {
  await expect(coverButton(page)).toHaveAttribute("aria-expanded", "true");
  await expect(favoriteToggle(page)).toBeVisible();
}

async function expectClosed(page: Page) {
  await expect(coverButton(page)).toHaveAttribute("aria-expanded", "false");
}

async function openList(page: Page) {
  await mockLinks(page);
  await page.goto(listPath());
  await expect(linkTitles(page).first()).toBeVisible();
  await expect(coverButton(page)).toBeVisible();
}

function linkTitles(page: Page) {
  return page.getByTestId("link-card-title").filter({ visible: true });
}

/**
 * Lets a running open or close animation finish (240ms + margin), then stops the page clock a moment
 * from now, so timers only run when the test says.
 */
async function pauseClock(page: Page) {
  await page.clock.runFor(OPEN_SETTLE_MS);
  const now = await page.evaluate(() => Date.now());
  await page.clock.pauseAt(now + 50);
}

async function horizontalOverflow(page: Page) {
  return page.evaluate(
    () => document.scrollingElement!.scrollWidth - document.scrollingElement!.clientWidth,
  );
}

async function box(locator: Locator) {
  const value = await locator.boundingBox();
  expect(value, "element should be laid out").not.toBeNull();
  return value!;
}

/** The cover's sliding window: the element that moves while it opens. */
async function coverShift(page: Page) {
  return cover(page).evaluate((node) => {
    const window = node.parentElement?.parentElement;
    const matrix = window ? getComputedStyle(window).transform : "none";
    if (matrix === "none") return 0;
    const values =
      matrix
        .match(/matrix\(([^)]+)\)/)?.[1]
        .split(",")
        .map(Number) ?? [];
    return values[4] ?? 0;
  });
}

test.describe("opening and closing", () => {
  test("the button opens the cover over the row, becomes a close button, and closes it", async ({
    page,
  }) => {
    await openList(page);
    await expectClosed(page);
    await expect(coverButton(page)).toHaveAccessibleName("정렬·필터 열기");

    await coverButton(page).click();
    await expectOpen(page);
    await expect(coverButton(page)).toHaveAccessibleName("정렬·필터 닫기");
    await expect(sortChip(page, "저장일, 내림차순")).toBeChecked();

    await coverButton(page).click();
    await expectClosed(page);
    await expect(coverButton(page)).toHaveAccessibleName("정렬·필터 열기");
  });

  test("pressing the empty part of the cover closes it", async ({ page }) => {
    test.skip(isWideProject(), "the wide cover is only as wide as its items");
    await openList(page);
    await coverButton(page).click();
    await expectOpen(page);
    const area = await box(cover(page));
    // The items sit at the right end; the left end of the cover is empty.
    await page.mouse.click(area.x + 12, area.y + area.height / 2);
    await expectClosed(page);
  });

  test("a press outside closes the cover and still opens the card", async ({ page }) => {
    await openList(page);
    await coverButton(page).click();
    await expectOpen(page);

    await linkTitles(page).filter({ hasText: TITLES[3] }).click();
    if (isWideProject()) {
      await expect(page).toHaveURL(/linkId=3/);
      await expectClosed(page);
    } else {
      await expect(page).toHaveURL(/\/links\/3$/);
    }
  });

  test("a press on the search field closes the cover and focuses the field", async ({ page }) => {
    test.skip(isWideProject(), "the search field sits on the mobile home");
    await openList(page);
    await coverButton(page).click();
    await expectOpen(page);
    const search = page.getByPlaceholder("링크 · 요약 · 태그 검색…");
    await search.click();
    await expectClosed(page);
    await expect(search).toBeFocused();
  });

  test("the covered 1st chips are out of reach while open", async ({ page }) => {
    test.skip(isWideProject(), "the folder chips sit on the mobile home");
    await openList(page);
    const folders = page.getByRole("radiogroup", { name: "폴더" });
    await expect(folders.getByRole("radio", { name: "전체", exact: true })).toBeChecked();
    await coverButton(page).click();
    await expectOpen(page);
    await expect(folders).toHaveJSProperty("inert", true);
    await coverButton(page).click();
    await expectClosed(page);
    await expect(folders).toHaveJSProperty("inert", false);
  });
});

test.describe("auto close", () => {
  test("closes the idle time (1.6s) after the last press, not before, and shows what was chosen", async ({
    page,
  }) => {
    await page.clock.install();
    await openList(page);
    await coverButton(page).click();
    await expectOpen(page);
    await pauseClock(page);

    await sortChip(page, "제목").click({ force: true });
    await page.clock.runFor(IDLE_MS - 100);
    await expectOpen(page);
    await page.clock.runFor(150);
    await expectClosed(page);
    await expect(coverButton(page)).toHaveAccessibleName("정렬·필터 열기, 적용 중: 제목 오름차순");
  });

  test("every press inside restarts the wait", async ({ page }) => {
    await page.clock.install();
    await openList(page);
    await coverButton(page).click();
    await expectOpen(page);
    await pauseClock(page);

    await sortChip(page, "제목").click({ force: true });
    await page.clock.runFor(1000);
    await favoriteToggle(page).click({ force: true });
    await page.clock.runFor(1000);
    await expectOpen(page);
    await page.clock.runFor(IDLE_MS - 1000 + 50);
    await expectClosed(page);
    await expect(coverButton(page)).toHaveAccessibleName(
      "정렬·필터 열기, 적용 중: 제목 오름차순, 바로가기만",
    );
  });

  test("only opening it leaves it open", async ({ page }) => {
    await page.clock.install();
    await openList(page);
    await coverButton(page).click();
    await expectOpen(page);
    await pauseClock(page);
    await page.clock.runFor(IDLE_MS * 3);
    await expectOpen(page);
  });
});

test.describe("the pill", () => {
  test("the closed button spells out the applied values and is an icon at the default", async ({
    page,
  }) => {
    await openList(page);
    await expect(coverButton(page).getByText("제목", { exact: true })).toHaveCount(0);

    await coverButton(page).click();
    await sortChip(page, "제목").click();
    await favoriteToggle(page).click();
    await coverButton(page).click();
    await expectClosed(page);
    await expect(coverButton(page)).toHaveAccessibleName(
      "정렬·필터 열기, 적용 중: 제목 오름차순, 바로가기만",
    );
    await expect(coverButton(page).getByText("제목", { exact: true })).toBeVisible();

    await coverButton(page).click();
    await expectOpen(page);
    await sortChip(page, "저장일").click();
    await favoriteToggle(page).click();
    await coverButton(page).click();
    await expectClosed(page);
    await expect(coverButton(page)).toHaveAccessibleName("정렬·필터 열기");
    await expect(coverButton(page).getByText("제목", { exact: true })).toHaveCount(0);
  });
});

test.describe("keyboard", () => {
  test("Enter opens with focus inside; one Tab stop for the sort; arrows choose; Enter reverses; Esc closes", async ({
    page,
  }) => {
    await page.clock.install();
    await openList(page);
    await coverButton(page).focus();
    await page.keyboard.press("Enter");
    await expectOpen(page);
    await expect(favoriteToggle(page)).toBeFocused();

    await page.keyboard.press("Tab");
    await expect(sortChip(page, "저장일, 내림차순")).toBeFocused();
    await page.keyboard.press("ArrowRight");
    await expect(sortChip(page, "제목, 오름차순")).toBeChecked();
    await expect(sortChip(page, "제목, 오름차순")).toBeFocused();
    await page.keyboard.press("Home");
    await expect(sortChip(page, "저장일, 내림차순")).toBeFocused();
    await page.keyboard.press("End");
    await expect(sortChip(page, "제목, 오름차순")).toBeFocused();
    await page.keyboard.press("Space");
    await expect(sortChip(page, "제목, 내림차순")).toBeChecked();
    await page.keyboard.press("Space");
    await expect(sortChip(page, "제목, 오름차순")).toBeChecked();
    await page.keyboard.press("Enter");
    await expect(sortChip(page, "제목, 내림차순")).toBeChecked();

    // Chosen with the keyboard: no auto close.
    await pauseClock(page);
    await page.clock.runFor(IDLE_MS * 2);
    await expectOpen(page);

    await page.keyboard.press("Escape");
    await expectClosed(page);
    await expect(coverButton(page)).toBeFocused();
    await expect(coverButton(page)).toHaveAccessibleName("정렬·필터 열기, 적용 중: 제목 내림차순");
  });

  test("tabbing out past the X, or back before the first item, closes it", async ({ page }) => {
    await openList(page);
    await coverButton(page).focus();
    await page.keyboard.press("Enter");
    await expect(favoriteToggle(page)).toBeFocused();
    // ★ → the chosen sort → X → out.
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    await expect(coverButton(page)).toBeFocused();
    await page.keyboard.press("Tab");
    await expectClosed(page);
    expect(await row(page).evaluate((node) => node.contains(document.activeElement))).toBe(false);

    await coverButton(page).focus();
    await page.keyboard.press("Enter");
    await expect(favoriteToggle(page)).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expectClosed(page);
  });

  test("Space presses a folder chip too", async ({ page }) => {
    test.skip(isWideProject(), "the folder chips sit on the mobile home");
    await openList(page);
    const folder = page.getByRole("radio", { name: "🗂️ 미분류" });
    await folder.focus();
    await page.keyboard.press("Space");
    await expect(folder).toBeChecked();
    await expect(page.getByRole("radio", { name: "전체", exact: true })).not.toBeChecked();
  });

  test("Esc closes only the cover and does not reach Esc handlers behind it", async ({ page }) => {
    await openList(page);
    // Stand-in for a panel that closes on Esc the way the wide link detail does: a document
    // keydown listener that skips handled keys, registered before the cover opens.
    await page.evaluate(() => {
      const seen: string[] = [];
      (window as unknown as { __escSeen: string[] }).__escSeen = seen;
      document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && !event.defaultPrevented) seen.push("closed-behind");
      });
    });
    await coverButton(page).focus();
    await page.keyboard.press("Enter");
    await expectOpen(page);
    await page.keyboard.press("Escape");
    await expectClosed(page);
    expect(
      await page.evaluate(() => (window as unknown as { __escSeen: string[] }).__escSeen),
    ).toEqual([]);

    // With the cover closed, Esc goes on to the handlers behind.
    await page.keyboard.press("Escape");
    expect(
      await page.evaluate(() => (window as unknown as { __escSeen: string[] }).__escSeen),
    ).toEqual(["closed-behind"]);
  });
});

test.describe("accessible names", () => {
  test("the closed cover is out of the accessibility tree", async ({ page }) => {
    await openList(page);
    await expect(page.getByRole("radiogroup", { name: "정렬 기준" })).toHaveCount(0);
    await expect(page.getByRole("radio", { name: /^(저장일|제목)/ })).toHaveCount(0);
    await expect(favoriteToggle(page)).toHaveCount(0);

    await coverButton(page).click();
    await expectOpen(page);
    await expect(page.getByRole("radio", { name: /^(저장일|제목)/ })).toHaveCount(2);

    await coverButton(page).click();
    await expectClosed(page);
    await expect(page.getByRole("radio", { name: /^(저장일|제목)/ })).toHaveCount(0);
  });

  test("the link row names its button, cover, sort group and chips", async ({ page }) => {
    await openList(page);
    if (!isWideProject()) {
      const folders = page.getByRole("radiogroup", { name: "폴더" });
      await expect(folders.getByRole("radio", { name: "전체", exact: true })).toBeChecked();
    }
    await coverButton(page).click();
    await expect(cover(page)).toBeVisible();
    await expect(coverButton(page)).toHaveAttribute("aria-controls", /.+/);
    const sorts = page.getByRole("radiogroup", { name: "정렬 기준" });
    await expect(sorts.getByRole("radio")).toHaveCount(2);
    await expect(sorts.getByRole("radio", { name: "저장일, 내림차순" })).toBeChecked();
    await expect(sorts.getByRole("radio", { name: "제목", exact: true })).not.toBeChecked();
  });

  test("the todo row names its status chips with their counts", async ({ page }) => {
    await mockApi(page, {
      todos: [
        {
          id: 1,
          title: "할 일",
          reminderAt: null,
          completedAt: null,
          linkId: 1,
          linkUrl: "https://example.com/posts/1",
          linkTitle: "링크 1",
          linkThumbnailUrl: null,
          linkFaviconUrl: null,
        },
      ],
    });
    await page.goto("/todos");
    const statuses = page.getByRole("radiogroup", { name: "액션 상태" });
    await expect(statuses.getByRole("radio", { name: "전체 1" })).toBeChecked();
    await expect(statuses.getByRole("radio", { name: "진행 중 1" })).toBeVisible();
    await expect(statuses.getByRole("radio", { name: "완료 0" })).toBeVisible();
    await expect(page.getByTestId("todo-filter-row-button")).toHaveAccessibleName("정렬·필터 열기");
  });
});

test.describe("widths", () => {
  for (const width of [320, 375, 390, 768]) {
    test(`${width}px: one row, the pill fits the 1st chips, no sideways scroll`, async ({
      page,
    }) => {
      test.skip(isWideProject(), "web mobile widths");
      await page.setViewportSize({ width, height: 800 });
      await openList(page);

      await coverButton(page).click();
      await sortChip(page, "제목").click();
      await favoriteToggle(page).click();
      await coverButton(page).click();
      await expectClosed(page);

      // One row: the button sits on the line of the 1st chips.
      const chip = await box(page.getByRole("radio", { name: "전체", exact: true }));
      const button = await box(coverButton(page));
      expect(Math.abs(chip.y + chip.height / 2 - (button.y + button.height / 2))).toBeLessThan(2);
      expect(await horizontalOverflow(page)).toBe(0);

      // 320 drops the pill text to marks so three folder chips stay whole.
      const title = coverButton(page).getByText("제목", { exact: true });
      if (width === 320) {
        await expect(title).toHaveCount(0);
      } else {
        await expect(title).toBeVisible();
      }
      const third = await box(page.getByRole("radio", { name: "📚 공부" }));
      expect(third.x + third.width).toBeLessThanOrEqual(button.x - 8);

      // Open, the cover spans the whole row.
      await coverButton(page).click();
      await expectOpen(page);
      const area = await box(cover(page));
      const line = await box(row(page));
      expect(area.width).toBeGreaterThanOrEqual(line.width - 40);
      expect(await horizontalOverflow(page)).toBe(0);
    });
  }

  test("769px: the count line is the row and the cover is as wide as its items", async ({
    page,
  }) => {
    test.skip(!isWideProject(), "web wide");
    await page.setViewportSize({ width: 769, height: 800 });
    await openList(page);
    const count = row(page).getByText("3개 링크");
    await expect(count).toBeVisible();

    await coverButton(page).click();
    await expectOpen(page);
    const area = await box(cover(page));
    const line = await box(row(page));
    expect(area.width).toBeLessThan(line.width / 2);
    const label = await box(count);
    expect(label.x + label.width).toBeLessThan(area.x);
    expect(await horizontalOverflow(page)).toBe(0);
  });
});

test.describe("reduced motion", () => {
  test("the cover slides open normally", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.clock.install();
    await openList(page);
    await pauseClock(page);
    await coverButton(page).click({ force: true });
    await expectOpen(page);
    let shift = 0;
    for (let frame = 0; frame < 6 && shift <= 1; frame++) {
      await page.clock.runFor(16);
      shift = await coverShift(page);
    }
    expect(shift).toBeGreaterThan(1);
    await page.clock.runFor(400);
    expect(await coverShift(page)).toBeLessThan(0.5);
  });

  test("with reduced motion it appears in place and works the same", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.clock.install();
    await openList(page);
    await pauseClock(page);
    await coverButton(page).click({ force: true });
    await page.clock.runFor(32);
    expect(await coverShift(page)).toBeLessThan(0.5);
    await page.clock.resume();

    await expectOpen(page);
    await sortChip(page, "제목").click();
    await expect(linkTitles(page).first()).toHaveText(TITLES[2]);
    await coverButton(page).click();
    await expectClosed(page);
    await expect(coverButton(page)).toHaveAccessibleName("정렬·필터 열기, 적용 중: 제목 오름차순");
  });
});

async function expectFocusRing(chip: Locator, selector: string | null = null) {
  await expect(chip).toBeFocused();
  await expect
    .poll(() =>
      chip.evaluate((node, innerSelector) => {
        const target = innerSelector ? node.querySelector(innerSelector) : node;
        const style = getComputedStyle(target!);
        return {
          hasRing: style.boxShadow !== "none",
          offset: style.getPropertyValue("--tw-ring-offset-width").trim(),
          offsetMatchesBackground:
            style.getPropertyValue("--tw-ring-offset-color").trim() ===
            `hsl(${style.getPropertyValue("--background").trim()})`,
        };
      }, selector),
    )
    .toEqual({ hasRing: true, offset: "2px", offsetMatchesBackground: true });
}

test.describe("#96 filter row regressions", () => {
  for (const folderDetail of [false, true]) {
    test(`filled shortcut icon, switch state and matching results on ${folderDetail ? "folder detail" : "the main list"}`, async ({
      page,
    }) => {
      await mockLinks(page);
      await page.goto(folderDetail ? "/folders/1" : listPath());
      const titles = linkTitles(page);
      await expect(titles).toHaveCount(3);
      await coverButton(page).focus();
      await page.keyboard.press("Enter");
      const star = favoriteToggle(page).locator("svg path");
      await expect(star).toHaveCSS("fill", "none");
      await expect(favoriteToggle(page)).not.toBeChecked();
      await page.keyboard.press("Space");
      await expect(favoriteToggle(page)).toBeChecked();
      await expect(star).not.toHaveCSS("fill", "none");
      await expect(titles).toHaveText([TITLES[2]]);
      await page.keyboard.press("Tab");
      await expectFocusRing(sortChip(page, "저장일, 내림차순"));
      await page.keyboard.press("Escape");
      await expect(coverButton(page)).toBeFocused();
      const pillStar = coverButton(page).locator("svg path[fill='currentColor']");
      await expect(pillStar).toHaveCount(1);
      await expect(pillStar).not.toHaveCSS("fill", "none");

      await page.keyboard.press("Enter");
      await page.keyboard.press("Space");
      await expect(favoriteToggle(page)).not.toBeChecked();
      await expect(star).toHaveCSS("fill", "none");
      await expect(titles).toHaveCount(3);
      await page.keyboard.press("Escape");
      await expect(pillStar).toHaveCount(0);
    });
  }

  test("folder and shortcut switch respond 21.5 pixels above and below their centers", async ({
    page,
  }) => {
    test.skip(isWideProject(), "web mobile touch targets");
    await openList(page);
    const folders = page.getByRole("radiogroup", { name: "폴더" });
    const folder = folders.getByRole("radio", { name: "📚 공부" });
    const all = folders.getByRole("radio", { name: "전체", exact: true });
    const other = folders.getByRole("radio", { name: "🗂️ 미분류" });
    for (const delta of [-21.5, 21.5]) {
      await all.tap();
      const area = await box(folder);
      await page.touchscreen.tap(area.x + area.width / 2, area.y + area.height / 2 + delta);
      await expect(folder).toBeChecked();
      await expect(other).not.toBeChecked();
      await expectClosed(page);
    }

    await coverButton(page).tap();
    await expect.poll(() => coverShift(page)).toBeLessThan(0.5);
    for (const delta of [-21.5, 21.5]) {
      await expect(favoriteToggle(page)).not.toBeChecked();
      const area = await box(favoriteToggle(page));
      await page.touchscreen.tap(area.x + area.width / 2, area.y + area.height / 2 + delta);
      await expect(favoriteToggle(page)).toBeChecked();
      await expect(sortChip(page, "저장일, 내림차순")).toBeChecked();
      await expectOpen(page);
      await favoriteToggle(page).tap();
    }
  });

  test("folder scroll fades follow the edges, let touches through, and survive reopening", async ({
    page,
  }) => {
    test.skip(isWideProject(), "web mobile folder scroll");
    await mockApi(page, { folders: makeFolders(10), links: buildLinks() });
    await page.goto("/home");
    const folders = page.getByRole("radiogroup", { name: "폴더" });
    const scroll = page.getByTestId("link-filter-row-primary-scroll");
    const left = page.getByTestId("link-filter-row-primary-fade-left");
    const right = page.getByTestId("link-filter-row-primary-fade-right");
    const first = folders.getByRole("radio").first();
    const last = folders.getByRole("radio").last();
    const clipped = folders.getByRole("radio", { name: "📁 폴더 8" });
    await expect(first).toBeChecked();
    await expect(left).toHaveCount(0);
    await expect(right).toBeVisible();

    const viewport = await box(scroll);
    const chip = await box(clipped);
    await scroll.evaluate((node, x) => (node.scrollLeft = x), chip.x - viewport.x + chip.width / 2);
    await expect(left).toBeVisible();
    await expect(right).toBeVisible();

    const fade = await box(left);
    const x = fade.x + fade.width / 2;
    const y = fade.y + fade.height / 2;
    await page.touchscreen.tap(x, y);
    await expect(clipped).toBeChecked();
    const beforeOpening = await scroll.evaluate((node) => node.scrollLeft);
    await coverButton(page).click();
    await expectOpen(page);
    await coverButton(page).click();
    await expectClosed(page);
    await expect.poll(() => scroll.evaluate((node) => node.scrollLeft)).toBe(beforeOpening);

    const client = await page.context().newCDPSession(page);
    const previous = await scroll.evaluate((node) => node.scrollLeft);
    await client.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
    for (const distance of [20, 40, 65]) {
      await client.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{ x: x + distance, y }],
      });
    }
    await expect.poll(() => scroll.evaluate((node) => node.scrollLeft)).toBeLessThan(previous);
    await scroll.evaluate((node) => {
      node.dataset.scrolling = "true";
      node.addEventListener("scrollend", () => delete node.dataset.scrolling, { once: true });
    });
    await client.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await client.detach();
    await expect(scroll).not.toHaveAttribute("data-scrolling");

    await page.keyboard.press("Tab");
    await last.focus();
    await page.keyboard.press("Space");
    await expect(last).toBeChecked();
    await expectFocusRing(last, ":scope > div");
    await expect(right).toHaveCount(0);
    await expect(left).toBeVisible();
    expect((await box(last)).x + (await box(last)).width + 4).toBeLessThanOrEqual(
      viewport.x + viewport.width + 0.1,
    );
    await first.focus();
    await page.keyboard.press("Space");
    await expect(first).toBeChecked();
    await expectFocusRing(first, ":scope > div");
    await expect(left).toHaveCount(0);
    await expect(right).toBeVisible();
    expect((await box(first)).x - 4).toBeGreaterThanOrEqual(viewport.x - 0.1);
  });

  test("fitting folder chips have no fade on either side", async ({ page }) => {
    test.skip(isWideProject(), "web mobile folder scroll");
    await mockApi(page, { folders: [], links: buildLinks() });
    await page.goto("/home");
    const scroll = page.getByTestId("link-filter-row-primary-scroll");
    await expect(scroll.getByRole("radio", { name: "전체", exact: true })).toBeChecked();
    await expect.poll(() => scroll.evaluate((node) => node.scrollWidth - node.clientWidth)).toBe(0);
    await expect(page.getByTestId(/link-filter-row-primary-fade-/)).toHaveCount(0);
  });

  const todos: MockTodo[] = ["진행할 일", "기간 지난 일", "끝낸 일"].map((title, index) => ({
    id: index + 1,
    title,
    reminderAt: index === 1 ? "2020-01-01T00:00:00Z" : null,
    completedAt: index === 2 ? "2020-01-02T00:00:00Z" : null,
    linkId: 1,
    linkUrl: "https://example.com",
    linkTitle: "링크",
    linkThumbnailUrl: null,
    linkFaviconUrl: null,
  }));

  for (const theme of ["light", "dark"] as const) {
    for (const accent of ["gray", "pink", "blue"] as const) {
      test(`sort and status focus are separated from the selected fill in ${theme} / ${accent}`, async ({
        page,
      }) => {
        await mockApi(page, {
          todos,
          handlers: { "GET /api/users/me/settings": settingsHandler(theme, accent) },
        });
        await page.goto("/todos");
        await expect(page.locator("html")).toHaveAttribute("data-accent", accent);
        if (theme === "dark") {
          await expect(page.locator("html")).toHaveClass(/\bdark\b/);
        } else {
          await expect(page.locator("html")).not.toHaveClass(/\bdark\b/);
        }
        const all = page.getByRole("radio", { name: "전체 3", exact: true });
        const button = page.getByTestId("todo-filter-row-button");
        await expect(all).toBeChecked();
        await page.keyboard.press("Tab");
        await all.focus();
        await expectFocusRing(all, ":scope > div");
        await button.focus();
        await page.keyboard.press("Enter");
        const sorts = page.getByRole("radiogroup", { name: "정렬 기준" });
        await expectFocusRing(sorts.getByRole("radio", { checked: true }));
      });
    }
  }

  test("four action statuses fit after selecting a nondefault sort and 완료 works by pointer and keyboard", async ({
    page,
  }) => {
    await mockApi(page, { todos });
    await page.goto("/todos");
    const button = page.getByTestId("todo-filter-row-button");
    const scroll = page.getByTestId("todo-filter-row-primary-scroll");
    const statuses = scroll.getByRole("radio");
    const completed = scroll.getByRole("radio", { name: "완료 1", exact: true });
    const all = scroll.getByRole("radio", { name: "전체 3", exact: true });
    await expect(all).toBeChecked();
    await button.click();
    await sortChip(page, "만든 날").click();
    await expect(sortChip(page, "만든 날, 내림차순")).toBeChecked();
    await button.click();
    await expect(button).toHaveAccessibleName("정렬·필터 열기, 적용 중: 만든 날 내림차순");
    await expect(statuses).toHaveCount(4);
    for (const name of ["전체 3", "진행 중 1", "기간지남 1", "완료 1"]) {
      await expect(scroll.getByRole("radio", { name, exact: true })).toBeInViewport({ ratio: 1 });
    }
    await expect.poll(() => scroll.evaluate((node) => node.scrollWidth - node.clientWidth)).toBe(0);
    await expect(page.getByTestId(/todo-filter-row-primary-fade-/)).toHaveCount(0);
    if (isWideProject()) {
      await expect(button.getByText("만든 날", { exact: true })).toBeVisible();
    } else {
      await expect(button.getByText("만든 날", { exact: true })).toHaveCount(0);
      await expect(button.getByTestId("todo-filter-sort-direction")).toBeVisible();
    }
    for (const delta of [-21.5, 21.5]) {
      const buttonArea = await box(button);
      await page.mouse.click(
        buttonArea.x + buttonArea.width / 2,
        buttonArea.y + buttonArea.height / 2 + delta,
      );
      await expect(sortChip(page, "만든 날, 내림차순")).toBeChecked();
      await button.click();
      const target = await box(completed);
      await page.mouse.click(target.x + target.width / 2, target.y + target.height / 2 + delta);
      await expect(completed).toBeChecked();
      await expect(page.getByTestId("todo-item-title")).toHaveText(["끝낸 일"]);
      await all.click();
    }
    await all.focus();
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    await expect(completed).toBeFocused();
    await page.keyboard.press("Space");
    await expect(completed).toBeChecked();
    await expect(page.getByTestId("todo-item-title")).toHaveText(["끝낸 일"]);
  });
});
