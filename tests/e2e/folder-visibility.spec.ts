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
const PUBLISH_TITLE = "폴더를 전체 공개할까요?";
const FOLDER_INPUT = "예: 디자인 레퍼런스";

for (const entry of ["numeric address", "folder card"] as const) {
  test(`places link visibility immediately after the star from the ${entry}`, async ({ page }) => {
    const [folder] = makeFolders(1);
    const link = makeLink({ id: 1, folderId: folder.id, folderName: folder.name });
    await mockApi(page, {
      folders: [{ ...folder, isPublic: true }],
      links: [link],
      details: { [link.id]: makeDetail(link, { isOwner: true, isPublic: true }) },
    });

    if (entry === "folder card") {
      await page.goto(`/folders/${folder.id}`);
      await page.getByTestId("link-card-title").filter({ hasText: link.title }).click();
      await expect(page).toHaveURL(isWideProject() ? /\/folders\/1\?linkId=1$/ : /\/links\/1$/);
    } else {
      await page.goto(`/links/${link.id}`);
    }

    const toolbar = page.getByTestId("link-detail-toolbar");
    const favorite = toolbar.getByTestId("link-detail-favorite");
    const visibility = toolbar.getByRole("button", { name: "공개 설정, 전체 공개" });
    const share = toolbar.getByTestId("link-detail-share");

    await expect(visibility).toBeInViewport();
    const buttons = await toolbar
      .getByRole("button")
      .evaluateAll((nodes) =>
        nodes.map((node) => node.getAttribute("data-testid") ?? node.getAttribute("aria-label")),
      );
    expect(buttons.slice(0, 3)).toEqual([
      "link-detail-favorite",
      "공개 설정, 전체 공개",
      "link-detail-share",
    ]);

    await favorite.focus();
    await page.keyboard.press("Tab");
    await expect(visibility).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(share).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(visibility).toBeFocused();
    await page.keyboard.press("Enter");
    const choices = page.getByRole("group", { name: "공개 설정" });
    await expect(choices.getByRole("button", { name: "전체 공개", pressed: true })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(choices).toHaveCount(0);
    await expect(visibility).toBeFocused();
  });
}

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
        route.fulfill({ json: envelope({ ...folder, isPublic: true }) }),
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
      folders: [{ ...folder, ownerId: folderOwnerId, isShared: true, isPublic: true }],
      links: [link],
      details: {
        [link.id]: makeDetail(link, { isOwner, isPublic }),
      },
      handlers: {
        "PUT /api/links/1/privacy": (route, request) => {
          const { isPublic } = request.postDataJSON() as { isPublic: boolean };
          state.details[link.id].isPublic = isPublic;
          return route.fulfill({
            json: envelope({ isPublic: state.details[link.id].isPublic }),
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
    expect(state.details[link.id].isPublic).toBe(true);
    await page.getByTestId("link-detail-edit").click();
    await expect(everyone).toBeChecked();
    await onlyMe.click();
    await page.getByRole("button", { name: "저장", exact: true }).click();
    await expect(onlyMe).toHaveCount(0);
    expect(state.details[link.id].isPublic).toBe(false);
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

test("does not infer link visibility from a public folder when the detail omits it", async ({
  page,
}) => {
  const [folder] = makeFolders(1);
  const link = makeLink({ id: 1, folderId: folder.id, folderName: folder.name });
  const state = await mockApi(page, {
    folders: [{ ...folder, isPublic: true }],
    links: [link],
    details: { [link.id]: makeDetail(link, { isOwner: true, isPublic: undefined }) },
  });
  await page.goto(isWideProject() ? "/links?linkId=1" : "/links/1");
  await page.getByTestId("link-detail-edit").click();
  await expect(page.getByText("링크 공개 상태를 확인할 수 없어요.")).toBeVisible();
  await expect(page.getByRole("button", { name: /^공개 설정, / })).toHaveCount(0);
  await expect(page.getByRole("radio", { name: "전체 공개" })).toHaveCount(0);
  expect(
    state.requests.some(({ method, path }) => method === "PUT" && path.endsWith("/privacy")),
  ).toBe(false);
});

for (const committed of [false, true]) {
  test(`reconciles a failed link privacy response after saving the title (committed: ${committed})`, async ({
    page,
  }) => {
    const [folder] = makeFolders(1);
    const link = makeLink({ id: 1, folderId: folder.id, folderName: folder.name });
    let failPrivacy = true;
    const state = await mockApi(page, {
      folders: [{ ...folder, isPublic: true }],
      links: [link],
      details: { [link.id]: makeDetail(link, { isOwner: true, isPublic: false }) },
      handlers: {
        "PUT /api/links/1": (route, request) => {
          const { title } = request.postDataJSON() as { title: string };
          state.details[link.id] = {
            ...state.details[link.id],
            title,
          };
          return route.fulfill({ json: envelope(state.details[link.id]) });
        },
        "PUT /api/links/1/privacy": (route, request) => {
          const { isPublic } = request.postDataJSON() as { isPublic: boolean };
          if (failPrivacy) {
            failPrivacy = false;
            if (committed) state.details[link.id].isPublic = isPublic;
            return route.abort("failed");
          }
          state.details[link.id].isPublic = isPublic;
          return route.fulfill({
            json: envelope({ isPublic: state.details[link.id].isPublic }),
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
    await expect(page.getByText("공개 설정을 저장하지 못했어요.")).toBeVisible();
    await expect(title).toHaveValue("이름과 함께 변경");
    await expect(everyone).toBeChecked();
    expect(state.details[link.id].isPublic).toBe(committed);
    expect(state.details[link.id].title).toBe("이름과 함께 변경");
    const privacyIndex = state.requests.findIndex(
      ({ path, method }) => method === "PUT" && path === "/api/links/1/privacy",
    );
    expect(state.requests.slice(privacyIndex + 1)).toEqual(
      expect.arrayContaining([expect.objectContaining({ method: "GET", path: "/api/links/1" })]),
    );

    if (committed) {
      await expect(save).toBeDisabled();
      await page.getByRole("button", { name: "취소", exact: true }).click();
    } else {
      await save.click();
    }
    await expect(title).toHaveCount(0);
    const toolbar = page.getByTestId("link-detail-toolbar");
    await toolbar.getByRole("button", { name: "공개 설정, 전체 공개" }).click();
    const overlay = page.getByRole("group", { name: "공개 설정" });
    await expect(overlay.getByRole("button", { name: "전체 공개", pressed: true })).toBeVisible();
    const privateOption = overlay.getByRole("button", { name: "나만 보기" });
    await privateOption.focus();
    expect(state.requests.filter(({ method }) => method === "PUT")).toHaveLength(committed ? 2 : 3);
    await page.keyboard.press("Enter");
    await expect(privateOption).toHaveAttribute("aria-pressed", "true");
    await page.keyboard.press("Escape");
    await expect(toolbar.getByRole("button", { name: "공개 설정, 나만 보기" })).toBeFocused();

    const writes = state.requests.filter(({ method }) => method === "PUT");
    expect(writes.map(({ path, body }) => [path, body])).toEqual([
      ["/api/links/1", expect.objectContaining({ title: "이름과 함께 변경", folderId: FOLDER_ID })],
      ["/api/links/1/privacy", { isPublic: true }],
      ...(committed ? [] : [["/api/links/1/privacy", { isPublic: true }]]),
      ["/api/links/1/privacy", { isPublic: false }],
    ]);
    expect(writes[0].body).not.toHaveProperty("isPublic");
  });
}

test("keeps link field edits after the current folder becomes private", async ({ page }) => {
  const [folder] = makeFolders(1);
  const link = makeLink({ id: 1, folderId: folder.id, folderName: folder.name });
  let folderIsPublic = true;
  const state = await mockApi(page, {
    links: [link],
    details: { [link.id]: makeDetail(link, { isOwner: true, isPublic: false }) },
    handlers: {
      "GET /api/folders": (route) =>
        route.fulfill({ json: scroll([{ ...folder, isPublic: folderIsPublic }]) }),
      "PUT /api/links/1": (route, request) => {
        const body = request.postDataJSON() as {
          title: string;
          summary: string;
        };
        state.details[link.id] = {
          ...state.details[link.id],
          title: body.title,
          summary: body.summary,
        };
        return route.fulfill({ json: envelope(state.details[link.id]) });
      },
      "PUT /api/links/1/privacy": (route) =>
        route.fulfill({ status: 422, json: { success: false, data: null } }),
    },
  });
  await page.goto(isWideProject() ? "/links?linkId=1" : "/links/1");
  await page.getByTestId("link-detail-edit").click();
  const title = page.getByRole("textbox", { name: "제목" });
  const summary = page.getByPlaceholder("한 줄 요약을 입력해주세요");
  const save = page.getByRole("button", { name: "저장", exact: true });
  await title.fill("유지할 제목");
  await summary.fill("유지할 요약");
  await page.getByRole("radio", { name: "전체 공개" }).click();
  folderIsPublic = false;
  await save.click();
  await expect(page.getByText("현재 폴더 상태에서는 링크를 전체 공개할 수 없어요.")).toBeVisible();
  await expect(title).toHaveValue("유지할 제목");
  await expect(summary).toHaveValue("유지할 요약");
  await expect(save).toBeDisabled();
  await page.getByRole("button", { name: "공개 변경 취소" }).click();
  await expect(save).toBeDisabled();
  await page.getByRole("button", { name: "취소", exact: true }).click();
  await expect(title).toHaveCount(0);
  expect(state.requests.filter(({ method }) => method === "PUT").map(({ body }) => body)).toEqual([
    expect.objectContaining({ title: "유지할 제목", summary: "유지할 요약" }),
    { isPublic: true },
  ]);
  expect(state.details[link.id]).toMatchObject({
    title: "유지할 제목",
    summary: "유지할 요약",
    isPublic: false,
  });
  expect(
    state.requests.find(({ method, path }) => method === "PUT" && path === "/api/links/1")?.body,
  ).not.toHaveProperty("isPublic");
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
  failures: { edit?: boolean; privacy?: "before-write" | "after-write" } = {},
) {
  const [folder] = makeFolders(1);
  const savedFolder = { ...folder, isShared: true, isPublic: false };
  const state = await mockApi(page, {
    folders: [savedFolder],
    handlers: {
      "GET /api/users/me/settings": settingsHandler(theme, "gray"),
      [`GET /api/folders/${FOLDER_ID}`]: (route) => route.fulfill({ json: envelope(savedFolder) }),
      [`PUT /api/folders/${FOLDER_ID}/privacy`]: (route, request) => {
        const { isPublic } = request.postDataJSON() as { isPublic: boolean };
        const failure = failures.privacy;
        failures.privacy = undefined;
        if (failure !== "before-write") savedFolder.isPublic = isPublic;
        if (failure) return route.abort("failed");
        return route.fulfill({ json: envelope({ isPublic }) });
      },
      [`PUT /api/folders/${FOLDER_ID}`]: (route, request) => {
        const { name, emoji, isShared } = request.postDataJSON() as {
          name: string;
          emoji: string | null;
          isShared: boolean;
        };
        if (failures.edit) {
          failures.edit = false;
          return route.fulfill({ status: 503, json: { success: false, data: null } });
        }
        Object.assign(savedFolder, { name, emoji, isShared });
        return route.fulfill({
          json: envelope({ id: FOLDER_ID, isPublic: savedFolder.isPublic }),
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

for (const privacy of ["before-write", "after-write"] as const) {
  test(`preserves the folder draft and reconciles a failed privacy response (${privacy})`, async ({
    page,
  }) => {
    const writes = await mockFolderOwner(page, "light", { edit: true, privacy });
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
    await expect(
      form.getByText("폴더 수정에 실패했어요. 잠시 후 다시 시도해주세요."),
    ).toBeVisible();
    await expect(form.getByPlaceholder(FOLDER_INPUT)).toHaveValue("실패 뒤 유지할 이름");
    await expect(form.getByRole("radio", { name: "전체 공개" })).toBeEnabled();
    expect(writes()).toEqual([{ name: "실패 뒤 유지할 이름", emoji: "📁", isShared: true }]);
    await save.click();
    await confirm.click();
    await expect(form.getByText("공개 설정을 저장하지 못했어요.")).toBeVisible();
    const publicAddress = form.getByRole("link", { name: "공개 페이지 열기" });
    if (privacy === "before-write") {
      await expect(publicAddress).toHaveCount(0);
      await save.click();
      await confirm.click();
      await expect(form.getByText("폴더를 전체 공개했어요.")).toBeVisible();
      await expect(publicAddress).toHaveCount(0);
      await form.getByRole("button", { name: "완료", exact: true }).click();
    } else {
      await expect(publicAddress).toHaveCount(0);
      await save.click();
    }
    await expect(form.getByPlaceholder(FOLDER_INPUT)).toHaveCount(0);
    const reopened = await openEdit(page);
    await expect(reopened.getByPlaceholder(FOLDER_INPUT)).toHaveValue("실패 뒤 유지할 이름");
    await expect(reopened.getByRole("radio", { name: "전체 공개" })).toBeChecked();
    await expect(reopened.getByRole("link", { name: "공개 페이지 열기" })).toHaveCount(0);
    expect(writes()).toEqual([
      { name: "실패 뒤 유지할 이름", emoji: "📁", isShared: true },
      { name: "실패 뒤 유지할 이름", emoji: "📁", isShared: true },
      { isPublic: true },
      ...(privacy === "before-write" ? [{ isPublic: true }] : []),
    ]);
  });
}

test("reads current visibility when the folder form is reopened immediately", async ({ page }) => {
  const [folder] = makeFolders(1);
  let isPublic: boolean = true;
  const state = await mockApi(page, {
    folders: [{ ...folder, isPublic }],
    handlers: {
      [`GET /api/folders/${FOLDER_ID}`]: (route) =>
        route.fulfill({ json: envelope({ ...folder, isPublic }) }),
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
  isPublic = false;
  const reopened = await openEdit(page);
  await expect(reopened.getByRole("radio", { name: "나만 보기" })).toBeChecked();
  await expect(reopened.getByRole("link", { name: "공개 페이지 열기" })).toHaveCount(0);
  await reopened.getByRole("button", { name: "취소", exact: true }).click();
  await expect(page.getByRole("button", { name: "공개 설정, 나만 보기" })).toBeVisible();
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
  await expect(everyone).toBeVisible();
  expect(writes()).toEqual([]);
  await everyone.click();
  await confirm.getByRole("button", { name: "전체 공개" }).click();
  await expect(trigger).toHaveAccessibleName("공개 설정, 전체 공개");
  await expect(everyone).toHaveAttribute("aria-pressed", "true");
  expect(writes()).toEqual([{ isPublic: true }]);
});

test("keeps the newer folder detail after the sidebar loads a different folder page", async ({
  page,
}) => {
  test.skip(!isWideProject(), "the wide sidebar stays mounted on folder details");
  const [first, second] = makeFolders(2).reverse();
  let isPublic: boolean = false;
  let releaseNextPage: () => void = () => {};
  const nextPage = new Promise<void>((resolve) => {
    releaseNextPage = resolve;
  });
  const state = await mockApi(page, {
    folders: [first, second],
    handlers: {
      "GET /api/folders": async (route, request) => {
        if (!new URL(request.url()).searchParams.has("cursor")) {
          return route.fulfill({ json: scroll([{ ...first, isPublic: false }], "second") });
        }
        await nextPage;
        return route.fulfill({ json: scroll([second]) });
      },
      [`GET /api/folders/${first.id}`]: (route) =>
        route.fulfill({ json: envelope({ ...first, isPublic }) }),
    },
  });
  try {
    await page.goto(`/folders/${first.id}`);
    const trigger = page.getByRole("button", { name: /^공개 설정, / });
    await expect(trigger).toHaveAccessibleName("공개 설정, 나만 보기");
    await expect
      .poll(() =>
        state.requests.some(
          ({ path, search }) => path === "/api/folders" && search.includes("cursor=second"),
        ),
      )
      .toBe(true);
    isPublic = true;
    await trigger.click();
    const overlay = page.getByRole("group", { name: "공개 설정" });
    await expect(overlay.getByRole("button", { name: "전체 공개", pressed: true })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(trigger).toHaveAccessibleName("공개 설정, 전체 공개");
    releaseNextPage();
    await expect(page.getByRole("button", { name: new RegExp(second.name) })).toBeVisible();
    await expect(trigger).toHaveAccessibleName("공개 설정, 전체 공개");
  } finally {
    releaseNextPage();
  }
});

for (const theme of ["light", "dark"] as const) {
  test(`publishes only after confirmation, preserves collaboration and offers the folder address in the header in ${theme}`, async ({
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
      { name: "협업 이름 초안", emoji: "📁", isShared: true },
      { isPublic: true },
    ]);
    const legacyLink = page.getByRole("link", { name: "공개 페이지 열기" });
    await expect(legacyLink).toHaveCount(0);
    await page.getByRole("button", { name: "완료", exact: true }).click();

    const publicForm = await openEdit(page);
    await expect(publicForm.getByRole("radio", { name: "전체 공개" })).toBeChecked();
    await expect(publicForm.getByText("공개 열람 주소")).toHaveCount(0);
    await expect(legacyLink).toHaveCount(0);
    await publicForm.getByPlaceholder(FOLDER_INPUT).fill("공개 주소를 유지하는 이름 수정");
    await publicForm.getByRole("button", { name: "저장", exact: true }).click();
    await expect(publicForm.getByPlaceholder(FOLDER_INPUT)).toHaveCount(0);
    await expect(confirmation).toHaveCount(0);
    expect(writes()[2]).toEqual({
      name: "공개 주소를 유지하는 이름 수정",
      emoji: "📁",
      isShared: true,
    });

    const cancelRevokeForm = await openEdit(page);
    await expect(legacyLink).toHaveCount(0);
    await cancelRevokeForm.getByRole("radio", { name: "나만 보기" }).click();
    await cancelRevokeForm.getByRole("button", { name: "취소" }).click();
    await expect(legacyLink).toHaveCount(0);

    const revokeForm = await openEdit(page);
    await expect(revokeForm.getByRole("radio", { name: "전체 공개" })).toBeChecked();
    await revokeForm.getByRole("radio", { name: "나만 보기" }).click();
    await revokeForm.getByRole("button", { name: "저장" }).click();
    await expect(
      page.getByText("공개를 껐어요. 이제 권한이 있는 사람만 폴더를 열 수 있어요."),
    ).toBeVisible();
    await expect(legacyLink).toHaveCount(0);
    await page.getByRole("button", { name: "완료", exact: true }).click();

    const republishForm = await openEdit(page);
    await republishForm.getByRole("radio", { name: "전체 공개" }).click();
    await republishForm.getByRole("button", { name: "저장" }).click();
    await confirmation.getByRole("button", { name: "전체 공개" }).click();
    await expect(page.getByText("폴더를 전체 공개했어요.")).toBeVisible();
    await page.getByRole("button", { name: "완료", exact: true }).click();
    await page.getByRole("button", { name: "공개 설정, 전체 공개" }).click();
    await expect(page.getByText(`/folders/${FOLDER_ID}`, { exact: true })).toBeVisible();
    await expect(legacyLink).toHaveCount(0);
    expect(writes()).toHaveLength(5);
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

for (const kind of [
  "regular-missing",
  "ai-inherits",
  "ai-explicit-public",
  "ai-private-5xx",
  "ai-private-network",
  "ai-private-response-lost",
] as const) {
  test(`applies the creation visibility contract (${kind})`, async ({ page }) => {
    const [known, unknown] = makeFolders(2);
    const isAi = kind !== "regular-missing";
    const needsPrivateWrite = kind.startsWith("ai-private");
    const shouldRetry = kind === "ai-private-5xx" || kind === "ai-private-network";
    const desiredPublic = kind === "ai-explicit-public";
    const destination = kind === "regular-missing" ? unknown : known;
    const newLink = makeLink({
      id: 100,
      folderId: destination.id,
      isPublic: !needsPrivateWrite,
      status: needsPrivateWrite ? "C" : "A",
      workModel: null,
    });
    let aiAttempts = 0;
    const state = await mockApi(page, {
      folders: [
        { ...known, name: "공개 상태 확인됨", emoji: null, isPublic: true },
        { ...unknown, name: "공개 상태 미확인", emoji: null, isPublic: undefined },
      ],
      details: { [newLink.id]: makeDetail(newLink, { isOwner: true }) },
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
        "POST /api/links": (route) =>
          route.fulfill({ status: 201, json: envelope({ id: newLink.id }) }),
        "PUT /api/links/ai": (route) => {
          aiAttempts += 1;
          if (aiAttempts === 1 && kind === "ai-private-5xx") {
            return route.fulfill({ status: 503, json: { success: false, data: null } });
          }
          if (aiAttempts === 1 && kind === "ai-private-network") {
            return route.abort("failed");
          }
          if (kind === "ai-private-response-lost") {
            state.details[newLink.id].status = "G";
            state.details[newLink.id].workModel = "gpt-test";
            return route.abort("failed");
          }
          return route.fulfill({ json: envelope({ id: newLink.id }) });
        },
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
    if (kind !== "ai-inherits") await page.getByRole("radio", { name: "나만 보기" }).click();
    if (desiredPublic) await page.getByRole("radio", { name: "전체 공개" }).click();
    if (destination === unknown) {
      await choose("공개 상태 미확인");
      await expect(page.getByRole("radio", { name: "나만 보기" })).toBeChecked();
      await expect(page.getByRole("radio", { name: "전체 공개" })).toBeDisabled();
    }
    const url = "https://example.com/private-ai";
    const formUrl = page.getByRole("textbox", { name: "URL", exact: true });
    await formUrl.fill(url);
    if (needsPrivateWrite) {
      await page.getByRole("button", { name: /^메모·액션/ }).click();
      await page.getByRole("textbox", { name: "메모", exact: true }).fill("숨길 메모");
      await page.getByText("액션 추가", { exact: true }).click();
      await page.getByPlaceholder("액션 제목").fill("숨길 액션");
    } else {
      await page.getByRole("textbox", { name: "제목", exact: true }).fill("새 링크");
    }
    const submit = page.getByRole("button", { name: isAi ? "AI 정리" : "저장", exact: true });
    await submit.click();
    const creates = () =>
      state.requests.filter(({ method, path }) => method === "POST" && path === "/api/links");
    if (!isAi) {
      await expect
        .poll(() => creates()[0]?.body)
        .toMatchObject({ folderId: destination.id, isPublic: false });
      return;
    }
    if (shouldRetry) {
      await expect(
        page.getByText("링크는 나만 보기로 저장됐어요. 다음 시도에서 접수 여부를 확인해요."),
      ).toBeVisible();
      await expect(formUrl).toHaveValue(url);
      await expect(page.getByRole("textbox", { name: "메모", exact: true })).toHaveValue(
        "숨길 메모",
      );
      await expect(page.getByPlaceholder("액션 제목")).toHaveValue("숨길 액션");
      await submit.click();
    }
    await expect(page).toHaveURL(isWideProject() ? /\/home\?linkId=100$/ : /\/links\/100$/);
    const aiRequests = state.requests.filter(
      ({ method, path }) => method === "PUT" && path === "/api/links/ai",
    );
    expect(aiRequests).toHaveLength(shouldRetry ? 2 : 1);
    if (shouldRetry) {
      expect(
        state.requests.slice(
          state.requests.indexOf(aiRequests[0]) + 1,
          state.requests.indexOf(aiRequests[1]),
        ),
      ).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ method: "GET", path: `/api/links/${newLink.id}` }),
        ]),
      );
    }
    expect(
      state.requests.some(({ path, method }) => method === "PUT" && path.endsWith("/privacy")),
    ).toBe(false);
    for (const request of aiRequests) {
      expect(request.body).toMatchObject({
        folderId: destination.id,
        modelId: 10,
        url,
        userProviderId: 5,
      });
      expect(request.body).not.toHaveProperty("isPublic");
      if (needsPrivateWrite) {
        expect(request.body).toMatchObject({ id: newLink.id, title: null });
        expect(request.body).not.toHaveProperty("memo");
        expect(request.body).not.toHaveProperty("todos");
        expect(state.requests.indexOf(request)).toBeGreaterThan(
          state.requests.indexOf(creates()[0]),
        );
      } else {
        expect(request.body).not.toHaveProperty("id");
      }
    }
    expect(creates()).toHaveLength(needsPrivateWrite ? 1 : 0);
    if (needsPrivateWrite) {
      expect(creates()[0].body).toMatchObject({
        folderId: destination.id,
        isPublic: false,
        memo: "숨길 메모",
        sourceType: "INPUT",
        tags: [],
        title: "example.com/private-ai",
        todos: [{ title: "숨길 액션" }],
        url,
      });
    }
  });
}
