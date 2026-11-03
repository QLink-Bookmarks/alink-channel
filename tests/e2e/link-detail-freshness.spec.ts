import { type Page, type Route, expect, test } from "@playwright/test";

import { isWideProject } from "./support/helpers";
import { type MockLink, envelope, makeDetail, makeLink, mockApi } from "./support/mock-api";

// #11: lists and details stay fresh for 30 seconds, so a change made in one place must
// show up right away in the other screens that list or show the same link or folder.

function buildLinks(): MockLink[] {
  return [1, 2, 3].map((id) =>
    makeLink({
      id,
      title: `공부 링크 ${id}`,
      folderId: 1,
      folderName: "공부",
      folderEmoji: "📚",
    }),
  );
}

async function mockFolderScreen(page: Page) {
  const links = buildLinks();
  const details = Object.fromEntries(links.map((link) => [link.id, makeDetail(link)]));
  let state: Awaited<ReturnType<typeof mockApi>> | null = null;
  const renameFolder = async (route: Route) => {
    const payload = route.request().postDataJSON() as { name: string; emoji?: string | null };
    if (state) {
      state.folders = state.folders.map((folder) =>
        folder.id === 1 ? { ...folder, name: payload.name } : folder,
      );
      state.links = state.links.map((link) =>
        link.folderId === 1 ? { ...link, folderName: payload.name } : link,
      );
      for (const detail of Object.values(state.details)) {
        if (detail.folderId === 1) detail.folderName = payload.name;
      }
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(envelope({ id: 1 })),
    });
  };
  const createLink = async (route: Route) => {
    const payload = route.request().postDataJSON() as {
      url: string;
      title: string;
      folderId?: number | null;
    };
    if (state) {
      const folder = state.folders.find((entry) => entry.id === payload.folderId);
      const created = makeLink({
        id: NEW_LINK_ID,
        url: payload.url,
        title: payload.title,
        folderId: folder?.id ?? null,
        folderName: folder?.name ?? null,
        folderEmoji: folder?.emoji ?? null,
        createdAt: new Date().toISOString(),
      });
      state.links = [created, ...state.links];
      state.details[NEW_LINK_ID] = makeDetail(created);
    }
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify(envelope({ id: NEW_LINK_ID })),
    });
  };
  state = await mockApi(page, {
    links,
    details,
    handlers: { "PUT /api/folders/1": renameFolder, "POST /api/links": createLink },
  });
  return state;
}

const NEW_LINK_ID = 100;

function card(page: Page, title: string) {
  return page.getByTestId("link-card").filter({ hasText: title });
}

async function openDetail(page: Page, title: string, linkId: number) {
  await card(page, title).getByTestId("link-card-title").click();
  await expect(page).toHaveURL(new RegExp(`linkId=${linkId}`));
  await expect(page.getByTestId("link-detail-title")).toContainText(title);
}

async function closeDetail(page: Page) {
  await page.getByTestId("link-detail-close").click();
  await expect(page).not.toHaveURL(/linkId=/);
}

