import { type Locator, type Page, type Route, expect, test } from "@playwright/test";

import { textContrast } from "./support/color";
import { boxOf, isWideProject } from "./support/helpers";
import {
  type MockFolder,
  type MockLink,
  envelope,
  makeDetail,
  makeFolders,
  makeLink,
  mockApi,
  settingsHandler,
} from "./support/mock-api";
import { settleSections } from "./support/section-motion";

const DARK_SETTINGS = {
  "GET /api/users/me/settings": (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(
        envelope({
          display: { theme: "dark", accent: "gray" },
          behavior: { allowsReminderNotification: false },
          ai: { defaultProvider: null, defaultModel: null },
          providers: [],
        }),
      ),
    }),
};

const MOVE_ERROR = "폴더를 옮기지 못했어요. 다시 시도해 주세요.";
const ADD_ERROR = "폴더에 추가하지 못했어요. 다시 시도해 주세요.";
const NONE_LABEL = "없음 - ✨ AI 자동 분류";
const UNCATEGORIZED_LABEL = "미분류";
const LONG_NAME =
  "2027 교토·오사카 여행 준비 체크리스트와 숙소 후보, 맛집 지도까지 모아 둔 아주 긴 이름의 폴더";

function linkIn(folderId: number) {
  return makeLink({
    id: 1,
    folderId,
    folderName: `폴더 ${folderId}`,
    folderEmoji: "📁",
  });
}

async function mockWithLink(
  page: Page,
  link: MockLink,
  options: Omit<Parameters<typeof mockApi>[1] & object, "links" | "details"> = {},
) {
  return mockApi(page, {
    folders: makeFolders(45, 3),
    links: [link],
    details: { [link.id]: makeDetail(link) },
    ...options,
  });
}

async function openDetail(page: Page, id = 1) {
  await page.goto(isWideProject() ? `/links?linkId=${id}` : `/links/${id}`);
  await expect(page.getByTestId("link-detail-title")).toBeVisible();
  if (isWideProject()) {
    await expect(page.getByTestId("link-detail-close")).toBeInViewport({ ratio: 1 });
  }
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

function windowScope(page: Page, title: string): Locator | Page {
  return isWideProject() ? page.getByRole("dialog", { name: title }) : page;
}

async function openMoveWindow(page: Page) {
  await page.getByRole("button", { name: /^폴더 이동, 현재/ }).click();
  const scope = windowScope(page, "폴더 이동");
  await expect(scope.getByRole("button", { name: "확인", exact: true })).toBeVisible();
  return scope;
}

async function openAddWindow(page: Page) {
  await page.getByRole("button", { name: "개인 폴더로 추가" }).click();
  const scope = windowScope(page, "개인 폴더로 추가");
  await expect(scope.getByRole("button", { name: "추가", exact: true })).toBeVisible();
  return scope;
}

async function openNewLinkPicker(page: Page) {
  await page.goto("/home");
  if (isWideProject()) {
    await page.getByText("새 링크", { exact: true }).first().click();
    await page.getByRole("button", { name: /^폴더, / }).click();
    const scope = page.getByRole("dialog").last();
    await expect(scope.getByRole("radio", { name: NONE_LABEL })).toBeVisible();
    return scope;
  }
  await page.getByLabel("새 링크").click();
  await page.getByRole("button", { name: /^폴더, / }).click();
  await expect(page.getByRole("radio", { name: NONE_LABEL })).toBeVisible();
  return page;
}

function radio(scope: Locator | Page, id: number) {
  return scope.getByRole("radio", { name: `📁 폴더 ${id}`, exact: true });
}

function toggle(scope: Locator | Page, label: "내 폴더" | "공유 폴더") {
  return scope.getByRole("button", { name: new RegExp(`^${label} (접기|펼치기)$`) });
}

function sectionList(scope: Locator | Page, label: "내 폴더" | "공유 폴더") {
  return scope.getByLabel(`${label} 목록`, { exact: true });
}

async function scrollUntilVisible(list: Locator, target: Locator) {
  await expect
    .poll(
      async () => {
        await list.evaluate((node) => {
          node.scrollTop = node.scrollHeight;
        });
        return target.isVisible();
      },
      { timeout: 20_000 },
    )
    .toBe(true);
}

function countRequests(
  state: Awaited<ReturnType<typeof mockApi>>,
  method: string,
  pattern: RegExp,
) {
  return state.requests.filter((r) => r.method === method && pattern.test(r.path)).length;
}

async function folderCountLabel(page: Page, id: number) {
  await page.goto(isWideProject() ? "/home" : "/folders");
  return page.getByRole("button", { name: new RegExp(`^폴더 ${id}, 링크 \\d+개`) }).first();
}

test.describe("new link folder picker", () => {
  test("shows the none row and two titles with one open section, scrolls inside a fixed height and appends the next batch", async ({
    page,
  }) => {
    await mockApi(page, { folders: makeFolders(45, 3) });
    const scope = await openNewLinkPicker(page);
    await expect(toggle(scope, "내 폴더")).toHaveAccessibleName("내 폴더 접기");
    await expect(toggle(scope, "공유 폴더")).toHaveAccessibleName("공유 폴더 펼치기");
    await expect(sectionList(scope, "내 폴더")).toHaveCount(1);
    await expect(sectionList(scope, "공유 폴더")).toHaveCount(0);

    await toggle(scope, "공유 폴더").click();
    await expect(toggle(scope, "내 폴더")).toHaveAccessibleName("내 폴더 펼치기");
    await expect(sectionList(scope, "내 폴더")).toHaveCount(0);
    await expect(sectionList(scope, "공유 폴더")).toHaveCount(1);
    await toggle(scope, "내 폴더").click();

    const mine = sectionList(scope, "내 폴더");
    const listBox = await boxOf(mine);
    const viewport = page.viewportSize()?.height ?? 0;
    expect(listBox.height).toBeLessThanOrEqual(isWideProject() ? 201 : viewport * 0.4 + 1);
    const noneBefore = await boxOf(scope.getByRole("radio", { name: NONE_LABEL }));
    await scrollUntilVisible(mine, radio(mine, 1));
    const noneAfter = await boxOf(scope.getByRole("radio", { name: NONE_LABEL }));
    expect(noneAfter.y).toBe(noneBefore.y);
    expect(noneAfter.y).toBeLessThan((await boxOf(toggle(scope, "내 폴더"))).y);
  });

  test("picking a folder goes straight back to the form with that folder, and nothing is saved", async ({
    page,
  }) => {
    const state = await mockApi(page, { folders: makeFolders(45, 3) });
    const scope = await openNewLinkPicker(page);
    await radio(scope, 43).click();
    if (isWideProject()) {
      await expect(page.getByRole("button", { name: "폴더, 📁 폴더 43" })).toBeVisible();
      await expect(page.getByRole("radio", { name: NONE_LABEL })).toHaveCount(0);
    } else {
      await expect(
        page.getByLabel("Bottom Sheet", { exact: true }).getByText("📁 폴더 43", { exact: true }),
      ).toBeVisible();
      await expect(page.getByRole("radio", { name: NONE_LABEL })).toHaveCount(0);
    }
    expect(countRequests(state, "POST", /^\/api\/links$/)).toBe(0);
  });

  test("+ opens the add window preset to its section on top of the link window, and the new folder shows unselected", async ({
    page,
  }) => {
    await mockApi(page, { folders: makeFolders(45, 3) });
    const scope = await openNewLinkPicker(page);
    await scope.getByRole("button", { name: "공유 폴더에 폴더 추가" }).click();
    await expect(page.getByText("새 폴더", { exact: true })).toBeVisible();
    await expect(page.getByRole("switch")).toBeChecked();
    await page.getByPlaceholder("예: 디자인 레퍼런스").fill("함께 갈 곳");
    await page.getByRole("button", { name: "저장", exact: true }).last().click();
    await expect(page.getByText("새 폴더", { exact: true })).toHaveCount(0);

    const created = scope.getByRole("radio", { name: "함께 갈 곳" });
    await expect(created).toBeVisible();
    await expect(created).not.toBeChecked();
    await expect(scope.getByRole("radio", { name: NONE_LABEL })).toBeChecked();
    await expect(toggle(scope, "공유 폴더")).toHaveAccessibleName("공유 폴더 접기");

    await scope.getByRole("button", { name: "내 폴더에 폴더 추가" }).click();
    await expect(page.getByRole("switch")).not.toBeChecked();
  });

  test("the picker remembers its open section apart from the sidebar and the folder tab", async ({
    page,
  }) => {
    await mockApi(page, { folders: makeFolders(45, 3) });
    let scope = await openNewLinkPicker(page);
    await toggle(scope, "공유 폴더").click();
    await expect(toggle(scope, "공유 폴더")).toHaveAccessibleName("공유 폴더 접기");

    scope = await openNewLinkPicker(page);
    await expect(toggle(scope, "공유 폴더")).toHaveAccessibleName("공유 폴더 접기");
    const stored = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("qlink-folder-navigation") ?? "{}"),
    );
    expect(stored.openSection.picker).toBe("shared");
    expect(stored.openSection.sidebar).toBe("mine");
    expect(stored.openSection.mobileTab).toBe("mine");
  });
});

