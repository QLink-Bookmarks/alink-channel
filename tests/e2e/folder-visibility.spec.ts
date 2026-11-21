import { type Page, expect, test } from "@playwright/test";

import { isWideProject } from "./support/helpers";
import {
  envelope,
  makeDetail,
  makeFolders,
  makeLink,
  mockApi,
  settingsHandler,
} from "./support/mock-api";

const FOLDER_ID = 1;
const ORIGINAL_ADDRESS = "857efcec-99fe-4d0f-a6e1-74ffdb2534c4";
const NEW_ADDRESS = "f6b87245-02ff-40fc-91ca-0ab6968b1ddb";
const PUBLISH_TITLE = "폴더를 전체 공개할까요?";
const FOLDER_INPUT = "예: 디자인 레퍼런스";

test("a new folder defaults to private and returns its public address without confirmation", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  const state = await mockApi(page, {
    folders: [],
    handlers: {
      "GET /api/folders/1/privacy": (route) =>
        route.fulfill({ json: envelope({ isPublic: true, publicId: ORIGINAL_ADDRESS }) }),
    },
  });
  await page.goto(isWideProject() ? "/home" : "/folders");
  await page.getByRole("button", { name: "내 폴더에 폴더 추가" }).click();
  await expect(page.getByRole("radio", { name: "나만 보기" })).toBeChecked();
  await page.getByPlaceholder(FOLDER_INPUT).fill("새 공개 폴더");
  await page.getByRole("radio", { name: "전체 공개" }).click();
  await page.getByRole("button", { name: "저장", exact: true }).click();
  await expect(page.getByText("폴더를 만들었어요.")).toBeVisible();
  await expect(page.getByRole("dialog", { name: PUBLISH_TITLE })).toHaveCount(0);
  expect(
    state.requests.filter(({ path, method }) => path === "/api/folders" && method === "POST"),
  ).toHaveLength(1);
  const address = new URL(`/public/folders/${ORIGINAL_ADDRESS}`, page.url()).href;
  await expect(page.getByText(address, { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "주소 복사" }).click();
  await expect(page.getByText("공개 주소를 복사했어요.")).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(address);
});

for (const isOwner of [true, false]) {
  test(`link publication can only be changed by its owner (owner: ${isOwner})`, async ({
    page,
  }) => {
    const [folder] = makeFolders(1);
    const link = makeLink({ id: 1, folderId: folder.id, folderName: folder.name });
    const state = await mockApi(page, {
      folders: [{ ...folder, isShared: true, isPublic: true }],
      links: [link],
      details: { [link.id]: makeDetail(link, { isOwner, isPublic: !isOwner }) },
      handlers: {
        "PUT /api/links/1": (route, request) => {
          const { isPublic, title } = request.postDataJSON() as {
            isPublic: boolean;
            title: string;
          };
          state.details[link.id] = { ...state.details[link.id], title, isPublic };
          return route.fulfill({ json: envelope(state.details[link.id]) });
        },
      },
    });
    await page.goto(isWideProject() ? "/links?linkId=1" : "/links/1");
    await page.getByTestId("link-detail-edit").click();
    const everyone = page.getByRole("radio", { name: "전체 공개" });
    const onlyMe = page.getByRole("radio", { name: "나만 보기" });
    if (!isOwner) {
      await expect(everyone).toBeChecked();
      await expect(onlyMe).toBeDisabled();
      await expect(everyone).toBeDisabled();
      return;
    }
    await expect(onlyMe).toBeChecked();
    await everyone.click();
    await page.getByRole("button", { name: "저장", exact: true }).click();
    await expect(page.getByText("수정했어요.")).toBeVisible();
    expect(state.details[link.id].isPublic).toBe(true);
    await page.getByTestId("link-detail-edit").click();
    await expect(everyone).toBeChecked();
  });
}

async function openEdit(page: Page) {
  await page.getByRole("button", { name: "폴더 수정", exact: true }).click();
  const scope = isWideProject() ? page.getByRole("dialog", { name: "폴더 수정" }) : page;
  await expect(scope.getByRole("radio", { name: "전체 공개" })).toBeEnabled();
  return scope;
}

async function mockFolderOwner(page: Page, theme: "light" | "dark") {
  let publicId: string | null = null;
  let previousAddress: string | null = null;
  const [folder] = makeFolders(1);
  const state = await mockApi(page, {
    folders: [{ ...folder, isShared: true }],
    handlers: {
      "GET /api/users/me/settings": settingsHandler(theme, "gray"),
      [`GET /api/folders/${FOLDER_ID}/privacy`]: (route) =>
        route.fulfill({ json: envelope({ isPublic: publicId !== null, publicId }) }),
      [`PUT /api/folders/${FOLDER_ID}`]: (route, request) => {
        const data = request.postDataJSON() as { isPublic?: boolean };
        if (data.isPublic === true && !publicId) {
          publicId = previousAddress ? NEW_ADDRESS : ORIGINAL_ADDRESS;
          previousAddress = publicId;
        }
        if (data.isPublic === false) publicId = null;
        return route.fulfill({
          json: envelope({ id: FOLDER_ID, isPublic: publicId !== null, publicId }),
        });
      },
    },
  });
  return () =>
    state.requests
      .filter(({ method, path }) => method === "PUT" && path === `/api/folders/${FOLDER_ID}`)
      .map(({ body }) => body);
}