test.describe("wide", () => {
  test.skip(() => !isWideProject(), "wide cards with hover actions and the detail overlay");

  test("favoriting from a card shows in the detail opened right after", async ({ page }) => {
    await mockFolderScreen(page);
    await page.goto("/folders/1");
    await expect(page.getByTestId("link-card")).toHaveCount(3);

    await openDetail(page, "공부 링크 2", 2);
    await expect(page.getByTestId("link-detail-favorite")).toHaveAccessibleName("바로가기 추가");
    await closeDetail(page);

    const favorited = page.waitForResponse(
      (response) =>
        response.request().method() === "PUT" &&
        new URL(response.url()).pathname === "/api/links/2/favorite",
    );
    await card(page, "공부 링크 2").hover();
    await card(page, "공부 링크 2").getByRole("button", { name: "바로가기 추가" }).click();
    await favorited;
    await expect(
      card(page, "공부 링크 2").getByRole("button", { name: "바로가기 해제" }),
    ).toBeVisible();

    await openDetail(page, "공부 링크 2", 2);
    await expect(page.getByTestId("link-detail-favorite")).toHaveAccessibleName("바로가기 해제");
  });

  test("renaming a folder shows the new name in a link detail opened right after", async ({
    page,
  }) => {
    await mockFolderScreen(page);
    await page.goto("/folders/1");
    await expect(page.getByTestId("link-card")).toHaveCount(3);

    await openDetail(page, "공부 링크 1", 1);
    await expect(page.getByTestId("link-detail-folder")).toContainText("공부");
    await closeDetail(page);

    await page.getByRole("button", { name: "폴더 수정" }).first().click();
    const nameInput = page.getByPlaceholder("예: 디자인 레퍼런스");
    await nameInput.fill("공부 노트");
    const renamed = page.waitForResponse(
      (response) =>
        response.request().method() === "PUT" &&
        new URL(response.url()).pathname === "/api/folders/1",
    );
    await page.getByText("저장", { exact: true }).last().click();
    await renamed;
    await expect(nameInput).toBeHidden();

    await openDetail(page, "공부 링크 1", 1);
    await expect(page.getByTestId("link-detail-folder")).toContainText("공부 노트");
  });

  test("a title edited in the link detail shows on its card after closing the detail", async ({
    page,
  }) => {
    await mockFolderScreen(page);
    await page.goto("/folders/1");
    await expect(page.getByTestId("link-card")).toHaveCount(3);

    await openDetail(page, "공부 링크 2", 2);
    await page.getByRole("button", { name: "수정하기" }).click();
    const editDialog = page.getByRole("dialog");
    await editDialog.getByPlaceholder("링크 제목").fill("고친 제목 링크 2");
    const saved = page.waitForResponse(
      (response) =>
        response.request().method() === "PUT" &&
        new URL(response.url()).pathname === "/api/links/2",
    );
    await editDialog.getByRole("button", { name: "저장", exact: true }).click();
    await saved;
    await expect(page.getByTestId("link-detail-title")).toContainText("고친 제목 링크 2");
    await expect(page.getByPlaceholder("링크 제목")).toBeHidden();

    await closeDetail(page);
    await expect(card(page, "고친 제목 링크 2")).toBeVisible();
    await expect(card(page, "공부 링크 2")).toHaveCount(0);
  });
});

async function pressBottomTab(page: Page, label: string) {
  await page.getByText(label, { exact: true }).last().click();
}

async function openMobileFolder(page: Page, label: string, path: RegExp) {
  await pressBottomTab(page, "폴더");
  await expect(page).toHaveURL(/\/folders$/);
  await page.getByText(label, { exact: true }).filter({ visible: true }).first().click();
  await expect(page).toHaveURL(path);
}

async function openMobileDetail(page: Page, title: string, linkId: number) {
  await card(page, title).getByTestId("link-card-title").click();
  await expect(page).toHaveURL(new RegExp(`/links/${linkId}$`));
  await expect(page.getByTestId("link-detail-title")).toContainText(title);
}

const UNSAVED_EDIT = "저장하지 않은 변경사항이 있어요";

function unsavedEditPrompt(page: Page) {
  return page.getByRole("dialog", { name: UNSAVED_EDIT });
}

function editSheet(page: Page) {
  return page.getByRole("slider", { name: "Bottom Sheet" });
}

async function openEditSheet(page: Page) {
  await page.getByRole("button", { name: "수정하기" }).click();
  await expect(editSheet(page).getByPlaceholder("링크 제목")).toBeVisible();
}

async function waitForLinkPut(page: Page, linkId: number) {
  return page.waitForResponse(
    (response) =>
      response.request().method() === "PUT" &&
      new URL(response.url()).pathname === `/api/links/${linkId}`,
  );
}

async function pressOutsideSheet(page: Page) {
  await page
    .getByRole("button", { name: "Bottom sheet backdrop" })
    .click({ position: { x: 20, y: 20 } });
}

async function pressSheetClose(page: Page) {
  await page.getByLabel("닫기", { exact: true }).click();
}

async function settledSheetBox(page: Page) {
  let previous = await editSheet(page).boundingBox();
  await expect
    .poll(
      async () => {
        const current = await editSheet(page).boundingBox();
        const viewportHeight = page.viewportSize()?.height ?? 0;
        const settled =
          current !== null &&
          previous !== null &&
          current.y < viewportHeight - 40 &&
          current.y === previous.y;
        previous = current;
        return settled;
      },
      { intervals: [250] },
    )
    .toBe(true);
  if (!previous) throw new Error("the sheet is not on screen");
  return previous;
}