test.describe("move window in the link detail", () => {
  test("cancel and confirm are always shown with no close button, and confirm stays off until another folder is chosen", async ({
    page,
  }) => {
    await mockWithLink(page, linkIn(44));
    await openDetail(page);
    const scope = await openMoveWindow(page);
    await expect(scope.getByRole("button", { name: "취소", exact: true })).toBeInViewport();
    await expect(scope.getByRole("button", { name: "확인", exact: true })).toBeInViewport();
    await expect(scope.getByRole("button", { name: "닫기" })).toHaveCount(0);
    await expect(scope.getByRole("button", { name: "확인", exact: true })).toBeDisabled();
    await expect(radio(scope, 44)).toBeChecked();

    await radio(scope, 43).click();
    await expect(radio(scope, 43)).toBeChecked();
    await expect(radio(scope, 44)).not.toBeChecked();
    await expect(scope.getByRole("button", { name: "확인", exact: true })).toBeEnabled();
    await expect(scope.getByRole("button", { name: "취소", exact: true })).toBeVisible();

    await radio(scope, 44).click();
    await expect(scope.getByRole("button", { name: "확인", exact: true })).toBeDisabled();
  });

  test("confirm shows the pending state, closes, and the detail and the chosen folder show the move", async ({
    page,
  }) => {
    const state = await mockWithLink(page, linkIn(44), { linkMutations: { delayMs: 1500 } });
    await openDetail(page);
    const scope = await openMoveWindow(page);
    await radio(scope, 43).click();
    await scope.getByRole("button", { name: "확인", exact: true }).click();
    await expect(scope.getByRole("button", { name: "옮기는 중" })).toBeVisible();
    await expect(scope.getByRole("button", { name: "옮기는 중" })).toBeDisabled();
    await expect(page.getByRole("button", { name: "옮기는 중" })).toHaveCount(0, {
      timeout: 10_000,
    });
    await expect(page.getByRole("button", { name: "폴더 이동, 현재 📁 폴더 43" })).toBeVisible();
    expect(countRequests(state, "PATCH", /^\/api\/links\/1$/)).toBe(1);

    await page.goto("/folders/43");
    await expect(page.getByText("링크 1", { exact: true }).first()).toBeVisible();
  });

  test("a failed move shows the message above the buttons and keeps the window and the choice; retrying moves it", async ({
    page,
  }) => {
    const state = await mockWithLink(page, linkIn(44), { linkMutations: { failMove: true } });
    await openDetail(page);
    const scope = await openMoveWindow(page);
    await radio(scope, 43).click();
    await scope.getByRole("button", { name: "확인", exact: true }).click();
    const alert = scope.getByRole("alert").filter({ hasText: MOVE_ERROR });
    await expect(alert).toBeVisible();
    expect((await boxOf(alert)).y).toBeLessThan(
      (await boxOf(scope.getByRole("button", { name: "확인", exact: true }))).y,
    );
    await expect(radio(scope, 43)).toBeChecked();
    await expect(scope.getByRole("button", { name: "확인", exact: true })).toBeEnabled();
    expect(state.links[0].folderId).toBe(44);

    state.linkMutations.failMove = false;
    await scope.getByRole("button", { name: "확인", exact: true }).click();
    await expect(page.getByRole("button", { name: "폴더 이동, 현재 📁 폴더 43" })).toBeVisible();
    await expect(page.getByText(MOVE_ERROR)).toHaveCount(0);
  });

  test("cancel, Esc and pressing outside close without moving", async ({ page }) => {
    const state = await mockWithLink(page, linkIn(44));
    await openDetail(page);

    const closers: { name: string; close: (scope: Locator | Page) => Promise<void> }[] = [
      {
        name: "cancel",
        close: (scope) => scope.getByRole("button", { name: "취소", exact: true }).click(),
      },
      { name: "outside", close: () => page.mouse.click(8, 8) },
    ];
    if (isWideProject()) {
      closers.push({ name: "esc", close: () => page.keyboard.press("Escape") });
    }
    for (const closer of closers) {
      const scope = await openMoveWindow(page);
      await radio(scope, 43).click();
      await settle(page);
      await closer.close(scope);
      await expect(
        page.getByRole("button", { name: "확인", exact: true }),
        closer.name,
      ).toHaveCount(0);
      await expect(page.getByRole("button", { name: "폴더 이동, 현재 📁 폴더 44" })).toBeVisible();
    }
    expect(countRequests(state, "PATCH", /^\/api\/links\/1$/)).toBe(0);
  });

  test("while pending, cancel, Esc and pressing outside do not close the window", async ({
    page,
  }) => {
    await mockWithLink(page, linkIn(44), { linkMutations: { delayMs: 4000 } });
    await openDetail(page);
    const scope = await openMoveWindow(page);
    await radio(scope, 43).click();
    await scope.getByRole("button", { name: "확인", exact: true }).click();
    const pending = scope.getByRole("button", { name: "옮기는 중" });
    await expect(pending).toBeVisible();
    await expect(scope.getByRole("button", { name: "취소", exact: true })).toBeDisabled();
    await scope.getByRole("button", { name: "취소", exact: true }).click({ force: true });
    await page.keyboard.press("Escape");
    await page.mouse.click(8, 8);
    await expect(pending).toBeVisible();
    await expect(page.getByRole("button", { name: "폴더 이동, 현재 📁 폴더 43" })).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByRole("button", { name: "옮기는 중" })).toHaveCount(0);
  });

  test("pressing confirm twice quickly moves the link once", async ({ page }) => {
    const state = await mockWithLink(page, linkIn(44), { linkMutations: { delayMs: 800 } });
    await openDetail(page);
    const scope = await openMoveWindow(page);
    await radio(scope, 43).click();
    await scope.getByRole("button", { name: "확인", exact: true }).dblclick();
    await expect(page.getByRole("button", { name: "폴더 이동, 현재 📁 폴더 43" })).toBeVisible();
    expect(countRequests(state, "PATCH", /^\/api\/links\/1$/)).toBe(1);
  });

  test("moving updates the link counts of both folders in the sidebar and the folder tab", async ({
    page,
  }) => {
    await mockWithLink(page, linkIn(44));
    await openDetail(page);
    const scope = await openMoveWindow(page);
    await radio(scope, 43).click();
    await scope.getByRole("button", { name: "확인", exact: true }).click();
    await expect(page.getByRole("button", { name: "폴더 이동, 현재 📁 폴더 43" })).toBeVisible();
    await expect(await folderCountLabel(page, 43)).toHaveAccessibleName("폴더 43, 링크 4개");
    await expect(await folderCountLabel(page, 44)).toHaveAccessibleName("폴더 44, 링크 3개");
  });

  test("a failed next batch shows one retry at the end of the open list, also after switching sections", async ({
    page,
  }) => {
    const state = await mockWithLink(page, linkIn(44), {
      folderPages: { failPages: new Set([1]) },
    });
    await openDetail(page);
    const scope = await openMoveWindow(page);
    const mine = sectionList(scope, "내 폴더");
    await scrollUntilVisible(mine, mine.getByText("더 불러오지 못했어요"));
    await expect(scope.getByText("더 불러오지 못했어요")).toHaveCount(1);
    await expect(radio(scope, 44)).toBeVisible();

    await toggle(scope, "공유 폴더").click();
    await expect(sectionList(scope, "공유 폴더")).toBeVisible();
    await expect(scope.getByRole("button", { name: "다시 시도" })).toHaveCount(1);
    await toggle(scope, "내 폴더").click();

    state.folderPages.failPages.clear();
    await scope.getByRole("button", { name: "다시 시도" }).click();
    await scrollUntilVisible(sectionList(scope, "내 폴더"), radio(scope, 1));
    await expect(scope.getByText("더 불러오지 못했어요")).toHaveCount(0);
  });

  test("with no folders, the picker shows the uncategorized row, both titles and the short note", async ({
    page,
  }) => {
    const link = makeLink({ id: 1 });
    await mockApi(page, { folders: [], links: [link], details: { 1: makeDetail(link) } });
    await openDetail(page);
    const scope = await openMoveWindow(page);
    await expect(scope.getByRole("radio", { name: UNCATEGORIZED_LABEL })).toBeChecked();
    await expect(toggle(scope, "내 폴더")).toBeVisible();
    await expect(toggle(scope, "공유 폴더")).toBeVisible();
    await expect(scope.getByText("아직 만든 폴더가 없어요")).toBeVisible();
    await toggle(scope, "공유 폴더").click();
    await expect(scope.getByText("아직 공유 폴더가 없어요")).toBeVisible();
  });

  test("a very long name stays on one line and stops before the selection mark", async ({
    page,
  }) => {
    const folders: MockFolder[] = [
      {
        id: 46,
        ownerId: 1,
        name: LONG_NAME,
        emoji: "📁",
        isShared: false,
        shareCounts: 0,
        linkCounts: 0,
      },
      ...makeFolders(45, 3),
    ];
    await mockWithLink(page, linkIn(44), { folders });
    await openDetail(page);
    const scope = await openMoveWindow(page);
    const row = scope.getByRole("radio", { name: `📁 ${LONG_NAME}` });
    await row.click();
    await expect(row).toBeChecked();
    const text = await boxOf(row.getByText(LONG_NAME, { exact: true }));
    const mark = await boxOf(row.locator("svg"));
    expect(text.height).toBeLessThan(32);
    expect(text.x + text.width).toBeLessThanOrEqual(mark.x);
  });

  test("the edge of the + hit area opens the add window, and the blank part of a title toggles", async ({
    page,
  }) => {
    await mockWithLink(page, linkIn(44));
    await openDetail(page);
    const scope = await openMoveWindow(page);
    const add = scope.getByRole("button", { name: "내 폴더에 폴더 추가" });
    await settle(page);
    const box = await boxOf(add);
    const minimum = isWideProject() ? 44 : 48;
    expect(box.width).toBeGreaterThanOrEqual(minimum);
    expect(box.height).toBeGreaterThanOrEqual(minimum);
    await add.click({ position: { x: 3, y: box.height / 2 } });
    await expect(page.getByText("새 폴더", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "취소", exact: true }).last().click();
    await expect(page.getByText("새 폴더", { exact: true })).toHaveCount(0);

    const title = await boxOf(toggle(scope, "내 폴더"));
    await toggle(scope, "내 폴더").click({
      position: { x: title.width - 12, y: title.height / 2 },
    });
    await expect(toggle(scope, "내 폴더")).toHaveAccessibleName("내 폴더 펼치기");
  });

  test("a folder made from the picker shows up in the sidebar or folder tab and in other pickers", async ({
    page,
  }) => {
    await mockWithLink(page, linkIn(44));
    await openDetail(page);
    const scope = await openMoveWindow(page);
    await scope.getByRole("button", { name: "내 폴더에 폴더 추가" }).click();
    await page.getByPlaceholder("예: 디자인 레퍼런스").fill("새로 만든 폴더");
    await page.getByRole("button", { name: "저장", exact: true }).last().click();
    const created = scope.getByRole("radio", { name: "새로 만든 폴더" });
    await expect(created).toBeVisible();
    await expect(created).not.toBeChecked();
    await expect(radio(scope, 44)).toBeChecked();
    await expect(scope.getByRole("button", { name: "취소", exact: true })).toHaveCount(1);
    await scope.getByRole("button", { name: "취소", exact: true }).click();

    await page.goto(isWideProject() ? "/home" : "/folders");
    await expect(page.getByRole("button", { name: "새로 만든 폴더, 링크 0개" })).toBeVisible();
    if (isWideProject()) {
      await page.getByRole("button", { name: "사이드바 줄이기" }).click();
      await expect(page.getByRole("button", { name: "사이드바 펼치기" })).toBeVisible();
      await page.getByRole("button", { name: "내 폴더", exact: true }).click();
      await expect(
        page
          .getByLabel("내 폴더 펼친 목록", { exact: true })
          .getByRole("button", { name: /^새로 만든 폴더/ }),
      ).toBeVisible();
      await page.keyboard.press("Escape");
      await page.getByRole("button", { name: "사이드바 펼치기" }).click();
    }
    const picker = await openNewLinkPicker(page);
    await expect(picker.getByRole("radio", { name: "새로 만든 폴더" })).toBeVisible();
  });
});