for (const theme of ["light", "dark"] as const) {
  test(`publishes only after confirmation, preserves collaboration and replaces withdrawn addresses in ${theme}`, async ({
    page,
  }) => {
    const writes = await mockFolderOwner(page, theme);
    await page.goto(`/folders/${FOLDER_ID}`);
    const form = await openEdit(page);
    await expect(form.getByRole("switch")).toBeChecked();
    await expect(form.getByRole("radio", { name: "나만 보기" })).toBeChecked();
    await form.getByPlaceholder(FOLDER_INPUT).fill("협업 이름 초안");
    await form.getByRole("radio", { name: "전체 공개" }).click();
    const save = form.getByRole("button", { name: "저장", exact: true });
    await save.click();
    const confirmation = page.getByRole("dialog", { name: PUBLISH_TITLE });
    await expect(confirmation).toHaveCount(1);
    await expect(confirmation).toContainText(
      "기존 링크는 모두 나만 보기로 유지되고, 새로 추가하는 링크는 전체 공개돼요.",
    );
    const cancel = confirmation.getByRole("button", { name: "취소" });
    await cancel.focus();
    await page.keyboard.press("Enter");
    await expect(confirmation).toHaveCount(0);
    await expect(form.getByPlaceholder(FOLDER_INPUT)).toHaveValue("협업 이름 초안");
    await expect(save).toBeFocused();
    expect(writes()).toEqual([]);
    await save.click();
    await confirmation.getByRole("button", { name: "전체 공개" }).click();
    await expect(page.getByText("폴더를 전체 공개했어요.")).toBeVisible();
    expect(writes()).toEqual([
      { name: "협업 이름 초안", emoji: "📁", isShared: true, isPublic: true },
    ]);
    const firstAddress = page.getByRole("link", { name: "공개 페이지 열기" });
    await expect(firstAddress).toHaveAttribute(
      "href",
      new RegExp(`/public/folders/${ORIGINAL_ADDRESS}$`),
    );
    await page.getByRole("button", { name: "완료", exact: true }).click();

    const publicForm = await openEdit(page);
    await expect(publicForm.getByRole("radio", { name: "전체 공개" })).toBeChecked();
    await expect(firstAddress).toBeVisible();
    await publicForm.getByRole("radio", { name: "나만 보기" }).click();
    await publicForm.getByRole("button", { name: "취소" }).click();
    await expect(firstAddress).toHaveCount(0);

    const revokeForm = await openEdit(page);
    await expect(revokeForm.getByRole("radio", { name: "전체 공개" })).toBeChecked();
    await revokeForm.getByRole("radio", { name: "나만 보기" }).click();
    await revokeForm.getByRole("button", { name: "저장" }).click();
    await expect(page.getByText("공개를 껐어요. 이전 주소는 더 이상 열리지 않아요.")).toBeVisible();
    await expect(firstAddress).toHaveCount(0);
    await page.getByRole("button", { name: "완료", exact: true }).click();

    const republishForm = await openEdit(page);
    await republishForm.getByRole("radio", { name: "전체 공개" }).click();
    await republishForm.getByRole("button", { name: "저장" }).click();
    await confirmation.getByRole("button", { name: "전체 공개" }).click();
    await expect(firstAddress).toHaveAttribute(
      "href",
      new RegExp(`/public/folders/${NEW_ADDRESS}$`),
    );
    expect(writes()).toHaveLength(3);
  });
}

test("keeps an explicit private link and its todo when the folder is reselected", async ({
  page,
}) => {
  const [folder] = makeFolders(1);
  const state = await mockApi(page, {
    folders: [{ ...folder, name: "공개 폴더", emoji: null, isPublic: true }],
  });
  await page.goto("/home");
  if (isWideProject()) {
    await page.getByText("새 링크", { exact: true }).first().click();
  } else {
    await page.getByLabel("새 링크").click();
  }
  const folderPicker = page.getByRole("button", { name: /^폴더, / });
  const onlyMe = page.getByRole("radio", { name: "나만 보기" });
  const everyone = page.getByRole("radio", { name: "전체 공개" });
  const selectFolder = async (name: string) => {
    await folderPicker.click();
    await page.getByRole("radio", { name, exact: true }).click();
  };

  await expect(everyone).toBeDisabled();
  await selectFolder("공개 폴더");
  await expect(everyone).toBeChecked();
  await onlyMe.click();
  await selectFolder("공개 폴더");
  await expect(onlyMe).toBeChecked();
  await selectFolder("없음");
  await expect(everyone).toBeDisabled();
  await selectFolder("공개 폴더");
  await expect(onlyMe).toBeChecked();

  await page.getByRole("textbox", { name: "URL", exact: true }).fill("https://example.com/private");
  await page.getByRole("textbox", { name: "제목", exact: true }).fill("나만 볼 링크");
  await page.getByRole("button", { name: /^메모·액션/ }).click();
  await page.getByText("액션 추가", { exact: true }).click();
  await page.getByRole("textbox", { name: "액션 제목" }).fill("나만 볼 할 일");
  const save = page.getByRole("button", { name: "저장", exact: true });
  await save.click();
  await expect
    .poll(
      () =>
        state.requests.find(({ method, path }) => method === "POST" && path === "/api/links")?.body,
    )
    .toMatchObject({
      folderId: folder.id,
      isPublic: false,
      todos: [{ title: "나만 볼 할 일" }],
    });
});
