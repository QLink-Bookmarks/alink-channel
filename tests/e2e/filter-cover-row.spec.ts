import { type Locator, type Page, expect, test } from "@playwright/test";

import { isWideProject } from "./support/helpers";
import { type MockLink, makeDetail, makeLink, mockApi } from "./support/mock-api";

// #79: the filter row's cover — how it opens and closes, the auto close, the pill, the keyboard,
// the accessible names, the row at 320–769px and reduced motion. The sorting and filtering itself
// is in link-sort-filter.spec.ts and todo-status-filter.spec.ts.

const IDLE_MS = 1200;

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
  await expect(page.getByTestId("link-card-title").first()).toBeVisible();
  await expect(coverButton(page)).toBeVisible();
}

/** Stops the page clock a moment from now, so timers only run when the test says. */
async function pauseClock(page: Page) {
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

    await page.getByTestId("link-card-title").filter({ hasText: TITLES[3] }).click();
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
  test("closes 1.2s after the last press, not before, and shows what was chosen", async ({
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
});

test.describe("accessible names", () => {
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
    await page.clock.install();
    await openList(page);
    await pauseClock(page);
    await coverButton(page).click({ force: true });
    await page.clock.runFor(32);
    expect(await coverShift(page)).toBeGreaterThan(1);
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
    await expect(page.getByTestId("link-card-title").first()).toHaveText(TITLES[2]);
    await coverButton(page).click();
    await expectClosed(page);
    await expect(coverButton(page)).toHaveAccessibleName("정렬·필터 열기, 적용 중: 제목 오름차순");
  });
});
