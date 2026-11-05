import { type Locator, type Page, expect, test } from "@playwright/test";

import { boxOf, isWideProject } from "./support/helpers";
import { makeDetail, makeFolders, makeLink, mockApi } from "./support/mock-api";

test.beforeEach(() => {
  test.skip(!isWideProject(), "wide sidebar only");
});

const HOVER_CLOSE_PAST_MS = 400;

const RAIL_ORDER = [
  "사이드바 펼치기",
  /^새 링크, 단축키/,
  "홈",
  "전체",
  "액션",
  "내 폴더",
  "공유 폴더",
  /^미분류/,
  "모드와 강조색",
  /^프로필 /,
] as const;

async function emulatePlatform(page: Page, platform: "MacIntel" | "Win32") {
  await page.addInitScript((value) => {
    Object.defineProperty(Navigator.prototype, "platform", { get: () => value });
    Object.defineProperty(Navigator.prototype, "userAgentData", { get: () => undefined });
  }, platform);
}

function sidebarColumn(page: Page) {
  return page.getByTestId("wide-sidebar-column");
}

async function columnWidth(page: Page) {
  const box = await sidebarColumn(page).boundingBox();
  return box ? Math.round(box.width) : 0;
}

async function collapse(page: Page) {
  await page.getByRole("button", { name: "사이드바 줄이기" }).click();
  await expect(page.getByRole("button", { name: "사이드바 펼치기" })).toBeVisible();
  await expect.poll(() => columnWidth(page)).toBe(80);
}

function railButton(page: Page, name: string | RegExp) {
  return page.getByRole("button", { name, exact: typeof name === "string" });
}

function flyout(page: Page, label: "내 폴더" | "공유 폴더") {
  return page.getByLabel(`${label} 펼친 목록`, { exact: true });
}

function flyoutRow(scope: Locator, id: number) {
  return scope.getByRole("button", { name: new RegExp(`^폴더 ${id}, 링크`) });
}

