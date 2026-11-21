import { type Page, expect, test } from "@playwright/test";

import { isWideProject } from "./support/helpers";
import {
  envelope,
  makeDetail,
  makeFolders,
  makeLink,
  mockApi,
  scroll,
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
  await page.getByRole("button", { name: "저장", exact: true }).evaluate((button: HTMLElement) => {
    button.click();
    button.click();
  });
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

  await context.clearPermissions();
  const cdp = await context.newCDPSession(page);
  const { targetInfo } = await cdp.send("Target.getTargetInfo");
  for (const allowWithoutSanitization of [true, false]) {
    await cdp.send("Browser.setPermission", {
      browserContextId: targetInfo.browserContextId,
      origin: new URL(page.url()).origin,
      permission: { name: "clipboard-write", allowWithoutSanitization },
      setting: "denied",
    });
  }
  await page.getByRole("button", { name: "주소 복사" }).click();
  await expect(
    page.getByText("복사하지 못했어요. 위 주소를 선택해 직접 복사해 주세요."),
  ).toBeVisible();
  await expect(page.getByText(address, { exact: true })).toHaveCSS("user-select", "text");
});

for (const { isOwner, folderOwnerId, isPublic } of [
  { isOwner: true, folderOwnerId: 2, isPublic: false },
  { isOwner: false, folderOwnerId: 1, isPublic: false },
  { isOwner: false, folderOwnerId: 1, isPublic: true },
  { isOwner: undefined, folderOwnerId: 1, isPublic: true },
]) {
  test(`link publication uses link ownership (link owner: ${isOwner}, folder owner: ${folderOwnerId}, public: ${isPublic})`, async ({
    page,
  }) => {
    const [folder] = makeFolders(1);
    const link = makeLink({ id: 1, folderId: folder.id, folderName: folder.name });
    const state = await mockApi(page, {
      folders: [{ ...folder, ownerId: folderOwnerId, isShared: true, isPublic: true }],
      links: [link],
      details: { [link.id]: makeDetail(link, { isOwner, isPublic }) },
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
    if (isOwner) await expect(page.getByTestId("link-detail-copy")).toBeVisible();
    await page.getByTestId("link-detail-edit").click();
    const everyone = page.getByRole("radio", { name: "전체 공개" });
    const onlyMe = page.getByRole("radio", { name: "나만 보기" });
    if (isOwner !== true) {
      await expect(page.getByText("수정하기", { exact: true })).toBeVisible();
      await expect(page.getByText("공개 설정", { exact: true })).toHaveCount(0);
      await expect(onlyMe).toHaveCount(0);
      await expect(everyone).toHaveCount(0);
      expect(state.requests.some(({ method }) => method === "PUT")).toBe(false);
      return;
    }
    await expect(onlyMe).toBeChecked();
    await everyone.click();
    await page.getByRole("button", { name: "저장", exact: true }).click();
    await expect(page.getByText("수정했어요.")).toBeVisible();
    expect(state.details[link.id].isPublic).toBe(true);
    await page.getByTestId("link-detail-edit").click();
    await expect(everyone).toBeChecked();
    await onlyMe.click();
    await page.getByRole("button", { name: "저장", exact: true }).click();
    await expect(onlyMe).toHaveCount(0);
    expect(state.details[link.id].isPublic).toBe(false);
  });
}

test("a private folder overrides stale public link details", async ({ page }) => {
  const [folder] = makeFolders(1);
  const link = makeLink({ id: 1, folderId: FOLDER_ID, folderName: folder.name });
  let release: () => void = () => {};
  const folderResponse = new Promise<void>((resolve) => {
    release = resolve;
  });
  await mockApi(page, {
    links: [link],
    details: { [link.id]: makeDetail(link, { isOwner: true, isPublic: true }) },
    handlers: {
      "GET /api/folders": async (route) => {
        await folderResponse;
        await route.fulfill({ json: scroll([{ ...folder, isPublic: false }]) });
      },
    },
  });

  const onlyMe = page.getByRole("radio", { name: "나만 보기" });
  const everyone = page.getByRole("radio", { name: "전체 공개" });
  try {
    await page.goto(isWideProject() ? `/links?linkId=${link.id}` : `/links/${link.id}`);
    await page.getByTestId("link-detail-edit").click();
    await expect(page.getByText("폴더 공개 상태를 확인하는 중이에요.")).toBeVisible();
    await expect(everyone).toHaveCount(0);
    await expect(onlyMe).toHaveCount(0);
  } finally {
    release();
  }
  await expect(onlyMe).toBeChecked();
  await expect(everyone).toBeDisabled();
});

async function openEdit(page: Page) {
  await page.getByRole("button", { name: "폴더 수정", exact: true }).click();
  const scope = isWideProject() ? page.getByRole("dialog", { name: "폴더 수정" }) : page;
  await expect(scope.getByRole("radio", { name: "전체 공개" })).toBeEnabled();
  return scope;
}

async function mockFolderOwner(
  page: Page,
  theme: "light" | "dark",
  failures: { beforeWrite?: boolean; afterWrite?: boolean } = {},
) {
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
        if (failures.beforeWrite) {
          failures.beforeWrite = false;
          return route.fulfill({ status: 503, json: { success: false, data: null } });
        }
        if (data.isPublic === true && !publicId) {
          publicId = previousAddress ? NEW_ADDRESS : ORIGINAL_ADDRESS;
          previousAddress = publicId;
        }
        if (data.isPublic === false) publicId = null;
        if (failures.afterWrite) {
          failures.afterWrite = false;
          return route.abort("failed");
        }
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

test("preserves the folder draft on failure and reloads a committed change after a lost response", async ({
  page,
}) => {
  const writes = await mockFolderOwner(page, "light", { beforeWrite: true, afterWrite: true });
  await page.goto(`/folders/${FOLDER_ID}`);
  const form = await openEdit(page);
  await form.getByPlaceholder(FOLDER_INPUT).fill("실패 뒤 유지할 이름");
  await form.getByRole("radio", { name: "전체 공개" }).click();
  const confirm = page
    .getByRole("dialog", { name: PUBLISH_TITLE })
    .getByRole("button", { name: "전체 공개" });
  const save = form.getByRole("button", { name: "저장", exact: true });
  await save.click();
  await confirm.click();
  await expect(form.getByText("폴더 수정에 실패했어요. 잠시 후 다시 시도해주세요.")).toBeVisible();
  await expect(form.getByPlaceholder(FOLDER_INPUT)).toHaveValue("실패 뒤 유지할 이름");
  await expect(form.getByRole("radio", { name: "전체 공개" })).toBeEnabled();
  await save.click();
  await confirm.click();
  await expect(form.getByRole("link", { name: "공개 페이지 열기" })).toBeVisible();
  await form.getByRole("button", { name: "취소", exact: true }).click();
  const reopened = await openEdit(page);
  await expect(reopened.getByRole("radio", { name: "전체 공개" })).toBeChecked();
  await expect(reopened.getByRole("link", { name: "공개 페이지 열기" })).toBeVisible();
  expect(writes()).toHaveLength(2);
});

test("reads current visibility when the folder form is reopened immediately", async ({ page }) => {
  const [folder] = makeFolders(1);
  let publicId: string | null = ORIGINAL_ADDRESS;
  const state = await mockApi(page, {
    folders: [{ ...folder, isPublic: true }],
    handlers: {
      [`GET /api/folders/${FOLDER_ID}/privacy`]: (route) =>
        route.fulfill({ json: envelope({ isPublic: publicId !== null, publicId }) }),
    },
  });

  await page.goto(`/folders/${FOLDER_ID}`);
  const form = await openEdit(page);
  await expect(form.getByRole("radio", { name: "전체 공개" })).toBeChecked();
  await form.getByRole("button", { name: "취소", exact: true }).click();
  await expect(page.getByRole("radio", { name: "전체 공개" })).toHaveCount(0);

  publicId = null;
  const reopened = await openEdit(page);
  await expect(reopened.getByRole("radio", { name: "나만 보기" })).toBeChecked();
  await expect(reopened.getByRole("link", { name: "공개 페이지 열기" })).toHaveCount(0);
  expect(
    state.requests.filter(({ path }) => path === `/api/folders/${FOLDER_ID}/privacy`),
  ).toHaveLength(2);
});

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
    await confirmation.getByRole("button", { name: "전체 공개" }).focus();
    await page.keyboard.press("Enter");
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
    await publicForm.getByPlaceholder(FOLDER_INPUT).fill("공개 주소를 유지하는 이름 수정");
    await publicForm.getByRole("button", { name: "저장", exact: true }).click();
    await expect(publicForm.getByPlaceholder(FOLDER_INPUT)).toHaveCount(0);
    await expect(confirmation).toHaveCount(0);
    expect(writes()[1]).toEqual({
      name: "공개 주소를 유지하는 이름 수정",
      emoji: "📁",
      isShared: true,
    });

    const cancelRevokeForm = await openEdit(page);
    await expect(firstAddress).toHaveAttribute(
      "href",
      new RegExp(`/public/folders/${ORIGINAL_ADDRESS}$`),
    );
    await cancelRevokeForm.getByRole("radio", { name: "나만 보기" }).click();
    await cancelRevokeForm.getByRole("button", { name: "취소" }).click();
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
    expect(writes()).toHaveLength(4);
  });
}

