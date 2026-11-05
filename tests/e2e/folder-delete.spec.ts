import { type Locator, type Page, type Route, expect, test } from "@playwright/test";

import { FOLDER_API_ERROR_CODES } from "../../features/folders/lib/folder-api-errors";
import { isWideProject } from "./support/helpers";
import {
  type MockFolder,
  type MockFolderMembers,
  type MockLink,
  envelope,
  makeDetail,
  makeLink,
  mockApi,
} from "./support/mock-api";

const NOT_FOUND_TEXT = "폴더를 찾을 수 없어요";
const DELETE_TOAST = "폴더를 삭제했어요.";
const DELETE_FAILED = "폴더를 삭제하지 못했어요. 잠시 후 다시 시도해주세요.";

const READING: MockFolder = {
  id: 1,
  ownerId: 1,
  name: "읽을거리",
  emoji: "📚",
  isShared: false,
  shareCounts: 0,
  linkCounts: 2,
};
const TRIP: MockFolder = {
  id: 5,
  ownerId: 1,
  name: "주말 여행",
  emoji: "🧳",
  isShared: false,
  shareCounts: 0,
  linkCounts: 3,
};
const EMPTY: MockFolder = {
  id: 6,
  ownerId: 1,
  name: "빈 폴더",
  emoji: "🫙",
  isShared: false,
  shareCounts: 0,
  linkCounts: 0,
};
const LEGACY: MockFolder = {
  id: 7,
  ownerId: 1,
  name: "예전 공유",
  emoji: "🗃️",
  isShared: false,
  shareCounts: 1,
  linkCounts: 3,
  myLinkCounts: 2,
};
const OTHERS_ONLY: MockFolder = {
  id: 8,
  ownerId: 1,
  name: "남은 링크",
  emoji: "📦",
  isShared: false,
  shareCounts: 1,
  linkCounts: 2,
  myLinkCounts: 0,
};
const MEMBER_FOLDER: MockFolder = {
  id: 9,
  ownerId: 2,
  name: "캠핑 모임",
  emoji: "🏕️",
  isShared: true,
  shareCounts: 3,
  linkCounts: 0,
};
const TEAM: MockFolder = {
  id: 10,
  ownerId: 1,
  name: "팀 자료",
  emoji: "🧭",
  isShared: true,
  shareCounts: 3,
  linkCounts: 4,
  myLinkCounts: 1,
};
const ALONE: MockFolder = {
  id: 11,
  ownerId: 1,
  name: "혼자 공유",
  emoji: "🎒",
  isShared: true,
  shareCounts: 1,
  linkCounts: 2,
};
const ALONE_EMPTY: MockFolder = {
  id: 12,
  ownerId: 1,
  name: "혼자 빈 공유",
  emoji: "🪺",
  isShared: true,
  shareCounts: 1,
  linkCounts: 0,
};

const FOLDERS = [
  READING,
  TRIP,
  EMPTY,
  LEGACY,
  OTHERS_ONLY,
  MEMBER_FOLDER,
  TEAM,
  ALONE,
  ALONE_EMPTY,
];

function linksIn(folder: MockFolder, ids: number[], ownerId = 1): MockLink[] {
  return ids.map((id) =>
    makeLink({
      id,
      title: `${folder.name} 링크 ${id}`,
      folderId: folder.id,
      folderName: folder.name,
      folderEmoji: folder.emoji,
      ownerId,
    }),
  );
}

const LINKS: MockLink[] = [
  ...linksIn(READING, [11, 12]),
  ...linksIn(TRIP, [101, 102, 103]),
  ...linksIn(LEGACY, [201, 202]),
  ...linksIn(LEGACY, [203], 2),
  ...linksIn(OTHERS_ONLY, [301, 302], 2),
  ...linksIn(TEAM, [401]),
  ...linksIn(TEAM, [402, 403, 404], 3),
  ...linksIn(ALONE, [501, 502]),
];

const MEMBERS: Record<number, MockFolderMembers> = {
  [TEAM.id]: {
    ownerId: 1,
    ownerNickname: "테스터",
    members: [
      { userId: 1, role: "OWNER", userNickname: "테스터", avatarEmoji: "🌸" },
      { userId: 3, role: "MEMBER", userNickname: "도윤", avatarEmoji: "🐻" },
      { userId: 4, role: "MEMBER", userNickname: "서연", avatarEmoji: "🦊" },
    ],
  },
  [ALONE.id]: {
    ownerId: 1,
    ownerNickname: "테스터",
    members: [{ userId: 1, role: "OWNER", userNickname: "테스터" }],
  },
  [ALONE_EMPTY.id]: { ownerId: 1, ownerNickname: "테스터", members: [] },
  [MEMBER_FOLDER.id]: {
    ownerId: 2,
    ownerNickname: "지민",
    members: [
      { userId: 2, role: "OWNER", userNickname: "지민" },
      { userId: 1, role: "MEMBER", userNickname: "테스터" },
    ],
  },
};

type Handlers = NonNullable<Parameters<typeof mockApi>[1]>["handlers"];

async function setup(page: Page, handlers?: Handlers, extraFolders: MockFolder[] = []) {
  // Records whether the folder's not-found screen ever rendered, even for a frame.
  await page.addInitScript((text) => {
    const flag = window as unknown as { __sawNotFound?: boolean };
    new MutationObserver(() => {
      if (document.body?.innerText.includes(text)) flag.__sawNotFound = true;
    }).observe(document, { childList: true, subtree: true, characterData: true });
  }, NOT_FOUND_TEXT);
  return mockApi(page, {
    folders: [...FOLDERS, ...extraFolders].map((folder) => ({ ...folder })),
    links: LINKS.map((link) => ({ ...link })),
    details: Object.fromEntries(LINKS.map((link) => [link.id, makeDetail(link)])),
    folderMembers: structuredClone(MEMBERS),
    handlers,
  });
}