async function dragSheetDown(page: Page) {
  const box = await settledSheetBox(page);
  const x = box.x + box.width / 2;
  const y = box.y - 14;
  await page.mouse.move(x, y);
  await page.mouse.down();
  for (let step = 1; step <= 12; step += 1) {
    await page.mouse.move(x, y + step * 40);
  }
  await page.mouse.up();
}

async function expectSheetStaysOpen(page: Page) {
  await expect(editSheet(page)).toBeVisible();
  await page.waitForTimeout(1000);
  await expect(editSheet(page)).toBeVisible();
}

async function expectEditSheetClosedWithoutPrompt(page: Page) {
  await expect(editSheet(page)).toHaveCount(0);
  await expect(unsavedEditPrompt(page)).toHaveCount(0);
}

test.describe("mobile", () => {
  test.skip(() => isWideProject(), "mobile screens remount on every tab and back");

  test("a link moved to another folder in the detail leaves this folder and shows in the other", async ({
    page,
  }) => {
    await mockFolderScreen(page);
    await page.goto("/home");
    await expect(page.getByTestId("link-card")).toHaveCount(3);
    await openMobileFolder(page, "공부", /\/folders\/1$/);
    await expect(page.getByTestId("link-card")).toHaveCount(3);

    await openMobileDetail(page, "공부 링크 3", 3);
    await page.getByRole("button", { name: "폴더 이동, 현재 📚 공부" }).click();
    const moved = page.waitForResponse(
      (response) =>
        response.request().method() === "PATCH" &&
        new URL(response.url()).pathname === "/api/links/3",
    );
    // The move dialog applies a choice only after 확인 (#10).
    await page
      .getByRole("radio", { name: /가볼 곳/ })
      .filter({ visible: true })
      .first()
      .click();
    await page.getByRole("button", { name: "확인", exact: true }).filter({ visible: true }).click();
    await moved;

    await page.getByRole("button", { name: "뒤로" }).click();
    await expect(page).toHaveURL(/\/folders\/1$/);
    await expect(page.getByTestId("link-card")).toHaveCount(2);
    await expect(card(page, "공부 링크 3")).toHaveCount(0);

    await openMobileFolder(page, "가볼 곳", /\/folders\/2$/);
    await expect(card(page, "공부 링크 3")).toBeVisible();
  });

  test("a new link saved from the add sheet shows on home and in its folder", async ({ page }) => {
    await mockFolderScreen(page);
    await page.goto("/home");
    await expect(page.getByTestId("link-card")).toHaveCount(3);
    await openMobileFolder(page, "공부", /\/folders\/1$/);
    await expect(page.getByTestId("link-card")).toHaveCount(3);
    await pressBottomTab(page, "홈");
    await expect(page).toHaveURL(/\/home$/);

    await page.getByLabel("새 링크").click();
    await page.getByPlaceholder(/^https:\/\//).fill("https://example.com/new-note");
    const addSheet = page.getByRole("slider", { name: "Bottom Sheet" });
    await addSheet
      .getByPlaceholder(/^(AI 생성으로 자동 정리해보세요|제목을 불러오는 중…)$/)
      .fill("새로 저장한 링크");
    await addSheet.getByRole("button", { name: "변경" }).first().click();
    await addSheet.getByText("📚 공부", { exact: true }).click();
    await expect(addSheet.getByText("📚 공부", { exact: true })).toBeVisible();
    const created = page.waitForResponse(
      (response) =>
        response.request().method() === "POST" && new URL(response.url()).pathname === "/api/links",
    );
    await addSheet.getByRole("button", { name: "저장", exact: true }).click();
    await created;
    await expect(page).toHaveURL(new RegExp(`/links/${NEW_LINK_ID}$`));

    await pressBottomTab(page, "홈");
    await expect(page).toHaveURL(/\/home$/);
    await expect(card(page, "새로 저장한 링크")).toBeVisible();
    await openMobileFolder(page, "공부", /\/folders\/1$/);
    await expect(card(page, "새로 저장한 링크")).toBeVisible();
    await expect(page.getByTestId("link-card")).toHaveCount(4);
  });

  test("a renamed folder shows its new name in the home folder chips", async ({ page }) => {
    await mockFolderScreen(page);
    await page.goto("/home");
    await expect(page.getByTestId("link-card")).toHaveCount(3);
    await expect(page.getByText("📚 공부", { exact: true }).first()).toBeVisible();

    await openMobileFolder(page, "공부", /\/folders\/1$/);
    await page.getByRole("button", { name: "폴더 수정" }).first().click();
    const nameInput = page.getByPlaceholder("예: 디자인 레퍼런스");
    await nameInput.fill("공부 노트");
    const renamed = page.waitForResponse(
      (response) =>
        response.request().method() === "PUT" &&
        new URL(response.url()).pathname === "/api/folders/1",
    );
    await page.getByText("저장", { exact: true }).last().click();
    await renamed;

    await pressBottomTab(page, "홈");
    await expect(page).toHaveURL(/\/home$/);
    await expect(page.getByText("📚 공부 노트", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("📚 공부", { exact: true })).toHaveCount(0);
  });

  test("saving an edited title closes the edit sheet without asking about unsaved changes, every time", async ({
    page,
  }) => {
    await mockFolderScreen(page);
    await page.goto("/home");
    await openMobileFolder(page, "공부", /\/folders\/1$/);
    await openMobileDetail(page, "공부 링크 2", 2);

    for (const title of ["고친 제목 1", "고친 제목 2", "고친 제목 3"]) {
      await openEditSheet(page);
      await editSheet(page).getByPlaceholder("링크 제목").fill(title);
      const saved = waitForLinkPut(page, 2);
      await editSheet(page).getByRole("button", { name: "저장", exact: true }).click();
      await saved;
      await expect(page.getByText("수정했어요.").first()).toBeVisible();
      await expect(page.getByTestId("link-detail-title")).toContainText(title);
      await expectEditSheetClosedWithoutPrompt(page);
    }

    await page.getByRole("button", { name: "뒤로" }).click();
    await expect(page).toHaveURL(/\/folders\/1$/);
    await expect(card(page, "고친 제목 3")).toBeVisible();
    await expect(card(page, "공부 링크 2")).toHaveCount(0);
  });

  test("saving only an edited summary closes the edit sheet without asking", async ({ page }) => {
    const state = await mockFolderScreen(page);
    await page.goto("/home");
    await openMobileFolder(page, "공부", /\/folders\/1$/);
    await openMobileDetail(page, "공부 링크 1", 1);

    await openEditSheet(page);
    await editSheet(page).getByPlaceholder("한 줄 요약을 입력해주세요").fill("새 한 줄 요약");
    const saved = waitForLinkPut(page, 1);
    await editSheet(page).getByRole("button", { name: "저장", exact: true }).click();
    await saved;
    await expect(page.getByText("수정했어요.").first()).toBeVisible();
    await expectEditSheetClosedWithoutPrompt(page);
    expect(state.details[1].summary).toBe("새 한 줄 요약");
  });

  test("closing the edit sheet from outside asks only when something changed, and 저장 안 함 keeps the title", async ({
    page,
  }) => {
    const state = await mockFolderScreen(page);
    await page.goto("/home");
    await openMobileFolder(page, "공부", /\/folders\/1$/);
    await openMobileDetail(page, "공부 링크 2", 2);

    await openEditSheet(page);
    await pressOutsideSheet(page);
    await expectEditSheetClosedWithoutPrompt(page);

    await openEditSheet(page);
    await editSheet(page).getByPlaceholder("링크 제목").fill("저장 안 할 제목");
    await pressOutsideSheet(page);
    await expect(unsavedEditPrompt(page)).toBeVisible();
    await unsavedEditPrompt(page).getByRole("button", { name: "저장 안 함", exact: true }).click();
    await expectEditSheetClosedWithoutPrompt(page);
    await expect(page.getByTestId("link-detail-title")).toContainText("공부 링크 2");
    expect(state.details[2].title).toBe("공부 링크 2");
  });

  test("저장 in the unsaved-changes prompt saves the edit and closes both", async ({ page }) => {
    await mockFolderScreen(page);
    await page.goto("/home");
    await openMobileFolder(page, "공부", /\/folders\/1$/);
    await openMobileDetail(page, "공부 링크 2", 2);

    await openEditSheet(page);
    await editSheet(page).getByPlaceholder("링크 제목").fill("창에서 저장한 제목");
    await pressSheetClose(page);
    const prompt = unsavedEditPrompt(page);
    await expect(prompt).toBeVisible();
    const saved = waitForLinkPut(page, 2);
    await prompt.getByRole("button", { name: "저장", exact: true }).click();
    await saved;
    await expect(page.getByTestId("link-detail-title")).toContainText("창에서 저장한 제목");
    await expectEditSheetClosedWithoutPrompt(page);
  });

  test("a failed save keeps the edit sheet open, and closing it then asks first", async ({
    page,
  }) => {
    await mockFolderScreen(page);
    await page.route("**/api/links/2", (route) =>
      route.request().method() === "PUT" ? route.abort("internetdisconnected") : route.fallback(),
    );
    await page.goto("/home");
    await openMobileFolder(page, "공부", /\/folders\/1$/);
    await openMobileDetail(page, "공부 링크 2", 2);

    await openEditSheet(page);
    await editSheet(page).getByPlaceholder("링크 제목").fill("저장 실패할 제목");
    await editSheet(page).getByRole("button", { name: "저장", exact: true }).click();
    await expect(page.getByText("수정에 실패했어요.").first()).toBeVisible();
    await expect(editSheet(page).getByPlaceholder("링크 제목")).toHaveValue("저장 실패할 제목");
    await expect(unsavedEditPrompt(page)).toHaveCount(0);

    await pressOutsideSheet(page);
    await expect(unsavedEditPrompt(page)).toBeVisible();
  });

  test("an edited sheet closed with X opens again after the prompt is answered once the sheet is gone", async ({
    page,
  }) => {
    await mockFolderScreen(page);
    await page.goto("/home");
    await openMobileFolder(page, "공부", /\/folders\/1$/);
    await openMobileDetail(page, "공부 링크 2", 2);

    await openEditSheet(page);
    await pressSheetClose(page);
    await expectEditSheetClosedWithoutPrompt(page);

    await openEditSheet(page);
    await editSheet(page).getByPlaceholder("링크 제목").fill("버릴 제목");
    await pressSheetClose(page);
    await expect(unsavedEditPrompt(page)).toBeVisible();
    await expect(editSheet(page)).toHaveCount(0);
    await unsavedEditPrompt(page).getByRole("button", { name: "저장 안 함", exact: true }).click();
    await expect(page.getByTestId("link-detail-title")).toContainText("공부 링크 2");

    await openEditSheet(page);
    await expect(editSheet(page).getByPlaceholder("링크 제목")).toHaveValue("공부 링크 2");
    await expectSheetStaysOpen(page);
  });

  for (const sheet of [
    { name: "link edit", button: "수정하기" },
    { name: "folder move", button: "폴더 이동, 현재 📚 공부" },
    { name: "todo editor", button: "+ 할 일 추가 / 수정" },
  ]) {
    test(`the ${sheet.name} sheet opens again after it was dragged down to close`, async ({
      page,
    }) => {
      await mockFolderScreen(page);
      await page.goto("/home");
      await openMobileFolder(page, "공부", /\/folders\/1$/);
      await openMobileDetail(page, "공부 링크 2", 2);

      await page.getByRole("button", { name: sheet.button, exact: true }).click();
      await expect(editSheet(page)).toBeVisible();
      await dragSheetDown(page);
      await expect(editSheet(page)).toHaveCount(0);

      await page.getByRole("button", { name: sheet.button, exact: true }).click();
      await expectSheetStaysOpen(page);
    });
  }

  for (const close of [
    { name: "X", run: pressSheetClose },
    { name: "outside", run: pressOutsideSheet },
  ]) {
    test(`the edit sheet opens and stays open when reopened as soon as the ${close.name} close finished`, async ({
      page,
    }) => {
      await mockFolderScreen(page);
      await page.goto("/home");
      await openMobileFolder(page, "공부", /\/folders\/1$/);
      await openMobileDetail(page, "공부 링크 2", 2);

      await openEditSheet(page);
      await close.run(page);
      await expect(editSheet(page)).toHaveCount(0);
      await page.getByRole("button", { name: "수정하기" }).click();

      await expectSheetStaysOpen(page);
      await expect(unsavedEditPrompt(page)).toHaveCount(0);
    });
  }

  test("the edit sheet stays open when it is reopened while the outside-press close is still animating", async ({
    page,
  }) => {
    await mockFolderScreen(page);
    await page.goto("/home");
    await openMobileFolder(page, "공부", /\/folders\/1$/);
    await openMobileDetail(page, "공부 링크 2", 2);

    await openEditSheet(page);
    await pressOutsideSheet(page);
    await page.getByRole("button", { name: "수정하기" }).dispatchEvent("click");

    await expectSheetStaysOpen(page);
    await expect(unsavedEditPrompt(page)).toHaveCount(0);
  });
});
