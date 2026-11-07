import { type Locator, type Page, expect, test } from "@playwright/test";

import { boxOf, cssOf, isWideProject } from "./support/helpers";
import { openDetailAt, setUpDetail } from "./support/link-detail-fixtures";
import {
  GOOD_IMAGE,
  HOUR_MS,
  type MockTodo,
  iso,
  makeFolders,
  makeLink,
  mockApi,
} from "./support/mock-api";
import { type ApiHandler, mockSignedInApi } from "./support/mock-save-flow-api";

// #88: the new link sheet keeps its head in place and asks before throwing input away, the
// detail's action editor asks before unsaved edits are left, and the actions tab marks a
// repeat past its end date as 지남 like the detail does.

const DAY_MS = 24 * HOUR_MS;
const UNSAVED_TITLE = "저장하지 않은 변경사항이 있어요";
const LINK_URL = "https://example.com/plain";

const PROVIDERS = [
  {
    providerId: 1,
    providerType: "GEMINI",
    models: [{ id: 10, model: "gemini-2.5-flash", priority: 1, userProviderId: 5 }],
  },
  {
    providerId: 2,
    providerType: "CLAUDE",
    models: [{ id: 20, model: "claude-sonnet-4-5", priority: 1, userProviderId: 6 }],
  },
];

type FormServer = { linkCreates: unknown[]; aiRequests: unknown[] };

async function setUpForm(page: Page): Promise<FormServer> {
  const server: FormServer = { linkCreates: [], aiRequests: [] };
  const folders = makeFolders(12);
  const handler: ApiHandler = async ({ path, request, respond }) => {
    if (path === "/api/users/me/settings") {
      await respond({
        display: { theme: "light", accent: "gray" },
        behavior: { allowsReminderNotification: false },
        ai: {
          defaultProvider: { id: 1, type: "GEMINI" },
          defaultModel: { id: 10, model: "gemini-2.5-flash" },
        },
        providers: [],
      });
      return true;
    }
    if (path === "/api/ai/providers/models") {
      await respond(PROVIDERS);
      return true;
    }
    if (path === "/api/folders" && request.method() === "GET") {
      await respond({ isEmpty: false, contents: folders, nextCursor: null, hasNext: false });
      return true;
    }
    if (path === "/api/links" && request.method() === "POST") {
      server.linkCreates.push(request.postDataJSON());
      await respond({ id: 101 }, 201);
      return true;
    }
    if (path === "/api/links/ai" && request.method() === "PUT") {
      server.aiRequests.push(request.postDataJSON());
      await respond({ id: 102 });
      return true;
    }
    return false;
  };
  await mockSignedInApi(page, [handler]);
  return server;
}

function form(page: Page): Locator {
  return isWideProject()
    ? page.getByRole("dialog", { name: "새 링크 추가" })
    : page.getByRole("slider", { name: "Bottom Sheet" });
}

function confirmDialog(page: Page) {
  return page.getByRole("dialog").filter({ hasText: UNSAVED_TITLE });
}

// The sheet's head sits above its scrolling body, outside the body's slider element.
function chrome(page: Page): Locator | Page {
  return isWideProject() ? form(page) : page;
}

function closeButton(page: Page) {
  return chrome(page).getByRole("button", { name: "닫기", exact: true });
}

function heading(page: Page, name: string) {
  return page.getByRole("heading", { name, exact: true });
}

async function openForm(page: Page) {
  await page.goto("/home");
  await page.evaluate(() => navigator.clipboard.writeText(""));
  if (isWideProject()) {
    await page.getByText("새 링크", { exact: true }).first().click();
  } else {
    await page.getByLabel("새 링크").click();
  }
  await expect(page.getByText("새 링크 추가", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "저장", exact: true })).toBeVisible();
}

async function fillMemoAndActions(page: Page) {
  await form(page).getByRole("textbox", { name: "URL", exact: true }).fill(LINK_URL);
  await form(page)
    .getByRole("button", { name: /^메모·액션/ })
    .click();
  await form(page).getByRole("textbox", { name: "메모", exact: true }).fill("연말에 갈 때 참고");
  for (const title of ["렌터카 예약 확인", "항공권 가격 확인"]) {
    const index = await form(page).getByTestId("todo-editor").count();
    await form(page).getByText("액션 추가", { exact: true }).click();
    await form(page)
      .getByTestId("todo-editor")
      .nth(index)
      .getByRole("textbox", { name: "액션 제목" })
      .fill(title);
  }
}

async function expectFormClosed(page: Page) {
  await expect(page.getByText("새 링크 추가", { exact: true })).toHaveCount(0);
}

