import { expect, test } from "@playwright/test";

import { isWideProject } from "./support/helpers";
import { envelope, makeDetail, makeFolders, makeLink, mockApi, scroll } from "./support/mock-api";

const FOLDER_ID = 1;
const PUBLIC_AT = "2026-11-22T10:00:00Z";

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
