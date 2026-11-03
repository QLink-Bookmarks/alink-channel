import { type Locator, type Page, expect, test } from "@playwright/test";

import { boxOf, isWideProject } from "./support/helpers";
import { type MockFolder, makeFolders, makeLink, mockApi } from "./support/mock-api";

const PIN_TOP = /0px 6px 10px -8px/;
const PIN_BOTTOM = /0px -6px 10px -8px/;

test.beforeEach(() => {
  test.skip(!isWideProject(), "wide sidebar only");
});

function toggle(page: Page, label: "내 폴더" | "공유 폴더") {
  return page.getByRole("button", {
    name: new RegExp(`^${label} (접기|펼치기)(, 현재 폴더 .+ 포함)?$`),
  });
}

function paletteButton(page: Page) {
  return page.getByRole("button", { name: "모드와 강조색", exact: true });
}

async function sidebarRightEdge(page: Page) {
  const box = await boxOf(page.getByTestId("wide-sidebar-column"));
  return box.x + box.width;
}

async function fullyVisibleRows(list: Locator) {
  return list.evaluate((node) => {
    const box = node.getBoundingClientRect();
    return Array.from(node.querySelectorAll('[role="button"]')).filter((row) => {
      const rect = row.getBoundingClientRect();
      return rect.top >= box.top - 1 && rect.bottom <= box.bottom + 1;
    }).length;
  });
}

async function sidebarOverflow(page: Page) {
  return (await sidebarScroller(page)).evaluate((node) =>
    node ? node.scrollHeight - node.clientHeight : 0,
  );
}

function addButton(page: Page, label: "내 폴더" | "공유 폴더") {
  return page.getByRole("button", { name: `${label}에 폴더 추가` });
}

function sectionList(page: Page, label: "내 폴더" | "공유 폴더") {
  return page.getByLabel(`${label} 목록`, { exact: true });
}

function folderRow(scope: Page | Locator, id: number) {
  return scope.getByRole("button", { name: new RegExp(`^폴더 ${id}, 링크`) });
}

function uncategorized(page: Page) {
  return page.getByRole("button", { name: /^미분류/ });
}

async function scrollTo(list: Locator, offset: number) {
  await list.evaluate((node, y) => {
    node.scrollTop = y;
  }, offset);
}

async function scrollToEnd(list: Locator) {
  await list.evaluate((node) => {
    node.scrollTop = node.scrollHeight;
  });
}

async function scrollTop(list: Locator) {
  return list.evaluate((node) => Math.round(node.scrollTop));
}

async function settle(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          document.getAnimations().filter((animation) => animation.playState === "running").length,
      ),
    )
    .toBe(0);
}

async function recordSectionAnimations(page: Page) {
  await page.evaluate(() => {
    const names: string[] = [];
    (window as unknown as { __sectionAnimations: string[] }).__sectionAnimations = names;
    document.addEventListener(
      "animationstart",
      (event) => {
        const target = event.target as HTMLElement;
        const isSectionList = target.querySelector('[aria-label$="폴더 목록"]') !== null;
        const isSectionTitle =
          target.querySelector('[aria-label$="폴더 접기"], [aria-label$="폴더 펼치기"]') !== null &&
          target.querySelectorAll('[aria-label$="폴더 접기"], [aria-label$="폴더 펼치기"]')
            .length === 1;
        if (isSectionList || isSectionTitle) {
          names.push(event.animationName);
        }
      },
      true,
    );
  });
}

function sectionAnimationCount(page: Page) {
  return page.evaluate(
    () => (window as unknown as { __sectionAnimations: string[] }).__sectionAnimations.length,
  );
}

function nextFrames(page: Page) {
  return page.evaluate(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve(null))),
      ),
  );
}

async function headerShadow(page: Page, label: "내 폴더" | "공유 폴더") {
  return toggle(page, label)
    .locator("xpath=..")
    .evaluate((node) => getComputedStyle(node).boxShadow);
}

async function scrollUntilVisible(list: Locator, target: Locator) {
  await expect
    .poll(
      async () => {
        await scrollToEnd(list);
        return target.isVisible();
      },
      { timeout: 20_000 },
    )
    .toBe(true);
}

async function sidebarScroller(page: Page) {
  return page.getByRole("button", { name: /^홈$/ }).evaluateHandle((node) => {
    let element: HTMLElement | null = node as HTMLElement;
    while (element && getComputedStyle(element).overflowY !== "auto") {
      element = element.parentElement;
    }
    return element;
  });
}

function mixedFolders(mine: number, shared: number): MockFolder[] {
  const total = mine + shared;
  return Array.from({ length: total }, (_, index) => {
    const id = total - index;
    const isShared = index >= mine;
    return {
      id,
      ownerId: isShared ? 2 : 1,
      name: `폴더 ${id}`,
      emoji: "📁",
      isShared,
      shareCounts: isShared ? 3 : 0,
      linkCounts: 1,
    };
  });
}