// The sheet body's scroll element and how far it can go.
async function scrollSheetBody(page: Page, to: "end" | number) {
  return form(page).evaluate((node, target) => {
    const scroller = Array.from(node.querySelectorAll<HTMLElement>("*")).find(
      (element) =>
        /(auto|scroll)/.test(getComputedStyle(element).overflowY) &&
        element.scrollHeight > element.clientHeight + 4,
    );
    if (!scroller) return null;
    scroller.scrollTop = target === "end" ? scroller.scrollHeight : target;
    return {
      scrollTop: scroller.scrollTop,
      top: scroller.getBoundingClientRect().top,
    };
  }, to);
}

// The element under the center of `locator`, checked to be inside it (nothing on top).
async function isOnTop(page: Page, locator: Locator) {
  const box = await boxOf(locator);
  const handle = await locator.elementHandle();
  return page.evaluate(
    ({ x, y, target }) => {
      const hit = document.elementFromPoint(x, y);
      return hit != null && target != null && (target === hit || target.contains(hit));
    },
    { x: box.x + box.width / 2, y: box.y + box.height / 2, target: handle },
  );
}

test.beforeEach(async ({ context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
});

test.describe("new link sheet head (#88)", () => {
  test.beforeEach(() => {
    test.skip(isWideProject(), "mobile new link sheet");
  });

  test("the title and × stay in place over the scrolled body and do not overlap it", async ({
    page,
  }) => {
    await setUpForm(page);
    await openForm(page);
    await fillMemoAndActions(page);
    const title = heading(page, "새 링크 추가");
    // The preview spinner leaves and the sheet resizes; measure once it holds still.
    await expect(form(page).getByTestId("link-create-preview-image-loading")).toHaveCount(0);
    let previous = -1;
    await expect
      .poll(async () => {
        const current = Math.round((await boxOf(title)).y);
        const steady = current === previous;
        previous = current;
        return steady;
      })
      .toBe(true);
    const before = { title: await boxOf(title), close: await boxOf(closeButton(page)) };

    const scrolled = await scrollSheetBody(page, "end");
    expect(scrolled?.scrollTop ?? 0).toBeGreaterThan(40);
    expect(Math.abs((await boxOf(title)).y - before.title.y)).toBeLessThan(1);
    expect(Math.abs((await boxOf(closeButton(page))).y - before.close.y)).toBeLessThan(1);
    // The head ends above the scrolling body, so nothing scrolls under the ×.
    const closeBox = await boxOf(closeButton(page));
    expect(closeBox.y + closeBox.height).toBeLessThanOrEqual(scrolled!.top);
    expect(await isOnTop(page, closeButton(page))).toBe(true);
    await expect(
      form(page).getByRole("heading", { name: "링크", exact: true }),
    ).not.toBeInViewport();
  });

  test("the 폴더 선택 and AI 제공자 선택 steps keep their head with 뒤로 while the list scrolls", async ({
    page,
  }) => {
    await setUpForm(page);
    await openForm(page);

    await form(page)
      .getByRole("button", { name: /^폴더, / })
      .click();
    const folderTitle = heading(page, "폴더 선택");
    await expect(folderTitle).toBeVisible();
    const back = page.getByRole("button", { name: "뒤로", exact: true });
    const before = await boxOf(folderTitle);
    const scrolled = await scrollSheetBody(page, "end");
    expect(scrolled?.scrollTop ?? 0).toBeGreaterThan(0);
    expect(Math.abs((await boxOf(folderTitle)).y - before.y)).toBeLessThan(1);
    expect((await boxOf(back)).y + (await boxOf(back)).height).toBeLessThanOrEqual(scrolled!.top);
    await back.click();

    await form(page)
      .getByRole("button", { name: /^AI 제공자, / })
      .click();
    const providerTitle = heading(page, "AI 제공자 선택");
    await expect(providerTitle).toBeVisible();
    await expect(back).toBeVisible();
    const firstProvider = form(page)
      .getByRole("button", { name: / 선택$/ })
      .first();
    const titleBox = await boxOf(providerTitle);
    expect(titleBox.y + titleBox.height).toBeLessThan((await boxOf(firstProvider)).y);
  });
});

test.describe("closing the new link form with input (#88)", () => {
  test("× with a memo and actions asks first: 취소 keeps everything, 저장 안 함 closes", async ({
    page,
  }) => {
    await setUpForm(page);
    await openForm(page);
    await fillMemoAndActions(page);

    await closeButton(page).click();
    await expect(confirmDialog(page)).toBeVisible();
    await confirmDialog(page).getByRole("button", { name: "취소", exact: true }).click();
    await expect(confirmDialog(page)).toHaveCount(0);
    await expect(form(page).getByRole("textbox", { name: "메모", exact: true })).toHaveValue(
      "연말에 갈 때 참고",
    );
    await expect(form(page).getByTestId("todo-editor")).toHaveCount(2);

    await closeButton(page).click();
    await confirmDialog(page).getByRole("button", { name: "저장 안 함", exact: true }).click();
    await expectFormClosed(page);

    await openForm(page);
    await expect(form(page).getByRole("textbox", { name: "URL", exact: true })).toHaveValue("");
  });

  test("tapping outside or pressing Esc with input asks too", async ({ page }) => {
    await setUpForm(page);
    await openForm(page);
    await form(page).getByRole("textbox", { name: "URL", exact: true }).fill(LINK_URL);

    if (isWideProject()) {
      await page.keyboard.press("Escape");
      await expect(confirmDialog(page)).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(confirmDialog(page)).toHaveCount(0);
      await expect(form(page)).toBeVisible();
      await page.mouse.click(10, 10);
    } else {
      await page.getByRole("button", { name: "Bottom sheet backdrop" }).click({
        position: { x: 20, y: 20 },
      });
    }
    await expect(confirmDialog(page)).toBeVisible();
    await confirmDialog(page).getByRole("button", { name: "취소", exact: true }).click();
    await expect(form(page).getByRole("textbox", { name: "URL", exact: true })).toHaveValue(
      LINK_URL,
    );
  });

  test("dragging the sheet down with input asks and the sheet comes back up", async ({ page }) => {
    test.skip(isWideProject(), "mobile sheet drag");
    await setUpForm(page);
    await openForm(page);
    await form(page).getByRole("textbox", { name: "URL", exact: true }).fill(LINK_URL);

    const title = heading(page, "새 링크 추가");
    // Wait for the sheet to stop resizing, then grab the handle bar just above the title
    // (text on web takes a drag as a selection).
    let previous = -1;
    await expect
      .poll(async () => {
        const current = Math.round((await boxOf(title)).y);
        const steady = current === previous;
        previous = current;
        return steady;
      })
      .toBe(true);
    const start = await boxOf(title);
    const x = start.x + start.width / 2;
    const y = start.y - 16;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x, y + 500, { steps: 25 });
    await page.mouse.up();

    await expect(confirmDialog(page)).toBeVisible();
    await confirmDialog(page).getByRole("button", { name: "취소", exact: true }).click();
    await expect(title).toBeInViewport();
    await expect(page.getByRole("button", { name: "저장", exact: true })).toBeInViewport();
    await expect(form(page).getByRole("textbox", { name: "URL", exact: true })).toHaveValue(
      LINK_URL,
    );
  });

  test("an untouched form closes at once with × (and Esc on wide)", async ({ page }) => {
    await setUpForm(page);
    await openForm(page);
    await closeButton(page).click();
    await expectFormClosed(page);
    await expect(confirmDialog(page)).toHaveCount(0);

    if (isWideProject()) {
      await openForm(page);
      await page.keyboard.press("Escape");
      await expectFormClosed(page);
      await expect(confirmDialog(page)).toHaveCount(0);
    }
  });

  test("a saved or AI-organized link closes the form without asking", async ({ page }) => {
    const server = await setUpForm(page);
    await openForm(page);
    await fillMemoAndActions(page);
    await form(page).getByRole("textbox", { name: "제목", exact: true }).fill("저장할 링크");
    await page.getByRole("button", { name: "저장", exact: true }).click();
    await expect.poll(() => server.linkCreates.length).toBe(1);
    await expectFormClosed(page);
    await expect(confirmDialog(page)).toHaveCount(0);

    await openForm(page);
    await form(page).getByRole("textbox", { name: "URL", exact: true }).fill(LINK_URL);
    await form(page)
      .getByRole("button", { name: /^메모·액션/ })
      .click();
    await form(page).getByRole("textbox", { name: "메모", exact: true }).fill("AI로 정리");
    await page.getByRole("button", { name: "AI 정리", exact: true }).click();
    await expect.poll(() => server.aiRequests.length).toBe(1);
    await expectFormClosed(page);
    await expect(confirmDialog(page)).toHaveCount(0);
  });
});