test.describe("uncategorized row in the move window", () => {
  test("shows 미분류 without the AI wording, moves the link out of its folder, and the new link form keeps the AI row", async ({
    page,
  }) => {
    const state = await mockWithLink(page, linkIn(44));
    await openDetail(page);
    const scope = await openMoveWindow(page);
    await expect(
      scope.getByRole("radio", { name: UNCATEGORIZED_LABEL, exact: true }),
    ).toBeVisible();
    await expect(scope.getByText(/AI 자동 분류/)).toHaveCount(0);
    await expect(scope.getByRole("radio", { name: NONE_LABEL })).toHaveCount(0);

    await scope.getByRole("radio", { name: UNCATEGORIZED_LABEL, exact: true }).click();
    await scope.getByRole("button", { name: "확인", exact: true }).click();
    await expect(page.getByRole("button", { name: "폴더 이동, 현재 📭 폴더 없음" })).toBeVisible();
    expect(state.requests.find((r) => r.method === "PATCH")?.body).toEqual({ folderId: 0 });
    expect(state.links[0].folderId).toBeNull();

    await page.goto("/folders/0");
    await expect(page.getByText("링크 1", { exact: true }).first()).toBeVisible();
    await page.goto("/folders/44");
    await expect(page.getByText(/폴더 44$/).first()).toBeVisible();
    await expect(page.getByText("링크 1", { exact: true })).toHaveCount(0);
    await expect(await folderCountLabel(page, 44)).toHaveAccessibleName("폴더 44, 링크 3개");

    const picker = await openNewLinkPicker(page);
    await expect(picker.getByRole("radio", { name: NONE_LABEL })).toBeVisible();
    await expect(picker.getByRole("radio", { name: UNCATEGORIZED_LABEL, exact: true })).toHaveCount(
      0,
    );
  });

  test("a link already in 미분류 opens with 미분류 selected and confirm off", async ({ page }) => {
    const link = makeLink({ id: 1 });
    await mockApi(page, {
      folders: makeFolders(45, 3),
      links: [link],
      details: { 1: makeDetail(link) },
    });
    await openDetail(page);
    const scope = await openMoveWindow(page);
    await expect(
      scope.getByRole("radio", { name: UNCATEGORIZED_LABEL, exact: true }),
    ).toBeChecked();
    await expect(scope.getByRole("button", { name: "확인", exact: true })).toBeDisabled();
  });
});

