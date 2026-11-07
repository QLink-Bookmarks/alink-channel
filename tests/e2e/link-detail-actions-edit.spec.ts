import { type Locator, type Page, expect, test } from "@playwright/test";

import { boxOf, cssOf, isWideProject, openedUrls, stubWindowOpen } from "./support/helpers";
import { FULL_TODOS, openDetailAt, setUpDetail } from "./support/link-detail-fixtures";
import { GOOD_IMAGE } from "./support/mock-api";

// #74 U4: the link detail's 내 정리 rows, and its actions edited right where they are.

const SAVE_FAILED = "액션을 저장하지 못했어요. 잠시 후 다시 시도해주세요.";

async function openDetail(page: Page, id: number) {
  await openDetailAt(page, id, isWideProject());
}

function todosRow(page: Page) {
  return page.getByTestId("link-detail-todos");
}

function editor(page: Page) {
  return page.getByTestId("link-detail-todos-editor");
}

function editorRow(page: Page, title: string) {
  return editor(page)
    .getByTestId("todo-editor")
    .filter({ has: page.locator(`input[value="${title}"]`) });
}

function card(page: Page, title: string) {
  return todosRow(page)
    .getByTestId(/^todo-item(-overdue)?$/)
    .filter({ hasText: title });
}

function writes(state: Awaited<ReturnType<typeof setUpDetail>>["state"]) {
  return state.requests
    .filter(
      (request) =>
        request.path.startsWith("/api/todos") &&
        request.method !== "GET" &&
        !request.path.endsWith("/completed"),
    )
    .map((request) => `${request.method} ${request.path}`);
}

function formatUntil(iso: string) {
  const date = new Date(iso);
  return `${date.getMonth() + 1}월 ${date.getDate()}일까지`;
}

