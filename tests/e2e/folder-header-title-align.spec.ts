import { type Locator, type Page, type Route, expect, test } from "@playwright/test";

import { boxOf, cssOf, isWideProject } from "./support/helpers";
import { type MockFolder, envelope, makeDetail, makeLink, mockApi } from "./support/mock-api";

// #57 follow-up: on the mobile folder detail header the title sits right after the back button
// (8px gap), so its left edge stays put whatever the role-dependent actions on the right are.
// Every other mobile header keeps its centered title.

const MINE: MockFolder = {
  id: 1,
  ownerId: 1,
  name: "읽을거리",
  emoji: "📚",
  isShared: false,
  shareCounts: 0,
  linkCounts: 0,
};
const OWNED_SHARED: MockFolder = {
  id: 10,
  ownerId: 1,
  name: "팀 자료",
  emoji: "🧭",
  isShared: true,
  shareCounts: 3,
  linkCounts: 0,
};
const MEMBER_SHARED: MockFolder = {
  id: 9,
  ownerId: 2,
  name: "캠핑 모임",
  emoji: "🏕️",
  isShared: true,
  shareCounts: 3,
  linkCounts: 0,
};
const LONG_NAME: MockFolder = {
  id: 11,
  ownerId: 1,
  name: "아주아주 긴 폴더 이름이 오른쪽 아이콘 앞에서 잘리는지 보는 폴더",
  emoji: "🗂️",
  isShared: true,
  shareCounts: 2,
  linkCounts: 0,
};
const FOLDERS = [MINE, OWNED_SHARED, MEMBER_SHARED, LONG_NAME];

type Handlers = NonNullable<Parameters<typeof mockApi>[1]>["handlers"];

function setup(page: Page, handlers?: Handlers) {
  const link = makeLink({ id: 1 });
  return mockApi(page, {
    folders: FOLDERS.map((folder) => ({ ...folder })),
    links: [link],
    details: { 1: makeDetail(link) },
    handlers,
  });
}

function header(page: Page) {
  return page.getByTestId("app-header").locator("visible=true");
}

function headerTitle(page: Page) {
  return header(page).getByTestId("app-header-title");
}

function backButton(page: Page) {
  return header(page).getByRole("button", { name: "뒤로" });
}

async function openFolder(page: Page, folder: MockFolder) {
  await page.goto("/folders");
  await page.goto(`/folders/${folder.id}`);
  await expect(headerTitle(page)).toHaveText(`${folder.emoji} ${folder.name}`, {
    timeout: 15_000,
  });
}

/** Title box left edge, after checking it starts 8px after the back button. */
async function expectTitleAfterBack(page: Page, name: string) {
  const back = await boxOf(backButton(page));
  const title = await boxOf(headerTitle(page));
  expect(title.x - (back.x + back.width), `${name}: gap after the back button`).toBeCloseTo(8, 0);
  expect(await cssOf(headerTitle(page), "text-align"), `${name}: text-align`).toBe("left");
  return title.x;
}

/** The header action buttons right of the title (everything but 뒤로). */
function rightActions(page: Page): Locator {
  return header(page).getByTestId("app-header-right").getByRole("button");
}

test.describe("mobile folder detail header title", () => {
  test.beforeEach(() => {
    test.skip(isWideProject(), "the mobile header only");
  });

  test("starts 8px after the back button and stays put for personal, owner and member", async ({
    page,
  }) => {
    await setup(page);
    const lefts: number[] = [];
    const actionCounts: number[] = [];
    for (const folder of [MINE, OWNED_SHARED, MEMBER_SHARED]) {
      await openFolder(page, folder);
      // Wait for the role-dependent actions to settle before measuring.
      await expect(rightActions(page).first()).toBeVisible();
      lefts.push(await expectTitleAfterBack(page, folder.name));
      actionCounts.push(await rightActions(page).count());
    }

    // The three headers carry different action sets, yet the title's left edge is identical.
    expect(new Set(actionCounts).size, `action counts ${actionCounts}`).toBeGreaterThan(1);
    expect(Math.max(...lefts) - Math.min(...lefts)).toBeLessThan(0.5);
  });

  test("does not move when the role arrives and the actions appear", async ({ page }) => {
    let releaseProfile: () => void = () => {};
    const profileHeld = new Promise<void>((resolve) => {
      releaseProfile = resolve;
    });
    await setup(page, {
      "GET /api/users/me": async (route: Route) => {
        await profileHeld;
        await route.fulfill({
          contentType: "application/json",
          body: JSON.stringify(
            envelope({
              id: 1,
              username: "e2e",
              nickname: "테스터",
              role: "USER",
              avatarEmoji: "🌸",
              allowsPrivacy: true,
              allowsAiUsage: true,
            }),
          ),
        });
      },
    });

    await page.goto(`/folders/${OWNED_SHARED.id}`);
    await expect(headerTitle(page)).toHaveText(`${OWNED_SHARED.emoji} ${OWNED_SHARED.name}`, {
      timeout: 15_000,
    });
    // Role unknown: the shared folder's actions wait.
    await expect(header(page).getByRole("button", { name: "폴더 공유" })).toHaveCount(0);
    const before = await expectTitleAfterBack(page, "role loading");

    releaseProfile();
    await expect(header(page).getByRole("button", { name: "폴더 공유" })).toBeVisible();
    const after = await expectTitleAfterBack(page, "owner");
    expect(Math.abs(after - before)).toBeLessThan(0.5);
  });

  test("a long name truncates before the right actions", async ({ page }) => {
    await setup(page);
    await openFolder(page, LONG_NAME);
    await expect(header(page).getByRole("button", { name: "폴더 공유" })).toBeVisible();
    await expectTitleAfterBack(page, "long name");

    const title = headerTitle(page);
    const titleBox = await boxOf(title);
    const firstAction = await boxOf(rightActions(page).first());
    expect(titleBox.x + titleBox.width).toBeLessThanOrEqual(firstAction.x);
    expect(
      await title.evaluate((node) => node.scrollWidth > node.clientWidth),
      "title is clipped",
    ).toBe(true);
    expect(await cssOf(title, "text-overflow")).toBe("ellipsis");
  });
});

test.describe("other mobile headers keep the centered title", () => {
  test.beforeEach(() => {
    test.skip(isWideProject(), "the mobile header only");
  });

  test("link detail header has back and the toolbar, and no title (#74)", async ({ page }) => {
    await setup(page);
    await page.goto("/home");
    await page.goto("/links/1");
    await expect(page.getByTestId("link-detail-toolbar")).toBeVisible({ timeout: 15_000 });
    await expect(backButton(page)).toBeVisible();
    await expect(headerTitle(page)).toHaveCount(0);
  });

  test("notifications title stays centered", async ({ page }) => {
    await setup(page);
    await page.goto("/home");
    await page.goto("/notifications");
    await expect(headerTitle(page)).toBeVisible({ timeout: 15_000 });
    expect(await cssOf(headerTitle(page), "text-align")).toBe("center");
  });
});