test.describe("move window on a link card", () => {
  test.beforeEach(() => {
    test.skip(!isWideProject(), "the card move button is wide only");
  });

  test("works like the detail: cancel and confirm, confirm off until changed, and the failure message", async ({
    page,
  }) => {
    const state = await mockWithLink(page, linkIn(44), { linkMutations: { failMove: true } });
    await page.goto("/links");
    const card = page.getByTestId("link-card").filter({ hasText: "링크 1" });
    await card.hover();
    await card.getByRole("button", { name: "폴더 이동" }).click();
    const scope = page.getByRole("dialog", { name: "폴더 이동" });
    await expect(scope.getByRole("button", { name: "닫기" })).toHaveCount(0);
    await expect(scope.getByRole("button", { name: "확인", exact: true })).toBeDisabled();
    await radio(scope, 43).click();
    await expect(scope.getByRole("button", { name: "확인", exact: true })).toBeEnabled();
    await scope.getByRole("button", { name: "확인", exact: true }).click();
    await expect(scope.getByRole("alert").filter({ hasText: MOVE_ERROR })).toBeVisible();
    await expect(radio(scope, 43)).toBeChecked();

    state.linkMutations.failMove = false;
    await scope.getByRole("button", { name: "확인", exact: true }).dblclick();
    await expect(scope).toHaveCount(0);
    expect(countRequests(state, "PATCH", /^\/api\/links\/1$/)).toBe(2);
    expect(state.links[0].folderId).toBe(43);

    await card.hover();
    await card.getByRole("button", { name: "폴더 이동" }).click();
    await radio(scope, 40).click();
    await scope.getByRole("button", { name: "취소", exact: true }).click();
    await expect(scope).toHaveCount(0);
    expect(state.links[0].folderId).toBe(43);
  });
});

test.describe("add to a personal folder", () => {
  test("shows only my folders with no none row, and add stays off until a folder is chosen", async ({
    page,
  }) => {
    await mockWithLink(page, linkIn(45));
    await openDetail(page);
    const scope = await openAddWindow(page);
    await expect(toggle(scope, "내 폴더")).toBeVisible();
    await expect(toggle(scope, "공유 폴더")).toHaveCount(0);
    await expect(scope.getByRole("radio", { name: NONE_LABEL })).toHaveCount(0);
    await expect(scope.getByRole("button", { name: "추가", exact: true })).toBeDisabled();
    await expect(radio(scope, 42)).toHaveCount(0);
    await radio(scope, 44).click();
    await expect(scope.getByRole("button", { name: "추가", exact: true })).toBeEnabled();
  });

  test("opens with my folders even when the picker last kept the shared section open", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      localStorage.setItem(
        "qlink-folder-navigation",
        JSON.stringify({
          isSidebarCollapsed: false,
          openSection: { sidebar: "mine", mobileTab: "mine", picker: "shared" },
        }),
      );
    });
    await mockWithLink(page, linkIn(45));
    await openDetail(page);
    const scope = await openAddWindow(page);
    await expect(sectionList(scope, "내 폴더")).toBeVisible();
    await expect(radio(scope, 44)).toBeVisible();
    await toggle(scope, "내 폴더").click({ force: true });
    await expect(sectionList(scope, "내 폴더")).toBeVisible();
    const stored = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("qlink-folder-navigation") ?? "{}"),
    );
    expect(stored.openSection.picker).toBe("shared");
  });

  test("add shows the pending state, closes, and the link shows in that folder with its count up", async ({
    page,
  }) => {
    const state = await mockWithLink(page, linkIn(45), { linkMutations: { delayMs: 1500 } });
    await openDetail(page);
    const scope = await openAddWindow(page);
    await radio(scope, 44).click();
    await scope.getByRole("button", { name: "추가", exact: true }).dblclick();
    await expect(scope.getByRole("button", { name: "추가하는 중" })).toBeVisible();
    await expect(page.getByRole("button", { name: "추가하는 중" })).toHaveCount(0, {
      timeout: 10_000,
    });
    await expect(page.getByRole("button", { name: "추가", exact: true })).toHaveCount(0);
    expect(countRequests(state, "POST", /^\/api\/links\/1\/copy$/)).toBe(1);
    expect(state.requests.find((r) => r.path === "/api/links/1/copy")?.body).toEqual({
      fromFolderId: 45,
      toFolderId: 44,
    });

    await expect(await folderCountLabel(page, 44)).toHaveAccessibleName("폴더 44, 링크 5개");
    await page.goto("/folders/44");
    await expect(page.getByText("링크 1", { exact: true }).first()).toBeVisible();
  });

  test("a failed add shows the message and keeps the choice", async ({ page }) => {
    const state = await mockWithLink(page, linkIn(45), { linkMutations: { failCopy: true } });
    await openDetail(page);
    const scope = await openAddWindow(page);
    await radio(scope, 44).click();
    await scope.getByRole("button", { name: "추가", exact: true }).click();
    await expect(scope.getByRole("alert").filter({ hasText: ADD_ERROR })).toBeVisible();
    await expect(radio(scope, 44)).toBeChecked();
    await expect(scope.getByRole("button", { name: "추가", exact: true })).toBeEnabled();

    state.linkMutations.failCopy = false;
    await scope.getByRole("button", { name: "추가", exact: true }).click();
    await expect(page.getByRole("button", { name: "추가", exact: true })).toHaveCount(0);
  });

  test("when the first batch has few of my folders, it keeps loading until my older folders can be chosen", async ({
    page,
  }) => {
    const folders: MockFolder[] = Array.from({ length: 25 }, (_, index) => {
      const id = 25 - index;
      const isShared = id > 3;
      return {
        id,
        ownerId: isShared ? 2 : 1,
        name: `폴더 ${id}`,
        emoji: "📁",
        isShared,
        shareCounts: isShared ? 2 : 0,
        linkCounts: 0,
      };
    });
    const state = await mockWithLink(page, linkIn(25), { folders });
    await openDetail(page);
    const scope = await openAddWindow(page);
    await expect(radio(scope, 2)).toBeVisible();
    await radio(scope, 2).click();
    await scope.getByRole("button", { name: "추가", exact: true }).click();
    await expect(page.getByRole("button", { name: "추가", exact: true })).toHaveCount(0);
    expect(state.requests.find((r) => r.path === "/api/links/1/copy")?.body).toEqual({
      fromFolderId: 25,
      toFolderId: 2,
    });
  });
});