// The full link (id 1) has 렌터카 예약 확인 (one time), 항공권 가격 확인 (repeat) and a done one.
const EDITED = "렌터카 반납 확인";

function editorTitle(page: Page, value: string) {
  return page.getByTestId("link-detail-todos-editor").locator(`input[value="${value}"]`);
}

async function editFirstAction(page: Page) {
  await page
    .getByTestId("link-detail-todo-list")
    .getByTestId(/^todo-item(-overdue)?$/)
    .filter({ hasText: "렌터카 예약 확인" })
    .getByTestId("todo-item-title")
    .click();
  await expect(page.getByTestId("link-detail-todos-editor")).toBeVisible();
}

async function changeFirstAction(page: Page) {
  await editFirstAction(page);
  await editorTitle(page, "렌터카 예약 확인").fill(EDITED);
}

async function expectViewWithOriginal(page: Page) {
  await expect(page.getByTestId("link-detail-todos-editor")).toHaveCount(0);
  await expect(
    page.getByTestId("link-detail-todo-list").getByText("렌터카 예약 확인", { exact: true }),
  ).toBeVisible();
}

function writes(state: Awaited<ReturnType<typeof setUpDetail>>["state"]) {
  return state.requests.filter(
    (request) => request.path.startsWith("/api/todos") && request.method !== "GET",
  );
}

