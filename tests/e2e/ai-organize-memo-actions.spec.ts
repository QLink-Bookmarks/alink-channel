import { type Locator, type Page, expect, test } from "@playwright/test";

import { isWideProject } from "./support/helpers";
import { type MockDetail, makeDetail, makeLink } from "./support/mock-api";
import { type ApiHandler, mockSignedInApi } from "./support/mock-save-flow-api";

// #67: AI 정리 sends the memo and actions typed in the form with its request
// (PUT /api/links/ai, alink-backend#189), and the server saves them with the new link.

const LINK_ID = 102;
const LINK_URL = "https://example.com/plain";
const PENDING_TITLE = "AI 생성 대기 중 - example.com";
const MEMO = "다음 주 회의 전에 읽기";
// The past-time error, kept in the app as PAST_REMINDER_ERROR in features/todos/lib/todo-schedule.ts.
const PAST_REMINDER_ERROR = "이미 지난 시간이에요";

type StoredTodo = {
  id: number;
  title: string;
  reminderAt: string | null;
  repeatUntil: string | null;
  repeatDays: string[] | null;
  repeatTime: string | null;
  completedAt: string | null;
};

type AiServer = {
  aiRequests: Record<string, unknown>[];
  linkCreates: Record<string, unknown>[];
  memoPatches: Record<string, unknown>[];
  todoPosts: Record<string, unknown>[];
  todoPuts: Record<string, unknown>[];
  isAiRequestFailing: boolean;
  aiDelayMs: number;
  saveDelayMs: number;
  isLinkCreated: boolean;
  status: "G" | "A";
  summary: string | null;
  memo: string | null;
  todos: StoredTodo[];
};

function linkItem(server: AiServer) {
  return makeLink({
    id: LINK_ID,
    url: LINK_URL,
    title: server.status === "A" ? "정리된 제목" : PENDING_TITLE,
    status: server.status,
    thumbnailUrl: null,
  });
}

function detailOf(server: AiServer): MockDetail {
  return makeDetail(linkItem(server), {
    summary: server.summary,
    memo: server.memo,
    todos: server.todos,
  });
}

function storedTodos(todos: Omit<StoredTodo, "id" | "completedAt">[]): StoredTodo[] {
  return todos.map((todo, index) => ({
    id: 500 + index,
    title: todo.title,
    reminderAt: todo.reminderAt ?? null,
    repeatUntil: todo.repeatUntil ?? null,
    repeatDays: todo.repeatDays ?? null,
    repeatTime: todo.repeatTime ?? null,
    completedAt: null,
  }));
}