test.describe("mobile sheet", () => {
  test.beforeEach(() => {
    test.skip(isWideProject(), "mobile sheet only");
  });

  test("cancel and confirm sit above the bottom edge, and the chosen row stands out in dark mode", async ({
    page,
  }) => {
    await mockWithLink(page, linkIn(44), { handlers: DARK_SETTINGS });
    await openDetail(page);
    await expect(page.locator("html")).toHaveClass(/dark/);
    const scope = await openMoveWindow(page);
    await radio(scope, 43).click();
    await settle(page);
    const viewport = page.viewportSize()?.height ?? 0;
    for (const name of ["취소", "확인"]) {
      const button = page.getByRole("button", { name, exact: true });
      await expect(button).toBeInViewport({ ratio: 1 });
      const box = await boxOf(button);
      expect(box.y + box.height).toBeLessThanOrEqual(viewport - 16);
    }
    const background = (id: number) =>
      radio(scope, id).evaluate((node) => getComputedStyle(node).backgroundColor);
    await expect.poll(async () => (await background(43)) !== (await background(40))).toBe(true);
    await expect(radio(scope, 43).locator("svg")).toBeVisible();
  });

  for (const size of [
    { width: 390, height: 844 },
    { width: 375, height: 667 },
  ]) {
    test(`at ${size.width}x${size.height}, cancel, confirm and the failure message stay on screen with the list`, async ({
      page,
    }) => {
      await page.setViewportSize(size);
      await mockWithLink(page, linkIn(44), { linkMutations: { failMove: true } });
      await openDetail(page);
      const scope = await openMoveWindow(page);
      await settle(page);
      await radio(scope, 43).click();
      await scope.getByRole("button", { name: "확인", exact: true }).click();
      const alert = page.getByRole("alert").filter({ hasText: MOVE_ERROR });
      await expect(alert).toBeVisible();
      await settle(page);
      for (const target of [
        alert,
        page.getByRole("button", { name: "취소", exact: true }),
        page.getByRole("button", { name: "확인", exact: true }),
        radio(scope, 43),
      ]) {
        await expect(target).toBeInViewport({ ratio: 1 });
      }
      const confirm = await boxOf(page.getByRole("button", { name: "확인", exact: true }));
      expect(confirm.y + confirm.height).toBeLessThanOrEqual(size.height - 16);
      expect((await boxOf(alert)).y + 4).toBeLessThan(confirm.y);
    });
  }

  test("the add sheet from the picker keeps the name field and save button on screen while typing", async ({
    page,
  }) => {
    await mockWithLink(page, linkIn(44));
    await openDetail(page);
    await openMoveWindow(page);
    await page.getByRole("button", { name: "내 폴더에 폴더 추가" }).click();
    const input = page.getByPlaceholder("예: 디자인 레퍼런스");
    await input.focus();
    await input.pressSequentially("여행");
    await expect(input).toBeInViewport({ ratio: 1 });
    await expect(page.getByRole("button", { name: "저장", exact: true }).last()).toBeInViewport({
      ratio: 1,
    });
  });

  test("making a folder from the move window while the folder tab was near the 30th folder returns near that spot with the new folder listed", async ({
    page,
  }) => {
    const link = makeLink({ id: 1, folderId: 15, folderName: "폴더 15", folderEmoji: "📁" });
    await mockApi(page, {
      folders: makeFolders(45, 0),
      links: [link],
      details: { 1: makeDetail(link) },
    });
    await page.goto("/folders");
    const mine = sectionList(page, "내 폴더");
    await expect(mine.getByRole("button", { name: /^폴더 45, 링크/ })).toBeVisible();
    await scrollUntilVisible(mine, mine.getByRole("button", { name: /^폴더 15, 링크/ }));
    const target = mine.getByRole("button", { name: /^폴더 15, 링크/ });
    await target.scrollIntoViewIfNeeded();
    const saved = await mine.evaluate((node) => Math.round(node.scrollTop));
    expect(saved).toBeGreaterThan(0);

    await target.click();
    await expect(page).toHaveURL(/\/folders\/15$/);
    await page.getByText("링크 1", { exact: true }).first().click();
    await expect(page.getByTestId("link-detail-title")).toBeVisible();
    const scope = await openMoveWindow(page);
    await scope.getByRole("button", { name: "내 폴더에 폴더 추가" }).click();
    await page.getByPlaceholder("예: 디자인 레퍼런스").fill("이동 창에서 만든 폴더");
    await page.getByRole("button", { name: "저장", exact: true }).last().click();
    await expect(scope.getByRole("radio", { name: "이동 창에서 만든 폴더" })).toBeVisible();
    await expect(scope.getByRole("button", { name: "취소", exact: true })).toHaveCount(1);
    await scope.getByRole("button", { name: "취소", exact: true }).click();

    await page.getByRole("button", { name: "뒤로" }).click();
    await expect(page).not.toHaveURL(/\/links\/1$/);
    await page.getByText("폴더", { exact: true }).last().click();
    await expect(page).toHaveURL(/\/folders$/);
    const list = sectionList(page, "내 폴더");
    await expect.poll(() => list.evaluate((node) => Math.round(node.scrollTop))).toBe(saved);
    await expect(list.getByRole("button", { name: /^폴더 16, 링크/ })).toBeInViewport();
    await list.evaluate((node) => {
      node.scrollTop = 0;
    });
    await expect(
      list.getByRole("button", { name: "이동 창에서 만든 폴더, 링크 0개" }),
    ).toBeVisible();
  });
});

