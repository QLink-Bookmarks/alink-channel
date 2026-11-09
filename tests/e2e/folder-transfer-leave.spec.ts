import { type Page, type Route, expect, test } from "@playwright/test";

import { FOLDER_API_ERROR_CODES } from "../../features/folders/lib/folder-api-errors";
import { isWideProject } from "./support/helpers";
import {
  type MockFolder,
  type MockFolderMembers,
  envelope,
  makeLink,
  mockApi,
} from "./support/mock-api";

const TEAM: MockFolder = {
  id: 10,
  ownerId: 1,
  name: "팀 자료",
  emoji: "🧭",
  isShared: true,
  shareCounts: 3,
  linkCounts: 2,
  myLinkCounts: 1,
};
const CAMP: MockFolder = {
  id: 9,
  ownerId: 2,
  name: "캠핑 모임",
  emoji: "🏕️",
  isShared: true,
  shareCounts: 3,
  linkCounts: 1,
  myLinkCounts: 1,
};

const TEAM_MEMBERS: MockFolderMembers = {
  ownerId: 1,
  ownerNickname: "테스터",
  members: [
    { userId: 1, role: "OWNER", userNickname: "테스터", avatarEmoji: "🌸" },
    { userId: 3, role: "MEMBER", userNickname: "도윤", avatarEmoji: "🐻" },
    { userId: 4, role: "MEMBER", userNickname: "서연", avatarEmoji: "🦊" },
  ],
};
const CAMP_MEMBERS: MockFolderMembers = {
  ownerId: 2,
  ownerNickname: "지민",
  members: [
    { userId: 2, role: "OWNER", userNickname: "지민" },
    { userId: 1, role: "MEMBER", userNickname: "테스터" },
    { userId: 3, role: "MEMBER", userNickname: "도윤" },
  ],
};

type Handlers = NonNullable<Parameters<typeof mockApi>[1]>["handlers"];

async function setup(page: Page, handlers?: Handlers) {
  // Records whether the folder's not-found screen ever rendered, even for a frame.
  await page.addInitScript(() => {
    const flag = window as unknown as { __sawNotFound?: boolean };
    new MutationObserver(() => {
      if (document.body?.innerText.includes("폴더를 찾을 수 없어요")) flag.__sawNotFound = true;
    }).observe(document, { childList: true, subtree: true, characterData: true });
  });
  return mockApi(page, {
    folders: [
      {
        id: 1,
        ownerId: 1,
        name: "읽을거리",
        emoji: "📚",
        isShared: false,
        shareCounts: 0,
        linkCounts: 0,
      },
      { ...TEAM },
      { ...CAMP },
    ],
    links: [
      makeLink({ id: 401, folderId: TEAM.id, folderName: TEAM.name, folderEmoji: TEAM.emoji }),
      makeLink({
        id: 402,
        folderId: TEAM.id,
        folderName: TEAM.name,
        folderEmoji: TEAM.emoji,
        ownerId: 3,
      }),
      makeLink({ id: 901, folderId: CAMP.id, folderName: CAMP.name, folderEmoji: CAMP.emoji }),
    ],
    folderMembers: {
      [TEAM.id]: structuredClone(TEAM_MEMBERS),
      [CAMP.id]: structuredClone(CAMP_MEMBERS),
    },
    handlers,
  });
}

function failWith(code: string, status: number) {
  return (route: Route) =>
    route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify({ success: false, data: null, error: { code, message: code } }),
    });
}

async function openFolder(page: Page, folder: MockFolder) {
  await page.goto(`/folders/${folder.id}`);
  await expect(page.getByText(`${folder.emoji} ${folder.name}`).first()).toBeVisible({
    timeout: 15_000,
  });
}

async function openTransferPicker(page: Page) {
  await openFolder(page, TEAM);
  await page.getByRole("button", { name: "공유 폴더 삭제", exact: true }).click();
  await expect(page.getByText("공유 폴더를 어떻게 할까요?")).toBeVisible();
  await page.getByRole("button", { name: "위임", exact: true }).click();
  await expect(page.getByText("새 소유자 선택")).toBeVisible();
}

function cta(page: Page) {
  return page.getByTestId("folder-removal-cta");
}

function transferRequests(state: Awaited<ReturnType<typeof setup>>) {
  return state.requests.filter(
    (request) => request.method === "PUT" && request.path === `/api/folders/${TEAM.id}/owner`,
  );
}

async function expectFinishedAt(page: Page) {
  await expect(page).toHaveURL(isWideProject() ? /\/home$/ : /\/folders$/);
  await page.waitForTimeout(300);
  expect(
    await page.evaluate(() => Boolean((window as { __sawNotFound?: boolean }).__sawNotFound)),
  ).toBe(false);
}