async function sawNotFound(page: Page) {
  return page.evaluate(() => Boolean((window as { __sawNotFound?: boolean }).__sawNotFound));
}

async function openFolder(page: Page, folder: MockFolder) {
  await page.goto(`/folders/${folder.id}`);
  await expect(page.getByText(`${folder.emoji} ${folder.name}`).first()).toBeVisible({
    timeout: 15_000,
  });
}

/** The flow's surface: the wide Dialog, or the page for the mobile Sheet. */
function flow(page: Page, title: string): Locator | Page {
  return isWideProject() ? page.getByRole("dialog", { name: title }) : page;
}

/** The header divider on screen (mobile also mounts the hidden list header's copy). */
function visibleDivider(page: Page) {
  return page.getByTestId("folder-header-divider").locator("visible=true");
}

/** The picker's 취소: on mobile its sheet is stacked last over the confirm sheet. */
function pickerCancel(page: Page) {
  return isWideProject()
    ? page
        .getByRole("dialog", { name: "폴더 이동" })
        .getByRole("button", { name: "취소", exact: true })
    : page.getByRole("button", { name: "취소", exact: true }).last();
}

function cta(page: Page) {
  return page.getByTestId("folder-removal-cta");
}

function nameInput(page: Page) {
  return page.getByTestId("folder-delete-name-input");
}

function deleteRequests(state: Awaited<ReturnType<typeof setup>>, id: number) {
  return state.requests.filter(
    (request) => request.method === "DELETE" && request.path === `/api/folders/${id}`,
  );
}

async function openPersonalDelete(page: Page, folder: MockFolder) {
  await openFolder(page, folder);
  await page.getByRole("button", { name: "폴더 삭제", exact: true }).click();
  const scope = flow(page, "폴더를 삭제할까요?");
  await expect(scope.getByText("폴더를 삭제할까요?")).toBeVisible();
  return scope;
}

async function expectFinishedAt(page: Page) {
  await expect(page).toHaveURL(isWideProject() ? /\/home$/ : /\/folders$/);
}

async function expandSection(scope: Locator | Page, label: "내 폴더" | "공유 폴더") {
  const toggle = scope.getByRole("button", { name: new RegExp(`^${label} (접기|펼치기)$`) });
  await expect(toggle.first()).toBeVisible();
  if ((await toggle.first().getAttribute("aria-label"))?.endsWith("펼치기")) {
    await toggle.first().click();
  }
}

async function settle(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(() => document.getAnimations().filter((a) => a.playState === "running").length),
    )
    .toBe(0);
}

function failWith(code: string | undefined, status: number, message?: string) {
  return (route: Route) =>
    route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify({ success: false, data: null, error: { code, message } }),
    });
}

test.describe("folder header actions", () => {
  test("a personal folder shows edit, a divider and a red delete; 미분류 has no actions", async ({
    page,
  }) => {
    await setup(page);
    await openFolder(page, TRIP);

    const edit = page.getByRole("button", { name: "폴더 수정", exact: true });
    const remove = page.getByRole("button", { name: "폴더 삭제", exact: true });
    await expect(edit).toBeVisible();
    await expect(remove).toBeVisible();
    await expect(visibleDivider(page)).toBeVisible();
    await expect(page.getByRole("button", { name: "공유 폴더 나가기" })).toHaveCount(0);
    await expect(remove.locator("svg")).toHaveAttribute("stroke", "hsl(0 74% 42%)");

    const editBox = await edit.boundingBox();
    const dividerBox = await visibleDivider(page).boundingBox();
    const removeBox = await remove.boundingBox();
    expect(editBox && dividerBox && removeBox).toBeTruthy();
    expect(dividerBox!.x).toBeGreaterThan(editBox!.x + editBox!.width);
    expect(removeBox!.x).toBeGreaterThan(dividerBox!.x);
    expect(removeBox!.width).toBe(36);

    // The restyled edit button still opens the editor.
    await edit.click();
    await expect(page.getByPlaceholder("예: 디자인 레퍼런스")).toHaveValue(TRIP.name);
    await page.keyboard.press("Escape");

    await page.goto("/folders/0");
    await expect(page.getByText("미분류").first()).toBeVisible();
    await expect(page.getByRole("button", { name: /폴더 (수정|삭제|공유)/ })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "공유 폴더 나가기" })).toHaveCount(0);
  });

  test("a shared folder owner sees edit, share and 공유 폴더 삭제 but no leave", async ({
    page,
  }) => {
    await setup(page);
    await openFolder(page, TEAM);

    await expect(page.getByRole("button", { name: "폴더 수정", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "폴더 공유", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "공유 폴더 삭제", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "공유 폴더 나가기" })).toHaveCount(0);

    // The owner's own row in the share dialog has no leave or remove button.
    await page.getByRole("button", { name: "폴더 공유", exact: true }).click();
    await expect(page.getByText("도윤")).toBeVisible();
    await expect(page.getByRole("button", { name: "테스터 멤버 제외" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "도윤 멤버 제외" })).toBeVisible();
  });

  test("a shared folder member sees only the red leave icon", async ({ page }) => {
    await setup(page);
    await openFolder(page, MEMBER_FOLDER);

    const leave = page.getByRole("button", { name: "공유 폴더 나가기", exact: true });
    await expect(leave).toBeVisible();
    await expect(leave.locator("svg")).toHaveAttribute("stroke", "hsl(0 74% 42%)");
    await expect(
      page.getByRole("button", { name: /^(폴더 수정|폴더 공유|공유 폴더 삭제)$/ }),
    ).toHaveCount(0);
    await expect(visibleDivider(page)).toHaveCount(0);
  });

  test("while my profile loads, a shared folder header shows no action at all", async ({
    page,
  }) => {
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    await setup(page, {
      "GET /api/users/me": async (route) => {
        await gate;
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(
            envelope({ id: 1, username: "e2e", nickname: "테스터", role: "USER" }),
          ),
        });
      },
    });
    // Watch for the action ever appearing before the profile arrives.
    await page.addInitScript(() => {
      new MutationObserver(() => {
        if (
          document.querySelector('[aria-label="공유 폴더 나가기"],[aria-label="공유 폴더 삭제"]')
        ) {
          (window as { __sawAction?: boolean }).__sawAction = true;
        }
      }).observe(document, { childList: true, subtree: true });
    });

    await openFolder(page, MEMBER_FOLDER);
    await page.waitForTimeout(500);
    expect(
      await page.evaluate(() => Boolean((window as { __sawAction?: boolean }).__sawAction)),
    ).toBe(false);

    release();
    await expect(page.getByRole("button", { name: "공유 폴더 나가기", exact: true })).toBeVisible();
  });

  test("when my profile fails, a shared folder shows no action but a personal folder does", async ({
    page,
  }) => {
    await setup(page, { "GET /api/users/me": failWith("COM_500_0001", 500) });

    await openFolder(page, TEAM);
    await page.waitForTimeout(500);
    await expect(
      page.getByRole("button", {
        name: /^(폴더 수정|폴더 공유|폴더 삭제|공유 폴더 삭제|공유 폴더 나가기)$/,
      }),
    ).toHaveCount(0);

    await openFolder(page, TRIP);
    await expect(page.getByRole("button", { name: "폴더 삭제", exact: true })).toBeVisible();
  });
});