test.describe("leaving the detail action editor, wide (#88)", () => {
  test.beforeEach(() => {
    test.skip(!isWideProject(), "wide detail panel");
  });

  test("clicking outside with an edit asks: 취소 keeps editing, 저장 안 함 drops it and closes", async ({
    page,
  }) => {
    const { state } = await setUpDetail(page);
    await openDetailAt(page, 1, true);
    await changeFirstAction(page);

    await page.mouse.click(400, 400);
    await expect(confirmDialog(page)).toBeVisible();
    await confirmDialog(page).getByRole("button", { name: "취소", exact: true }).click();
    await expect(editorTitle(page, EDITED)).toBeVisible();
    await expect(page.getByTestId("detail-panel")).toBeVisible();

    await page.mouse.click(400, 400);
    await confirmDialog(page).getByRole("button", { name: "저장 안 함", exact: true }).click();
    await expect(page.getByTestId("detail-panel")).toHaveCount(0);
    expect(writes(state)).toEqual([]);

    await openDetailAt(page, 1, true);
    await expectViewWithOriginal(page);
  });

  test("저장 in the dialog saves the edit and then leaves", async ({ page }) => {
    const { state } = await setUpDetail(page);
    await openDetailAt(page, 1, true);
    await changeFirstAction(page);

    await page.getByTestId("link-detail-close").click();
    await expect(confirmDialog(page)).toBeVisible();
    await confirmDialog(page).getByRole("button", { name: "저장", exact: true }).click();
    await expect(page.getByTestId("detail-panel")).toHaveCount(0);
    expect(writes(state).map((request) => `${request.method} ${request.path}`)).toEqual([
      "PUT /api/todos/21",
    ]);
  });

  test("Esc asks with an edit and goes back to the cards without one; a second Esc closes", async ({
    page,
  }) => {
    await setUpDetail(page);
    await openDetailAt(page, 1, true);
    await changeFirstAction(page);

    await page.keyboard.press("Escape");
    await expect(confirmDialog(page)).toBeVisible();
    await confirmDialog(page).getByRole("button", { name: "저장 안 함", exact: true }).click();
    await expectViewWithOriginal(page);
    await expect(page.getByTestId("detail-panel")).toBeVisible();

    await editFirstAction(page);
    await page.keyboard.press("Escape");
    await expect(confirmDialog(page)).toHaveCount(0);
    await expectViewWithOriginal(page);
    await expect(page.getByTestId("detail-panel")).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(page.getByTestId("detail-panel")).toHaveCount(0);
  });

  test("clicking another link's card behind the panel while editing asks first (the scrim takes the click)", async ({
    page,
  }) => {
    await setUpDetail(page);
    await openDetailAt(page, 1, true);
    await changeFirstAction(page);

    const other = page.getByTestId("link-card").filter({ hasText: "팀 온보딩" });
    const box = await boxOf(other);
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await expect(confirmDialog(page)).toBeVisible();
  });

  test("without a change, clicking outside closes at once", async ({ page }) => {
    await setUpDetail(page);
    await openDetailAt(page, 1, true);
    await editFirstAction(page);

    await page.mouse.click(400, 400);
    await expect(confirmDialog(page)).toHaveCount(0);
    await expect(page.getByTestId("detail-panel")).toHaveCount(0);
  });
});

