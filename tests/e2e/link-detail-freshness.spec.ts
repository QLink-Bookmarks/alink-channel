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
    await page.getByText("☕ 가볼 곳", { exact: true }).filter({ visible: true }).first().click();
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
});