function formatOnce(iso: string) {
  const date = new Date(iso);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

async function isDisabled(locator: Locator) {
  return (await locator.getAttribute("aria-disabled")) === "true";
}

test.describe("내 정리 rows", () => {
  test("an empty link shows 폴더 없음 with a pencil and + 추가 for tags, memo and actions, and no dashed box anywhere", async ({
    page,
  }) => {
    await setUpDetail(page);
    await openDetail(page, 2);
    const notes = page.getByTestId("link-detail-my-notes");
    await expect(notes.getByText("내 정리", { exact: true })).toBeVisible();
    await expect(page.getByTestId("link-detail-folder-name")).toHaveText("폴더 없음");
    await expect(notes.getByRole("button", { name: "폴더 이동" })).toBeVisible();
    for (const name of ["태그 추가", "메모 추가", "액션 추가"]) {
      await expect(notes.getByRole("button", { name })).toHaveText("추가");
    }
    await expect(page.getByText("메모가 아직 없어요")).toHaveCount(0);
    await expect(page.getByText("아직 연결된 액션이 없어요")).toHaveCount(0);
    const dashed = await page
      .getByTestId("link-detail")
      .evaluate(
        (root) =>
          Array.from(root.querySelectorAll<HTMLElement>("*")).filter(
            (node) => getComputedStyle(node).borderTopStyle === "dashed",
          ).length,
      );
    expect(dashed).toBe(0);
  });

  test("the four rows share one label column, and filled rows keep a pencil at the right", async ({
    page,
  }) => {
    await setUpDetail(page);
    await openDetail(page, 1);
    const labels = [
      ...["폴더", "태그", "메모"].map((label) =>
        page.getByTestId("link-detail-my-notes").getByText(label, { exact: true }),
      ),
      todosRow(page).getByText("액션", { exact: true }),
    ];
    // Read all four in one pass, after the panel has stopped sliding in.
    await expect
      .poll(async () => {
        const xs = await Promise.all(labels.map(async (label) => (await boxOf(label)).x));
        return Math.max(...xs) - Math.min(...xs);
      })
      .toBeLessThanOrEqual(1);
    const pencils = ["폴더 이동", "태그 편집", "메모 수정"].map((name) =>
      page.getByTestId("link-detail").getByRole("button", { name, exact: true }),
    );
    const rights = await Promise.all(
      pencils.map(async (pencil) => {
        const box = await boxOf(pencil);
        return box.x + box.width;
      }),
    );
    for (const right of rights) expect(Math.abs(right - rights[0])).toBeLessThanOrEqual(1);
  });

  test("tags are added from + 추가 and removed from the pencil; the card follows", async ({
    page,
  }) => {
    const { state } = await setUpDetail(page);
    await openDetail(page, 2);
    const tags = page.getByTestId("link-detail-tags");
    await tags.getByRole("button", { name: "태그 추가" }).click();
    await tags.getByPlaceholder("태그").fill("온보딩");
    await tags.getByPlaceholder("태그").press("Enter");
    await expect(tags.getByText("#온보딩", { exact: true })).toBeVisible();
    await tags.getByRole("button", { name: "태그 편집 완료" }).click();
    await expect(tags.getByPlaceholder("태그")).toHaveCount(0);
    await expect.poll(() => state.details[2].tags).toEqual(["온보딩"]);

    await tags.getByRole("button", { name: "태그 편집" }).click();
    await tags.getByRole("button", { name: "#온보딩 태그 삭제" }).click();
    await expect(tags.getByText("#온보딩", { exact: true })).toHaveCount(0);
    await expect.poll(() => state.details[2].tags).toEqual([]);
    if (isWideProject()) {
      await expect(
        page.getByTestId("link-card").filter({ hasText: "팀 온보딩" }).getByText("#온보딩"),
      ).toHaveCount(0);
    }
  });

  test("the memo opens in place from + 추가, saves, and shows its text with a pencil", async ({
    page,
  }) => {
    await setUpDetail(page);
    await openDetail(page, 2);
    const memo = page.getByTestId("link-detail-memo");
    await memo.getByRole("button", { name: "메모 추가" }).click();
    const input = memo.getByPlaceholder("메모를 입력해주세요");
    await expect(input).toBeFocused();
    await input.fill("첫 주 일정 확인");
    await memo.getByRole("button", { name: "저장", exact: true }).click();
    await expect(page.getByTestId("link-detail-memo-text")).toHaveText("첫 주 일정 확인");
    await expect(memo.getByRole("button", { name: "메모 수정" })).toBeVisible();

    await memo.getByRole("button", { name: "메모 수정" }).click();
    await memo.getByPlaceholder("메모를 입력해주세요").fill("");
    await memo.getByRole("button", { name: "저장", exact: true }).click();
    await expect(memo.getByRole("button", { name: "메모 추가" })).toBeVisible();
  });

  test("수정 sends the representative image the server filled after the detail opened (#195)", async ({
    page,
  }) => {
    const { state } = await setUpDetail(page);
    await openDetail(page, 2);
    state.details[2] = { ...state.details[2], thumbnailUrl: GOOD_IMAGE, isVideo: false };
    await page.getByRole("button", { name: "수정", exact: true }).click();
    await page.getByPlaceholder("링크 제목").fill("온보딩 문서 v2");
    await page.getByRole("button", { name: "저장", exact: true }).click();
    await expect(page.getByTestId("link-detail-title")).toHaveText("온보딩 문서 v2");
    const put = state.requests
      .filter((r) => r.method === "PUT" && r.path === "/api/links/2")
      .at(-1);
    expect(put?.body).toMatchObject({ title: "온보딩 문서 v2", thumbnailUrl: GOOD_IMAGE });
  });
});

test.describe("head and AI surface", () => {
  test("the domain in the meta line opens the original", async ({ page }) => {
    await stubWindowOpen(page);
    await setUpDetail(page);
    await openDetail(page, 1);
    await expect(page.getByTestId("link-detail-source")).toContainText("brunch.co.kr");
    await page.getByTestId("link-detail-source").click();
    expect(await openedUrls(page)).toEqual(["https://brunch.co.kr/@jejutrip/142"]);
  });

  test("a summary alone, a preview alone, or neither: only what is there, and no surface without both", async ({
    page,
  }) => {
    await setUpDetail(page);
    await openDetail(page, 5);
    await expect(page.getByTestId("link-detail-summary")).toBeVisible();
    await expect(page.getByTestId("link-detail-excerpt")).toHaveCount(0);
    await openDetail(page, 2);
    await expect(page.getByTestId("link-detail-summary")).toHaveCount(0);
    await expect(page.getByTestId("link-detail-excerpt")).toBeVisible();
    await openDetail(page, 3);
    await expect(page.getByTestId("link-detail-ai-surface")).toHaveCount(0);
    await expect(page.getByTestId("link-detail-status")).toHaveText("AI 생성 중...");
  });
});

test.describe("action cards", () => {
  test("cards read the shared schedule wording: 11/20-style once, a repeat summary, nothing for a done one", async ({
    page,
  }) => {
    await setUpDetail(page);
    await openDetail(page, 1);
    const once = card(page, "렌터카 예약 확인");
    await expect(once.getByTestId("todo-item-reminder-once")).toBeVisible();
    await expect(once.getByTestId("todo-item-reminder-text")).toHaveText(
      formatOnce(FULL_TODOS[0].reminderAt!),
    );
    const repeat = card(page, "항공권 가격 확인");
    await expect(repeat.getByTestId("todo-item-reminder-repeat")).toBeVisible();
    await expect(repeat.getByTestId("todo-item-reminder-text")).toHaveText(
      `매주 월·목 오전 8:00 · ${formatUntil(FULL_TODOS[1].repeatUntil!)}`,
    );
    const done = card(page, "숙소 2박 결제");
    await expect(done.getByTestId("todo-item-reminder")).toHaveCount(0);
    await expect(done.getByTestId("todo-item-title")).toHaveCSS(
      "text-decoration-line",
      "line-through",
    );
    const icon = await cssOf(once.getByTestId("todo-item-reminder-once").locator("svg"), "color");
    // The editor chip reads the same line as the card.
    await once.getByTestId("todo-item-title").click();
    await expect(editorRow(page, "렌터카 예약 확인").getByTestId("todo-schedule-chip")).toHaveText(
      formatOnce(FULL_TODOS[0].reminderAt!),
    );
    await expect(editorRow(page, "항공권 가격 확인").getByTestId("todo-schedule-chip")).toHaveText(
      `매주 월·목 오전 8:00 · ${formatUntil(FULL_TODOS[1].repeatUntil!)}`,
    );
    await page.getByTestId("link-detail-todos-cancel").click();
    const text = await cssOf(once.getByTestId("todo-item-reminder-text"), "color");
    expect(icon).not.toBe(text);
  });

  test("an overdue action shows a red card with (지남)", async ({ page }) => {
    await setUpDetail(page);
    await openDetail(page, 4);
    const overdue = todosRow(page).getByTestId("todo-item-overdue");
    await expect(overdue).toHaveCount(1);
    await expect(overdue.getByTestId("todo-item-reminder-text")).toHaveText(/ \(지남\)$/);
  });

  test("the checkbox only toggles done and saves it; the card does not open the editor", async ({
    page,
  }) => {
    const { state } = await setUpDetail(page);
    await openDetail(page, 1);
    await card(page, "렌터카 예약 확인").getByRole("checkbox", { name: "완료 표시" }).click();
    await expect(card(page, "렌터카 예약 확인").getByRole("checkbox")).toHaveAccessibleName(
      "완료 취소, 렌터카 예약 확인",
    );
    await expect(editor(page)).toHaveCount(0);
    await expect
      .poll(() => state.requests.some((r) => r.path === "/api/todos/21/completed"))
      .toBe(true);
    await page.reload();
    await expect(card(page, "렌터카 예약 확인").getByRole("checkbox")).toHaveAccessibleName(
      "완료 취소, 렌터카 예약 확인",
    );
  });
});

test.describe("editing actions in place", () => {
  test("pressing a card opens the editor there: its panel open, its title focused, same left edge, width and checkbox x", async ({
    page,
  }) => {
    await setUpDetail(page);
    await openDetail(page, 1);
    const view = card(page, "렌터카 예약 확인");
    const viewBox = await boxOf(view);
    const viewCheckbox = await boxOf(view.getByRole("checkbox"));
    await view.getByTestId("todo-item-title").click();

    const row = editorRow(page, "렌터카 예약 확인");
    await expect(row.getByTestId("todo-schedule-panel")).toBeVisible();
    await expect(row.getByPlaceholder("액션 제목")).toBeFocused();
    await expect(editor(page).getByTestId("todo-schedule-panel")).toHaveCount(1);
    const rowBox = await boxOf(row);
    expect(Math.abs(rowBox.x - viewBox.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(rowBox.width - viewBox.width)).toBeLessThanOrEqual(1);
    const editCheckbox = await boxOf(row.getByRole("checkbox"));
    expect(Math.abs(editCheckbox.x - viewCheckbox.x)).toBeLessThanOrEqual(1);
    // The same round checkbox as the card.
    expect(Math.round(editCheckbox.width)).toBe(Math.round(viewCheckbox.width));
    const radius = parseFloat(await cssOf(row.getByRole("checkbox"), "border-top-left-radius"));
    expect(radius).toBeGreaterThanOrEqual(editCheckbox.width / 2 - 0.5);
    await expect(editor(page).getByTestId("todo-editor")).toHaveCount(3);
    await expect(editor(page).getByText("액션 추가", { exact: true })).toHaveCount(0);
  });

  test("while editing, 수정, 새로고침 and the other pencils and + 추가 are off; ★, 공유 and 링크 삭제 still work", async ({
    page,
  }) => {
    await setUpDetail(page);
    await openDetail(page, 1);
    await card(page, "렌터카 예약 확인").getByTestId("todo-item-title").click();
    await expect(editor(page)).toBeVisible();
    for (const [scope, name] of [
      ["link-detail-toolbar", "수정"],
      ["link-detail-toolbar", "새로고침"],
      ["link-detail-my-notes", "폴더 이동"],
      ["link-detail-my-notes", "태그 편집"],
      ["link-detail-my-notes", "메모 수정"],
    ]) {
      const button = page.getByTestId(scope).getByRole("button", { name, exact: true });
      expect(await isDisabled(button), name).toBe(true);
      expect(Number(await cssOf(button, "opacity")), name).toBeLessThan(0.5);
    }
    await page.getByTestId("link-detail-folder-move").click({ force: true });
    await expect(page.getByRole("button", { name: "확인", exact: true })).toHaveCount(0);

    await page.getByTestId("link-detail-favorite").click();
    await expect(page.getByTestId("link-detail-favorite")).toHaveAccessibleName("바로가기 해제");
    expect(await isDisabled(page.getByTestId("link-detail-share"))).toBe(false);
    await page.getByRole("button", { name: "링크 삭제" }).click();
    await expect(page.getByText("링크를 삭제할까요?")).toBeVisible();
    await page.getByRole("button", { name: "취소", exact: true }).last().click();
    await expect(editor(page)).toBeVisible();
  });

  test("+ 추가 enters editing with a new row focused, and adds one more row while editing", async ({
    page,
  }) => {
    await setUpDetail(page);
    await openDetail(page, 1);
    const add = todosRow(page).getByRole("button", { name: "액션 추가" });
    await add.click();
    const rows = editor(page).getByTestId("todo-editor");
    await expect(rows).toHaveCount(4);
    await expect(rows.last().getByPlaceholder("액션 제목")).toBeFocused();
    await expect(rows.last().getByTestId("todo-schedule-chip")).toHaveText(/알림 없음/);
    await add.click();
    await expect(rows).toHaveCount(5);
    await expect(rows.last().getByPlaceholder("액션 제목")).toBeFocused();
  });

  test("an empty 액션 row's + 추가 opens the editor with one empty row", async ({ page }) => {
    await setUpDetail(page);
    await openDetail(page, 2);
    await todosRow(page).getByRole("button", { name: "액션 추가" }).click();
    const rows = editor(page).getByTestId("todo-editor");
    await expect(rows).toHaveCount(1);
    await expect(rows.first().getByPlaceholder("액션 제목")).toBeFocused();
  });

  test("done changes in the editor hide the chip, are undone by 취소 and saved by 저장", async ({
    page,
  }) => {
    const { state } = await setUpDetail(page);
    await openDetail(page, 1);
    await card(page, "렌터카 예약 확인").getByTestId("todo-item-title").click();
    const row = editorRow(page, "렌터카 예약 확인");
    await row.getByRole("checkbox", { name: "완료 표시" }).click();
    await expect(row.getByTestId("todo-schedule-chip")).toHaveCount(0);
    await expect(row.getByTestId("todo-schedule-panel")).toHaveCount(0);
    await expect(row.getByPlaceholder("액션 제목")).toHaveCSS(
      "text-decoration-line",
      "line-through",
    );
    await expect(row.getByRole("button", { name: "액션 삭제" })).toBeVisible();

    await page.getByTestId("link-detail-todos-cancel").click();
    await expect(editor(page)).toHaveCount(0);
    await expect(card(page, "렌터카 예약 확인").getByRole("checkbox")).toHaveAccessibleName(
      "완료 표시, 렌터카 예약 확인",
    );
    expect(writes(state)).toEqual([]);

    await card(page, "렌터카 예약 확인").getByTestId("todo-item-title").click();
    await editorRow(page, "렌터카 예약 확인").getByRole("checkbox", { name: "완료 표시" }).click();
    await page.getByTestId("link-detail-todos-save").click();
    await expect(editor(page)).toHaveCount(0);
    await expect(card(page, "렌터카 예약 확인").getByRole("checkbox")).toHaveAccessibleName(
      "완료 취소, 렌터카 예약 확인",
    );
    expect(writes(state)).toEqual([]);
    expect(state.requests.filter((r) => r.path === "/api/todos/21/completed")).toHaveLength(1);
    await page.goto("/todos");
    await expect(
      page
        .getByRole("main")
        .getByTestId(/^todo-item(-overdue)?$/)
        .filter({ hasText: "렌터카 예약 확인" })
        .getByRole("checkbox"),
    ).toHaveAccessibleName("완료 취소, 렌터카 예약 확인");
  });

  test("저장 sends only what changed: a new title and schedule, a removed action and a new one; the detail and the actions tab follow", async ({
    page,
  }) => {
    const { state } = await setUpDetail(page);
    await openDetail(page, 1);
    await card(page, "항공권 가격 확인").getByTestId("todo-item-title").click();
    const flight = editorRow(page, "항공권 가격 확인");
    // The schedule changes too: the repeat is turned off (its panel opened with the card).
    await flight.getByTestId("todo-schedule-panel").getByText("알림 없음", { exact: true }).click();
    await flight.getByPlaceholder("액션 제목").fill("항공권 최저가 확인");
    await editorRow(page, "숙소 2박 결제").getByRole("button", { name: "액션 삭제" }).click();
    await todosRow(page).getByRole("button", { name: "액션 추가" }).click();
    await editor(page)
      .getByTestId("todo-editor")
      .last()
      .getByPlaceholder("액션 제목")
      .fill("공항 픽업 예약");
    await page.getByTestId("link-detail-todos-save").click();

    await expect(editor(page)).toHaveCount(0);
    expect(writes(state)).toEqual(["DELETE /api/todos/23", "PUT /api/todos/22", "POST /api/todos"]);
    expect(
      state.requests.find((r) => r.method === "PUT" && r.path === "/api/todos/22")?.body,
    ).toMatchObject({ title: "항공권 최저가 확인", repeatDays: null, reminderAt: null });
    await expect(card(page, "항공권 최저가 확인")).toBeVisible();
    await expect(card(page, "항공권 최저가 확인").getByTestId("todo-item-reminder")).toHaveCount(0);
    await expect(card(page, "공항 픽업 예약")).toBeVisible();
    await expect(card(page, "숙소 2박 결제")).toHaveCount(0);
    await expect(card(page, "렌터카 예약 확인")).toBeVisible();

    // The actions tab shows the same: renamed, removed and added.
    await page.goto("/todos");
    const tab = page.getByRole("main");
    await expect(tab.getByText("항공권 최저가 확인", { exact: true })).toBeVisible();
    await expect(tab.getByText("공항 픽업 예약", { exact: true })).toBeVisible();
    await expect(tab.getByText("숙소 2박 결제", { exact: true })).toHaveCount(0);
  });

  test("an overdue action keeps its past time until it is changed; renamed and done, it saves without the past reminder", async ({
    page,
  }) => {
    const { state } = await setUpDetail(page);
    await openDetail(page, 4);
    await card(page, "물때 확인").getByTestId("todo-item-title").click();
    const row = editorRow(page, "물때 확인");
    await expect(row.getByText("이미 지난 시간이에요", { exact: true })).toHaveCount(0);
    await row.getByPlaceholder("액션 제목").fill("물때 확인함");
    // Renamed, it is sent again, and the server refuses a past reminder: the editor says so.
    await expect(page.getByTestId("todo-error-summary")).toHaveText("확인할 액션이 1개 있어요");
    await editorRow(page, "물때 확인함").getByRole("checkbox", { name: "완료 표시" }).click();
    await expect(page.getByTestId("todo-error-summary")).toHaveCount(0);
    await page.getByTestId("link-detail-todos-save").click();

    await expect(editor(page)).toHaveCount(0);
    const put = state.requests.find((r) => r.method === "PUT" && r.path === "/api/todos/41");
    expect(put?.body).toMatchObject({ title: "물때 확인함", reminderAt: null });
    await expect(card(page, "물때 확인함").getByRole("checkbox")).toHaveAccessibleName(
      "완료 취소, 물때 확인함",
    );
  });

  test("취소 drops every change", async ({ page }) => {
    const { state } = await setUpDetail(page);
    await openDetail(page, 1);
    await card(page, "렌터카 예약 확인").getByTestId("todo-item-title").click();
    await editorRow(page, "렌터카 예약 확인").getByPlaceholder("액션 제목").fill("바뀐 제목");
    await editorRow(page, "숙소 2박 결제").getByRole("button", { name: "액션 삭제" }).click();
    await page.getByTestId("link-detail-todos-cancel").click();
    await expect(card(page, "렌터카 예약 확인")).toBeVisible();
    await expect(card(page, "숙소 2박 결제")).toBeVisible();
    await expect(card(page, "바뀐 제목")).toHaveCount(0);
    expect(writes(state)).toEqual([]);
  });

  test("a missing time shows 시간 미정 and the summary beside the buttons, no alert, and nothing is saved", async ({
    page,
  }) => {
    const { state } = await setUpDetail(page);
    await openDetail(page, 2);
    await todosRow(page).getByRole("button", { name: "액션 추가" }).click();
    const row = editor(page).getByTestId("todo-editor").first();
    await row.getByPlaceholder("액션 제목").fill("시간 없는 액션");
    await row.getByTestId("todo-schedule-chip").click();
    await row.getByTestId("todo-schedule-panel").getByText("한 번", { exact: true }).click();
    await row.getByTestId("todo-schedule-panel").getByText("날짜 선택", { exact: true }).click();
    await page.getByRole("button", { name: "확인", exact: true }).click();
    await page.getByTestId("link-detail-todos-save").click();

    await expect(row.getByTestId("todo-schedule-chip")).toHaveText("시간 미정");
    await expect(row.getByText("시간을 선택해주세요.", { exact: true })).toBeVisible();
    const summary = page.getByTestId("todo-error-summary");
    await expect(summary).toHaveText("확인할 액션이 1개 있어요");
    await expect(page.getByText(SAVE_FAILED)).toHaveCount(0);
    expect(writes(state)).toEqual([]);
    const summaryBox = await boxOf(summary);
    const saveBox = await boxOf(page.getByTestId("link-detail-todos-save"));
    if (isWideProject()) {
      expect(
        Math.abs(summaryBox.y + summaryBox.height / 2 - (saveBox.y + saveBox.height / 2)),
      ).toBeLessThanOrEqual(4);
      expect(summaryBox.x).toBeLessThan(saveBox.x);
    } else {
      expect(summaryBox.y + summaryBox.height).toBeLessThanOrEqual(saveBox.y);
    }
    for (const old of ["필수 항목을 입력해주세요.", "액션 제목을 모두 입력해주세요."]) {
      await expect(page.getByText(old)).toHaveCount(0);
    }
  });

  test("a schedule without a title keeps 저장 on and shows 액션 제목을 입력해 주세요", async ({
    page,
  }) => {
    const { state } = await setUpDetail(page);
    await openDetail(page, 2);
    await todosRow(page).getByRole("button", { name: "액션 추가" }).click();
    const row = editor(page).getByTestId("todo-editor").first();
    await row.getByTestId("todo-schedule-chip").click();
    await row.getByTestId("todo-schedule-panel").getByText("한 번", { exact: true }).click();
    await row.getByTestId("todo-schedule-panel").getByText("날짜 선택", { exact: true }).click();
    await page.getByRole("button", { name: "확인", exact: true }).click();
    const save = page.getByTestId("link-detail-todos-save");
    await expect(save).toBeEnabled();
    await save.click();
    await expect(row.getByText("액션 제목을 입력해 주세요", { exact: true })).toBeVisible();
    expect(writes(state)).toEqual([]);
  });

  test("a failed request shows only the alert, keeps the edits, clears on the next change, and a retry sends only what is left", async ({
    page,
  }) => {
    // The first POST succeeds, the second one fails once.
    let postCount = 0;
    const { state } = await setUpDetail(page, {
      todoWrites: { shouldFail: (method) => method === "POST" && ++postCount === 2 },
    });
    await openDetail(page, 2);
    const add = todosRow(page).getByRole("button", { name: "액션 추가" });
    await add.click();
    await editor(page)
      .getByTestId("todo-editor")
      .last()
      .getByPlaceholder("액션 제목")
      .fill("첫 액션");
    await add.click();
    await editor(page)
      .getByTestId("todo-editor")
      .last()
      .getByPlaceholder("액션 제목")
      .fill("둘째 액션");
    await page.getByTestId("link-detail-todos-save").click();

    const alert = page.getByText(SAVE_FAILED);
    await expect(alert).toBeVisible();
    await expect(page.getByTestId("todo-error-summary")).toHaveCount(0);
    await expect(editor(page).getByTestId("todo-editor")).toHaveCount(2);
    await expect(page.getByText("액션 저장에 실패했습니다. 서버 응답을 확인해주세요.")).toHaveCount(
      0,
    );

    await editor(page)
      .getByTestId("todo-editor")
      .last()
      .getByPlaceholder("액션 제목")
      .fill("둘째 액션!");
    await expect(alert).toHaveCount(0);

    await page.getByTestId("link-detail-todos-save").click();
    await expect(editor(page)).toHaveCount(0);
    const titles = state.requests
      .filter((r) => r.method === "POST" && r.path === "/api/todos")
      .map((r) => (r.body as { title: string }).title);
    expect(titles.filter((title) => title === "첫 액션")).toHaveLength(1);
    await expect(card(page, "첫 액션")).toHaveCount(1);
    await expect(card(page, "둘째 액션!")).toHaveCount(1);
  });

  test("while saving, 저장 spins, the rows are locked, and pressing again saves once", async ({
    page,
  }) => {
    const { state } = await setUpDetail(page, { todoWrites: { delayMs: 800 } });
    await openDetail(page, 2);
    await todosRow(page).getByRole("button", { name: "액션 추가" }).click();
    const title = editor(page).getByTestId("todo-editor").first().getByPlaceholder("액션 제목");
    await title.fill("한 번만 저장");
    const save = page.getByTestId("link-detail-todos-save");
    await save.click();
    await expect(save).toBeDisabled();
    await expect(save.getByLabel("저장 중")).toBeVisible();
    await expect(title).not.toBeEditable();
    await expect(page.getByTestId("link-detail-todos-cancel")).toBeDisabled();
    await save.click({ force: true });
    await expect(editor(page)).toHaveCount(0);
    expect(writes(state)).toEqual(["POST /api/todos"]);
  });

  test("the title stops at 50 characters with the n/50 counter, as in the create form", async ({
    page,
  }) => {
    await setUpDetail(page);
    await openDetail(page, 2);
    await todosRow(page).getByRole("button", { name: "액션 추가" }).click();
    const row = editor(page).getByTestId("todo-editor").first();
    await row.getByPlaceholder("액션 제목").fill("가".repeat(60));
    await expect(row.getByPlaceholder("액션 제목")).toHaveValue("가".repeat(50));
    await expect(row.getByTestId("todo-editor-title-counter")).toHaveText("50/50");
  });
});

test.describe("widths", () => {
  test("768px is the full-screen detail with a 600px centred body; 769px is the side panel", async ({
    page,
  }) => {
    test.skip(isWideProject(), "set per width below");
    await setUpDetail(page);
    await page.setViewportSize({ width: 768, height: 900 });
    await openDetailAt(page, 1, false);
    const title = await boxOf(page.getByTestId("link-detail-title"));
    expect(Math.round(title.x)).toBe(84 + 16);
    expect(Math.round(title.width)).toBeLessThanOrEqual(600 - 32);
    await expect(page.getByTestId("detail-panel")).toHaveCount(0);

    await page.setViewportSize({ width: 769, height: 900 });
    await openDetailAt(page, 1, true);
    await expect(page.getByTestId("detail-panel")).toBeVisible();
  });

  test("the mobile header keeps back and the four commands on one line at 390px", async ({
    page,
  }) => {
    test.skip(isWideProject(), "the mobile header");
    await setUpDetail(page);
    await openDetail(page, 1);
    const header = page.getByTestId("app-header");
    await expect(header).toHaveCount(1);
    const back = await boxOf(header.getByRole("button", { name: "뒤로" }));
    for (const name of ["바로가기 추가", "공유", "수정", "새로고침"]) {
      const box = await boxOf(header.getByRole("button", { name, exact: true }));
      expect(
        Math.abs(box.y + box.height / 2 - (back.y + back.height / 2)),
        name,
      ).toBeLessThanOrEqual(1);
      expect(box.x + box.width, name).toBeLessThanOrEqual(390);
    }
    await expect(page.getByTestId("app-header-title")).toHaveCount(0);
  });
});