test("pressing the oldest folder of more than 40 opens its detail instead of not found", async ({
  page,
}) => {
  await mockApi(page, { folders: makeFolders(45, 0) });
  await page.goto(isWideProject() ? "/home" : "/folders");
  const mine = sectionList(page, "내 폴더").first();
  const oldest = mine.getByRole("button", { name: /^폴더 1, 링크/ });
  await scrollUntilVisible(mine, oldest);
  await oldest.click();
  await expect(page).toHaveURL(/\/folders\/1$/);
  await expect(page.getByText("폴더를 찾을 수 없어요")).toHaveCount(0);
  await expect.poll(() => page.title()).toContain("폴더 1");
});

test.describe("window fit, width and marks (#27)", () => {
  test("in a low window the new link folder popover stays 16px inside the screen and only the folder list shrinks", async ({
    page,
  }) => {
    test.skip(!isWideProject(), "wide popover");
    await mockApi(page, { folders: makeFolders(45, 3) });
    for (const height of [520, 620, 800]) {
      await page.setViewportSize({ width: 1280, height });
      const scope = await openNewLinkPicker(page);
      await settle(page);
      const popover = await boxOf(scope as Locator);
      const trigger = await boxOf(page.getByRole("button", { name: /^폴더, / }));
      expect(popover.y).toBeGreaterThanOrEqual(trigger.y + trigger.height);
      expect(popover.y + popover.height).toBeLessThanOrEqual(height - 16 + 1);
      await expect(scope.getByRole("radio", { name: NONE_LABEL })).toBeInViewport({ ratio: 1 });
      await expect(toggle(scope, "내 폴더")).toBeInViewport({ ratio: 1 });
      await expect(toggle(scope, "공유 폴더")).toBeInViewport({ ratio: 1 });
      const mine = sectionList(scope, "내 폴더");
      expect(await mine.evaluate((node) => node.scrollHeight > node.clientHeight)).toBe(true);
      const listHeight = (await boxOf(mine)).height;
      expect(listHeight).toBeLessThanOrEqual(200);
      if (height === 520) {
        expect(popover.y + popover.height).toBeGreaterThanOrEqual(height - 16 - 1);
        expect(listHeight).toBeLessThan(200);
      }
    }
  });

  test("in a low window a failed folder load keeps both titles in the popover", async ({
    page,
  }) => {
    test.skip(!isWideProject(), "wide popover");
    await page.setViewportSize({ width: 1280, height: 620 });
    await mockApi(page, { folders: makeFolders(45, 3), folderPages: { failAll: true } });
    const scope = await openNewLinkPicker(page);
    await expect(scope.getByText("폴더를 불러오지 못했어요")).toBeVisible({ timeout: 20_000 });
    await settle(page);
    const popover = await boxOf(scope as Locator);
    expect(popover.y + popover.height).toBeLessThanOrEqual(620 - 16 + 1);
    await expect(toggle(scope, "내 폴더")).toBeInViewport({ ratio: 1 });
    await expect(toggle(scope, "공유 폴더")).toBeInViewport({ ratio: 1 });
  });

  test("the mobile form shows a picked folder without the AI sparkle", async ({ page }) => {
    test.skip(isWideProject(), "mobile new link sheet");
    await mockApi(page, { folders: makeFolders(45, 3) });
    await page.goto("/home");
    await page.getByLabel("새 링크").click();
    const sheet = page.getByLabel("Bottom Sheet", { exact: true });
    await expect(sheet.getByRole("button", { name: "폴더, 없음" })).toBeVisible();
    await page.getByRole("button", { name: /^폴더, / }).click();
    await radio(page, 43).click();
    await expect(sheet.getByText("📁 폴더 43", { exact: true })).toBeVisible();
    await expect(sheet.getByText(/✨/)).toHaveCount(0);
  });

  test("the move window keeps one 420px width across sections, a long name and the failure message", async ({
    page,
  }) => {
    test.skip(!isWideProject(), "wide window");
    const folders: MockFolder[] = [
      {
        id: 46,
        ownerId: 1,
        name: LONG_NAME,
        emoji: "📁",
        isShared: false,
        shareCounts: 0,
        linkCounts: 0,
      },
      ...makeFolders(45, 3),
    ];
    await mockWithLink(page, linkIn(44), { folders, linkMutations: { failMove: true } });
    await openDetail(page);
    const scope = (await openMoveWindow(page)) as Locator;
    await settle(page);
    const widths: number[] = [];
    const measure = async () => {
      await settle(page);
      widths.push(Math.round((await boxOf(scope)).width));
    };
    await measure();
    await toggle(scope, "공유 폴더").click();
    await measure();
    await toggle(scope, "공유 폴더").click();
    await measure();
    await toggle(scope, "내 폴더").click();
    await radio(scope, 43).click();
    await scope.getByRole("button", { name: "확인", exact: true }).click();
    await expect(scope.getByRole("alert").filter({ hasText: MOVE_ERROR })).toBeVisible();
    await measure();
    expect(widths).toEqual([420, 420, 420, 420]);
    const longRow = scope.getByRole("radio", { name: `📁 ${LONG_NAME}` });
    expect((await boxOf(longRow.getByText(LONG_NAME, { exact: true }))).height).toBeLessThan(24);
  });

  test("the add to personal folder window opens at the same 420px width", async ({ page }) => {
    test.skip(!isWideProject(), "wide window");
    await mockWithLink(page, linkIn(45));
    await openDetail(page);
    const scope = (await openAddWindow(page)) as Locator;
    await settle(page);
    expect(Math.round((await boxOf(scope)).width)).toBe(420);
  });

  test("the chosen row shows a check mark instead of the sparkle, and the none row keeps its AI wording", async ({
    page,
  }) => {
    await mockWithLink(page, linkIn(44));
    await openDetail(page);
    const move = await openMoveWindow(page);
    await radio(move, 43).click();
    await expect(move.getByTestId("folder-picker-selected-mark")).toHaveCount(1);
    await expect(radio(move, 43).getByTestId("folder-picker-selected-mark")).toBeVisible();
    await move.getByRole("button", { name: "취소", exact: true }).click();

    const picker = await openNewLinkPicker(page);
    const none = picker.getByRole("radio", { name: NONE_LABEL });
    await expect(none).toBeChecked();
    await expect(picker.getByTestId("folder-picker-selected-mark")).toHaveCount(1);
    await expect(none.getByTestId("folder-picker-selected-mark")).toBeVisible();
  });

  test("the add to personal folder window marks the chosen folder with the same check", async ({
    page,
  }) => {
    await mockWithLink(page, linkIn(45));
    await openDetail(page);
    const add = await openAddWindow(page);
    await expect(add.getByTestId("folder-picker-selected-mark")).toHaveCount(0);
    await radio(add, 44).click();
    await expect(add.getByTestId("folder-picker-selected-mark")).toHaveCount(1);
    await expect(radio(add, 44).getByTestId("folder-picker-selected-mark")).toBeVisible();
  });

  test("reopening the move or add window right after a move hides the previous success message", async ({
    page,
  }) => {
    test.skip(isWideProject(), "the message covers the mobile sheet");
    await mockWithLink(page, linkIn(45));
    await openDetail(page);
    const moved = page.getByText(/\(으\)로 옮겼어요\.$/);

    let scope = await openMoveWindow(page);
    await toggle(scope, "공유 폴더").click();
    await radio(scope, 42).click();
    await scope.getByRole("button", { name: "확인", exact: true }).click();
    await expect(moved.first()).toBeVisible();
    scope = await openMoveWindow(page);
    await expect(moved).toHaveCount(0, { timeout: 1000 });

    await radio(scope, 39).click();
    await scope.getByRole("button", { name: "확인", exact: true }).click();
    await expect(moved.first()).toBeVisible();
    await openAddWindow(page);
    await expect(moved).toHaveCount(0, { timeout: 1000 });
  });

  test("with a mouse in a narrow window, pressing the folder chip hides its hover name as the sheet opens", async ({
    browser,
  }) => {
    test.skip(isWideProject(), "narrow window");
    const context = await browser.newContext({
      baseURL: test.info().project.use.baseURL,
      viewport: { width: 390, height: 844 },
    });
    try {
      const page = await context.newPage();
      await mockWithLink(page, linkIn(44));
      await openDetail(page);
      const chip = page.getByTestId("link-detail-folder");
      await chip.hover();
      await expect(page.getByRole("tooltip")).toHaveCount(1);
      await chip.click();
      await expect(page.getByRole("button", { name: "확인", exact: true })).toBeVisible();
      await page.waitForTimeout(400);
      expect(await page.getByRole("tooltip").count()).toBe(0);
    } finally {
      await context.close();
    }
  });
});