async function setUpAiServer(page: Page): Promise<AiServer> {
  const server: AiServer = {
    aiRequests: [],
    linkCreates: [],
    memoPatches: [],
    todoPosts: [],
    todoPuts: [],
    isAiRequestFailing: false,
    aiDelayMs: 300,
    saveDelayMs: 0,
    isLinkCreated: false,
    status: "G",
    summary: null,
    memo: null,
    todos: [],
  };
  const handler: ApiHandler = async ({ path, request, respond }) => {
    const method = request.method();
    // Like the server after #189: the link, its memo and the typed actions are saved
    // together, or nothing is.
    if (path === "/api/links/ai" && method === "PUT") {
      const body = request.postDataJSON() as {
        memo?: string | null;
        todos?: Omit<StoredTodo, "id" | "completedAt">[] | null;
      };
      server.aiRequests.push(body);
      await new Promise((resolve) => setTimeout(resolve, server.aiDelayMs));
      if (server.isAiRequestFailing) {
        await respond(null, 500);
        return true;
      }
      server.isLinkCreated = true;
      server.memo = body.memo ?? null;
      server.todos = storedTodos(body.todos ?? []);
      await respond({ id: LINK_ID });
      return true;
    }
    if (path === "/api/links" && method === "POST") {
      const body = request.postDataJSON() as {
        memo?: string;
        todos: Omit<StoredTodo, "id" | "completedAt">[];
      };
      server.linkCreates.push(body);
      await new Promise((resolve) => setTimeout(resolve, server.saveDelayMs));
      server.isLinkCreated = true;
      server.memo = body.memo ?? null;
      server.todos = storedTodos(body.todos);
      await respond({ id: LINK_ID }, 201);
      return true;
    }
    if (path === "/api/links" && method === "GET") {
      const contents = server.isLinkCreated ? [linkItem(server)] : [];
      await respond({ isEmpty: contents.length === 0, contents, nextCursor: null, hasNext: false });
      return true;
    }
    if (path === `/api/links/${LINK_ID}` && method === "GET") {
      await respond(detailOf(server));
      return true;
    }
    // AI 정리 must not save the memo or actions in follow-up calls; these only record.
    if (path === `/api/links/${LINK_ID}` && method === "PATCH") {
      server.memoPatches.push(request.postDataJSON() as Record<string, unknown>);
      await respond({ folderId: null, memo: server.memo, tags: [], todos: server.todos });
      return true;
    }
    if (path === "/api/todos" && method === "POST") {
      server.todoPosts.push(request.postDataJSON() as Record<string, unknown>);
      await respond({ id: 999 }, 201);
      return true;
    }
    if (/^\/api\/todos\/\d+$/.test(path) && method === "PUT") {
      server.todoPuts.push(request.postDataJSON() as Record<string, unknown>);
      await respond({ id: Number(path.split("/").pop()) });
      return true;
    }
    if (path === "/api/todos" && method === "GET") {
      const contents = server.todos.map((todo) => ({
        id: todo.id,
        title: todo.title,
        reminderAt: todo.reminderAt,
        completedAt: todo.completedAt,
        linkId: LINK_ID,
        linkUrl: LINK_URL,
        linkTitle: linkItem(server).title,
        linkThumbnailUrl: null,
        linkFaviconUrl: null,
      }));
      await respond({ isEmpty: contents.length === 0, contents, nextCursor: null, hasNext: false });
      return true;
    }
    return false;
  };
  await mockSignedInApi(page, [handler]);
  return server;
}

// What the AI worker does when it finishes: summary and status, and with 액션 생성 on,
// its own actions appended. The memo and the typed actions are left alone.
function finishAi(server: AiServer, aiTodoTitle?: string) {
  server.status = "A";
  server.summary = "AI가 만든 요약";
  if (aiTodoTitle) {
    server.todos.push({
      id: 900,
      title: aiTodoTitle,
      reminderAt: null,
      repeatUntil: null,
      repeatDays: null,
      repeatTime: null,
      completedAt: null,
    });
  }
}

function form(page: Page): Locator {
  return isWideProject()
    ? page.getByRole("dialog", { name: "새 링크 추가" })
    : page.getByRole("slider", { name: "Bottom Sheet" });
}

function aiButton(page: Page) {
  return page.getByRole("button", { name: "AI 정리", exact: true });
}

function saveButton(page: Page) {
  return page.getByRole("button", { name: "저장", exact: true });
}

async function openForm(page: Page, path = "/home") {
  await page.goto(path);
  await page.evaluate(() => navigator.clipboard.writeText(""));
  if (isWideProject()) {
    await page.getByText("새 링크", { exact: true }).first().click();
  } else {
    await page.getByLabel("새 링크").click();
  }
  await expect(page.getByText("새 링크 추가", { exact: true }).first()).toBeVisible();
  await page.getByRole("textbox", { name: "URL", exact: true }).fill(LINK_URL);
  await expect(aiButton(page)).toBeEnabled();
}

async function fillMemo(page: Page, memo: string) {
  await form(page).getByRole("textbox", { name: "메모", exact: true }).fill(memo);
}

async function addAction(
  page: Page,
  title: string,
  mode: "시간 없음" | "시간 선택",
  container: Locator = form(page),
) {
  await container.getByText("액션 추가", { exact: true }).click();
  const input = container.getByPlaceholder("액션 제목").last();
  await input.fill(title);
  await container.getByText(mode, { exact: true }).last().click();
}

const NEXT_YEAR = new Date().getFullYear() + 1;
// 03/15 at the picker's default 09:00, next year so it is never shown as past.
const PICKED_LABEL = "03/15 09:00";

