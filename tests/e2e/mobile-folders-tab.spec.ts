import { type Locator, type Page, expect, test } from "@playwright/test";

import { boxOf, isWideProject } from "./support/helpers";
import {
  type MockFolder,
  type MockTodo,
  makeFolders,
  makeLink,
  mockApi,
  settingsHandler,
} from "./support/mock-api";
import { settleSections } from "./support/section-motion";

const PIN_TOP = /0px 6px 10px -8px/;

function toggle(page: Page, label: "내 폴더" | "공유 폴더") {
  return page.getByRole("button", { name: new RegExp(`^${label} (접기|펼치기)$`) });
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

function bottomTabBar(page: Page) {
  let bar = page.locator("div");
  for (const label of ["홈", "폴더", "할일", "설정"]) {
    bar = bar.filter({ has: page.getByText(label, { exact: true }) });
  }
  return bar.last();
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

async function settle(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          document.getAnimations().filter((animation) => animation.playState === "running").length,
      ),
    )
    .toBe(0);
  await settleSections(page);
}

async function scrollableOffsets(page: Page) {
  return page.evaluate(() => [
    window.scrollY,
    ...Array.from(document.querySelectorAll<HTMLElement>("*"))
      .filter((node) => {
        const overflow = getComputedStyle(node).overflowY;
        return (
          (overflow === "auto" || overflow === "scroll") &&
          node.scrollHeight > node.clientHeight + 1
        );
      })
      .map((node) => Math.round(node.scrollTop)),
  ]);
}

async function maxScrollOffset(page: Page) {
  return Math.max(...(await scrollableOffsets(page)));
}

async function headerShadow(page: Page, label: "내 폴더" | "공유 폴더") {
  return toggle(page, label)
    .locator("xpath=..")
    .evaluate((node) => getComputedStyle(node).boxShadow);
}