test.describe("leaving the detail action editor, mobile (#88)", () => {
  test.beforeEach(() => {
    test.skip(isWideProject(), "mobile detail screen");
  });

  test("뒤로 with an edit asks; 저장 안 함 leaves, and 뒤로 without one leaves at once", async ({
    page,
  }) => {
    const { state } = await setUpDetail(page);
    await page.goto("/home");
    await openDetailAt(page, 1, false);
    await changeFirstAction(page);

    const back = page.getByRole("button", { name: "뒤로", exact: true });
    await back.click();
    await expect(confirmDialog(page)).toBeVisible();
    await confirmDialog(page).getByRole("button", { name: "취소", exact: true }).click();
    await expect(editorTitle(page, EDITED)).toBeVisible();
    await expect(page).toHaveURL(/\/links\/1$/);

    await back.click();
    await confirmDialog(page).getByRole("button", { name: "저장 안 함", exact: true }).click();
    await expect(page).not.toHaveURL(/\/links\/1$/);
    expect(writes(state)).toEqual([]);

    await openDetailAt(page, 1, false);
    await editFirstAction(page);
    await page.getByRole("button", { name: "뒤로", exact: true }).click();
    await expect(confirmDialog(page)).toHaveCount(0);
    await expect(page).not.toHaveURL(/\/links\/1$/);
  });
});

test.describe("actions tab 지남 for repeats (#88)", () => {
  const LINK = makeLink({ id: 1, title: "채용 공고" });

  function repeat(id: number, title: string, until: number, completedAt: string | null = null) {
    return {
      id,
      title,
      reminderAt: null,
      repeatDays: ["MON"],
      repeatTime: "08:00",
      repeatUntil: iso(until),
      completedAt,
      linkId: LINK.id,
      linkUrl: LINK.url,
      linkTitle: LINK.title,
      linkThumbnailUrl: GOOD_IMAGE,
      linkFaviconUrl: null,
    } as MockTodo;
  }

  test("a repeat past its end date is a red (지남) card in the 진행 중 section; one still running and a done one are plain", async ({
    page,
  }) => {
    await mockApi(page, {
      links: [LINK],
      todos: [
        repeat(1, "끝난 반복", -2 * DAY_MS),
        repeat(2, "이어지는 반복", 30 * DAY_MS),
        repeat(3, "끝낸 반복", -2 * DAY_MS, iso(-3 * DAY_MS)),
      ],
    });
    await page.goto("/todos");

    const card = (title: string) =>
      page.getByTestId(/^todo-item(-overdue)?$/).filter({ hasText: title });
    await expect(card("끝난 반복")).toHaveAttribute("data-testid", "todo-item-overdue");
    await expect(card("끝난 반복")).toContainText("(지남)");
    await expect(card("이어지는 반복")).toHaveAttribute("data-testid", "todo-item");
    await expect(card("이어지는 반복")).not.toContainText("(지남)");
    await expect(card("끝낸 반복")).toHaveAttribute("data-testid", "todo-item");

    // The sections still follow the server's status: the ended repeat is ACTIVE there.
    const sectionOf = (title: string) =>
      card(title).evaluate((node) => {
        let current: HTMLElement | null = node as HTMLElement;
        while (current && !/^(🔥 기간지남|⏳ 진행 중|✓ 완료)/.test(current.innerText ?? "")) {
          current = current.parentElement;
        }
        return current?.innerText.split("\n")[0] ?? null;
      });
    expect(await sectionOf("끝난 반복")).toBe("⏳ 진행 중");
    expect(await sectionOf("끝낸 반복")).toBe("✓ 완료");
    await expect(page.getByText("🔥 기간지남", { exact: true })).toHaveCount(0);
  });
});

test.describe("action title focus border (#88)", () => {
  test.beforeEach(() => {
    test.skip(!isWideProject(), "hover is a pointer case");
  });

  test("a focused title keeps the focus border under the pointer; hover alone shows the hover border", async ({
    page,
  }) => {
    await setUpForm(page);
    await openForm(page);
    await form(page)
      .getByRole("button", { name: /^메모·액션/ })
      .click();
    await form(page).getByText("액션 추가", { exact: true }).click();
    const input = form(page).getByRole("textbox", { name: "액션 제목" });
    await input.click();
    await expect(input).toBeFocused();
    await input.hover();
    const focusedHovered = await cssOf(input, "border-top-color");
    await page.mouse.move(0, 0);
    const focused = await cssOf(input, "border-top-color");
    expect(focusedHovered).toBe(focused);

    await form(page).getByRole("textbox", { name: "메모", exact: true }).click();
    await expect(input).not.toBeFocused();
    const idle = await cssOf(input, "border-top-color");
    await input.hover();
    const hovered = await cssOf(input, "border-top-color");
    expect(hovered).not.toBe(idle);
    expect(hovered).not.toBe(focused);
  });
});