test.describe("personal folder delete", () => {
  test("opens with 다른 폴더로 옮기기 and 🗂️ 미분류, and deleting moves the links to 미분류", async ({
    page,
  }) => {
    const state = await setup(page);
    const scope = await openPersonalDelete(page, TRIP);

    await expect(scope.getByText("링크 3개를 어떻게 할지 골라주세요.")).toBeVisible();
    await expect(scope.getByRole("radio", { name: "다른 폴더로 옮기기" })).toBeChecked();
    await expect(scope.getByRole("radio", { name: "링크도 함께 삭제" })).not.toBeChecked();
    await expect(scope.getByRole("button", { name: "옮길 폴더 선택, 현재 미분류" })).toBeVisible();
    await expect(nameInput(page)).toHaveCount(0);

    await cta(page).click();

    await expectFinishedAt(page);
    await expect(page.getByText(DELETE_TOAST)).toBeVisible();
    expect(deleteRequests(state, TRIP.id).map((request) => request.search)).toEqual([""]);
    expect(
      state.links.filter((link) => [101, 102, 103].includes(link.id)).map((l) => l.folderId),
    ).toEqual([null, null, null]);
    expect(await sawNotFound(page)).toBe(false);

    // The folder is gone from the folder list the app shows.
    await expandSection(page, "내 폴더");
    await expect(
      page.getByText("📚 읽을거리").or(page.getByText("읽을거리")).first(),
    ).toBeVisible();
    await expect(page.getByText("주말 여행", { exact: true })).toHaveCount(0);
    await page.goBack();
    await expect(page).not.toHaveURL(new RegExp(`/folders/${TRIP.id}$`));

    // Its address now shows the not-found screen.
    await page.goto(`/folders/${TRIP.id}`);
    await expect(page.getByText(NOT_FOUND_TEXT).first()).toBeVisible({ timeout: 15_000 });
  });

  test("the picker opens over the confirm without the folder, and 확인/취소 set the target", async ({
    page,
  }) => {
    const state = await setup(page);
    await openPersonalDelete(page, TRIP);

    await page.getByRole("button", { name: "옮길 폴더 선택, 현재 미분류" }).click();
    const picker = isWideProject() ? page.getByRole("dialog", { name: "폴더 이동" }) : page;
    await expect(picker.getByText("이동할 폴더를 선택해주세요.")).toBeVisible();
    await expandSection(picker, "내 폴더");
    await expect(picker.getByRole("radio", { name: "📚 읽을거리", exact: true })).toBeVisible();
    await expect(picker.getByRole("radio", { name: "🧳 주말 여행", exact: true })).toHaveCount(0);

    await picker.getByRole("radio", { name: "📚 읽을거리", exact: true }).click();
    await picker.getByRole("button", { name: "확인", exact: true }).click();
    await expect(page.getByRole("button", { name: "옮길 폴더 선택, 현재 읽을거리" })).toBeVisible();

    // 취소 keeps the folder picked before.
    await page.getByRole("button", { name: "옮길 폴더 선택, 현재 읽을거리" }).click();
    await expect(picker.getByText("이동할 폴더를 선택해주세요.")).toBeVisible();
    await picker.getByRole("radio", { name: "미분류", exact: true }).click();
    await pickerCancel(page).click();
    await expect(page.getByText("이동할 폴더를 선택해주세요.")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "옮길 폴더 선택, 현재 읽을거리" })).toBeVisible();
    expect(deleteRequests(state, TRIP.id)).toHaveLength(0);

    await cta(page).click();
    await expectFinishedAt(page);
    expect(deleteRequests(state, TRIP.id).map((request) => request.search)).toEqual([
      `?onDelete=move&targetFolderId=${READING.id}`,
    ]);
    expect(state.folders.find((folder) => folder.id === READING.id)?.linkCounts).toBe(5);
  });

  test("a shared folder can be the target, and the links go there", async ({ page }) => {
    const state = await setup(page);
    await openPersonalDelete(page, TRIP);

    await page.getByRole("button", { name: "옮길 폴더 선택, 현재 미분류" }).click();
    const picker = isWideProject() ? page.getByRole("dialog", { name: "폴더 이동" }) : page;
    await expandSection(picker, "공유 폴더");
    await picker.getByRole("radio", { name: "🧭 팀 자료", exact: true }).click();
    await picker.getByRole("button", { name: "확인", exact: true }).click();
    await cta(page).click();

    await expectFinishedAt(page);
    expect(deleteRequests(state, TRIP.id).map((request) => request.search)).toEqual([
      `?onDelete=move&targetFolderId=${TEAM.id}`,
    ]);
    expect(state.links.filter((link) => link.folderId === TEAM.id).map((link) => link.id)).toEqual(
      expect.arrayContaining([101, 102, 103]),
    );
  });

  test("링크도 함께 삭제 needs the exact name; the typed name survives switching", async ({
    page,
  }) => {
    const state = await setup(page);
    const scope = await openPersonalDelete(page, TRIP);

    await scope.getByRole("radio", { name: "링크도 함께 삭제" }).click();
    await expect(scope.getByText("삭제하려면 폴더 이름을 입력해주세요.")).toBeVisible();
    await expect(nameInput(page)).toHaveAttribute("placeholder", TRIP.name);
    await expect(page.getByRole("button", { name: /옮길 폴더 선택/ })).toHaveCount(0);
    await expect(cta(page)).toBeDisabled();

    await nameInput(page).fill("주말 여");
    await expect(cta(page)).toBeDisabled();
    await nameInput(page).fill("주말 여행!");
    await expect(cta(page)).toBeDisabled();
    await nameInput(page).fill("  주말 여행  ");
    await expect(cta(page)).toBeEnabled();

    await scope.getByRole("radio", { name: "다른 폴더로 옮기기" }).click();
    await expect(nameInput(page)).toHaveCount(0);
    await scope.getByRole("radio", { name: "링크도 함께 삭제" }).click();
    await expect(nameInput(page)).toHaveValue("  주말 여행  ");

    await cta(page).click();
    await expectFinishedAt(page);
    await expect(page.getByText(DELETE_TOAST)).toBeVisible();
    expect(deleteRequests(state, TRIP.id).map((request) => request.search)).toEqual([
      "?onDelete=cascade",
    ]);
    expect(state.links.some((link) => [101, 102, 103].includes(link.id))).toBe(false);
  });

  test("the name check is case-sensitive and accepts a pasted NFD Hangul name", async ({
    page,
  }) => {
    const folder: MockFolder = {
      ...READING,
      id: 21,
      name: "Reading 한글",
      emoji: "📗",
      linkCounts: 1,
      myLinkCounts: 1,
    };
    await setup(page, undefined, [folder]);
    await openPersonalDelete(page, folder);

    await page.getByRole("radio", { name: "링크도 함께 삭제" }).click();
    await nameInput(page).fill("reading 한글");
    await expect(cta(page)).toBeDisabled();
    await nameInput(page).fill("Reading 한글".normalize("NFD"));
    await expect(cta(page)).toBeEnabled();
  });

  test("an empty folder shows only the empty notice and deletes", async ({ page }) => {
    const state = await setup(page);
    const scope = await openPersonalDelete(page, EMPTY);

    await expect(scope.getByText("빈 폴더예요. 삭제해도 옮겨지는 링크가 없어요.")).toBeVisible();
    await expect(page.getByRole("radio")).toHaveCount(0);
    await expect(nameInput(page)).toHaveCount(0);

    await cta(page).click();
    await expectFinishedAt(page);
    expect(deleteRequests(state, EMPTY.id).map((request) => request.search)).toEqual([""]);
  });

  test("a once-shared folder counts my links and shows other users' links on one line", async ({
    page,
  }) => {
    const state = await setup(page);
    const scope = await openPersonalDelete(page, LEGACY);

    await expect(scope.getByText("링크 2개를 어떻게 할지 골라주세요.")).toBeVisible();
    await expect(scope.getByText("링크 2개를 고른 폴더로 옮겨요.")).toBeVisible();
    await expect(
      scope.getByText("다른 사람이 넣은 링크 1개는 그 사람의 미분류로 옮겨져요."),
    ).toBeVisible();
    await scope.getByRole("radio", { name: "링크도 함께 삭제" }).click();
    await expect(
      scope.getByText("링크 2개와 링크에 단 액션이 함께 삭제되고 되돌릴 수 없어요."),
    ).toBeVisible();
    await expect(
      scope.getByText("다른 사람이 넣은 링크 1개는 그 사람의 미분류로 옮겨져요."),
    ).toBeVisible();

    await nameInput(page).fill(LEGACY.name);
    await cta(page).click();
    await expectFinishedAt(page);
    // The mock applies #165: only my links are deleted; the other user's goes to their 미분류.
    expect(state.links.find((link) => link.id === 203)?.folderId).toBeNull();
    expect(state.links.some((link) => link.id === 201 || link.id === 202)).toBe(false);
  });

  test("a folder with only other users' links shows that line and no choice", async ({ page }) => {
    const state = await setup(page);
    const scope = await openPersonalDelete(page, OTHERS_ONLY);

    await expect(
      scope.getByText("다른 사람이 넣은 링크 2개는 그 사람의 미분류로 옮겨져요."),
    ).toBeVisible();
    await expect(page.getByRole("radio")).toHaveCount(0);
    await expect(nameInput(page)).toHaveCount(0);
    await cta(page).click();
    await expectFinishedAt(page);
    expect(deleteRequests(state, OTHERS_ONLY.id).map((request) => request.search)).toEqual([""]);
  });

  test("counts are refetched when the confirm opens", async ({ page }) => {
    const state = await setup(page);
    await openFolder(page, TRIP);
    // Another device adds a link to the folder.
    state.links.push(...linksIn(TRIP, [104]));
    state.folders = state.folders.map((folder) =>
      folder.id === TRIP.id ? { ...folder, linkCounts: 4 } : folder,
    );

    await page.getByRole("button", { name: "폴더 삭제", exact: true }).click();
    await expect(page.getByText("링크 4개를 어떻게 할지 골라주세요.")).toBeVisible();
  });

  test("closing and reopening starts over; cancel changes nothing", async ({ page }) => {
    const state = await setup(page);
    await openPersonalDelete(page, TRIP);

    await page.getByRole("radio", { name: "링크도 함께 삭제" }).click();
    await nameInput(page).fill("주말");
    await page.getByRole("button", { name: "취소", exact: true }).click();
    await expect(page.getByText("폴더를 삭제할까요?")).toHaveCount(0);

    await page.getByRole("button", { name: "폴더 삭제", exact: true }).click();
    await expect(page.getByRole("radio", { name: "다른 폴더로 옮기기" })).toBeChecked();
    await expect(page.getByRole("button", { name: "옮길 폴더 선택, 현재 미분류" })).toBeVisible();
    await page.getByRole("radio", { name: "링크도 함께 삭제" }).click();
    await expect(nameInput(page)).toHaveValue("");

    if (isWideProject()) {
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog")).toHaveCount(0);
    } else {
      await page.getByRole("button", { name: "닫기", exact: true }).click();
      await expect(page.getByText("폴더를 삭제할까요?")).toHaveCount(0);
    }
    expect(deleteRequests(state, TRIP.id)).toHaveLength(0);
    expect(state.folders.some((folder) => folder.id === TRIP.id)).toBe(true);
  });

  test("keyboard: focus stays in the dialog, arrows move the link choice", async ({ page }) => {
    test.skip(!isWideProject(), "wide dialog keyboard");
    await setup(page);
    const scope = await openPersonalDelete(page, TRIP);

    await scope.getByRole("radio", { name: "다른 폴더로 옮기기" }).focus();
    await page.keyboard.press("ArrowDown");
    await expect(scope.getByRole("radio", { name: "링크도 함께 삭제" })).toBeChecked();
    for (let i = 0; i < 12; i += 1) {
      await page.keyboard.press("Tab");
      const inside = await page
        .getByRole("dialog", { name: "폴더를 삭제할까요?" })
        .evaluate((node) => node.contains(document.activeElement));
      expect(inside).toBe(true);
    }

    // The picker list moves with the arrow keys too.
    await scope.getByRole("radio", { name: "다른 폴더로 옮기기" }).click();
    await page.getByRole("button", { name: "옮길 폴더 선택, 현재 미분류" }).click();
    const picker = page.getByRole("dialog", { name: "폴더 이동" });
    await expandSection(picker, "내 폴더");
    await picker.getByRole("radio", { name: "미분류", exact: true }).focus();
    await page.keyboard.press("ArrowDown");
    await expect(picker.getByRole("radio", { name: "📚 읽을거리", exact: true })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    await expect(picker.getByRole("radio", { name: "📚 읽을거리", exact: true })).toBeFocused();
    await page.keyboard.press("ArrowUp");
    await expect(picker.getByRole("radio", { name: "미분류", exact: true })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });

  test("769px opens a centered dialog and 768px a sheet", async ({ page }) => {
    test.skip(!isWideProject(), "resizes a desktop viewport");
    await setup(page);

    await page.setViewportSize({ width: 769, height: 800 });
    await openPersonalDelete(page, TRIP);
    await expect(page.getByRole("dialog", { name: "폴더를 삭제할까요?" })).toBeVisible();
    await page.keyboard.press("Escape");

    await page.setViewportSize({ width: 768, height: 800 });
    await openFolder(page, TRIP);
    await page.getByRole("button", { name: "폴더 삭제", exact: true }).click();
    await expect(page.getByText("폴더를 삭제할까요?")).toBeVisible();
    await expect(page.getByRole("dialog", { name: "폴더를 삭제할까요?" })).toHaveCount(0);
  });

  test("while deleting, everything but the spinner is blocked and a double press sends once", async ({
    page,
  }) => {
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const state = await setup(page, {
      [`DELETE /api/folders/${TRIP.id}`]: async (route) => {
        await gate;
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(envelope(null)),
        });
      },
    });
    await openPersonalDelete(page, TRIP);

    await cta(page).dblclick();
    await cta(page).click({ force: true });
    await expect(cta(page)).toHaveAttribute("aria-busy", "true");
    await expect(page.getByRole("button", { name: "취소", exact: true })).toBeDisabled();
    await page.getByRole("radio", { name: "링크도 함께 삭제" }).click({ force: true });
    await expect(page.getByRole("radio", { name: "다른 폴더로 옮기기" })).toBeChecked();
    if (isWideProject()) {
      await page.keyboard.press("Escape");
      await page.mouse.click(5, 5);
      await expect(page.getByRole("dialog", { name: "폴더를 삭제할까요?" })).toBeVisible();
    }

    release();
    await expectFinishedAt(page);
    await expect(page.getByText(DELETE_TOAST)).toHaveCount(1);
    expect(deleteRequests(state, TRIP.id)).toHaveLength(1);
  });

  test("a failure keeps the confirm with the message, and the same button retries", async ({
    page,
  }) => {
    let mode: "fail" | "abort" | "pass" = "fail";
    const state = await setup(page, {
      [`DELETE /api/folders/${TRIP.id}`]: async (route) => {
        if (mode === "fail") return failWith("COM_500_0001", 500)(route);
        if (mode === "abort") return route.abort("internetdisconnected");
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(envelope(null)),
        });
      },
    });
    await openPersonalDelete(page, TRIP);

    await cta(page).click();
    await expect(page.getByText(DELETE_FAILED)).toBeVisible();
    await expect(page.getByText("폴더를 삭제할까요?")).toBeVisible();

    mode = "abort";
    await cta(page).click();
    await expect(page.getByText(DELETE_FAILED)).toBeVisible();
    await expect(cta(page)).toBeEnabled();

    mode = "pass";
    await cta(page).click();
    await expectFinishedAt(page);
    await expect(page.getByText(DELETE_TOAST)).toBeVisible();
    expect(deleteRequests(state, TRIP.id)).toHaveLength(3);
  });

  test("a vanished target keeps delete off on (a) until another target is picked", async ({
    page,
  }) => {
    let code: string = FOLDER_API_ERROR_CODES.deleteTargetNotFound;
    let fail = true;
    const state = await setup(page, {
      [`DELETE /api/folders/${TRIP.id}`]: async (route) => {
        if (fail) return failWith(code, code.includes("403") ? 403 : 404, "x")(route);
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(envelope(null)),
        });
      },
    });
    const picker = isWideProject() ? page.getByRole("dialog", { name: "폴더 이동" }) : page;
    const pickTarget = async (current: string, next: string) => {
      await page.getByRole("button", { name: `옮길 폴더 선택, 현재 ${current}` }).click();
      await expect(picker.getByText("이동할 폴더를 선택해주세요.")).toBeVisible();
      if (next !== "미분류") await expandSection(picker, "내 폴더");
      await picker.getByRole("radio", { name: next, exact: true }).click();
      await picker.getByRole("button", { name: "확인", exact: true }).click();
      await expect(page.getByText("이동할 폴더를 선택해주세요.")).toHaveCount(0);
    };
    const notFound = page.getByText("옮길 폴더를 찾을 수 없어요. 다른 폴더를 골라주세요.");
    const denied = page.getByText("이 폴더로는 옮길 수 없어요. 다른 폴더를 골라주세요.");

    await openPersonalDelete(page, TRIP);
    await pickTarget("미분류", "📚 읽을거리");
    await cta(page).click();
    await expect(notFound).toBeVisible();
    await expect(cta(page)).toBeDisabled();

    // (b) hides the notice and follows the name rule.
    await page.getByRole("radio", { name: "링크도 함께 삭제" }).click();
    await expect(notFound).toHaveCount(0);
    await expect(cta(page)).toBeDisabled();
    await nameInput(page).fill(TRIP.name);
    await expect(cta(page)).toBeEnabled();

    // Back on (a) the vanished target still blocks delete; only a new pick clears it.
    await page.getByRole("radio", { name: "다른 폴더로 옮기기" }).click();
    await expect(notFound).toBeVisible();
    await expect(cta(page)).toBeDisabled();
    await pickTarget("읽을거리", "미분류");
    await expect(notFound).toHaveCount(0);
    await expect(cta(page)).toBeEnabled();

    code = FOLDER_API_ERROR_CODES.deleteTargetAccessDenied;
    await pickTarget("미분류", "📚 읽을거리");
    await cta(page).click();
    await expect(denied).toBeVisible();
    await expect(cta(page)).toBeDisabled();

    await pickTarget("읽을거리", "미분류");
    await expect(denied).toHaveCount(0);
    fail = false;
    await cta(page).click();
    await expectFinishedAt(page);
    expect(deleteRequests(state, TRIP.id).map((request) => request.search)).toEqual([
      `?onDelete=move&targetFolderId=${READING.id}`,
      `?onDelete=move&targetFolderId=${READING.id}`,
      "",
    ]);
  });

  test("a confirm-only delete sends no target even after one was picked earlier", async ({
    page,
  }) => {
    let failOnce = true;
    const state = await setup(page, {
      [`DELETE /api/folders/${TRIP.id}`]: async (route) => {
        if (failOnce) {
          failOnce = false;
          // Meanwhile my links in the folder were all moved elsewhere.
          state.folders = state.folders.map((folder) =>
            folder.id === TRIP.id ? { ...folder, linkCounts: 1, myLinkCounts: 0 } : folder,
          );
          return failWith(FOLDER_API_ERROR_CODES.deleteTargetNotFound, 404, "x")(route);
        }
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(envelope(null)),
        });
      },
    });
    await openPersonalDelete(page, TRIP);
    await page.getByRole("button", { name: "옮길 폴더 선택, 현재 미분류" }).click();
    const picker = isWideProject() ? page.getByRole("dialog", { name: "폴더 이동" }) : page;
    await expandSection(picker, "내 폴더");
    await picker.getByRole("radio", { name: "📚 읽을거리", exact: true }).click();
    await picker.getByRole("button", { name: "확인", exact: true }).click();
    await cta(page).click();

    // The refetched counts turn the confirm into the others-only notice with no choice.
    await expect(
      page.getByText("다른 사람이 넣은 링크 1개는 그 사람의 미분류로 옮겨져요."),
    ).toBeVisible();
    await expect(page.getByRole("radio")).toHaveCount(0);
    await expect(cta(page)).toBeEnabled();
    await cta(page).click();

    await expectFinishedAt(page);
    expect(deleteRequests(state, TRIP.id).map((request) => request.search)).toEqual([
      `?onDelete=move&targetFolderId=${READING.id}`,
      "",
    ]);
  });

  test("a folder another device already deleted ends as deleted", async ({ page }) => {
    const state = await setup(page);
    await openPersonalDelete(page, EMPTY);
    state.folders = state.folders.filter((folder) => folder.id !== EMPTY.id);

    await cta(page).click();
    await expectFinishedAt(page);
    await expect(page.getByText(DELETE_TOAST)).toBeVisible();
    expect(await sawNotFound(page)).toBe(false);
  });

  test("a permission change ends quietly when the folder left my list", async ({ page }) => {
    const state = await setup(page, {
      [`DELETE /api/folders/${TRIP.id}`]: failWith(FOLDER_API_ERROR_CODES.differentOwner, 403),
    });
    await openPersonalDelete(page, TRIP);
    state.folders = state.folders.filter((folder) => folder.id !== TRIP.id);

    await cta(page).click();
    await expectFinishedAt(page);
    await page.waitForTimeout(300);
    await expect(page.getByText(DELETE_TOAST)).toHaveCount(0);
  });

  test("a permission change with the folder still listed stays and updates the header", async ({
    page,
  }) => {
    const state = await setup(page);
    await openFolder(page, TEAM);
    await page.getByRole("button", { name: "공유 폴더 삭제", exact: true }).click();
    await page.getByRole("button", { name: "폴더 삭제", exact: true }).click();
    // Another device handed the folder to 도윤.
    state.folders = state.folders.map((folder) =>
      folder.id === TEAM.id ? { ...folder, ownerId: 3 } : folder,
    );
    await nameInput(page).fill(TEAM.name);
    await cta(page).click();

    await expect(page.getByText("폴더 권한이 바뀌었어요. 다시 확인해주세요.")).toBeVisible();
    await page.getByRole("button", { name: "취소", exact: true }).click();
    await expect(page.getByRole("button", { name: "공유 폴더 나가기", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "공유 폴더 삭제", exact: true })).toHaveCount(0);
  });

  test("a link detail panel open inside the folder closes with the delete", async ({ page }) => {
    test.skip(!isWideProject(), "wide detail panel");
    await setup(page);
    await page.goto(`/folders/${TRIP.id}?linkId=101`);
    await expect(page.getByTestId("link-detail-title")).toBeVisible({ timeout: 15_000 });

    // The wide detail overlay covers the header, so the press is dispatched to the button.
    await page.getByRole("button", { name: "폴더 삭제", exact: true }).dispatchEvent("click");
    await cta(page).click();
    await expect(page).toHaveURL(/\/home$/);
    await expect(page.getByTestId("link-detail-title")).toHaveCount(0);
  });

  test("a folder made from the picker's + stays after the delete is cancelled", async ({
    page,
  }) => {
    const state = await setup(page);
    await openPersonalDelete(page, TRIP);
    await page.getByRole("button", { name: "옮길 폴더 선택, 현재 미분류" }).click();
    const picker = isWideProject() ? page.getByRole("dialog", { name: "폴더 이동" }) : page;
    await expect(picker.getByText("이동할 폴더를 선택해주세요.")).toBeVisible();
    await settle(page);
    await picker.getByRole("button", { name: "내 폴더에 폴더 추가" }).click();
    await page.getByPlaceholder("예: 디자인 레퍼런스").fill("새로 만든 폴더");
    await page.getByRole("button", { name: "저장", exact: true }).last().click();
    await expect(picker.getByRole("radio", { name: /새로 만든 폴더/ })).toBeVisible();
    await pickerCancel(page).click();
    await expect(page.getByText("이동할 폴더를 선택해주세요.")).toHaveCount(0);
    await page.getByRole("button", { name: "취소", exact: true }).click();
    await expect(page.getByText("폴더를 삭제할까요?")).toHaveCount(0);

    expect(state.folders.some((folder) => folder.name === "새로 만든 폴더")).toBe(true);
    expect(deleteRequests(state, TRIP.id)).toHaveLength(0);
  });
});