test.describe("collapsing the wide sidebar", () => {
  test("the hamburger shrinks the sidebar to icons and widens the content, and restores it", async ({
    page,
  }) => {
    await mockApi(page, { folders: makeFolders(12, 3) });
    await page.goto("/home");
    const toggle = page.getByRole("button", { name: "사이드바 줄이기" });
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    const expandedWidth = await columnWidth(page);
    const mainBefore = await boxOf(page.getByRole("main"));

    await collapse(page);
    const mainAfter = await boxOf(page.getByRole("main"));
    expect(mainAfter.width).toBeCloseTo(mainBefore.width + expandedWidth - 80, 0);
    await expect(page.getByRole("button", { name: "사이드바 펼치기" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );

    await page.getByRole("button", { name: "사이드바 펼치기" }).click();
    await expect.poll(() => columnWidth(page)).toBe(expandedWidth);
  });

  test("the rail keeps the expanded order with icons only, and each icon shows its name on hover", async ({
    page,
  }) => {
    await mockApi(page, { folders: makeFolders(12, 3), links: [makeLink({ id: 1 })] });
    await page.goto("/home");
    await collapse(page);

    const tops: number[] = [];
    for (const name of RAIL_ORDER) {
      tops.push((await boxOf(railButton(page, name))).y);
    }
    expect([...tops].sort((a, b) => a - b)).toEqual(tops);
    await expect(page.getByText("내 폴더", { exact: true })).toHaveCount(0);

    for (const [name, tooltip] of [
      ["홈", "홈"],
      ["전체", "전체"],
      ["액션", "액션"],
      [/^미분류/, "미분류"],
      ["모드와 강조색", "모드 · 강조색"],
      ["사이드바 펼치기", "사이드바 펼치기"],
    ] as const) {
      await railButton(page, name).hover();
      await expect(page.getByRole("tooltip").filter({ hasText: tooltip })).toBeVisible();
      await page.mouse.move(640, 400);
      await page.mouse.move(700, 450);
    }
  });

  for (const [platform, label] of [
    ["MacIntel", "⌥N"],
    ["Win32", "Alt+N"],
  ] as const) {
    test(`the new link icon reads "새 링크 ${label}" on ${platform}`, async ({ page }) => {
      await emulatePlatform(page, platform);
      await mockApi(page, { folders: makeFolders(3, 0) });
      await page.goto("/home");
      await collapse(page);

      const cta = railButton(page, `새 링크, 단축키 ${label}`);
      await cta.hover();
      await expect(page.getByRole("tooltip").filter({ hasText: `새 링크${label}` })).toBeVisible();
    });
  }

  test("the theme icon opens mode and accent choices that apply right away", async ({ page }) => {
    await mockApi(page, { folders: makeFolders(3, 0) });
    await page.goto("/home");
    await collapse(page);

    await railButton(page, "모드와 강조색").click();
    const popover = page.getByLabel("모드와 강조색", { exact: true }).last();
    await expect(popover.getByRole("radiogroup", { name: "강조색" })).toBeVisible();
    await expect(popover.getByText("모드 · 강조색")).toHaveCount(0);
    await popover.getByRole("switch").click();
    await expect(page.locator("html")).toHaveClass(/dark/);
    await expect(page.locator("html")).toHaveAttribute("data-accent", "gray");
    await popover.locator('[tabindex="0"]').nth(1).click();
    await expect(page.locator("html")).toHaveAttribute("data-accent", "pink");
  });

  test("an open link overlay stays open while the sidebar collapses and expands", async ({
    page,
  }) => {
    const link = makeLink({ id: 7, title: "오버레이 링크", folderId: 10 });
    await mockApi(page, {
      folders: makeFolders(12, 3),
      links: [link],
      details: { 7: makeDetail(link) },
    });
    await page.goto("/folders/10?linkId=7");
    const overlayTitle = page.getByText("오버레이 링크").last();
    await expect(overlayTitle).toBeVisible();

    await collapse(page);
    await expect(overlayTitle).toBeVisible();
    await expect(page).toHaveURL(/linkId=7/);
    await page.getByRole("button", { name: "사이드바 펼치기" }).click();
    await expect(page.getByRole("button", { name: "사이드바 줄이기" })).toBeVisible();
    await expect(overlayTitle).toBeVisible();
    await expect(page).toHaveURL(/linkId=7/);
  });

  test("while a link overlay is open the sidebar is covered and only the hamburger works", async ({
    page,
  }) => {
    const link = makeLink({ id: 7, title: "오버레이 링크", folderId: 10 });
    await mockApi(page, {
      folders: makeFolders(12, 3),
      links: [link],
      details: { 7: makeDetail(link) },
    });
    await page.goto("/folders/10?linkId=7");
    await expect(page.getByText("오버레이 링크").last()).toBeVisible();

    await expect(page.getByRole("button", { name: /^폴더 8, 링크/ })).toHaveCount(0);
    const row = await boxOf(page.getByText("폴더 8", { exact: true }).first());
    const hit = await page.evaluate(
      ({ x, y }) =>
        document.elementFromPoint(x, y)?.closest("[role=button]")?.getAttribute("aria-label") ??
        null,
      { x: row.x + row.width / 2, y: row.y + row.height / 2 },
    );
    expect(hit).toBe("링크 상세 닫기");
    await expect(page.getByRole("button", { name: "사이드바 줄이기" })).toHaveCount(1);

    await page.mouse.click(row.x + row.width / 2, row.y + row.height / 2);
    await expect(page).not.toHaveURL(/\/folders\/8/);
  });

  test("a collapsed sidebar starts at 80px after a reload without a width transition", async ({
    page,
  }) => {
    await mockApi(page, { folders: makeFolders(12, 3) });
    await page.goto("/home");
    await collapse(page);

    await page.addInitScript(() => {
      const transitions: string[] = [];
      (window as unknown as { __widthTransitions: string[] }).__widthTransitions = transitions;
      document.addEventListener(
        "transitionstart",
        (event) => {
          if (event.propertyName.includes("width")) {
            transitions.push(event.propertyName);
          }
        },
        true,
      );
    });
    await page.reload();
    await expect(page.getByRole("button", { name: "사이드바 펼치기" })).toBeVisible();
    expect(await columnWidth(page)).toBe(80);
    await expect(page.getByRole("button", { name: "홈" })).toBeVisible();
    const started = await page.evaluate(
      () => (window as unknown as { __widthTransitions: string[] }).__widthTransitions.length,
    );
    expect(started).toBe(0);
    const widthAnimations = await sidebarColumn(page).evaluate(
      (node) =>
        node
          .getAnimations()
          .filter((animation) =>
            String((animation as CSSTransition).transitionProperty ?? "").includes("width"),
          ).length,
    );
    expect(widthAnimations).toBe(0);
  });

  test("the expanded folder list keeps its position after collapsing and expanding", async ({
    page,
  }) => {
    await mockApi(page, { folders: makeFolders(45, 3) });
    await page.goto("/home");
    const list = page.getByLabel("내 폴더 목록", { exact: true });
    await expect(flyoutRow(list, 44)).toBeVisible();
    await list.evaluate((node) => {
      node.scrollTop = 200;
    });
    await expect.poll(() => list.evaluate((node) => node.scrollTop)).toBe(200);
    await expect
      .poll(() =>
        page
          .getByRole("button", { name: "내 폴더 접기" })
          .locator("xpath=..")
          .evaluate((node) => getComputedStyle(node).boxShadow),
      )
      .toMatch(/0px 6px 10px -8px/);

    await collapse(page);
    await page.getByRole("button", { name: "사이드바 펼치기" }).click();
    await expect.poll(() => list.evaluate((node) => Math.round(node.scrollTop))).toBe(200);
  });

  test("collapsed or expanded state and the open section survive a reload", async ({ page }) => {
    await mockApi(page, { folders: makeFolders(12, 3) });
    await page.goto("/home");
    await page.getByRole("button", { name: "공유 폴더 펼치기" }).click();
    await collapse(page);

    await page.reload();
    await expect(page.getByRole("button", { name: "사이드바 펼치기" })).toBeVisible();
    await expect.poll(() => columnWidth(page)).toBe(80);

    await page.getByRole("button", { name: "사이드바 펼치기" }).click();
    await expect(page.getByRole("button", { name: "공유 폴더 접기" })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("button", { name: "사이드바 줄이기" })).toBeVisible();
    await expect(page.getByRole("button", { name: "공유 폴더 접기" })).toBeVisible();
  });

  test("the selected folder icon shows only while a folder is open", async ({ page }) => {
    await mockApi(page, { folders: makeFolders(12, 3) });
    await page.goto("/home");
    await collapse(page);
    await expect(page.getByRole("button", { name: /선택된 폴더$/ })).toHaveCount(0);

    await railButton(page, /^미분류/).click();
    await expect(page).toHaveURL(/\/folders\/0$/);
    await expect(page.getByRole("button", { name: /선택된 폴더$/ })).toHaveCount(0);

    await page.goto("/folders/10");
    const selected = page.getByRole("button", { name: "폴더 10, 선택된 폴더" });
    await expect(selected).toContainText("📁");
    await expect(selected).toHaveAttribute("aria-current", "page");
  });

  test("opening the oldest of 45 folders while collapsed shows a small loading, then its emoji and detail", async ({
    page,
  }) => {
    await mockApi(page, {
      folders: makeFolders(45, 3),
      folderPages: { delayMs: { 1: 1500, 2: 1500 } },
    });
    await page.goto("/home");
    await collapse(page);

    await page.goto("/folders/1");
    const loading = page.getByRole("button", { name: "선택한 폴더 불러오는 중" });
    await expect(loading).toBeVisible();
    await expect(loading).toHaveAttribute("aria-busy", "true");
    await expect(page.getByRole("button", { name: "폴더 1, 선택된 폴더" })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByRole("main").getByText("📁 폴더 1", { exact: true })).toBeVisible();
  });

  test("a long folder name shows in full in the selected folder tooltip", async ({ page }) => {
    const longName = "2027 교토·오사카 여행 준비 체크리스트와 숙소 후보 그리고 맛집 지도 정리";
    await mockApi(page, {
      folders: [
        {
          id: 3,
          ownerId: 1,
          name: longName,
          emoji: "✈️",
          isShared: false,
          shareCounts: 0,
          linkCounts: 2,
        },
      ],
    });
    await page.goto("/folders/3");
    await collapse(page);

    await page.getByRole("button", { name: `${longName}, 선택된 폴더` }).hover();
    await expect(page.getByRole("tooltip").filter({ hasText: longName })).toBeVisible();
  });
});

test.describe("rail folder flyouts", () => {
  test("hovering 내 폴더 or 공유 폴더 opens its list with an add button on top and no member counts", async ({
    page,
  }) => {
    await mockApi(page, { folders: makeFolders(12, 3) });
    await page.goto("/home");
    await collapse(page);

    await railButton(page, "내 폴더").hover();
    const mine = flyout(page, "내 폴더");
    await expect(mine).toBeVisible();
    await expect(railButton(page, "내 폴더")).toHaveAttribute("aria-expanded", "true");
    const addBox = await boxOf(mine.getByRole("button", { name: "내 폴더에 폴더 추가" }));
    const firstRow = await boxOf(flyoutRow(mine, 11));
    expect(addBox.y).toBeLessThan(firstRow.y);

    await page.mouse.move(700, 600);
    await expect(mine).toHaveCount(0);
    await railButton(page, "공유 폴더").hover();
    const shared = flyout(page, "공유 폴더");
    await expect(flyoutRow(shared, 12)).toBeVisible();
    await expect(shared.getByRole("button", { name: "공유 폴더에 폴더 추가" })).toBeVisible();
    await expect(shared.getByText(/명 참여/)).toHaveCount(0);
    await expect(flyoutRow(shared, 12)).toHaveAccessibleName("폴더 12, 링크 2개");
  });

  for (const [section, shared] of [
    ["내 폴더", false],
    ["공유 폴더", true],
  ] as const) {
    test(`the ${section} flyout add button closes the flyout and opens the add dialog preset, and the new folder tops the list`, async ({
      page,
    }) => {
      await mockApi(page, { folders: makeFolders(12, 3) });
      await page.goto("/home");
      await collapse(page);

      await railButton(page, section).hover();
      await flyout(page, section)
        .getByRole("button", { name: `${section}에 폴더 추가` })
        .click();
      await expect(flyout(page, section)).toHaveCount(0);
      const dialog = page.getByRole("dialog");
      await expect(dialog.getByRole("switch")).toHaveAttribute("aria-checked", String(shared));
      await page.getByPlaceholder("예: 디자인 레퍼런스").fill(`레일에서 만든 ${section}`);
      await page.getByRole("button", { name: "저장" }).click();
      await expect(dialog).toHaveCount(0);

      await railButton(page, section).click();
      await expect(flyout(page, section).getByRole("button").nth(1)).toHaveAccessibleName(
        new RegExp(`^레일에서 만든 ${section}, 링크 0개`),
      );
    });
  }

  test("a long flyout list scrolls inside and appends the next batch at the end", async ({
    page,
  }) => {
    await mockApi(page, { folders: makeFolders(45, 3) });
    await page.goto("/home");
    await collapse(page);

    await railButton(page, "내 폴더").click();
    const list = flyout(page, "내 폴더").getByLabel("내 폴더 목록", { exact: true });
    await expect(flyoutRow(list, 44)).toBeVisible();
    expect(await list.evaluate((node) => node.scrollHeight > node.clientHeight)).toBe(true);
    await expect
      .poll(
        async () => {
          await list.evaluate((node) => {
            node.scrollTop = node.scrollHeight;
          });
          return flyoutRow(list, 1).isVisible();
        },
        { timeout: 20_000 },
      )
      .toBe(true);
  });

  test("a hover-opened list stays open on the way from the icon to the list, and closes when the pointer leaves both", async ({
    page,
  }) => {
    await page.clock.install();
    await mockApi(page, { folders: makeFolders(12, 3) });
    await page.goto("/home");
    await collapse(page);

    const trigger = await boxOf(railButton(page, "내 폴더"));
    await page.mouse.move(trigger.x + trigger.width / 2, trigger.y + trigger.height / 2);
    const mine = flyout(page, "내 폴더");
    await expect(mine).toBeVisible();
    const list = await boxOf(mine);
    await page.mouse.move(list.x + 40, list.y + 80, { steps: 12 });
    await page.clock.runFor(HOVER_CLOSE_PAST_MS);
    await expect(mine).toBeVisible();

    await page.mouse.move(list.x + list.width + 200, list.y + 80, { steps: 6 });
    await page.clock.runFor(HOVER_CLOSE_PAST_MS);
    await expect(mine).toHaveCount(0);
  });

  test("a clicked list stays open when the pointer moves away, and closes on an outside click or Esc", async ({
    page,
  }) => {
    await page.clock.install();
    await mockApi(page, { folders: makeFolders(12, 3) });
    await page.goto("/home");
    await collapse(page);

    await railButton(page, "내 폴더").click();
    const mine = flyout(page, "내 폴더");
    await expect(mine).toBeVisible();
    await page.mouse.move(900, 500, { steps: 6 });
    await page.clock.runFor(HOVER_CLOSE_PAST_MS);
    await expect(mine).toBeVisible();
    await page.mouse.click(900, 500);
    await expect(mine).toHaveCount(0);

    await railButton(page, "내 폴더").click();
    await expect(mine).toBeVisible();
    await page.mouse.move(900, 500, { steps: 6 });
    await page.keyboard.press("Escape");
    await expect(mine).toHaveCount(0);
  });

  test("picking a folder closes the list, opens its detail and moves the selected icon to it", async ({
    page,
  }) => {
    await mockApi(page, { folders: makeFolders(12, 3) });
    await page.goto("/folders/11");
    await collapse(page);
    await expect(page.getByRole("button", { name: "폴더 11, 선택된 폴더" })).toBeVisible();

    await railButton(page, "내 폴더").click();
    await flyoutRow(flyout(page, "내 폴더"), 8).click();
    await expect(flyout(page, "내 폴더")).toHaveCount(0);
    await expect(page).toHaveURL(/\/folders\/8$/);
    await expect(page.getByRole("button", { name: "폴더 8, 선택된 폴더" })).toBeVisible();
  });

  test("Tab and Enter open the list with focus on the first folder, and Esc returns focus to the icon", async ({
    page,
  }) => {
    await mockApi(page, { folders: makeFolders(12, 3) });
    await page.goto("/home");
    await collapse(page);
    const trigger = railButton(page, "내 폴더");

    await railButton(page, "액션").focus();
    await page.keyboard.press("Tab");
    await expect(trigger).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(flyoutRow(flyout(page, "내 폴더"), 11)).toBeFocused();

    await page.keyboard.press("Escape");
    await expect(flyout(page, "내 폴더")).toHaveCount(0);
    await expect(trigger).toBeFocused();
  });

  test("a next-batch failure shows a single retry at the end of the flyout list", async ({
    page,
  }) => {
    test.setTimeout(60_000);
    const state = await mockApi(page, {
      folders: makeFolders(45, 3),
      folderPages: { failPages: new Set([1]) },
    });
    await page.goto("/home");
    await collapse(page);

    await railButton(page, "내 폴더").click();
    const list = flyout(page, "내 폴더").getByLabel("내 폴더 목록", { exact: true });
    await expect
      .poll(
        async () => {
          await list.evaluate((node) => {
            node.scrollTop = node.scrollHeight;
          });
          return list.getByText("더 불러오지 못했어요").isVisible();
        },
        { timeout: 30_000 },
      )
      .toBe(true);
    await expect(page.getByRole("button", { name: "다시 시도" })).toHaveCount(1);

    state.folderPages.failPages.clear();
    await list.getByRole("button", { name: "다시 시도" }).click();
    await expect(flyoutRow(list, 25)).toBeAttached();
  });

  test("an account without folders shows the same note in the flyout", async ({ page }) => {
    await mockApi(page, { folders: [] });
    await page.goto("/home");
    await collapse(page);

    await railButton(page, "내 폴더").click();
    await expect(flyout(page, "내 폴더").getByText("아직 만든 폴더가 없어요")).toBeVisible();
  });

  test("rail icons are named buttons", async ({ page }) => {
    await mockApi(page, { folders: makeFolders(12, 3), links: [makeLink({ id: 1 })] });
    await page.goto("/folders/10");
    await collapse(page);
    for (const name of RAIL_ORDER) {
      await expect(railButton(page, name)).toBeVisible();
    }
    await expect(railButton(page, /^미분류/)).toHaveAccessibleName("미분류, 링크 1개");
    await expect(page.getByRole("button", { name: "폴더 10, 선택된 폴더" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });
});

test.describe("rail on a touch screen", () => {
  test.use({ hasTouch: true, viewport: { width: 1180, height: 820 } });

  test("tapping 내 폴더 opens the list and tapping outside closes it", async ({ page }) => {
    await page.clock.install();
    await mockApi(page, { folders: makeFolders(12, 3) });
    await page.goto("/home");
    await page.getByRole("button", { name: "사이드바 줄이기" }).tap();
    await expect(page.getByRole("button", { name: "사이드바 펼치기" })).toBeVisible();

    await railButton(page, "내 폴더").tap();
    const mine = flyout(page, "내 폴더");
    await expect(mine).toBeVisible();
    await page.clock.runFor(HOVER_CLOSE_PAST_MS);
    await expect(mine).toBeVisible();
    await page.touchscreen.tap(900, 600);
    await expect(mine).toHaveCount(0);
  });
});

test.describe("rail flyout placement (#27)", () => {
  test("the flyout opens 8px outside the rail and keeps a gap under its scrolling list", async ({
    page,
  }) => {
    await mockApi(page, { folders: makeFolders(45, 3) });
    await page.goto("/home");
    await collapse(page);

    await railButton(page, "내 폴더").hover();
    const mine = flyout(page, "내 폴더");
    await expect(flyoutRow(mine, 44)).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            document.getAnimations().filter((animation) => animation.playState === "running")
              .length,
        ),
      )
      .toBe(0);
    const rail = await boxOf(sidebarColumn(page));
    const panel = await boxOf(mine);
    expect(panel.x).toBeGreaterThanOrEqual(rail.x + rail.width + 8 - 1);
    expect(panel.x).toBeLessThanOrEqual(rail.x + rail.width + 8 + 1);

    const list = mine.getByLabel("내 폴더 목록", { exact: true });
    expect(await list.evaluate((node) => node.scrollHeight > node.clientHeight)).toBe(true);
    const listBox = await boxOf(list);
    expect(panel.y + panel.height - (listBox.y + listBox.height)).toBeGreaterThanOrEqual(6 - 0.5);
  });
});