test.describe("design critique follow-ups (#27)", () => {
  test("the move window keeps one height, top and confirm position across sections, both closed and the failure message", async ({
    page,
  }) => {
    test.skip(!isWideProject(), "wide window");
    await mockWithLink(page, linkIn(44), { linkMutations: { failMove: true } });
    await openDetail(page);
    const scope = (await openMoveWindow(page)) as Locator;
    const confirm = scope.getByRole("button", { name: "확인", exact: true });
    const frames: { top: number; height: number; confirmY: number }[] = [];
    const measure = async () => {
      await settle(page);
      const box = await boxOf(scope);
      frames.push({
        top: Math.round(box.y),
        height: Math.round(box.height),
        confirmY: Math.round((await boxOf(confirm)).y),
      });
    };
    await measure();
    await toggle(scope, "공유 폴더").click();
    await measure();
    await toggle(scope, "공유 폴더").click();
    await measure();
    await toggle(scope, "내 폴더").click();
    await radio(scope, 43).click();
    await confirm.click();
    await expect(scope.getByRole("alert").filter({ hasText: MOVE_ERROR })).toBeVisible();
    await measure();
    expect(frames).toEqual([frames[0], frames[0], frames[0], frames[0]]);
    expect(frames[0].height).toBe(Math.min(640, Math.round(800 * 0.8)));
  });

  test("the none row shows the sparkle once, and the wide form button uses the same wording", async ({
    page,
  }) => {
    await mockApi(page, { folders: makeFolders(12, 3) });
    const picker = await openNewLinkPicker(page);
    const none = picker.getByRole("radio", { name: NONE_LABEL });
    await expect(none).toBeVisible();
    expect((await none.innerText()).match(/✨/g)).toHaveLength(1);
    if (isWideProject()) {
      await page.keyboard.press("Escape");
      await expect(page.getByRole("button", { name: `폴더, ${NONE_LABEL}` })).toBeVisible();
    }
  });

  test("in the mobile move sheet the 미분류 row lines up with the folder rows", async ({
    page,
  }) => {
    test.skip(isWideProject(), "mobile sheet");
    await mockWithLink(page, linkIn(44));
    await openDetail(page);
    const scope = await openMoveWindow(page);
    await settle(page);
    const uncategorized = await boxOf(scope.getByRole("radio", { name: UNCATEGORIZED_LABEL }));
    const row = await boxOf(radio(scope, 44));
    expect(Math.round(uncategorized.x)).toBe(Math.round(row.x));
    expect(Math.round(uncategorized.width)).toBe(Math.round(row.width));
  });
});