test("keeps an explicit private link and its todo when the folder is reselected", async ({
  page,
}) => {
  const [folder, privateFolder] = makeFolders(2);
  const state = await mockApi(page, {
    folders: [
      { ...folder, name: "공개 폴더", emoji: null, isPublic: true },
      { ...privateFolder, name: "비공개 폴더", emoji: null, isPublic: false },
    ],
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
  await selectFolder("비공개 폴더");
  await expect(everyone).toBeDisabled();
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

for (const kind of ["일반", "AI"] as const) {
  test(`keeps a link private in the ${kind} flow when the folder response omits visibility`, async ({
    page,
  }) => {
    const [known, unknown] = makeFolders(2);
    const state = await mockApi(page, {
      folders: [
        { ...known, name: "공개 상태 확인됨", emoji: null, isPublic: true },
        { ...unknown, name: "공개 상태 미확인", emoji: null },
      ],
      handlers: {
        "GET /api/users/me/settings": (route) =>
          route.fulfill({
            json: envelope({
              display: { theme: "light", accent: "gray" },
              ai: {
                defaultProvider: { id: 1, type: "OPENAI" },
                defaultModel: { id: 10, model: "gpt-test" },
              },
            }),
          }),
        "GET /api/ai/providers/models": (route) =>
          route.fulfill({
            json: envelope([
              {
                providerId: 1,
                providerType: "OPENAI",
                models: [{ id: 10, model: "gpt-test", priority: 1, userProviderId: 5 }],
              },
            ]),
          }),
        "PUT /api/links/ai": (route) => route.fulfill({ json: envelope({ id: 100 }) }),
      },
    });
    await page.goto("/home");
    if (isWideProject()) {
      await page.getByText("새 링크", { exact: true }).first().click();
    } else {
      await page.getByLabel("새 링크").click();
    }
    const choose = async (name: string) => {
      await page.getByRole("button", { name: /^폴더, / }).click();
      await page.getByRole("radio", { name, exact: true }).click();
    };
    await choose("공개 상태 확인됨");
    await page.getByRole("radio", { name: "나만 보기" }).click();
    await choose("공개 상태 미확인");
    await expect(page.getByRole("radio", { name: "나만 보기" })).toBeChecked();
    await expect(page.getByRole("radio", { name: "전체 공개" })).toBeDisabled();
    await page
      .getByRole("textbox", { name: "URL", exact: true })
      .fill("https://example.com/unknown");
    await page.getByRole("textbox", { name: "제목", exact: true }).fill("비공개 링크");
    await page
      .getByRole("button", { name: kind === "AI" ? "AI 정리" : "저장", exact: true })
      .click();
    await expect
      .poll(
        () =>
          state.requests.find(({ method, path }) =>
            kind === "AI"
              ? method === "PUT" && path === "/api/links/ai"
              : method === "POST" && path === "/api/links",
          )?.body,
      )
      .toMatchObject({ folderId: unknown.id, isPublic: false });
  });
}