async function pickDateAndTime(page: Page, container: Locator = form(page)) {
  await container.getByText("년-월-일", { exact: true }).last().click();
  const datePopover = page.getByText("날짜 선택", { exact: true }).locator("..");
  await datePopover.getByText(`${NEXT_YEAR}년`, { exact: true }).click();
  await datePopover.getByText("03월", { exact: true }).click();
  await datePopover.getByText("15일", { exact: true }).click();
  await datePopover.getByRole("button", { name: "확인", exact: true }).click();
  await expect(container.getByText(`${NEXT_YEAR}-03-15`, { exact: true })).toBeVisible();

  await container.getByText("오전 09:00", { exact: true }).last().click();
  const timePopover = page.getByText("시간선택", { exact: true }).locator("..");
  await timePopover.getByRole("button", { name: "확인", exact: true }).click();
  await expect(page.getByText("시간선택", { exact: true })).toHaveCount(0);
}

async function openActionsTabFromSidebar(page: Page) {
  await page
    .getByRole("button")
    .filter({ has: page.getByText("액션", { exact: true }) })
    .first()
    .click();
  await expect(page).toHaveURL(/\/todos$/);
}

function expectedReminderAt(page: Page) {
  return page.evaluate((year) => new Date(year, 2, 15, 9, 0).toISOString(), NEXT_YEAR);
}

async function expectOnNewLinkDetail(page: Page) {
  await expect(page.getByText("새 링크 추가", { exact: true })).toHaveCount(0);
  await expect(page).toHaveURL(isWideProject() ? /linkId=102/ : /\/links\/102$/);
  await expect(page.getByTestId("link-detail-memo")).toBeVisible();
}