test.describe("ownership transfer", () => {
  test("picks a member other than me, confirms, and leaves the folder", async ({ page }) => {
    const state = await setup(page);
    await openTransferPicker(page);

    await expect(page.getByText("소유권을 넘길 멤버를 골라주세요.")).toBeVisible();
    await expect(page.getByRole("radio", { name: "도윤" })).toBeVisible();
    await expect(page.getByRole("radio", { name: "서연" })).toBeVisible();
    await expect(page.getByRole("radio", { name: "테스터" })).toHaveCount(0);
    await expect(cta(page)).toBeDisabled();

    await page.getByText("도윤", { exact: true }).click();
    await expect(page.getByRole("radio", { name: "도윤" })).toBeChecked();
    await expect(cta(page)).toBeEnabled();
    await cta(page).click();

    await expect(page.getByText("도윤님에게 위임할까요?")).toBeVisible();
    await expect(
      page.getByText(
        "도윤님이 새 소유자가 되고 나는 이 폴더에서 나가요. 내가 넣은 링크는 폴더에 남아요.",
      ),
    ).toBeVisible();

    // Back keeps the choice; back again returns to the choice step.
    await page.getByRole("button", { name: "이전 단계로" }).click();
    await expect(page.getByRole("radio", { name: "도윤" })).toBeChecked();
    await page.getByRole("button", { name: "이전 단계로" }).click();
    await expect(page.getByText("공유 폴더를 어떻게 할까요?")).toBeVisible();
    await page.getByRole("button", { name: "위임", exact: true }).click();
    await page.getByText("서연", { exact: true }).click();
    await cta(page).click();
    await expect(page.getByText("서연님에게 위임할까요?")).toBeVisible();

    await cta(page).click();
    await expectFinishedAt(page);
    await expect(page.getByText("서연님에게 위임하고 폴더에서 나왔어요.")).toBeVisible();
    expect(transferRequests(state).map((request) => request.body)).toEqual([{ ownerId: 4 }]);
    // My link stays in the folder for the members.
    expect(state.links.find((link) => link.id === 401)?.folderId).toBe(TEAM.id);
    expect(state.folders.some((folder) => folder.id === TEAM.id)).toBe(false);
  });

  test("arrow keys move the new owner choice", async ({ page }) => {
    test.skip(!isWideProject(), "wide keyboard");
    await setup(page);
    await openTransferPicker(page);

    await page.getByText("도윤", { exact: true }).click();
    await page.getByRole("radio", { name: "도윤" }).focus();
    await page.keyboard.press("ArrowDown");
    await expect(page.getByRole("radio", { name: "서연" })).toBeChecked();
  });

  test("a member who left meanwhile is dropped from the list with a notice", async ({ page }) => {
    const state = await setup(page);
    await openTransferPicker(page);
    await page.getByText("도윤", { exact: true }).click();
    await cta(page).click();
    // 도윤 leaves before the transfer.
    state.folderMembers[TEAM.id].members = state.folderMembers[TEAM.id].members.filter(
      (member) => member.userId !== 3,
    );

    await cta(page).click();
    await expect(
      page.getByText("선택한 멤버가 폴더에 없어요. 다른 멤버를 골라주세요."),
    ).toBeVisible();
    await expect(page.getByText("새 소유자 선택")).toBeVisible();
    await expect(page.getByRole("radio", { name: "도윤" })).toHaveCount(0);
    await expect(page.getByRole("radio", { name: "서연" })).toBeVisible();
    await expect(cta(page)).toBeDisabled();
  });

  test("with every other member gone it offers 폴더 삭제 into the owner-only confirm", async ({
    page,
  }) => {
    const state = await setup(page);
    await openTransferPicker(page);
    await page.getByText("도윤", { exact: true }).click();
    await cta(page).click();
    state.folderMembers[TEAM.id].members = [TEAM_MEMBERS.members[0]];

    await cta(page).click();
    await expect(page.getByText("위임할 멤버가 없어요.")).toBeVisible();
    await expect(page.getByRole("button", { name: "이전 단계로" })).toHaveCount(0);
    await expect(cta(page)).toHaveText("폴더 삭제");

    await cta(page).click();
    await expect(
      page.getByText("🧭 팀 자료 공유 폴더를 삭제할까요?", { exact: true }),
    ).toBeVisible();
    await expect(page.getByText("나만 있는 공유 폴더예요.", { exact: true })).toBeVisible();
    await expect(page.getByTestId("shared-folder-delete-facts")).toHaveCount(0);
  });

  test("a duplicate name blocks the transfer with the notice", async ({ page }) => {
    const state = await setup(page, {
      [`PUT /api/folders/${TEAM.id}/owner`]: failWith(
        FOLDER_API_ERROR_CODES.transferDuplicateName,
        409,
      ),
    });
    await openTransferPicker(page);
    await page.getByText("도윤", { exact: true }).click();
    await cta(page).click();
    await cta(page).click();

    await expect(
      page.getByText(
        "지금 이 폴더 이름으로는 위임할 수 없어요. 폴더 이름을 바꾼 뒤 다시 시도해주세요.",
      ),
    ).toBeVisible();
    await expect(page.getByText("도윤님에게 위임할까요?")).toBeVisible();
    await expect(cta(page)).toBeDisabled();
    await page.getByRole("button", { name: "취소", exact: true }).click();
    expect(transferRequests(state)).toHaveLength(1);
    expect(state.folders.some((folder) => folder.id === TEAM.id)).toBe(true);
  });

  test("a folder that no longer exists ends quietly", async ({ page }) => {
    await setup(page, {
      [`PUT /api/folders/${TEAM.id}/owner`]: failWith(
        FOLDER_API_ERROR_CODES.transferFolderNotFound,
        404,
      ),
    });
    await openTransferPicker(page);
    await page.getByText("도윤", { exact: true }).click();
    await cta(page).click();
    await cta(page).click();

    await expectFinishedAt(page);
    await page.waitForTimeout(300);
    await expect(page.getByText(/위임하고 폴더에서 나왔어요/)).toHaveCount(0);
  });

  test("handed over from another device: the confirm closes without the transfer toast", async ({
    page,
  }) => {
    const state = await setup(page, {
      [`PUT /api/folders/${TEAM.id}/owner`]: failWith(FOLDER_API_ERROR_CODES.differentOwner, 403),
    });
    await openTransferPicker(page);
    await page.getByText("도윤", { exact: true }).click();
    await cta(page).click();
    // Another device transferred and left the folder.
    state.folders = state.folders.filter((folder) => folder.id !== TEAM.id);

    await cta(page).click();
    await expectFinishedAt(page);
    await page.waitForTimeout(300);
    await expect(page.getByText(/위임하고 폴더에서 나왔어요/)).toHaveCount(0);
  });

  test("a double press sends one transfer and shows one toast", async ({ page }) => {
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const state = await setup(page, {
      [`PUT /api/folders/${TEAM.id}/owner`]: async (route) => {
        await gate;
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(envelope(null)),
        });
      },
    });
    await openTransferPicker(page);
    await page.getByText("도윤", { exact: true }).click();
    await cta(page).click();
    await cta(page).dblclick();
    await expect(cta(page)).toHaveAttribute("aria-busy", "true");
    await expect(page.getByRole("button", { name: "이전 단계로" })).toBeDisabled();
    release();

    await expectFinishedAt(page);
    await expect(page.getByText("도윤님에게 위임하고 폴더에서 나왔어요.")).toHaveCount(1);
    expect(transferRequests(state)).toHaveLength(1);
  });
});