test.describe("folder picker rows look like the sidebar (#27)", () => {
  function frameOf(page: Page, scope: Locator | Page): Locator {
    return isWideProject() ? (scope as Locator) : page.getByLabel("Bottom Sheet", { exact: true });
  }

  async function rowLook(row: Locator) {
    return row.evaluate((node) => {
      const style = getComputedStyle(node);
      return {
        background: style.backgroundColor,
        borders: [
          style.borderTopWidth,
          style.borderRightWidth,
          style.borderBottomWidth,
          style.borderLeftWidth,
        ],
      };
    });
  }

  async function expectListRows(frame: Locator, selected: Locator, others: Locator[]) {
    await expect(selected).toBeChecked();
    await expect(selected.getByTestId("folder-picker-selected-mark")).toBeVisible();
    await expect(frame.getByTestId("folder-picker-selected-mark")).toHaveCount(1);
    const chosen = await rowLook(selected);
    expect(chosen.borders).toEqual(["0px", "0px", "0px", "0px"]);
    for (const other of others) {
      await expect(other).toBeVisible();
      const look = await rowLook(other);
      expect(look.borders).toEqual(["0px", "0px", "0px", "0px"]);
      expect(look.background).not.toBe(chosen.background);
    }

    const bounds = await boxOf(frame);
    for (const row of [selected, ...others]) {
      const box = await boxOf(row);
      expect(box.x).toBeGreaterThanOrEqual(bounds.x);
      expect(box.x + box.width).toBeLessThanOrEqual(bounds.x + bounds.width + 0.5);
      if (isWideProject()) {
        expect(Math.round(box.height)).toBe(40);
      } else {
        expect(Math.round(box.height)).toBeGreaterThanOrEqual(44);
        expect(Math.round(box.height)).toBeLessThanOrEqual(48);
      }
    }
    const overflow = await frame.evaluate(
      (node) =>
        Array.from(node.querySelectorAll<HTMLElement>("*")).filter(
          (element) =>
            ["auto", "scroll"].includes(getComputedStyle(element).overflowX) &&
            element.scrollWidth > element.clientWidth + 1,
        ).length,
    );
    expect(overflow).toBe(0);
  }

  test("move window: plain rows, the chosen one with a soft background and the check", async ({
    page,
  }) => {
    await mockWithLink(page, linkIn(44));
    await openDetail(page);
    const scope = await openMoveWindow(page);
    await settle(page);
    await expectListRows(frameOf(page, scope), radio(scope, 44), [
      radio(scope, 43),
      radio(scope, 41),
      scope.getByRole("radio", { name: UNCATEGORIZED_LABEL, exact: true }),
    ]);
  });

  test("add to personal folder window: plain rows, the chosen one with a soft background and the check", async ({
    page,
  }) => {
    await mockWithLink(page, linkIn(45));
    await openDetail(page);
    const scope = await openAddWindow(page);
    await radio(scope, 44).click();
    await settle(page);
    await expectListRows(frameOf(page, scope), radio(scope, 44), [
      radio(scope, 43),
      radio(scope, 41),
    ]);
  });

  test("new link folder picker: the none row and folder rows share the plain row look", async ({
    page,
  }) => {
    await mockApi(page, { folders: makeFolders(12, 3) });
    const picker = await openNewLinkPicker(page);
    await settle(page);
    const frame = isWideProject()
      ? (picker as Locator)
      : page.getByLabel("Bottom Sheet", { exact: true });
    await expectListRows(frame, picker.getByRole("radio", { name: NONE_LABEL }), [
      radio(picker, 11),
      radio(picker, 10),
    ]);
  });

  async function headerShadow(scope: Locator | Page, label: "내 폴더" | "공유 폴더") {
    return toggle(scope, label).evaluate((node) => {
      const style = getComputedStyle(node.parentElement as Element);
      return style.borderTopWidth === "1px" && style.borderTopStyle === "solid"
        ? "0px -1px 0px border"
        : style.boxShadow;
    });
  }

  async function geometry(header: Locator, headerLabel: string, row: Locator, rowLabel: string) {
    const [chevron, title, icon, name] = await Promise.all([
      boxOf(header.locator("svg").first()),
      boxOf(header.getByText(headerLabel, { exact: true })),
      boxOf(row.getByText("📁", { exact: true })),
      boxOf(row.getByText(rowLabel, { exact: true })),
    ]);
    return { iconFromChevron: icon.x - chevron.x, labelFromHeaderLabel: name.x - title.x };
  }

  async function sidebarGeometry(page: Page) {
    const viewport = page.viewportSize();
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/home");
    const header = page.getByRole("button", { name: /^내 폴더 (접기|펼치기)$/ }).first();
    if ((await header.getAttribute("aria-expanded")) !== "true") {
      await header.click();
    }
    const row = page.getByRole("button", { name: /^폴더 3, 링크/ }).first();
    await expect(row).toBeVisible();
    await settle(page);
    const result = await geometry(header, "내 폴더", row, "폴더 3");
    if (viewport) {
      await page.setViewportSize(viewport);
    }
    return result;
  }

  test("a soft divider sits between the fixed row and the first section, none between a section title and its rows, and rows keep the sidebar's offsets", async ({
    page,
  }) => {
    await mockWithLink(page, linkIn(3), { folders: makeFolders(3, 0) });
    const sidebar = await sidebarGeometry(page);
    await openDetail(page);
    const scope = await openMoveWindow(page);
    await settle(page);

    expect(await headerShadow(scope, "내 폴더")).toMatch(/0px -1px 0px/);
    expect(await headerShadow(scope, "공유 폴더")).toMatch(/0px -1px 0px/);
    const list = sectionList(scope, "내 폴더");
    const listLook = await list.evaluate((node) => {
      const style = getComputedStyle(node);
      return { border: style.borderTopWidth, shadow: style.boxShadow };
    });
    expect(listLook).toEqual({ border: "0px", shadow: "none" });

    const header = toggle(scope, "내 폴더");
    const title = header.getByText("내 폴더", { exact: true });
    const name = radio(scope, 2).getByText("폴더 2", { exact: true });
    const [titleLook, nameLook] = await Promise.all(
      [title, name].map((text) =>
        text.evaluate((node) => {
          const style = getComputedStyle(node);
          return { size: parseFloat(style.fontSize), color: style.color };
        }),
      ),
    );
    expect(titleLook.size).toBeLessThan(nameLook.size);
    expect(titleLook.color).not.toBe(nameLook.color);

    const fixed = await boxOf(scope.getByRole("radio", { name: UNCATEGORIZED_LABEL, exact: true }));
    const mineHeader = await boxOf(header);
    const sharedHeader = await boxOf(toggle(scope, "공유 폴더"));
    const firstRow = await boxOf(radio(scope, 3));
    const lastRow = await boxOf(radio(scope, 1));
    const underHeader = firstRow.y - (mineHeader.y + mineHeader.height);
    const beforeDivider = sharedHeader.y - (lastRow.y + lastRow.height);
    expect(underHeader).toBeGreaterThanOrEqual(0);
    expect(underHeader).toBeLessThan(beforeDivider);
    expect(mineHeader.y - (fixed.y + fixed.height)).toBeGreaterThan(underHeader);

    const picker = await geometry(header, "내 폴더", radio(scope, 3), "폴더 3");
    expect(Math.abs(picker.iconFromChevron - sidebar.iconFromChevron)).toBeLessThanOrEqual(1);
    expect(
      Math.abs(picker.labelFromHeaderLabel - sidebar.labelFromHeaderLabel),
    ).toBeLessThanOrEqual(1);
  });

  test("without a fixed row on top, the first section title has no divider above it", async ({
    page,
  }) => {
    await mockWithLink(page, linkIn(45));
    await openDetail(page);
    const scope = await openAddWindow(page);
    await settle(page);
    expect(await headerShadow(scope, "내 폴더")).not.toMatch(/-1px/);
  });

  for (const theme of ["light", "dark"] as const) {
    for (const accent of ["gray", "pink", "blue"] as const) {
      test(`${theme} ${accent}: the chosen row label reaches 4.5:1 on its background`, async ({
        page,
      }) => {
        await mockWithLink(page, linkIn(44), {
          handlers: { "GET /api/users/me/settings": settingsHandler(theme, accent) },
        });
        await openDetail(page);
        await expect(page.locator("html")).toHaveAttribute("data-accent", accent);
        const scope = await openMoveWindow(page);
        await settle(page);
        const chosen = radio(scope, 44);
        await expect(chosen).toBeChecked();
        const label = chosen.getByText("폴더 44", { exact: true });
        expect(await textContrast(label)).toBeGreaterThanOrEqual(4.5);
        const background = await chosen.evaluate((node) => getComputedStyle(node).backgroundColor);
        expect(background).not.toMatch(/rgba\(.*,\s*0\)$/);
        expect(
          await textContrast(radio(scope, 43).getByText("폴더 43", { exact: true })),
        ).toBeGreaterThanOrEqual(4.5);
      });
    }
  }
});