test.beforeEach(async ({ context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
});

function expectNoFollowUpSaves(server: AiServer) {
  expect(server.memoPatches).toHaveLength(0);
  expect(server.todoPosts).toHaveLength(0);
}

test.describe("AI 정리 sends the memo and actions typed in the wide form (#67)", () => {
  test.beforeEach(() => {
    test.skip(!isWideProject(), "the memo and action fields are only in the wide form");
  });

  test("the memo and actions go with the AI 정리 request and show in the new link's detail and in 액션", async ({
    page,
  }) => {
    const server = await setUpAiServer(page);
    await openForm(page);
    await fillMemo(page, `  ${MEMO}  `);
    await addAction(page, "회의 자료 읽기", "시간 선택");
    await pickDateAndTime(page);
    await addAction(page, "링크 공유하기", "시간 없음");
    await aiButton(page).click();

    await expectOnNewLinkDetail(page);
    const reminderAt = await expectedReminderAt(page);
    expect(server.aiRequests).toHaveLength(1);
    expect(server.aiRequests[0]).toMatchObject({
      url: LINK_URL,
      memo: MEMO,
      todos: [
        {
          title: "회의 자료 읽기",
          reminderAt,
          repeatUntil: null,
          repeatDays: null,
          repeatTime: null,
          repeatTimezone: null,
        },
        {
          title: "링크 공유하기",
          reminderAt: null,
          repeatUntil: null,
          repeatDays: null,
          repeatTime: null,
          repeatTimezone: null,
        },
      ],
    });
    expect(server.aiRequests[0]).not.toHaveProperty("id");
    expectNoFollowUpSaves(server);

    const memo = page.getByTestId("link-detail-memo");
    await expect(memo.getByText(MEMO, { exact: true })).toBeVisible();
    const actions = page.getByTestId("link-detail-todos");
    await expect(actions.getByText("회의 자료 읽기", { exact: true })).toBeVisible();
    await expect(actions.getByText(PICKED_LABEL, { exact: true })).toBeVisible();
    await expect(actions.getByText("링크 공유하기", { exact: true })).toBeVisible();

    await page.goto("/todos");
    await expect(page.getByText("회의 자료 읽기", { exact: true }).first()).toBeVisible();
    await expect(page.getByText(PICKED_LABEL, { exact: true }).first()).toBeVisible();
  });

  test("with 액션 생성 on, the AI's actions join the typed ones and the memo stays after the summary arrives", async ({
    page,
  }) => {
    const server = await setUpAiServer(page);
    await openForm(page);
    await form(page).getByRole("switch").click();
    await fillMemo(page, MEMO);
    await addAction(page, "직접 쓴 액션", "시간 없음");
    await aiButton(page).click();

    await expectOnNewLinkDetail(page);
    expect(server.aiRequests[0]).toMatchObject({
      generateTodo: true,
      memo: MEMO,
      todos: [expect.objectContaining({ title: "직접 쓴 액션" })],
    });
    await expect(page.getByTestId("link-detail-todos").getByText("직접 쓴 액션")).toBeVisible();

    finishAi(server, "AI가 만든 액션");
    await page.reload();
    await expect(page.getByText("AI가 만든 요약").first()).toBeVisible();
    await expect(
      page.getByTestId("link-detail-memo").getByText(MEMO, { exact: true }),
    ).toBeVisible();
    const actions = page.getByTestId("link-detail-todos");
    await expect(actions.getByText("직접 쓴 액션", { exact: true })).toBeVisible();
    await expect(actions.getByText("AI가 만든 액션", { exact: true })).toBeVisible();
    expectNoFollowUpSaves(server);
  });

  test("a scheduled action without its date and time stops AI 정리 and shows the error under it", async ({
    page,
  }) => {
    const server = await setUpAiServer(page);
    await openForm(page);
    await fillMemo(page, MEMO);
    await addAction(page, "시간 없는 액션", "시간 없음");
    await addAction(page, "날짜 빠진 액션", "시간 선택");
    await aiButton(page).click();

    // Each action is the innermost box holding its title field and its mode chips; in
    // document order the second action's box comes last.
    const actionBoxes = form(page)
      .locator("div")
      .filter({ has: page.getByPlaceholder("액션 제목") })
      .filter({ hasText: "시간 선택" });
    const missingScheduleAction = actionBoxes.last();
    await expect(missingScheduleAction.getByPlaceholder("액션 제목")).toHaveValue("날짜 빠진 액션");
    await expect(
      missingScheduleAction.getByText("날짜와 시간을 선택해주세요.", { exact: true }),
    ).toBeVisible();
    await expect(form(page).getByText("날짜와 시간을 선택해주세요.", { exact: true })).toHaveCount(
      1,
    );
    await expect(form(page)).toBeVisible();
    expect(server.aiRequests).toHaveLength(0);
    expectNoFollowUpSaves(server);
  });

  test("when the AI 정리 request fails, no link is made, the failure notice shows and the memo and actions stay in the form", async ({
    page,
  }) => {
    const server = await setUpAiServer(page);
    server.isAiRequestFailing = true;
    await openForm(page);
    await fillMemo(page, MEMO);
    await addAction(page, "남아 있을 액션", "시간 없음");
    await aiButton(page).click();

    await expect(page.getByText("AI 정리 실패", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("AI 정리 시작", { exact: true })).toHaveCount(0);
    await expect(form(page)).toBeVisible();
    await expect(form(page).getByRole("textbox", { name: "메모", exact: true })).toHaveValue(MEMO);
    await expect(form(page).getByPlaceholder("액션 제목")).toHaveValue("남아 있을 액션");
    await expect(page).not.toHaveURL(/linkId=/);
    expect(server.aiRequests).toHaveLength(1);
    expect(server.isLinkCreated).toBe(false);
    expectNoFollowUpSaves(server);
    await expect(aiButton(page)).toBeEnabled();
    await expect(saveButton(page)).toBeEnabled();
  });

  test("a double press on AI 정리 sends one request", async ({ page }) => {
    const server = await setUpAiServer(page);
    await openForm(page);
    await fillMemo(page, MEMO);
    await addAction(page, "한 번만", "시간 없음");
    // Two presses in the same task, before React can re-render the button as disabled.
    await aiButton(page).evaluate((button: HTMLElement) => {
      button.click();
      button.click();
    });

    await expectOnNewLinkDetail(page);
    await expect(
      page.getByTestId("link-detail-todos").getByText("한 번만", { exact: true }),
    ).toHaveCount(1);
    expect(server.aiRequests).toHaveLength(1);
    expectNoFollowUpSaves(server);
  });

  test("저장 is disabled while the AI 정리 request is pending", async ({ page }) => {
    const server = await setUpAiServer(page);
    server.aiDelayMs = 1_500;
    await openForm(page);
    await page.getByRole("textbox", { name: "제목", exact: true }).fill("AI 정리 중 저장");
    await fillMemo(page, MEMO);
    await expect(saveButton(page)).toBeEnabled();
    await aiButton(page).click();

    await expect(saveButton(page)).toBeDisabled();
    await saveButton(page).click({ force: true });
    await expectOnNewLinkDetail(page);
    expect(server.linkCreates).toHaveLength(0);
    expect(server.aiRequests).toHaveLength(1);
  });

  test("AI 정리 is disabled while 저장 is creating the link", async ({ page }) => {
    const server = await setUpAiServer(page);
    server.saveDelayMs = 1_500;
    await openForm(page);
    await page.getByRole("textbox", { name: "제목", exact: true }).fill("저장 중 AI 정리");
    await fillMemo(page, MEMO);
    await addAction(page, "한 번만 만들 액션", "시간 없음");
    await saveButton(page).click();

    await expect(aiButton(page)).toBeDisabled();
    await aiButton(page).click({ force: true });
    await expect(page.getByText("새 링크 추가", { exact: true })).toHaveCount(0);
    expect(server.linkCreates).toHaveLength(1);
    expect(server.aiRequests).toHaveLength(0);
  });

  test("the 액션 tab already loaded before AI 정리 shows the new action without a reload", async ({
    page,
  }) => {
    const server = await setUpAiServer(page);
    await openForm(page, "/todos");
    await addAction(page, "탭에 바로 보일 액션", "시간 없음");
    await aiButton(page).click();

    await expectOnNewLinkDetail(page);
    expect(server.aiRequests).toHaveLength(1);
    await page.getByTestId("link-detail-close").click();
    await openActionsTabFromSidebar(page);
    await expect(
      page.getByRole("main").getByText("탭에 바로 보일 액션", { exact: true }),
    ).toBeVisible();
  });

  for (const press of ["AI 정리", "저장"] as const) {
    test(`a one-time action set to a past time stops ${press} and shows the error under it`, async ({
      page,
    }) => {
      // Pretend it is already noon on the day the picker will choose (09:00).
      await page.clock.setFixedTime(new Date(NEXT_YEAR, 2, 15, 12, 0));
      const server = await setUpAiServer(page);
      await openForm(page);
      await page.getByRole("textbox", { name: "제목", exact: true }).fill("지난 시각");
      await fillMemo(page, MEMO);
      await addAction(page, "앞으로 할 액션", "시간 없음");
      await addAction(page, "지난 시각 액션", "시간 선택");
      await pickDateAndTime(page);
      await expect(form(page).getByText(PAST_REMINDER_ERROR, { exact: true })).toHaveCount(0);

      await (press === "AI 정리" ? aiButton(page) : saveButton(page)).click();

      const pastAction = form(page)
        .locator("div")
        .filter({ has: page.getByPlaceholder("액션 제목") })
        .filter({ hasText: "시간 선택" })
        .last();
      await expect(pastAction.getByPlaceholder("액션 제목")).toHaveValue("지난 시각 액션");
      await expect(pastAction.getByText(PAST_REMINDER_ERROR, { exact: true })).toBeVisible();
      await expect(form(page).getByText(PAST_REMINDER_ERROR, { exact: true })).toHaveCount(1);
      await expect(form(page)).toBeVisible();
      expect(server.aiRequests).toHaveLength(0);
      expect(server.linkCreates).toHaveLength(0);
      expectNoFollowUpSaves(server);
    });
  }

  test("adding a one-time action at a past time in the link detail is refused with the same error", async ({
    page,
  }) => {
    await page.clock.setFixedTime(new Date(NEXT_YEAR, 2, 15, 12, 0));
    const server = await setUpAiServer(page);
    server.isLinkCreated = true;
    await page.goto("/links");
    await page.getByText(PENDING_TITLE).first().click();
    await expect(page).toHaveURL(/linkId=102/);
    await page
      .getByTestId("link-detail-todos")
      .getByRole("button", { name: "+ 액션 추가 / 수정" })
      .click();
    const editor = page.getByRole("dialog", { name: "액션 추가 / 수정" });
    await addAction(page, "상세에서 지난 시각", "시간 선택", editor);
    await pickDateAndTime(page, editor);
    await editor.getByRole("button", { name: "저장", exact: true }).click();

    await expect(editor.getByText(PAST_REMINDER_ERROR, { exact: true })).toHaveCount(1);
    await expect(editor.getByText("필수 항목을 입력해주세요.", { exact: true })).toHaveCount(0);
    await expect(editor).toBeVisible();
    expect(server.todoPosts).toHaveLength(0);
  });

  test("a saved action whose reminder has passed stops the link detail's 저장 with the same error", async ({
    page,
  }) => {
    await page.clock.setFixedTime(new Date(NEXT_YEAR, 2, 15, 12, 0));
    const server = await setUpAiServer(page);
    server.isLinkCreated = true;
    server.todos = [
      {
        id: 700,
        title: "알림이 지난 액션",
        reminderAt: new Date(NEXT_YEAR, 2, 15, 9, 0).toISOString(),
        repeatUntil: null,
        repeatDays: null,
        repeatTime: null,
        completedAt: null,
      },
    ];
    await page.goto("/links");
    await page.getByText(PENDING_TITLE).first().click();
    await expect(page).toHaveURL(/linkId=102/);
    await page
      .getByTestId("link-detail-todos")
      .getByRole("button", { name: "+ 액션 추가 / 수정" })
      .click();
    const editor = page.getByRole("dialog", { name: "액션 추가 / 수정" });
    await addAction(page, "새로 쓴 액션", "시간 없음", editor);
    await editor.getByRole("button", { name: "저장", exact: true }).click();

    await expect(editor.getByText(PAST_REMINDER_ERROR, { exact: true })).toHaveCount(1);
    await expect(editor).toBeVisible();
    expect(server.todoPuts).toHaveLength(0);
    expect(server.todoPosts).toHaveLength(0);
  });

  test("the 액션 tab already loaded before 저장 shows the new action without a reload", async ({
    page,
  }) => {
    const server = await setUpAiServer(page);
    await openForm(page, "/todos");
    await page.getByRole("textbox", { name: "제목", exact: true }).fill("직접 저장");
    await addAction(page, "저장 뒤 탭에 보일 액션", "시간 없음");
    await saveButton(page).click();

    await expect(page.getByText("새 링크 추가", { exact: true })).toHaveCount(0);
    expect(server.linkCreates).toHaveLength(1);
    await page.getByTestId("link-detail-close").click();
    await openActionsTabFromSidebar(page);
    await expect(
      page.getByRole("main").getByText("저장 뒤 탭에 보일 액션", { exact: true }),
    ).toBeVisible();
  });

  test("저장 still sends the memo and actions with the new link", async ({ page }) => {
    const server = await setUpAiServer(page);
    await openForm(page);
    await page.getByRole("textbox", { name: "제목", exact: true }).fill("직접 저장");
    await fillMemo(page, MEMO);
    await addAction(page, "저장으로 만든 액션", "시간 없음");
    await saveButton(page).click();

    await expect(page.getByText("새 링크 추가", { exact: true })).toHaveCount(0);
    expect(server.linkCreates).toEqual([
      expect.objectContaining({
        memo: MEMO,
        todos: [expect.objectContaining({ title: "저장으로 만든 액션", reminderAt: null })],
      }),
    ]);
    expect(server.aiRequests).toHaveLength(0);
    expectNoFollowUpSaves(server);
  });
});

test("AI 정리 without a memo or actions leaves both fields out and opens the new link as before (#67)", async ({
  page,
}) => {
  const server = await setUpAiServer(page);
  await openForm(page);
  if (isWideProject()) {
    // An action row with no title counts as no action.
    await form(page).getByText("액션 추가", { exact: true }).click();
    await fillMemo(page, "   ");
  }
  await aiButton(page).click();

  await expect(page.getByText("AI 정리 시작").first()).toBeVisible();
  await expectOnNewLinkDetail(page);
  expect(server.aiRequests).toHaveLength(1);
  expect(server.aiRequests[0]).not.toHaveProperty("memo");
  expect(server.aiRequests[0]).not.toHaveProperty("todos");
  expectNoFollowUpSaves(server);
});
