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
const PUBLIC_AT = "2026-11-22T10:00:00Z";
const PUBLISH_TITLE = "폴더를 전체 공개할까요?";
const FOLDER_INPUT = "예: 디자인 레퍼런스";

test("a new folder defaults to private and returns its public address without confirmation", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  const [folder] = makeFolders(1);
  const state = await mockApi(page, {
    folders: [],
    handlers: {
      "GET /api/folders/1": (route) =>
        route.fulfill({ json: envelope({ ...folder, turnsPublicAt: PUBLIC_AT }) }),
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
  const address = new URL(`/folders/${FOLDER_ID}`, page.url()).href;
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
      folders: [{ ...folder, ownerId: folderOwnerId, isShared: true, turnsPublicAt: PUBLIC_AT }],
      links: [link],
      details: {
        [link.id]: makeDetail(link, { isOwner, turnsPublicAt: isPublic ? PUBLIC_AT : null }),
      },
      handlers: {
        "PUT /api/links/1": (route, request) => {
          const { isPublic, title } = request.postDataJSON() as {
            isPublic: boolean;
            title: string;
          };
          state.details[link.id] = {
            ...state.details[link.id],
            title,
            turnsPublicAt: isPublic ? PUBLIC_AT : null,
          };
          return route.fulfill({ json: envelope(state.details[link.id]) });
        },
        "PUT /api/links/1/privacy": (route, request) => {
          const { isPublic } = request.postDataJSON() as { isPublic: boolean };
          state.details[link.id].turnsPublicAt = isPublic ? PUBLIC_AT : null;
          return route.fulfill({
            json: envelope({ turnsPublicAt: state.details[link.id].turnsPublicAt }),
          });
        },
      },
    });
    await page.goto(isWideProject() ? "/links?linkId=1" : "/links/1");
    if (isOwner) await expect(page.getByTestId("link-detail-copy")).toBeVisible();
    await page.getByTestId("link-detail-edit").click();
    const everyone = page.getByRole("radio", { name: "전체 공개" });
    const onlyMe = page.getByRole("radio", { name: "나만 보기" });
    if (isOwner !== true) {
      await expect(page.getByRole("button", { name: /^공개 설정, / })).toHaveCount(0);
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
    expect(state.details[link.id].turnsPublicAt).toBe(PUBLIC_AT);
    await page.getByTestId("link-detail-edit").click();
    await expect(everyone).toBeChecked();
    await onlyMe.click();
    await page.getByRole("button", { name: "저장", exact: true }).click();
    await expect(onlyMe).toHaveCount(0);
    expect(state.details[link.id].turnsPublicAt).toBeNull();
    expect(
      state.requests.filter(({ method }) => method === "PUT").map(({ path, body }) => [path, body]),
    ).toEqual([
      ["/api/links/1/privacy", { isPublic: true }],
      ["/api/links/1/privacy", { isPublic: false }],
    ]);
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
    details: { [link.id]: makeDetail(link, { isOwner: true, turnsPublicAt: PUBLIC_AT }) },
    handlers: {
      "GET /api/folders": async (route) => {
        await folderResponse;
        await route.fulfill({ json: scroll([{ ...folder, turnsPublicAt: null }]) });
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

test("keeps a rejected combined link edit intact and uses the toolbar for a privacy-only write", async ({
  page,
}) => {
  const [folder] = makeFolders(1);
  const link = makeLink({ id: 1, folderId: folder.id, folderName: folder.name });
  let rejectCombined = true;
  const state = await mockApi(page, {
    folders: [{ ...folder, turnsPublicAt: PUBLIC_AT }],
    links: [link],
    details: { [link.id]: makeDetail(link, { isOwner: true, turnsPublicAt: null }) },
    handlers: {
      "PUT /api/links/1": (route, request) => {
        if (rejectCombined)
          return route.fulfill({ status: 422, json: { success: false, data: null } });
        const { title, isPublic } = request.postDataJSON() as { title: string; isPublic: boolean };
        state.details[link.id] = {
          ...state.details[link.id],
          title,
          turnsPublicAt: isPublic ? PUBLIC_AT : null,
        };
        return route.fulfill({ json: envelope(state.details[link.id]) });
      },
      "PUT /api/links/1/privacy": (route, request) => {
        const { isPublic } = request.postDataJSON() as { isPublic: boolean };
        state.details[link.id].turnsPublicAt = isPublic ? PUBLIC_AT : null;
        return route.fulfill({
          json: envelope({ turnsPublicAt: state.details[link.id].turnsPublicAt }),
        });
      },
    },
  });

  await page.goto(isWideProject() ? "/links?linkId=1" : "/links/1");
  await page.getByTestId("link-detail-edit").click();
  const title = page.getByRole("textbox", { name: "제목" });
  const everyone = page.getByRole("radio", { name: "전체 공개" });
  const save = page.getByRole("button", { name: "저장", exact: true });
  await title.fill("이름과 함께 변경");
  await everyone.click();
  await save.click();
  await expect(page.getByText("수정에 실패했어요.")).toBeVisible();
  await expect(title).toHaveValue("이름과 함께 변경");
  await expect(everyone).toBeChecked();
  expect(state.details[link.id].turnsPublicAt).toBeNull();
  expect(state.details[link.id].title).toBe(link.title);

  rejectCombined = false;
  await save.click();
  await expect(title).toHaveCount(0);
  const toolbar = page.getByTestId("link-detail-toolbar");
  await toolbar.getByRole("button", { name: "공개 설정, 전체 공개" }).click();
  const overlay = page.getByRole("group", { name: "공개 설정" });
  await expect(overlay.getByRole("button", { name: "전체 공개", pressed: true })).toBeVisible();
  const privateOption = overlay.getByRole("button", { name: "나만 보기" });
  await privateOption.focus();
  expect(state.requests.filter(({ method }) => method === "PUT")).toHaveLength(2);
  await page.keyboard.press("Enter");
  await expect(privateOption).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("Escape");
  await expect(toolbar.getByRole("button", { name: "공개 설정, 나만 보기" })).toBeFocused();

  const writes = state.requests.filter(({ method }) => method === "PUT");
  expect(writes.map(({ path }) => path)).toEqual([
    "/api/links/1",
    "/api/links/1",
    "/api/links/1/privacy",
  ]);
  expect(writes[0].body).toMatchObject({ title: "이름과 함께 변경", isPublic: true });
  expect(writes[1].body).toEqual(writes[0].body);
  expect(writes[2].body).toEqual({ isPublic: false });
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
  let turnsPublicAt: string | null = null;
  const [folder] = makeFolders(1);
  const state = await mockApi(page, {
    folders: [{ ...folder, isShared: true, turnsPublicAt }],
    handlers: {
      "GET /api/users/me/settings": settingsHandler(theme, "gray"),
      [`GET /api/folders/${FOLDER_ID}`]: (route) =>
        route.fulfill({ json: envelope({ ...folder, isShared: true, turnsPublicAt }) }),
      [`PUT /api/folders/${FOLDER_ID}/privacy`]: (route, request) => {
        const body = request.postDataJSON() as { isPublic: boolean };
        turnsPublicAt = body.isPublic ? PUBLIC_AT : null;
        return route.fulfill({ json: envelope({ turnsPublicAt }) });
      },
      [`PUT /api/folders/${FOLDER_ID}`]: (route, request) => {
        const data = request.postDataJSON() as { isPublic?: boolean };
        if (failures.beforeWrite) {
          failures.beforeWrite = false;
          return route.fulfill({ status: 503, json: { success: false, data: null } });
        }
        if (data.isPublic !== undefined) turnsPublicAt = data.isPublic ? PUBLIC_AT : null;
        if (failures.afterWrite) {
          failures.afterWrite = false;
          return route.abort("failed");
        }
        return route.fulfill({
          json: envelope({ id: FOLDER_ID, turnsPublicAt }),
        });
      },
    },
  });
  return () =>
    state.requests
      .filter(
        ({ method, path }) => method === "PUT" && path.startsWith(`/api/folders/${FOLDER_ID}`),
      )
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
  let turnsPublicAt: string | null = PUBLIC_AT;
  const state = await mockApi(page, {
    folders: [{ ...folder, turnsPublicAt }],
    handlers: {
      [`GET /api/folders/${FOLDER_ID}`]: (route) =>
        route.fulfill({ json: envelope({ ...folder, turnsPublicAt }) }),
    },
  });

  await page.goto(`/folders/${FOLDER_ID}`);
  const form = await openEdit(page);
  await expect(form.getByRole("radio", { name: "전체 공개" })).toBeChecked();
  await form.getByRole("button", { name: "취소", exact: true }).click();
  await expect(page.getByRole("radio", { name: "전체 공개" })).toHaveCount(0);

  const firstReads = state.requests.filter(
    ({ path }) => path === `/api/folders/${FOLDER_ID}`,
  ).length;
  turnsPublicAt = null;
  const reopened = await openEdit(page);
  await expect(reopened.getByRole("radio", { name: "나만 보기" })).toBeChecked();
  await expect(reopened.getByRole("link", { name: "공개 페이지 열기" })).toHaveCount(0);
  expect(state.requests.filter(({ path }) => path === `/api/folders/${FOLDER_ID}`)).toHaveLength(
    firstReads + 1,
  );
});

test("publishes from the folder header only after confirmation", async ({ page }) => {
  const writes = await mockFolderOwner(page, "light");
  await page.goto(`/folders/${FOLDER_ID}`);
  const trigger = page.getByRole("button", { name: /^공개 설정, / });
  await trigger.click();
  const everyone = page
    .getByRole("group", { name: "공개 설정" })
    .getByRole("button", { name: "전체 공개" });
  await everyone.click();
  const confirm = page.getByRole("dialog", { name: PUBLISH_TITLE });
  await confirm.getByRole("button", { name: "취소" }).click();
  await expect(confirm).toHaveCount(0);
  await expect(trigger).toBeFocused();
  expect(writes()).toEqual([]);
  await trigger.click();
  await everyone.click();
  await confirm.getByRole("button", { name: "전체 공개" }).click();
  await expect(trigger).toHaveAccessibleName("공개 설정, 전체 공개");
  await trigger.click();
  await expect(everyone).toHaveAttribute("aria-pressed", "true");
  expect(writes()).toEqual([{ isPublic: true }]);
});

for (const theme of ["light", "dark"] as const) {
  test(`publishes only after confirmation, preserves collaboration and keeps the folder address through republication in ${theme}`, async ({
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
    await expect(firstAddress).toHaveAttribute("href", new RegExp(`/folders/${FOLDER_ID}$`));
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
    await expect(firstAddress).toHaveAttribute("href", new RegExp(`/folders/${FOLDER_ID}$`));
    await cancelRevokeForm.getByRole("radio", { name: "나만 보기" }).click();
    await cancelRevokeForm.getByRole("button", { name: "취소" }).click();
    await expect(firstAddress).toHaveCount(0);

    const revokeForm = await openEdit(page);
    await expect(revokeForm.getByRole("radio", { name: "전체 공개" })).toBeChecked();
    await revokeForm.getByRole("radio", { name: "나만 보기" }).click();
    await revokeForm.getByRole("button", { name: "저장" }).click();
    await expect(
      page.getByText("공개를 껐어요. 이제 권한이 있는 사람만 폴더를 열 수 있어요."),
    ).toBeVisible();
    await expect(firstAddress).toHaveCount(0);
    await page.getByRole("button", { name: "완료", exact: true }).click();

    const republishForm = await openEdit(page);
    await republishForm.getByRole("radio", { name: "전체 공개" }).click();
    await republishForm.getByRole("button", { name: "저장" }).click();
    await confirmation.getByRole("button", { name: "전체 공개" }).click();
    await expect(firstAddress).toHaveAttribute("href", new RegExp(`/folders/${FOLDER_ID}$`));
    expect(writes()).toHaveLength(4);
  });
}

test("keeps an explicit private link and its todo when the folder is reselected", async ({
  page,
}) => {
  const [folder, privateFolder] = makeFolders(2);
  const state = await mockApi(page, {
    folders: [
      { ...folder, name: "공개 폴더", emoji: null, turnsPublicAt: PUBLIC_AT },
      { ...privateFolder, name: "비공개 폴더", emoji: null, turnsPublicAt: null },
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
        { ...known, name: "공개 상태 확인됨", emoji: null, turnsPublicAt: PUBLIC_AT },
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