test.describe("leave a shared folder", () => {
  test("a member leaves from the header and the folder disappears", async ({ page }) => {
    const state = await setup(page);
    await openFolder(page, CAMP);

    await page.getByRole("button", { name: "공유 폴더 나가기", exact: true }).click();
    await expect(page.getByText("공유 폴더에서 나갈까요?")).toBeVisible();
    await expect(
      page.getByText("내가 넣은 링크는 폴더에 남고 다른 멤버는 계속 볼 수 있어요."),
    ).toBeVisible();
    await expect(cta(page)).toHaveText("나가기");

    await cta(page).click();
    await expectFinishedAt(page);
    await expect(page.getByText("공유 폴더에서 나왔어요.")).toBeVisible();
    expect(
      state.requests
        .filter((request) => request.method === "DELETE")
        .map((request) => request.path),
    ).toEqual([`/api/folders/${CAMP.id}/members/1`]);
    expect(state.links.find((link) => link.id === 901)?.folderId).toBe(CAMP.id);
  });

  test("leaving a folder the owner already deleted ends as left", async ({ page }) => {
    await setup(page, {
      [`DELETE /api/folders/${CAMP.id}/members/1`]: failWith(
        FOLDER_API_ERROR_CODES.folderNotFound,
        404,
      ),
    });
    await openFolder(page, CAMP);
    await page.getByRole("button", { name: "공유 폴더 나가기", exact: true }).click();
    await cta(page).click();

    await expectFinishedAt(page);
    await expect(page.getByText("공유 폴더에서 나왔어요.")).toBeVisible();
  });

  test("a failure keeps the confirm with the message and retries", async ({ page }) => {
    let fail = true;
    await setup(page, {
      [`DELETE /api/folders/${CAMP.id}/members/1`]: (route) =>
        fail
          ? route.abort("internetdisconnected")
          : route.fulfill({
              status: 200,
              contentType: "application/json",
              body: JSON.stringify(envelope(null)),
            }),
    });
    await openFolder(page, CAMP);
    await page.getByRole("button", { name: "공유 폴더 나가기", exact: true }).click();
    await cta(page).click();
    await expect(
      page.getByText("공유 폴더에서 나가지 못했어요. 잠시 후 다시 시도해주세요."),
    ).toBeVisible();
    await expect(page.getByText("공유 폴더에서 나갈까요?")).toBeVisible();

    fail = false;
    await cta(page).click();
    await expectFinishedAt(page);
  });
});