test.describe("shared folder delete", () => {
  test("loads members, offers 위임 above a red 폴더 삭제, and deletes after the name", async ({
    page,
  }) => {
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const state = await setup(page, {
      [`GET /api/folders/${TEAM.id}/members`]: async (route) => {
        await gate;
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(envelope(MEMBERS[TEAM.id])),
        });
      },
    });
    await openFolder(page, TEAM);
    await page.getByRole("button", { name: "공유 폴더 삭제", exact: true }).click();

    await expect(page.getByText("공유 폴더 삭제").last()).toBeVisible();
    await expect(page.getByLabel("멤버 목록을 불러오는 중")).toBeVisible();
    release();

    await expect(page.getByText("공유 폴더를 어떻게 할까요?")).toBeVisible();
    const transfer = await page.getByRole("button", { name: "위임", exact: true }).boundingBox();
    const remove = await page.getByRole("button", { name: "폴더 삭제", exact: true }).boundingBox();
    expect(transfer!.y).toBeLessThan(remove!.y);

    await page.getByRole("button", { name: "폴더 삭제", exact: true }).click();
    const scope = flow(page, "공유 폴더를 삭제할까요?");
    await expect(scope.getByText("삭제한 폴더는 되돌릴 수 없어요.")).toBeVisible();
    const facts = page.getByTestId("shared-folder-delete-facts");
    await expect(facts).toContainText("참여 인원 3명");
    await expect(facts).toContainText("링크 4개 · 각자 넣은 사람의 미분류로 이동");
    await expect(facts).toContainText("모든 멤버가 이 폴더를 더 볼 수 없어요");
    await expect(scope.getByRole("radio", { name: "각자의 미분류로 옮기기" })).toBeChecked();
    await expect(nameInput(page)).toBeVisible();
    await expect(cta(page)).toBeDisabled();

    await scope.getByRole("radio", { name: "링크도 모두 삭제" }).click();
    await expect(facts).toContainText("링크 4개 · 다른 멤버의 링크까지 모두 삭제");
    await expect(scope.getByText("다른 멤버가 넣은 링크까지 4개가 모두 삭제돼요.")).toBeVisible();

    await page.getByRole("button", { name: "이전 단계로" }).click();
    await expect(page.getByText("공유 폴더를 어떻게 할까요?")).toBeVisible();
    await page.getByRole("button", { name: "폴더 삭제", exact: true }).click();
    // The choice survives going back a step.
    await expect(page.getByRole("radio", { name: "링크도 모두 삭제" })).toBeChecked();
    await page.getByRole("radio", { name: "각자의 미분류로 옮기기" }).click();

    await nameInput(page).fill(TEAM.name);
    await expect(cta(page)).toBeEnabled();
    await cta(page).click();

    await expectFinishedAt(page);
    await expect(page.getByText(DELETE_TOAST)).toBeVisible();
    expect(deleteRequests(state, TEAM.id).map((request) => request.search)).toEqual([""]);
    expect(await sawNotFound(page)).toBe(false);
  });

  test("(b) on a shared folder cascades every link", async ({ page }) => {
    const state = await setup(page);
    await openFolder(page, TEAM);
    await page.getByRole("button", { name: "공유 폴더 삭제", exact: true }).click();
    await page.getByRole("button", { name: "폴더 삭제", exact: true }).click();
    await page.getByRole("radio", { name: "링크도 모두 삭제" }).click();
    await nameInput(page).fill(TEAM.name);
    await cta(page).click();

    await expectFinishedAt(page);
    expect(deleteRequests(state, TEAM.id).map((request) => request.search)).toEqual([
      "?onDelete=cascade",
    ]);
    expect(state.links.some((link) => link.folderId === TEAM.id)).toBe(false);
    expect(state.links.some((link) => [401, 402, 403, 404].includes(link.id))).toBe(false);
  });

  test("members that fail to load show the message and 닫기 only, and reopening refetches", async ({
    page,
  }) => {
    const state = await setup(page, {
      [`GET /api/folders/${TEAM.id}/members`]: failWith("COM_500_0001", 500),
    });
    await openFolder(page, TEAM);
    await page.getByRole("button", { name: "공유 폴더 삭제", exact: true }).click();

    await expect(page.getByText("공유 폴더 멤버를 불러오지 못했어요.")).toBeVisible({
      timeout: 15_000,
    });
    await expect(cta(page)).toHaveCount(0);
    await expect(page.getByRole("button", { name: "닫기", exact: true }).last()).toBeVisible();
    const membersRequests = () =>
      state.requests.filter((request) => request.path === `/api/folders/${TEAM.id}/members`).length;
    expect(membersRequests()).toBe(2);

    await page.getByRole("button", { name: "닫기", exact: true }).last().click();
    await expect(page.getByText("공유 폴더 멤버를 불러오지 못했어요.")).toHaveCount(0);
    await page.getByRole("button", { name: "공유 폴더 삭제", exact: true }).click();
    await expect(page.getByText("공유 폴더 멤버를 불러오지 못했어요.")).toBeVisible({
      timeout: 15_000,
    });
    expect(membersRequests()).toBe(4);
  });

  test("members cached by the share dialog do not hide a failed reload", async ({ page }) => {
    let failMembers = false;
    await setup(page, {
      [`GET /api/folders/${TEAM.id}/members`]: async (route) => {
        if (failMembers) return failWith("COM_500_0001", 500)(route);
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(envelope(MEMBERS[TEAM.id])),
        });
      },
    });
    await openFolder(page, TEAM);
    await page.getByRole("button", { name: "폴더 공유", exact: true }).click();
    await expect(page.getByText("도윤")).toBeVisible();
    await page.getByRole("button", { name: "닫기", exact: true }).last().click();
    await expect(page.getByText("도윤")).toHaveCount(0);

    failMembers = true;
    await page.getByRole("button", { name: "공유 폴더 삭제", exact: true }).click();
    await expect(page.getByText("공유 폴더 멤버를 불러오지 못했어요.")).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText("공유 폴더를 어떻게 할까요?")).toHaveCount(0);
    await expect(cta(page)).toHaveCount(0);
  });

  test("an owner-only shared folder with links skips the choice and has no summary", async ({
    page,
  }) => {
    const state = await setup(page);
    await openFolder(page, ALONE);
    await page.getByRole("button", { name: "공유 폴더 삭제", exact: true }).click();

    await expect(
      page.getByText("나만 있는 공유 폴더예요. 링크 2개는 각자 넣은 사람의 미분류로 이동해요."),
    ).toBeVisible();
    await expect(page.getByText("공유 폴더를 어떻게 할까요?")).toHaveCount(0);
    await expect(page.getByTestId("shared-folder-delete-facts")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "이전 단계로" })).toHaveCount(0);
    await expect(nameInput(page)).toBeVisible();

    await page.getByRole("radio", { name: "링크도 모두 삭제" }).click();
    await expect(
      page.getByText("나만 있는 공유 폴더예요. 링크 2개가 모두 삭제돼요."),
    ).toBeVisible();
    await page.getByRole("radio", { name: "각자의 미분류로 옮기기" }).click();
    await nameInput(page).fill(ALONE.name);
    await cta(page).click();
    await expectFinishedAt(page);
    expect(deleteRequests(state, ALONE.id).map((request) => request.search)).toEqual([""]);
  });

  test("an owner-only empty shared folder shows the notice only and deletes", async ({ page }) => {
    const state = await setup(page);
    await openFolder(page, ALONE_EMPTY);
    await page.getByRole("button", { name: "공유 폴더 삭제", exact: true }).click();

    await expect(
      page.getByText("나만 있는 빈 공유 폴더예요. 삭제해도 옮겨지는 링크가 없어요."),
    ).toBeVisible();
    await expect(page.getByRole("radio")).toHaveCount(0);
    await expect(nameInput(page)).toHaveCount(0);
    await cta(page).click();
    await expectFinishedAt(page);
    expect(deleteRequests(state, ALONE_EMPTY.id)).toHaveLength(1);
  });
});