async function scrollAndRecord(page: Page, list: Locator, offset: number) {
  await scrollTo(list, offset);
  await expect.poll(() => scrollTop(list)).toBe(offset);
  await expect.poll(() => headerShadow(page, "내 폴더")).toMatch(PIN_TOP);
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

test.describe("mobile folder tab", () => {
  test.beforeEach(() => {
    test.skip(isWideProject(), "mobile folder tab only");
  });

  test("shows section titles and large rows newest first, without chips, tiles or the collapse button", async ({
    page,
  }) => {
    await mockApi(page, { folders: makeFolders(12, 3) });
    await page.goto("/folders");
    const mine = sectionList(page, "내 폴더");
    await expect(folderRow(mine, 11)).toBeVisible();

    for (const text of [
      "전체",
      "최신순",
      "오래된순",
      "가나다순",
      "+ 새 폴더",
      "+ 폴더 공유 시작",
    ]) {
      await expect(page.getByText(text, { exact: true })).toHaveCount(0);
    }
    await expect(page.getByRole("button", { name: /^사이드바/ })).toHaveCount(0);
    await expect(toggle(page, "내 폴더")).toBeVisible();
    await expect(toggle(page, "공유 폴더")).toBeVisible();

    const names = await mine
      .getByRole("button")
      .evaluateAll((nodes) => nodes.map((node) => node.getAttribute("aria-label") ?? ""));
    const ids = names.map((name) => Number(/^폴더 (\d+)/.exec(name)?.[1]));
    expect(ids).toEqual([...ids].sort((a, b) => b - a));
    expect((await boxOf(folderRow(mine, 11))).height).toBeGreaterThanOrEqual(60);

    for (const tab of ["홈", "폴더", "할일", "설정"]) {
      await expect(page.getByText(tab, { exact: true }).last()).toBeVisible();
    }
  });

  test("starts with 내 폴더 open, keeps one section open, and closes both when the open title is pressed again", async ({
    page,
  }) => {
    await mockApi(page, { folders: makeFolders(12, 3) });
    await page.goto("/folders");
    await expect(toggle(page, "내 폴더")).toHaveAccessibleName("내 폴더 접기");
    await expect(toggle(page, "내 폴더")).toHaveAttribute("aria-expanded", "true");

    await toggle(page, "공유 폴더").click();
    await expect(toggle(page, "내 폴더")).toHaveAccessibleName("내 폴더 펼치기");
    await expect(sectionList(page, "내 폴더")).toHaveCount(0);
    await expect(folderRow(sectionList(page, "공유 폴더"), 12)).toContainText("2명 참여");

    await toggle(page, "공유 폴더").click();
    await expect(page.getByLabel(/폴더 목록$/)).toHaveCount(0);
    await expect(uncategorized(page)).toBeVisible();
  });

  test("titles stay put while the list scrolls, and 미분류 and the new link button sit above the tabs without covering rows", async ({
    page,
  }) => {
    await mockApi(page, { folders: makeFolders(30, 0), links: [makeLink({ id: 1 })] });
    await page.goto("/folders");
    const mine = sectionList(page, "내 폴더");
    await expect(folderRow(mine, 30)).toBeVisible();
    await settle(page);

    const before = await boxOf(toggle(page, "내 폴더"));
    const sharedBefore = await boxOf(toggle(page, "공유 폴더"));
    await scrollTo(mine, 300);
    await expect.poll(() => scrollTop(mine)).toBe(300);
    expect((await boxOf(toggle(page, "내 폴더"))).y).toBeCloseTo(before.y, 0);
    expect((await boxOf(toggle(page, "공유 폴더"))).y).toBeCloseTo(sharedBefore.y, 0);

    const uncategorizedBox = await boxOf(uncategorized(page));
    const fab = await boxOf(page.getByRole("button", { name: "새 링크" }));
    const tabs = await boxOf(page.getByText("홈", { exact: true }).last());
    const listBox = await boxOf(mine);
    expect(uncategorizedBox.y + uncategorizedBox.height).toBeLessThanOrEqual(tabs.y);
    expect(fab.x).toBeGreaterThanOrEqual(uncategorizedBox.x + uncategorizedBox.width - 1);
    expect(fab.y).toBeGreaterThanOrEqual(listBox.y + listBox.height - 1);
    expect(fab.y + fab.height).toBeLessThanOrEqual(tabs.y);
    await expect(uncategorized(page)).toHaveAccessibleName("미분류, 링크 1개");

    await page.getByRole("button", { name: "새 링크" }).click();
    await expect(page.getByText("링크 추가", { exact: true }).first()).toBeVisible();
  });

  test("scrolling to the end appends the next batches down to the oldest folder, with member counts on shared rows", async ({
    page,
  }) => {
    await mockApi(page, { folders: makeFolders(45, 3), folderPages: { delayMs: { 1: 800 } } });
    await page.goto("/folders");
    const mine = sectionList(page, "내 폴더");
    await expect(folderRow(mine, 44)).toBeVisible();
    await scrollToEnd(mine);
    await expect(mine.getByRole("progressbar", { name: "폴더를 더 불러오는 중" })).toBeVisible();
    await scrollUntilVisible(mine, folderRow(mine, 1));

    await toggle(page, "공유 폴더").click();
    await expect(folderRow(sectionList(page, "공유 폴더"), 45)).toContainText("2명 참여");
  });

  for (const [label, shared] of [
    ["내 폴더", false],
    ["공유 폴더", true],
  ] as const) {
    test(`the ${label} + opens the mobile add sheet preset, and the new folder tops that section`, async ({
      page,
    }) => {
      await mockApi(page, { folders: makeFolders(12, 3) });
      await page.goto("/folders");
      await expect(folderRow(sectionList(page, "내 폴더"), 11)).toBeVisible();

      await addButton(page, label).click();
      const sharedSwitch = page.getByRole("switch");
      await expect(sharedSwitch).toHaveAttribute("aria-checked", String(shared));
      await page.getByPlaceholder("예: 디자인 레퍼런스").fill(`탭에서 만든 ${label}`);
      await page.getByRole("button", { name: "저장" }).click();
      await expect(page.getByPlaceholder("예: 디자인 레퍼런스")).toHaveCount(0);

      await expect(toggle(page, label)).toHaveAccessibleName(`${label} 접기`);
      await expect(sectionList(page, label).getByRole("button").first()).toHaveAccessibleName(
        new RegExp(`^탭에서 만든 ${label}, 링크 0개`),
      );
    });
  }

  test("the open section survives a reload, and the scroll position starts at the top", async ({
    page,
  }) => {
    await mockApi(page, { folders: makeFolders(45, 3) });
    await page.goto("/folders");
    await toggle(page, "공유 폴더").click();
    const shared = sectionList(page, "공유 폴더");
    await expect(folderRow(shared, 45)).toBeVisible();
    await scrollTo(shared, 200);
    await expect.poll(() => scrollTop(shared)).toBe(200);

    await page.reload();
    await expect(toggle(page, "공유 폴더")).toHaveAccessibleName("공유 폴더 접기");
    await expect(folderRow(sectionList(page, "공유 폴더"), 45)).toBeVisible();
    expect(await scrollTop(sectionList(page, "공유 폴더"))).toBe(0);
  });

  test("returning from a folder detail with back restores the position", async ({ page }) => {
    await mockApi(page, { folders: makeFolders(45, 0) });
    await page.goto("/folders");
    const mine = sectionList(page, "내 폴더");
    await expect(folderRow(mine, 45)).toBeVisible();
    await scrollAndRecord(page, mine, 360);

    await folderRow(mine, 38).click();
    await expect(page).toHaveURL(/\/folders\/38$/);
    await page.getByRole("button", { name: "뒤로" }).click();
    await expect(page).toHaveURL(/\/folders$/);
    await expect.poll(() => scrollTop(sectionList(page, "내 폴더"))).toBe(360);
  });

  test("returning from the home tab restores the position", async ({ page }) => {
    await mockApi(page, { folders: makeFolders(45, 0) });
    await page.goto("/folders");
    const mine = sectionList(page, "내 폴더");
    await expect(folderRow(mine, 45)).toBeVisible();
    await scrollAndRecord(page, mine, 300);

    await page.getByText("홈", { exact: true }).last().click();
    await expect(page).toHaveURL(/\/home$/);
    await page.getByText("폴더", { exact: true }).last().click();
    await expect(page).toHaveURL(/\/folders$/);
    await expect.poll(() => scrollTop(sectionList(page, "내 폴더"))).toBe(300);
  });

  test("each section reopens at its own position", async ({ page }) => {
    await mockApi(page, { folders: makeFolders(80, 2) });
    await page.goto("/folders");
    const mine = sectionList(page, "내 폴더");
    await expect(folderRow(mine, 79)).toBeVisible();
    await scrollAndRecord(page, mine, 240);

    await toggle(page, "공유 폴더").click();
    const shared = sectionList(page, "공유 폴더");
    await expect(folderRow(shared, 80)).toBeVisible();
    await settle(page);
    await scrollTo(shared, 120);
    await expect.poll(() => scrollTop(shared)).toBe(120);
    await expect.poll(() => headerShadow(page, "공유 폴더")).toMatch(PIN_TOP);

    await toggle(page, "내 폴더").click();
    await expect.poll(() => scrollTop(sectionList(page, "내 폴더"))).toBe(240);
    await toggle(page, "공유 폴더").click();
    await expect.poll(() => scrollTop(sectionList(page, "공유 폴더"))).toBe(120);
  });

  test("after folders were deleted elsewhere, returning shows the last possible position without errors", async ({
    page,
  }) => {
    await page.clock.install();
    const state = await mockApi(page, { folders: makeFolders(45, 0) });
    await page.goto("/folders");
    const mine = sectionList(page, "내 폴더");
    await expect(folderRow(mine, 45)).toBeVisible();
    await scrollUntilVisible(mine, folderRow(mine, 1));
    const deepOffset = await scrollTop(mine);
    await expect.poll(() => headerShadow(page, "내 폴더")).toMatch(PIN_TOP);

    await page.getByText("홈", { exact: true }).last().click();
    await expect(page).toHaveURL(/\/home$/);
    state.folders = state.folders.slice(0, 12);
    await page.clock.fastForward(31_000);
    const requestsBeforeReturn = state.requests.length;
    await page.getByText("폴더", { exact: true }).last().click();

    const list = sectionList(page, "내 폴더");
    await expect
      .poll(() =>
        state.requests
          .slice(requestsBeforeReturn)
          .some((r) => r.path === "/api/folders" && !r.search.includes("cursor=")),
      )
      .toBe(true);
    await expect(list.getByRole("button", { name: /^폴더 \d+, 링크/ })).toHaveCount(12);
    await expect(folderRow(list, 34)).toBeVisible();
    await expect(folderRow(list, 1)).toHaveCount(0);
    await expect(page.getByText("폴더를 불러오지 못했어요")).toHaveCount(0);
    await expect
      .poll(() =>
        list.evaluate((node) => node.scrollTop >= node.scrollHeight - node.clientHeight - 1),
      )
      .toBe(true);
    // The browser clamps scrollTop after the shorter list lays out; wait for it.
    await expect.poll(() => scrollTop(list)).toBeLessThan(deepOffset);
  });

  test("restoring the tab leaves the folder picker section and the home and todo scroll positions alone", async ({
    page,
  }) => {
    const links = Array.from({ length: 37 }, (_, index) => makeLink({ id: index + 1 }));
    const todos: MockTodo[] = Array.from({ length: 30 }, (_, index) => ({
      id: index + 1,
      title: `할일 ${index + 1}`,
      reminderAt: null,
      completedAt: null,
      linkId: 1,
      linkUrl: links[0].url,
      linkTitle: links[0].title,
      linkThumbnailUrl: null,
      linkFaviconUrl: null,
    }));
    await mockApi(page, { folders: makeFolders(45, 0), links, todos });
    await page.goto("/folders");
    const mine = sectionList(page, "내 폴더");
    await expect(folderRow(mine, 45)).toBeVisible();
    await scrollAndRecord(page, mine, 300);
    const stored = () =>
      page.evaluate(() => JSON.parse(localStorage.getItem("qlink-folder-navigation") ?? "{}"));
    const before = await stored();

    await page.getByText("할일", { exact: true }).last().click();
    await expect(page).toHaveURL(/\/todos$/);
    await expect(page.getByText("할일 1", { exact: true })).toBeVisible();
    expect((await scrollableOffsets(page)).length).toBeGreaterThan(1);
    await expect.poll(() => maxScrollOffset(page)).toBe(0);
    await page.getByText("폴더", { exact: true }).last().click();
    await expect.poll(() => scrollTop(sectionList(page, "내 폴더"))).toBe(300);

    await page.getByText("할일", { exact: true }).last().click();
    await expect(page.getByText("할일 1", { exact: true })).toBeVisible();
    await expect.poll(() => maxScrollOffset(page)).toBe(0);

    await page.getByText("홈", { exact: true }).last().click();
    await expect(page.getByText(links[0].title, { exact: true }).first()).toBeVisible();
    expect((await scrollableOffsets(page)).length).toBeGreaterThan(1);
    await expect.poll(() => maxScrollOffset(page)).toBe(0);
    await page.getByText("폴더", { exact: true }).last().click();
    await expect.poll(() => scrollTop(sectionList(page, "내 폴더"))).toBe(300);
    await page.getByText("홈", { exact: true }).last().click();
    await expect(page.getByText(links[0].title, { exact: true }).first()).toBeVisible();
    await expect.poll(() => maxScrollOffset(page)).toBe(0);

    const after = await stored();
    expect(after.openSection?.picker ?? "mine").toBe(before.openSection?.picker ?? "mine");
    expect(after.openSection?.sidebar ?? "mine").toBe(before.openSection?.sidebar ?? "mine");
  });
});

test.describe("mobile folder tab uncategorized row (#27)", () => {
  test.beforeEach(() => {
    test.skip(isWideProject(), "mobile folder tab only");
  });

  test("the 미분류 icon and name start on the same lines as the folder rows, with at least 12px before the new link button", async ({
    page,
  }) => {
    await mockApi(page, { folders: makeFolders(30, 0), links: [makeLink({ id: 1 })] });
    await page.goto("/folders");
    const row = folderRow(sectionList(page, "내 폴더"), 30);
    await expect(row).toBeVisible();
    await settle(page);

    const rowTile = await boxOf(row.locator(":scope > div").first());
    const rowName = await boxOf(row.getByText("폴더 30", { exact: true }));
    const uncategorizedRow = uncategorized(page);
    const tile = await boxOf(uncategorizedRow.locator(":scope > div").first());
    const name = await boxOf(uncategorizedRow.getByText("미분류", { exact: true }));
    expect(Math.round(tile.x)).toBe(Math.round(rowTile.x));
    expect(Math.round(tile.width)).toBe(Math.round(rowTile.width));
    expect(Math.round(name.x)).toBe(Math.round(rowName.x));

    const count = await boxOf(uncategorizedRow.getByText("1개", { exact: true }));
    const fab = await boxOf(page.getByRole("button", { name: "새 링크" }));
    expect(fab.x - (count.x + count.width)).toBeGreaterThanOrEqual(12);
    const viewport = page.viewportSize()?.width ?? 0;
    expect(Math.round(viewport - (fab.x + fab.width))).toBe(24);
  });

  test("the new link button sits in the same place on the home and folder tabs, above the tabs and past home's last content, and opens the sheet on both", async ({
    page,
  }) => {
    const links = Array.from({ length: 12 }, (_, index) => makeLink({ id: index + 1 }));
    await mockApi(page, { folders: makeFolders(30, 0), links });
    const fab = page.getByRole("button", { name: "새 링크", exact: true });
    const tabs = page.getByText("홈", { exact: true }).last();

    await page.goto("/folders");
    await expect(folderRow(sectionList(page, "내 폴더"), 30)).toBeVisible();
    await settle(page);
    const onFolders = await boxOf(fab);

    await page.getByText("홈", { exact: true }).last().click();
    await expect(page).toHaveURL(/\/home$/);
    await expect(page.getByTestId("link-card")).toHaveCount(12);
    await settle(page);
    const onHome = await boxOf(fab);
    expect(Math.round(onHome.x)).toBe(Math.round(onFolders.x));
    expect(Math.round(onHome.y)).toBe(Math.round(onFolders.y));
    expect(Math.round(onHome.width)).toBe(Math.round(onFolders.width));

    const tabBar = await boxOf(bottomTabBar(page));
    const viewportHeight = page.viewportSize()?.height ?? 0;
    expect(Math.round(tabBar.y + tabBar.height)).toBe(viewportHeight);
    expect(tabBar.y).toBeLessThanOrEqual((await boxOf(tabs)).y);
    expect(onHome.y + onHome.height).toBeLessThanOrEqual(tabBar.y);

    await scrollMainToEnd(page);
    await settle(page);
    const lastCard = await boxOf(page.getByTestId("link-card").last());
    expect(lastCard.y + lastCard.height).toBeLessThanOrEqual((await boxOf(fab)).y);

    await fab.click();
    await expect(page.getByText("링크 추가", { exact: true }).first()).toBeVisible();
    await page.getByRole("button", { name: "닫기", exact: true }).click();
    await expect(page.getByText("링크 추가", { exact: true })).toHaveCount(0);

    await page.getByText("폴더", { exact: true }).last().click();
    await expect(page).toHaveURL(/\/folders$/);
    await fab.click();
    await expect(page.getByText("링크 추가", { exact: true }).first()).toBeVisible();
  });

  test("on a folder detail scrolled to the end, the last card ends above the new link button", async ({
    page,
  }) => {
    const links = Array.from({ length: 12 }, (_, index) =>
      makeLink({ id: index + 1, folderId: 1, folderName: "폴더 1", folderEmoji: "📁" }),
    );
    await mockApi(page, { folders: makeFolders(3, 0), links });
    await page.goto("/folders/1");
    await expect(page.getByTestId("link-card")).toHaveCount(12);
    await settle(page);

    await scrollMainToEnd(page);
    await settle(page);
    const fab = await boxOf(page.getByRole("button", { name: "새 링크", exact: true }));
    const lastCard = await boxOf(page.getByTestId("link-card").last());
    expect(lastCard.y + lastCard.height).toBeLessThanOrEqual(fab.y);
    expect(fab.y + fab.height).toBeLessThanOrEqual((await boxOf(bottomTabBar(page))).y);
  });
});

test.describe("mobile new link button ring (#27)", () => {
  test.beforeEach(() => {
    test.skip(isWideProject(), "mobile button");
  });

  for (const theme of ["light", "dark"] as const) {
    test(`${theme}: the new link button ${theme === "dark" ? "has no light ring" : "keeps its light ring"}`, async ({
      page,
    }) => {
      await mockApi(page, {
        folders: makeFolders(3, 0),
        handlers: { "GET /api/users/me/settings": settingsHandler(theme, "gray") },
      });
      await page.goto("/home");
      await expect(page.locator("html")).toHaveClass(theme === "dark" ? /dark/ : /^(?!.*dark)/);
      const fab = page.getByRole("button", { name: "새 링크", exact: true });
      await expect(fab).toBeVisible();
      const shadow = await fab.evaluate((node) => getComputedStyle(node).boxShadow);
      const ring = /0px 0px 0px 4px/.test(shadow);
      expect(ring).toBe(theme === "light");
    });
  }
});

test.describe("mobile folder tab states", () => {
  test.beforeEach(() => {
    test.skip(isWideProject(), "mobile folder tab only");
  });

  test("while the first batch loads, only the folder area shows a skeleton and the titles, + and 미분류 work", async ({
    page,
  }) => {
    await mockApi(page, { folders: makeFolders(12, 3), folderPages: { delayMs: { 0: 4000 } } });
    await page.goto("/folders");

    await expect(
      sectionList(page, "내 폴더").getByRole("progressbar", { name: "폴더를 불러오는 중" }),
    ).toBeVisible();
    await addButton(page, "내 폴더").click();
    await expect(page.getByPlaceholder("예: 디자인 레퍼런스")).toBeVisible();
    await page.getByRole("button", { name: "취소" }).click();
    await toggle(page, "공유 폴더").click();
    await expect(sectionList(page, "공유 폴더").getByRole("progressbar")).toBeVisible();
    await uncategorized(page).click();
    await expect(page).toHaveURL(/\/folders\/0$/);
  });

  test("a failed first batch shows an error with retry, hides the 미분류 count, and keeps tabs and 미분류 working", async ({
    page,
  }) => {
    test.setTimeout(90_000);
    const state = await mockApi(page, {
      folders: makeFolders(12, 3),
      folderPages: { failAll: true },
      handlers: {
        "GET /api/links": (route) =>
          route.fulfill({ status: 500, contentType: "application/json", body: "{}" }),
      },
    });
    await page.goto("/folders");

    const area = sectionList(page, "내 폴더");
    await expect(area.getByText("폴더를 불러오지 못했어요")).toBeVisible({ timeout: 30_000 });
    await expect(uncategorized(page)).toHaveAccessibleName("미분류");

    state.folderPages.failAll = false;
    await area.getByRole("button", { name: "다시 시도" }).click();
    await expect(folderRow(sectionList(page, "내 폴더"), 11)).toBeVisible();

    await page.getByText("할일", { exact: true }).last().click();
    await expect(page).toHaveURL(/\/todos$/);
    await page.getByText("홈", { exact: true }).last().click();
    await expect(page).toHaveURL(/\/home$/);
    await page.getByText("폴더", { exact: true }).last().click();
    await uncategorized(page).click();
    await expect(page).toHaveURL(/\/folders\/0$/);
  });

  test("a failed next batch keeps loaded folders with a single retry at the end of the open list, also after switching sections", async ({
    page,
  }) => {
    test.setTimeout(90_000);
    const state = await mockApi(page, {
      folders: makeFolders(45, 3),
      folderPages: { failPages: new Set([1]) },
    });
    await page.goto("/folders");
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

    await toggle(page, "공유 폴더").click();
    const shared = sectionList(page, "공유 폴더");
    await expect(shared.getByRole("button", { name: "다시 시도" })).toBeVisible();
    await expect(page.getByRole("button", { name: "다시 시도" })).toHaveCount(1);

    state.folderPages.failPages.clear();
    await shared.getByRole("button", { name: "다시 시도" }).click();
    await expect(folderRow(shared, 24)).toBeAttached();
  });

  test("empty sections show a short note and the title + creates the first shared folder", async ({
    page,
  }) => {
    await mockApi(page, { folders: makeFolders(6, 0) });
    await page.goto("/folders");
    await toggle(page, "공유 폴더").click();
    await expect(sectionList(page, "공유 폴더").getByText("아직 공유 폴더가 없어요")).toBeVisible();

    await addButton(page, "공유 폴더").click();
    await page.getByPlaceholder("예: 디자인 레퍼런스").fill("첫 공유 폴더");
    await page.getByRole("button", { name: "저장" }).click();
    await expect(
      sectionList(page, "공유 폴더").getByRole("button", { name: /^첫 공유 폴더, 링크 0개/ }),
    ).toBeVisible();
  });

  test("an account with only shared folders shows the note in 내 폴더, and one without folders shows titles, note and 미분류", async ({
    page,
  }) => {
    const state = await mockApi(page, { folders: mixedFolders(0, 4) });
    await page.goto("/folders");
    await expect(sectionList(page, "내 폴더").getByText("아직 만든 폴더가 없어요")).toBeVisible();

    state.folders = [];
    await page.reload();
    await expect(toggle(page, "내 폴더")).toBeVisible();
    await expect(toggle(page, "공유 폴더")).toBeVisible();
    await expect(page.getByText("아직 만든 폴더가 없어요")).toBeVisible();
    await expect(uncategorized(page)).toBeVisible();
  });

  for (const count of [1, 20]) {
    test(`an account with exactly ${count} folder(s) shows them all with nothing left loading`, async ({
      page,
    }) => {
      const state = await mockApi(page, {
        folders: makeFolders(count, 0),
        links: [makeLink({ id: 1 })],
      });
      const firstBatch = page.waitForResponse(
        (response) =>
          new URL(response.url()).pathname === "/api/folders" &&
          response.request().method() === "GET",
      );
      await page.goto("/folders");
      expect((await (await firstBatch).json()).data.hasNext).toBe(false);
      const mine = sectionList(page, "내 폴더");
      await expect(folderRow(mine, count)).toBeVisible();
      await scrollToEnd(mine);
      await expect(folderRow(mine, 1)).toBeVisible();
      await expect(uncategorized(page)).toHaveAccessibleName(/^미분류, 링크 \d+개$/);
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
    await page.goto("/folders");
    const mine = sectionList(page, "내 폴더");
    await expect(folderRow(mine, 21)).toBeVisible();
    await scrollUntilVisible(mine, folderRow(mine, 1));
  });

  test("shared folders older than the first 20 own folders load without scrolling", async ({
    page,
  }) => {
    await mockApi(page, { folders: mixedFolders(25, 5) });
    await page.goto("/folders");
    await toggle(page, "공유 폴더").click();
    const shared = sectionList(page, "공유 폴더");
    await expect(folderRow(shared, 5)).toBeVisible();
    await expect(folderRow(shared, 1)).toBeVisible();
  });

  test("an alternating account keeps the shared list in place when the next batch arrives", async ({
    page,
  }) => {
    await mockApi(page, { folders: makeFolders(80, 2), folderPages: { delayMs: { 1: 800 } } });
    await page.goto("/folders");
    await toggle(page, "공유 폴더").click();
    const shared = sectionList(page, "공유 폴더");
    await expect(folderRow(shared, 80)).toBeVisible();
    await settle(page);

    await scrollTo(shared, 120);
    const anchor = folderRow(shared, 74);
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
    await page.goto("/folders");
    await toggle(page, "공유 폴더").click();

    const label = page.getByText(longName, { exact: true });
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
    const countBox = await boxOf(page.getByText("31개", { exact: true }));
    expect(labelBox.x + labelBox.width).toBeLessThanOrEqual(countBox.x + 1);
    await expect(page.getByText("6명 참여", { exact: true })).toBeVisible();
  });

  test("the edge of the + hit area opens the add sheet, and the blank part of a title toggles", async ({
    page,
  }) => {
    await mockApi(page, { folders: makeFolders(12, 3) });
    await page.goto("/folders");
    await expect(folderRow(sectionList(page, "내 폴더"), 11)).toBeVisible();

    const sharedTitle = toggle(page, "공유 폴더");
    const titleBox = await boxOf(sharedTitle);
    await sharedTitle.click({ position: { x: titleBox.width - 6, y: titleBox.height / 2 } });
    await expect(toggle(page, "공유 폴더")).toHaveAccessibleName("공유 폴더 접기");

    const addBox = await boxOf(addButton(page, "내 폴더"));
    expect(addBox.width).toBeGreaterThanOrEqual(48);
    expect(addBox.height).toBeGreaterThanOrEqual(48);
    await page.mouse.click(addBox.x + 3, addBox.y + addBox.height - 3);
    await expect(page.getByPlaceholder("예: 디자인 레퍼런스")).toBeVisible();
  });

  test("titles, rows and 미분류 are named buttons", async ({ page }) => {
    await mockApi(page, { folders: makeFolders(6, 3), links: [makeLink({ id: 1 })] });
    await page.goto("/folders");
    await expect(toggle(page, "내 폴더")).toHaveAccessibleName("내 폴더 접기");
    await expect(toggle(page, "내 폴더")).toHaveAttribute("aria-expanded", "true");
    await expect(addButton(page, "내 폴더")).toBeVisible();
    await expect(folderRow(page, 5)).toHaveAccessibleName("폴더 5, 링크 0개");
    await expect(uncategorized(page)).toHaveAccessibleName("미분류, 링크 1개");
    await toggle(page, "공유 폴더").click();
    await expect(folderRow(page, 6)).toHaveAccessibleName("폴더 6, 링크 1개, 2명 참여");
  });
});

test.describe("folder sections across the 768px/769px boundary", () => {
  test.beforeEach(() => {
    test.skip(!isWideProject(), "resizes a desktop viewport");
  });

  test("the wide sidebar and the folder tab each keep their own open section", async ({ page }) => {
    await mockApi(page, { folders: makeFolders(12, 3) });
    await page.goto("/home");
    await toggle(page, "공유 폴더").click();
    await expect(toggle(page, "공유 폴더")).toHaveAccessibleName("공유 폴더 접기");

    await page.setViewportSize({ width: 768, height: 900 });
    await page.goto("/folders");
    await expect(toggle(page, "내 폴더")).toHaveAccessibleName("내 폴더 접기");

    await page.setViewportSize({ width: 1280, height: 800 });
    await expect(toggle(page, "공유 폴더")).toHaveAccessibleName("공유 폴더 접기");
    await page.setViewportSize({ width: 768, height: 900 });
    await page.goto("/folders");
    await expect(toggle(page, "내 폴더")).toHaveAccessibleName("내 폴더 접기");
  });

  test("an open folder detail keeps the loaded folders and the current folder mark across the boundary", async ({
    page,
  }) => {
    await mockApi(page, { folders: makeFolders(12, 3) });
    await page.setViewportSize({ width: 769, height: 900 });
    await page.goto("/folders/10");
    const current = folderRow(sectionList(page, "내 폴더"), 10);
    await expect(current).toHaveAttribute("aria-current", "page");

    await page.setViewportSize({ width: 768, height: 900 });
    await expect(page.getByText("📁 폴더 10", { exact: true }).first()).toBeVisible();
    await page.setViewportSize({ width: 769, height: 900 });
    await expect(folderRow(sectionList(page, "내 폴더"), 10)).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(folderRow(sectionList(page, "내 폴더"), 11)).toBeVisible();
  });
});