test.describe("wide sidebar folder sections", () => {
  test("first use: 내 폴더 open, 공유 폴더 title below its list, 미분류 under the folder area", async ({
    page,
  }) => {
    await mockApi(page, { folders: makeFolders(45, 3) });
    await page.goto("/home");

    await expect(toggle(page, "내 폴더")).toHaveAttribute("aria-expanded", "true");
    await expect(toggle(page, "내 폴더")).toHaveAccessibleName("내 폴더 접기");
    await expect(toggle(page, "공유 폴더")).toHaveAccessibleName("공유 폴더 펼치기");
    await expect(toggle(page, "공유 폴더")).toHaveAttribute("aria-expanded", "false");
    await expect(folderRow(sectionList(page, "내 폴더"), 44)).toBeVisible();
    await settle(page);

    const mineHeader = await boxOf(toggle(page, "내 폴더"));
    const mineList = await boxOf(sectionList(page, "내 폴더"));
    const sharedHeader = await boxOf(toggle(page, "공유 폴더"));
    const uncategorizedRow = await boxOf(uncategorized(page));
    expect(mineList.y).toBeGreaterThanOrEqual(mineHeader.y + mineHeader.height - 1);
    expect(sharedHeader.y).toBeGreaterThanOrEqual(mineList.y + mineList.height - 1);
    expect(uncategorizedRow.y).toBeGreaterThan(sharedHeader.y + sharedHeader.height - 1);
    await expect(sectionList(page, "공유 폴더")).toHaveCount(0);
  });

  test("scrolling 내 폴더 to the end shows a small loading, then every folder down to the oldest", async ({
    page,
  }) => {
    await mockApi(page, { folders: makeFolders(45, 3), folderPages: { delayMs: { 1: 1200 } } });
    await page.goto("/home");
    const list = sectionList(page, "내 폴더");
    await expect(folderRow(list, 44)).toBeVisible();

    await scrollToEnd(list);
    await expect(list.getByRole("progressbar", { name: "폴더를 더 불러오는 중" })).toBeVisible();
    await scrollUntilVisible(list, folderRow(list, 1));
    await expect(list.getByRole("progressbar")).toHaveCount(0);
  });

  test("the rest of the sidebar and both titles stay put while the folder list scrolls", async ({
    page,
  }) => {
    await mockApi(page, { folders: makeFolders(45, 3) });
    await page.goto("/home");
    const list = sectionList(page, "내 폴더");
    await expect(folderRow(list, 44)).toBeVisible();

    const fixed = [
      page.getByRole("button", { name: /새 링크/ }).first(),
      page.getByRole("button", { name: /^홈$/ }),
      page.getByRole("button", { name: /^전체$/ }),
      page.getByRole("button", { name: /^할일$/ }),
      toggle(page, "내 폴더"),
      toggle(page, "공유 폴더"),
      uncategorized(page),
      paletteButton(page),
      page.getByText("테스터", { exact: true }),
    ];
    await settle(page);
    const before = await Promise.all(fixed.map((locator) => boxOf(locator)));
    await scrollTo(list, 240);
    await expect.poll(() => scrollTop(list)).toBeGreaterThan(200);
    const after = await Promise.all(fixed.map((locator) => boxOf(locator)));
    after.forEach((box, index) => expect(box.y).toBeCloseTo(before[index].y, 0));

    await toggle(page, "공유 폴더").click();
    await expect(toggle(page, "공유 폴더")).toHaveAttribute("aria-expanded", "true");
    await page.getByRole("button", { name: /^할일$/ }).click();
    await expect(page).toHaveURL(/\/todos$/);
  });

  test("title shadows follow the scroll position of the open list", async ({ page }) => {
    await mockApi(page, { folders: makeFolders(25, 0) });
    await page.goto("/home");
    const list = sectionList(page, "내 폴더");
    await expect(folderRow(list, 24)).toBeVisible();

    expect(await headerShadow(page, "내 폴더")).not.toMatch(PIN_TOP);
    await expect.poll(() => headerShadow(page, "공유 폴더")).toMatch(PIN_BOTTOM);

    await scrollTo(list, 60);
    await expect.poll(() => headerShadow(page, "내 폴더")).toMatch(PIN_TOP);

    await scrollUntilVisible(list, folderRow(list, 1));
    await expect.poll(() => headerShadow(page, "공유 폴더")).not.toMatch(PIN_BOTTOM);

    await scrollTo(list, 0);
    await expect.poll(() => headerShadow(page, "내 폴더")).not.toMatch(PIN_TOP);
  });

  test("rows show emoji, name and link count, the current folder is marked, and no count badge or add rows remain", async ({
    page,
  }) => {
    await mockApi(page, { folders: makeFolders(10, 3) });
    await page.goto("/folders/8");
    const list = sectionList(page, "내 폴더");

    const current = folderRow(list, 8);
    await expect(current).toHaveAttribute("aria-current", "page");
    await expect(current).toContainText("📁");
    await expect(current).toContainText("폴더 8");
    await expect(current).toContainText("3");
    await expect(folderRow(list, 10)).not.toHaveAttribute("aria-current", "page");
    await expect(toggle(page, "내 폴더")).toHaveText("내 폴더");
    await expect(toggle(page, "공유 폴더")).toHaveText("공유 폴더");
    await expect(page.getByText(/폴더 추가|공유폴더 추가/)).toHaveCount(0);
  });

  test("opening 공유 폴더 closes 내 폴더, re-opening 내 폴더 closes 공유 폴더, and pressing the open title closes both", async ({
    page,
  }) => {
    await mockApi(page, { folders: makeFolders(12, 3) });
    await page.goto("/home");
    await expect(folderRow(sectionList(page, "내 폴더"), 11)).toBeVisible();

    await toggle(page, "공유 폴더").click();
    await expect(toggle(page, "내 폴더")).toHaveAccessibleName("내 폴더 펼치기");
    await expect(sectionList(page, "내 폴더")).toHaveCount(0);
    await settle(page);
    const sharedList = sectionList(page, "공유 폴더");
    await expect(folderRow(sharedList, 12)).toHaveAccessibleName("폴더 12, 링크 2개, 2명 참여");
    const mineHeader = await boxOf(toggle(page, "내 폴더"));
    const sharedHeader = await boxOf(toggle(page, "공유 폴더"));
    const sharedBox = await boxOf(sharedList);
    expect(sharedHeader.y).toBeGreaterThan(mineHeader.y);
    expect(sharedBox.y).toBeGreaterThanOrEqual(sharedHeader.y + sharedHeader.height - 1);

    await toggle(page, "내 폴더").click();
    await expect(toggle(page, "내 폴더")).toHaveAccessibleName("내 폴더 접기");
    await expect(toggle(page, "공유 폴더")).toHaveAccessibleName("공유 폴더 펼치기");
    await expect(sectionList(page, "공유 폴더")).toHaveCount(0);

    await toggle(page, "내 폴더").click();
    await expect(toggle(page, "내 폴더")).toHaveAccessibleName("내 폴더 펼치기");
    await expect(toggle(page, "공유 폴더")).toHaveAccessibleName("공유 폴더 펼치기");
    await expect(page.getByLabel(/폴더 목록$/)).toHaveCount(0);
    await expect(uncategorized(page)).toBeVisible();
  });

  test("switching sections animates, and reduced motion switches without animation", async ({
    browser,
  }) => {
    for (const reducedMotion of ["no-preference", "reduce"] as const) {
      const context = await browser.newContext({
        reducedMotion,
        viewport: { width: 1280, height: 800 },
      });
      const page = await context.newPage();
      await mockApi(page, { folders: makeFolders(12, 3) });
      await page.goto("/home");
      await expect(folderRow(sectionList(page, "내 폴더"), 11)).toBeVisible();
      await settle(page);
      await recordSectionAnimations(page);

      await toggle(page, "공유 폴더").click();
      await expect(folderRow(sectionList(page, "공유 폴더"), 12)).toBeVisible();
      if (reducedMotion === "reduce") {
        await nextFrames(page);
        expect(await sectionAnimationCount(page)).toBe(0);
      } else {
        await expect.poll(() => sectionAnimationCount(page)).toBeGreaterThan(0);
      }
      await context.close();
    }
  });

  test("each section reopens where it was left, and a section opened for the first time starts at the top", async ({
    page,
  }) => {
    await mockApi(page, { folders: makeFolders(45, 3) });
    await page.goto("/home");
    const mine = sectionList(page, "내 폴더");
    await expect(folderRow(mine, 44)).toBeVisible();
    await scrollTo(mine, 180);
    await expect.poll(() => scrollTop(mine)).toBe(180);
    await expect.poll(() => headerShadow(page, "내 폴더")).toMatch(PIN_TOP);

    await toggle(page, "공유 폴더").click();
    const shared = sectionList(page, "공유 폴더");
    await expect(folderRow(shared, 45)).toBeVisible();
    expect(await scrollTop(shared)).toBe(0);

    await toggle(page, "내 폴더").click();
    await expect.poll(() => scrollTop(sectionList(page, "내 폴더"))).toBe(180);
  });

  test("the blank part of a title toggles, and the edge of the add hit area opens the add dialog", async ({
    page,
  }) => {
    await mockApi(page, { folders: makeFolders(12, 3) });
    await page.goto("/home");

    const titleBox = await boxOf(toggle(page, "공유 폴더"));
    await page.mouse.click(titleBox.x + titleBox.width - 6, titleBox.y + titleBox.height / 2);
    await expect(toggle(page, "공유 폴더")).toHaveAccessibleName("공유 폴더 접기");

    const addBox = await boxOf(addButton(page, "내 폴더"));
    expect(addBox.width).toBeGreaterThanOrEqual(44);
    expect(addBox.height).toBeGreaterThanOrEqual(44);
    await page.mouse.click(addBox.x + 3, addBox.y + addBox.height - 3);
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByText("새 폴더", { exact: true })).toBeVisible();
  });

  test("the add button of each section preselects 일반 or 공유", async ({ page }) => {
    await mockApi(page, { folders: makeFolders(12, 3) });
    await page.goto("/home");

    await addButton(page, "내 폴더").click();
    await expect(page.getByRole("dialog").getByRole("switch")).not.toBeChecked();
    await page.getByRole("button", { name: "취소" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);

    await addButton(page, "공유 폴더").click();
    await expect(page.getByRole("dialog").getByRole("switch")).toBeChecked();
  });

  test("a created folder shows first in its section, and a failed create adds nothing", async ({
    page,
  }) => {
    let failCreate = false;
    await mockApi(page, { folders: makeFolders(30, 3) });
    await page.route(
      (url) => url.pathname === "/api/folders" && !url.host.startsWith("localhost"),
      async (route) => {
        if (failCreate && route.request().method() === "POST") {
          await route.fulfill({ status: 500, contentType: "application/json", body: "{}" });
          return;
        }
        await route.fallback();
      },
    );
    await page.goto("/home");
    const mine = sectionList(page, "내 폴더");
    await expect(folderRow(mine, 29)).toBeVisible();
    await scrollTo(mine, 200);

    await addButton(page, "공유 폴더").click();
    await page.getByPlaceholder("예: 디자인 레퍼런스").fill("새 공유 모임");
    await page.getByRole("button", { name: "저장" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    const shared = sectionList(page, "공유 폴더");
    await expect(shared.getByRole("button").first()).toHaveAccessibleName(
      /^새 공유 모임, 링크 0개/,
    );

    failCreate = true;
    await addButton(page, "공유 폴더").click();
    await page.getByPlaceholder("예: 디자인 레퍼런스").fill("만들어지면 안 되는 폴더");
    await page.getByRole("button", { name: "저장" }).click();
    await expect(page.getByText("폴더 생성에 실패했어요")).toBeVisible();
    await page.getByRole("button", { name: "취소" }).click();
    await expect(page.getByText("만들어지면 안 되는 폴더")).toHaveCount(0);
  });

  test("a folder made from 내 폴더 + after switching to 공유 opens 공유 폴더 with the new folder first, and the other way round", async ({
    page,
  }) => {
    await mockApi(page, { folders: makeFolders(30, 3) });
    await page.goto("/home");
    await expect(folderRow(sectionList(page, "내 폴더"), 29)).toBeVisible();

    await addButton(page, "내 폴더").click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("switch")).not.toBeChecked();
    await dialog.getByRole("switch").click();
    await expect(dialog.getByRole("switch")).toBeChecked();
    await page.getByPlaceholder("예: 디자인 레퍼런스").fill("바꿔서 만든 공유 폴더");
    await page.getByRole("button", { name: "저장" }).click();
    await expect(dialog).toHaveCount(0);
    await expect(toggle(page, "공유 폴더")).toHaveAccessibleName("공유 폴더 접기");
    await expect(sectionList(page, "공유 폴더").getByRole("button").first()).toHaveAccessibleName(
      /^바꿔서 만든 공유 폴더, 링크 0개/,
    );

    await addButton(page, "공유 폴더").click();
    await expect(dialog.getByRole("switch")).toBeChecked();
    await dialog.getByRole("switch").click();
    await page.getByPlaceholder("예: 디자인 레퍼런스").fill("바꿔서 만든 내 폴더");
    await page.getByRole("button", { name: "저장" }).click();
    await expect(dialog).toHaveCount(0);
    await expect(toggle(page, "내 폴더")).toHaveAccessibleName("내 폴더 접기");
    await expect(sectionList(page, "내 폴더").getByRole("button").first()).toHaveAccessibleName(
      /^바꿔서 만든 내 폴더, 링크 0개/,
    );
  });

  test("the folder list keeps its scroll position across navigation and starts at the top after reload", async ({
    page,
  }) => {
    await mockApi(page, { folders: makeFolders(45, 3) });
    await page.goto("/home");
    const mine = sectionList(page, "내 폴더");
    await expect(folderRow(mine, 44)).toBeVisible();
    await scrollTo(mine, 200);
    await expect.poll(() => scrollTop(mine)).toBe(200);

    await folderRow(mine, 34).click();
    await expect(page).toHaveURL(/\/folders\/34$/);
    for (const [name, url] of [
      [/^홈$/, /\/home$/],
      [/^전체$/, /\/links/],
      [/^할일$/, /\/todos$/],
    ] as const) {
      await page.getByRole("button", { name }).click();
      await expect(page).toHaveURL(url);
    }
    expect(await scrollTop(sectionList(page, "내 폴더"))).toBe(200);

    await page.reload();
    await expect(folderRow(sectionList(page, "내 폴더"), 44)).toBeVisible();
    expect(await scrollTop(sectionList(page, "내 폴더"))).toBe(0);
  });

  test("a 480px tall window keeps the folder area at its minimum and scrolls the whole sidebar, until the window grows again", async ({
    page,
  }) => {
    await mockApi(page, { folders: makeFolders(45, 3) });
    await page.setViewportSize({ width: 1280, height: 480 });
    await page.goto("/home");
    const mine = sectionList(page, "내 폴더");
    await expect(folderRow(mine, 44)).toBeVisible();

    await settle(page);
    const headers = (await boxOf(toggle(page, "내 폴더"))).height * 2;
    const listBox = await boxOf(mine);
    expect(headers + listBox.height).toBeGreaterThanOrEqual(40 * 2 + 40 * 2);

    const scroller = await sidebarScroller(page);
    const overflow = await scroller.evaluate((node) =>
      node ? node.scrollHeight - node.clientHeight : 0,
    );
    expect(overflow).toBeGreaterThan(0);
    await scroller.evaluate((node) => {
      if (node) {
        node.scrollTop = node.scrollHeight;
      }
    });
    await expect(page.getByText("테스터", { exact: true })).toBeInViewport();

    await page.setViewportSize({ width: 1280, height: 800 });
    await expect
      .poll(async () =>
        (await sidebarScroller(page)).evaluate((node) =>
          node ? node.scrollHeight - node.clientHeight : 0,
        ),
      )
      .toBeLessThanOrEqual(1);
    await expect.poll(async () => (await boxOf(mine)).height).toBeGreaterThan(listBox.height);
  });

  test("the open section survives a reload, including both closed", async ({ page }) => {
    await mockApi(page, { folders: makeFolders(12, 3) });
    await page.goto("/home");
    await toggle(page, "공유 폴더").click();
    await expect(toggle(page, "공유 폴더")).toHaveAccessibleName("공유 폴더 접기");

    await page.reload();
    await expect(toggle(page, "공유 폴더")).toHaveAccessibleName("공유 폴더 접기");
    await expect(toggle(page, "내 폴더")).toHaveAccessibleName("내 폴더 펼치기");

    await toggle(page, "공유 폴더").click();
    await page.reload();
    await expect(toggle(page, "공유 폴더")).toHaveAccessibleName("공유 폴더 펼치기");
    await expect(toggle(page, "내 폴더")).toHaveAccessibleName("내 폴더 펼치기");
  });
});

test.describe("wide sidebar folder states", () => {
  test("while the first batch loads, only the folder area shows a skeleton and the titles, add buttons and 미분류 work", async ({
    page,
  }) => {
    await mockApi(page, { folders: makeFolders(12, 3), folderPages: { delayMs: { 0: 4000 } } });
    await page.goto("/home");

    const skeleton = sectionList(page, "내 폴더").getByRole("progressbar", {
      name: "폴더를 불러오는 중",
    });
    await expect(skeleton).toBeVisible();
    await addButton(page, "내 폴더").click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByRole("button", { name: "취소" }).click();
    await toggle(page, "공유 폴더").click();
    await expect(sectionList(page, "공유 폴더").getByRole("progressbar")).toBeVisible();
    await uncategorized(page).click();
    await expect(page).toHaveURL(/\/folders\/0$/);
  });

  test("a failed first batch shows an error with retry in the folder area, hides the 미분류 count, and keeps other menus working", async ({
    page,
  }) => {
    test.setTimeout(90_000);
    const state = await mockApi(page, {
      folders: makeFolders(12, 3),
      links: [makeLink({ id: 1 })],
      folderPages: { failAll: true },
      handlers: {
        "GET /api/links": (route) =>
          route.fulfill({ status: 500, contentType: "application/json", body: "{}" }),
      },
    });
    await page.goto("/home");

    const area = sectionList(page, "내 폴더");
    await expect(area.getByText("폴더를 불러오지 못했어요")).toBeVisible({ timeout: 30_000 });
    await expect(uncategorized(page)).toHaveAccessibleName("미분류");
    for (const [name, url] of [
      [/^전체$/, /\/links/],
      [/^할일$/, /\/todos$/],
      [/^홈$/, /\/home$/],
    ] as const) {
      await page.getByRole("button", { name }).click();
      await expect(page).toHaveURL(url);
    }
    await uncategorized(page).click();
    await expect(page).toHaveURL(/\/folders\/0$/);

    state.folderPages.failAll = false;
    await area.getByRole("button", { name: "다시 시도" }).click();
    await expect(folderRow(sectionList(page, "내 폴더"), 11)).toBeVisible();
  });

  test("a failed next batch keeps loaded folders with a single retry at the end of the open list, also after switching sections", async ({
    page,
  }) => {
    test.setTimeout(90_000);
    const state = await mockApi(page, {
      folders: makeFolders(45, 3),
      folderPages: { failPages: new Set([1]) },
    });
    await page.goto("/home");
    const mine = sectionList(page, "내 폴더");
    await expect(folderRow(mine, 44)).toBeVisible();

    await expect
      .poll(
        async () => {
          await scrollToEnd(mine);
          return mine.getByText("더 불러오지 못했어요").isVisible();
        },
        { timeout: 30_000 },
      )
      .toBe(true);
    await expect(page.getByRole("button", { name: "다시 시도" })).toHaveCount(1);
    await expect(folderRow(mine, 26)).toBeAttached();

    await toggle(page, "공유 폴더").click();
    const shared = sectionList(page, "공유 폴더");
    await expect(shared.getByRole("button", { name: "다시 시도" })).toBeVisible();
    await expect(page.getByRole("button", { name: "다시 시도" })).toHaveCount(1);

    state.folderPages.failPages.clear();
    await shared.getByRole("button", { name: "다시 시도" }).click();
    await expect(folderRow(shared, 24)).toBeAttached();
    await expect(page.getByRole("button", { name: "다시 시도" })).toHaveCount(0);
  });

  test("empty sections show a short note and the title add button creates the first folder", async ({
    page,
  }) => {
    await mockApi(page, { folders: makeFolders(6, 0) });
    await page.goto("/home");

    await toggle(page, "공유 폴더").click();
    const shared = sectionList(page, "공유 폴더");
    await expect(shared.getByText("아직 공유 폴더가 없어요")).toBeVisible();
    await addButton(page, "공유 폴더").click();
    await page.getByPlaceholder("예: 디자인 레퍼런스").fill("첫 공유 폴더");
    await page.getByRole("button", { name: "저장" }).click();
    await expect(
      sectionList(page, "공유 폴더").getByRole("button", { name: /^첫 공유 폴더, 링크 0개/ }),
    ).toBeVisible();
    await expect(page.getByText("아직 공유 폴더가 없어요")).toHaveCount(0);
  });

  test("an account with only shared folders shows the note in 내 폴더", async ({ page }) => {
    await mockApi(page, { folders: mixedFolders(0, 4) });
    await page.goto("/home");
    await expect(sectionList(page, "내 폴더").getByText("아직 만든 폴더가 없어요")).toBeVisible();
  });

  test("an account without folders shows both titles, the note and 미분류", async ({ page }) => {
    await mockApi(page, { folders: [] });
    await page.goto("/home");
    await expect(toggle(page, "내 폴더")).toBeVisible();
    await expect(toggle(page, "공유 폴더")).toBeVisible();
    await expect(page.getByText("아직 만든 폴더가 없어요")).toBeVisible();
    await expect(uncategorized(page)).toBeVisible();
  });

  for (const count of [1, 20]) {
    test(`an account with exactly ${count} folder(s) shows them all with nothing left loading`, async ({
      page,
    }) => {
      const state = await mockApi(page, { folders: makeFolders(count, 0) });
      await page.goto("/home");
      const mine = sectionList(page, "내 폴더");
      await expect(folderRow(mine, count)).toBeVisible();
      await scrollToEnd(mine);
      await expect(folderRow(mine, 1)).toBeVisible();
      await page.waitForLoadState("networkidle");
      await expect(mine.getByRole("progressbar")).toHaveCount(0);
      await expect(page.getByRole("button", { name: "다시 시도" })).toHaveCount(0);
      expect(
        state.requests.filter(
          (r) => r.method === "GET" && r.path === "/api/folders" && r.search.includes("cursor="),
        ),
      ).toHaveLength(0);
    });
  }

  test("an account with 21 folders appends the 21st at the end", async ({ page }) => {
    await mockApi(page, { folders: makeFolders(21, 0) });
    await page.goto("/home");
    const mine = sectionList(page, "내 폴더");
    await expect(folderRow(mine, 21)).toBeVisible();
    await scrollUntilVisible(mine, folderRow(mine, 1));
  });

  test("shared folders older than the first 20 own folders load without scrolling", async ({
    page,
  }) => {
    await mockApi(page, { folders: mixedFolders(25, 5) });
    await page.goto("/home");
    await expect(folderRow(sectionList(page, "내 폴더"), 30)).toBeVisible();

    await toggle(page, "공유 폴더").click();
    const shared = sectionList(page, "공유 폴더");
    await expect(folderRow(shared, 5)).toBeVisible();
    await expect(folderRow(shared, 1)).toBeVisible();
  });

  test("an alternating account keeps the shared list in place when the next batch arrives", async ({
    page,
  }) => {
    await mockApi(page, {
      folders: makeFolders(80, 2),
      folderPages: { delayMs: { 1: 800 } },
    });
    await page.goto("/home");
    await toggle(page, "공유 폴더").click();
    const shared = sectionList(page, "공유 폴더");
    await expect(folderRow(shared, 80)).toBeVisible();

    await scrollTo(shared, 120);
    const anchor = folderRow(shared, 70);
    const before = await boxOf(anchor);
    await scrollToEnd(shared);
    const offsetBeforeAppend = await scrollTop(shared);
    await expect(folderRow(shared, 42)).toBeAttached({ timeout: 10_000 });
    expect(await scrollTop(shared)).toBe(offsetBeforeAppend);

    await scrollTo(shared, 120);
    const after = await boxOf(anchor);
    expect(after.y).toBeCloseTo(before.y, 0);
  });

  test("a very long name is cut to one line without covering the link count or members", async ({
    page,
  }) => {
    const longName = "2027 교토·오사카 여행 준비 체크리스트와 숙소 후보 그리고 맛집 지도 정리";
    await mockApi(page, {
      folders: [
        {
          id: 3,
          ownerId: 2,
          name: longName,
          emoji: "✈️",
          isShared: true,
          shareCounts: 6,
          linkCounts: 31,
        },
        ...makeFolders(2, 0),
      ],
    });
    await page.goto("/home");
    await toggle(page, "공유 폴더").click();

    const row = page.getByRole("button", { name: `${longName}, 링크 31개, 6명 참여` });
    const label = row.getByText(longName, { exact: true });
    const meta = row.getByText("6", { exact: true });
    const count = row.getByText("31", { exact: true });
    await expect(label).toBeVisible();
    const sizes = await label.evaluate((node) => ({
      scroll: node.scrollWidth,
      client: node.clientWidth,
      height: node.getBoundingClientRect().height,
      fontSize: parseFloat(getComputedStyle(node).fontSize),
    }));
    expect(sizes.scroll).toBeGreaterThan(sizes.client);
    expect(sizes.height).toBeLessThan(sizes.fontSize * 2);
    const labelBox = await boxOf(label);
    const metaBox = await boxOf(meta);
    const countBox = await boxOf(count);
    expect(labelBox.x + labelBox.width).toBeLessThanOrEqual(metaBox.x + 1);
    expect(metaBox.x + metaBox.width).toBeLessThanOrEqual(countBox.x + 1);
    expect(labelBox.width).toBeGreaterThan(75);
  });

  test("a folder created on the mobile folder tab shows in the wide sidebar right away", async ({
    page,
  }) => {
    await mockApi(page, { folders: makeFolders(5, 0) });
    await page.setViewportSize({ width: 768, height: 900 });
    await page.goto("/folders");
    await page.getByRole("button", { name: "내 폴더에 폴더 추가" }).click();
    await page.getByPlaceholder("예: 디자인 레퍼런스").fill("탭에서 만든 폴더");
    await page.getByRole("button", { name: "저장" }).click();
    await expect(page.getByText("탭에서 만든 폴더").first()).toBeVisible();

    await page.setViewportSize({ width: 1280, height: 800 });
    await expect(
      sectionList(page, "내 폴더").getByRole("button", { name: /^탭에서 만든 폴더, 링크 0개/ }),
    ).toBeVisible();
  });

  test("rows, 미분류 and the add buttons have names, and the current folder reads as selected", async ({
    page,
  }) => {
    await mockApi(page, {
      folders: makeFolders(6, 3),
      links: [makeLink({ id: 1 }), makeLink({ id: 2 })],
    });
    await page.goto("/folders/5");

    await expect(addButton(page, "내 폴더")).toBeVisible();
    await expect(addButton(page, "공유 폴더")).toBeVisible();
    await expect(folderRow(page, 5)).toHaveAccessibleName("폴더 5, 링크 0개");
    await expect(folderRow(page, 5)).toHaveAttribute("aria-current", "page");
    await expect(folderRow(page, 4)).not.toHaveAttribute("aria-current", "page");
    for (const name of [/^홈$/, /^전체$/, /^할일$/]) {
      await expect(page.getByRole("button", { name })).not.toHaveAttribute("aria-selected");
    }
    await expect(folderRow(page, 5)).not.toHaveAttribute("aria-selected");
    await expect(uncategorized(page)).toHaveAccessibleName("미분류, 링크 2개");

    await toggle(page, "공유 폴더").click();
    await expect(folderRow(page, 6)).toHaveAccessibleName("폴더 6, 링크 1개, 2명 참여");
  });
});

test.describe("wide sidebar at low heights", () => {
  test("at 1280×620 the folder list shows 3 rows without scrolling the whole sidebar, and the palette sits in the profile row", async ({
    page,
  }) => {
    await mockApi(page, { folders: makeFolders(45, 3) });
    await page.setViewportSize({ width: 1280, height: 620 });
    await page.goto("/home");
    const mine = sectionList(page, "내 폴더");
    await expect(folderRow(mine, 44)).toBeVisible();
    await settle(page);

    await expect.poll(() => sidebarOverflow(page)).toBeLessThanOrEqual(1);
    await expect.poll(() => fullyVisibleRows(mine)).toBe(3);
    await expect(page.getByRole("switch")).toHaveCount(0);

    const palette = await boxOf(paletteButton(page));
    const nickname = await boxOf(page.getByText("테스터", { exact: true }));
    expect(palette.height).toBeGreaterThanOrEqual(44);
    expect(palette.x).toBeGreaterThan(nickname.x + nickname.width);
    expect(Math.abs(palette.y + palette.height / 2 - (nickname.y + nickname.height))).toBeLessThan(
      16,
    );
    await expect(uncategorized(page)).toBeInViewport({ ratio: 1 });
  });

  test("at 1280×800 the folder list shows 7 rows", async ({ page }) => {
    await mockApi(page, { folders: makeFolders(45, 3) });
    await page.goto("/home");
    const mine = sectionList(page, "내 폴더");
    await expect(folderRow(mine, 44)).toBeVisible();
    await settle(page);

    await expect.poll(() => sidebarOverflow(page)).toBeLessThanOrEqual(1);
    await expect.poll(() => fullyVisibleRows(mine)).toBe(7);
  });

  test("at 769×620 the sidebar keeps the same layout, and at 768 it is gone", async ({ page }) => {
    await mockApi(page, { folders: makeFolders(45, 3) });
    await page.setViewportSize({ width: 769, height: 620 });
    await page.goto("/home");
    const mine = sectionList(page, "내 폴더");
    await expect(folderRow(mine, 44)).toBeVisible();
    await settle(page);

    await expect.poll(() => sidebarOverflow(page)).toBeLessThanOrEqual(1);
    await expect.poll(() => fullyVisibleRows(mine)).toBe(3);
    await expect(paletteButton(page)).toBeVisible();

    await page.setViewportSize({ width: 768, height: 620 });
    await expect(toggle(page, "내 폴더")).toBeHidden();
    await expect(paletteButton(page)).toBeHidden();
  });

  test("the palette opens only the accent and mode controls next to the sidebar, applies choices, and closes on Esc or an outside click", async ({
    page,
  }) => {
    await mockApi(page, { folders: makeFolders(3, 0) });
    await page.setViewportSize({ width: 1280, height: 620 });
    await page.goto("/home");

    await paletteButton(page).click();
    const popover = page.getByLabel("모드와 강조색", { exact: true }).last();
    await expect(popover.getByRole("radiogroup", { name: "강조색" })).toBeVisible();
    await expect(popover.getByText("모드 · 강조색")).toHaveCount(0);
    const popoverBox = await boxOf(popover);
    const buttonBox = await boxOf(paletteButton(page));
    expect(popoverBox.x).toBeGreaterThanOrEqual(buttonBox.x + buttonBox.width);
    expect(popoverBox.x).toBeGreaterThanOrEqual(await sidebarRightEdge(page));
    expect(popoverBox.y + popoverBox.height).toBeCloseTo(buttonBox.y + buttonBox.height, -1);
    expect(popoverBox.y + popoverBox.height).toBeLessThanOrEqual(620);

    await popover.getByRole("switch", { name: "다크 모드" }).click();
    await expect(page.locator("html")).toHaveClass(/dark/);
    await popover.getByRole("radio", { name: "강조색 분홍" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-accent", "pink");
    await expect(popover.getByRole("radio", { name: "강조색 분홍" })).toBeChecked();

    await page.keyboard.press("Escape");
    await expect(page.getByRole("switch")).toHaveCount(0);
    await expect(paletteButton(page)).toBeFocused();

    await paletteButton(page).click();
    const reopened = page.getByLabel("모드와 강조색", { exact: true }).last();
    await expect(reopened).toBeVisible();
    await expect(page.getByRole("switch")).toHaveCount(1);
    await page.evaluate(
      () =>
        new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(resolve, 0))),
        ),
    );
    const searchBox = await boxOf(page.getByText("⌘/Ctrl + K").first());
    await page.mouse.click(1200, searchBox.y + searchBox.height / 2);
    await expect(page.getByRole("switch")).toHaveCount(0);
    await expect(page).toHaveURL(/\/home$/);
  });

  test("shared rows show members as an icon and a number but still read N명 참여", async ({
    page,
  }) => {
    await mockApi(page, { folders: makeFolders(10, 3) });
    await page.goto("/home");
    await toggle(page, "공유 폴더").click();

    const row = folderRow(sectionList(page, "공유 폴더"), 9);
    await expect(row).toHaveAccessibleName("폴더 9, 링크 4개, 2명 참여");
    await expect(row).not.toContainText("명 참여");
    await expect(row.getByText("2", { exact: true })).toBeVisible();
    await expect(row.locator("svg")).toHaveCount(1);
    const members = await boxOf(row.getByText("2", { exact: true }));
    const count = await boxOf(row.getByText("4", { exact: true }));
    expect(count.x - (members.x + members.width)).toBeGreaterThanOrEqual(11);
  });

  test("a collapsed 내 폴더 shows the current folder path while 공유 폴더 is open, and drops it when reopened", async ({
    page,
  }) => {
    await mockApi(page, { folders: makeFolders(10, 3) });
    await page.goto("/folders/8");
    await expect(folderRow(sectionList(page, "내 폴더"), 8)).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(toggle(page, "내 폴더")).toHaveAccessibleName("내 폴더 접기");

    await toggle(page, "공유 폴더").click();
    await expect(toggle(page, "내 폴더")).toHaveAccessibleName(
      "내 폴더 펼치기, 현재 폴더 폴더 8 포함",
    );
    await expect(toggle(page, "내 폴더")).toHaveText("내 폴더/📁");
    await expect(toggle(page, "공유 폴더")).toHaveAccessibleName("공유 폴더 접기");

    await toggle(page, "내 폴더").click();
    await expect(toggle(page, "내 폴더")).toHaveAccessibleName("내 폴더 접기");
    await expect(toggle(page, "내 폴더")).toHaveText("내 폴더");
    await expect(folderRow(sectionList(page, "내 폴더"), 8)).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  test("a shared current folder marks 공유 폴더, also with both sections closed", async ({
    page,
  }) => {
    await mockApi(page, { folders: makeFolders(10, 3) });
    await page.goto("/folders/9");

    await expect(toggle(page, "공유 폴더")).toHaveAccessibleName(
      "공유 폴더 펼치기, 현재 폴더 폴더 9 포함",
    );
    await expect(toggle(page, "공유 폴더")).toHaveText("공유 폴더/📁");
    await expect(toggle(page, "내 폴더")).toHaveAccessibleName("내 폴더 접기");

    await toggle(page, "내 폴더").click();
    await expect(toggle(page, "내 폴더")).toHaveAccessibleName("내 폴더 펼치기");
    await expect(toggle(page, "내 폴더")).toHaveText("내 폴더");
    await expect(toggle(page, "공유 폴더")).toHaveAccessibleName(
      "공유 폴더 펼치기, 현재 폴더 폴더 9 포함",
    );
  });

  test("the path shows only the folder icon even at 769px, hovering or focusing it shows the full name beside the add button, and pressing the title only opens the section", async ({
    page,
  }) => {
    const longName =
      "2027 교토·오사카 여행 준비 체크리스트와 숙소 후보, 맛집 지도까지 모아 둔 폴더";
    await mockApi(page, {
      folders: [
        {
          id: 7,
          ownerId: 1,
          name: longName,
          emoji: "🧳",
          isShared: false,
          shareCounts: 0,
          linkCounts: 11,
        },
        ...makeFolders(5, 3),
      ],
    });
    await page.goto("/folders/7");
    await toggle(page, "공유 폴더").click();
    const mineToggle = toggle(page, "내 폴더");
    await expect(mineToggle).toHaveAccessibleName(`내 폴더 펼치기, 현재 폴더 ${longName} 포함`);

    await expect(mineToggle).toHaveText("내 폴더/🧳");
    await page.setViewportSize({ width: 769, height: 800 });
    const icon = mineToggle.getByText("🧳", { exact: true });
    await expect(icon).toBeVisible();
    const iconSizes = await icon.evaluate((node) => ({
      scroll: node.scrollWidth,
      client: node.clientWidth,
    }));
    expect(iconSizes.scroll).toBeLessThanOrEqual(iconSizes.client);
    const iconBox = await boxOf(icon);
    const toggleBox = await boxOf(mineToggle);
    expect(iconBox.x + iconBox.width).toBeLessThanOrEqual(toggleBox.x + toggleBox.width);
    await page.setViewportSize({ width: 1280, height: 800 });

    await mineToggle.hover();
    const tooltip = page.getByRole("tooltip");
    await expect(tooltip).toHaveText(`현재 폴더: ${longName}`);
    const tooltipBox = await boxOf(page.locator("[data-radix-popper-content-wrapper]").last());
    const addBox = await boxOf(addButton(page, "내 폴더"));
    expect(tooltipBox.x).toBeGreaterThanOrEqual(addBox.x + addBox.width - 2);
    expect(tooltipBox.x).toBeGreaterThanOrEqual(await sidebarRightEdge(page));

    await page.mouse.move(900, 500, { steps: 5 });
    await expect(tooltip).toHaveCount(0);
    await addButton(page, "내 폴더").focus();
    await page.keyboard.press("Shift+Tab");
    await expect(mineToggle).toBeFocused();
    await expect(page.getByRole("tooltip")).toHaveText(`현재 폴더: ${longName}`);

    await page.keyboard.press("Enter");
    await expect(mineToggle).toHaveAccessibleName("내 폴더 접기");
    await expect(mineToggle).toBeFocused();
    await expect(page).toHaveURL(/\/folders\/7$/);
  });

  test("no path shows on 홈, 전체, 할일 or 미분류, nor while folders first load", async ({
    page,
  }) => {
    await mockApi(page, { folders: makeFolders(10, 3), folderPages: { delayMs: { 0: 3000 } } });
    await page.goto("/folders/9");
    await expect(
      sectionList(page, "내 폴더").getByRole("progressbar", { name: "폴더를 불러오는 중" }),
    ).toBeVisible();
    await expect(toggle(page, "공유 폴더")).toHaveAccessibleName("공유 폴더 펼치기");
    await expect(toggle(page, "공유 폴더")).toHaveText("공유 폴더");
    await expect(toggle(page, "공유 폴더")).toHaveAccessibleName(
      "공유 폴더 펼치기, 현재 폴더 폴더 9 포함",
      { timeout: 10_000 },
    );

    for (const [name, url] of [
      [/^홈$/, /\/home$/],
      [/^전체$/, /\/links/],
      [/^할일$/, /\/todos$/],
      [/^미분류/, /\/folders\/0$/],
    ] as const) {
      await page.getByRole("button", { name }).click();
      await expect(page).toHaveURL(url);
      await expect(toggle(page, "내 폴더")).toHaveAccessibleName("내 폴더 접기");
      await expect(toggle(page, "공유 폴더")).toHaveAccessibleName("공유 폴더 펼치기");
    }
  });
});
