import { type Locator, type Page, expect, test } from "@playwright/test";

import { isWideProject } from "./support/helpers";
import { makeDetail, makeLink, mockApi } from "./support/mock-api";
import { type ApiHandler, mockSignedInApi } from "./support/mock-save-flow-api";

// #74 U2: the action editor (V4 face, ghost title, schedule chip and panel, 50-character
// title, inline errors and the error summary). Checked in the create form, which has the
// editor folded under 메모·액션, and in the link detail's action sheet on mobile.

const NEXT_YEAR = new Date().getFullYear() + 1;
const PAST_REMINDER_ERROR = "이미 지난 시간이에요";
const TITLE_REQUIRED_ERROR = "액션 제목을 입력해 주세요";
const LINK_URL = "https://example.com/plain";
const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
const DATE_FIELD_LABEL = /^\d{1,2}월 \d{1,2}일 \([일월화수목금토]\)$/;

// A picked date in the date field: `11월 20일 (금)`.
function dateFieldLabel(year: number, month: number, day: number) {
  return `${month}월 ${day}일 (${WEEKDAYS[new Date(year, month - 1, day).getDay()]})`;
}

type FormServer = { linkCreates: Record<string, unknown>[] };

async function setUpFormServer(page: Page): Promise<FormServer> {
  const server: FormServer = { linkCreates: [] };
  const handler: ApiHandler = async ({ path, request, respond }) => {
    if (path === "/api/links" && request.method() === "POST") {
      server.linkCreates.push(request.postDataJSON() as Record<string, unknown>);
      await respond({ id: 101 }, 201);
      return true;
    }
    return false;
  };
  await mockSignedInApi(page, [handler]);
  return server;
}

function form(page: Page): Locator {
  return page.getByRole("dialog", { name: "새 링크 추가" });
}

function saveButton(page: Page) {
  return page.getByRole("button", { name: "저장", exact: true });
}

function aiButton(page: Page) {
  return page.getByRole("button", { name: "AI 정리", exact: true });
}

async function openForm(page: Page) {
  await page.goto("/home");
  await page.evaluate(() => navigator.clipboard.writeText(""));
  await page.getByText("새 링크", { exact: true }).first().click();
  await expect(page.getByText("새 링크 추가", { exact: true }).first()).toBeVisible();
  await page.getByRole("textbox", { name: "URL", exact: true }).fill(LINK_URL);
  await page.getByRole("textbox", { name: "제목", exact: true }).fill("직접 저장");
  await expect(saveButton(page)).toBeEnabled();
  await form(page)
    .getByRole("button", { name: /^메모·액션/ })
    .click();
  await expect(form(page).getByText("액션 추가", { exact: true })).toBeVisible();
}

function actions(container: Locator) {
  return container.getByTestId("todo-editor");
}

async function addAction(container: Locator, title = "") {
  const index = await actions(container).count();
  await container.getByText("액션 추가", { exact: true }).click();
  const action = actions(container).nth(index);
  await expect(action).toBeVisible();
  if (title) await titleOf(action).fill(title);
  return action;
}

function titleOf(action: Locator) {
  return action.getByRole("textbox", { name: "액션 제목" });
}

function chipOf(action: Locator) {
  return action.getByTestId("todo-schedule-chip");
}

function panelOf(action: Locator) {
  return action.getByTestId("todo-schedule-panel");
}

async function pickMode(action: Locator, mode: "알림 없음" | "한 번" | "반복") {
  if ((await panelOf(action).count()) === 0) await chipOf(action).click();
  await panelOf(action).getByText(mode, { exact: true }).click();
}

// A wheel keeps snapping while it scrolls, so a press can miss; the caller retries.
async function pressWheelItem(popover: Locator, label: string) {
  const item = popover.getByText(label, { exact: true });
  await item.scrollIntoViewIfNeeded({ timeout: 2000 });
  await item.click({ force: true, timeout: 2000 });
  await expect(item).toHaveClass(/font-bold/, { timeout: 1000 });
  // Let the wheel finish its snap (it commits 140 ms after the last scroll).
  await popover.page().waitForTimeout(400);
}

async function pickDate(
  page: Page,
  action: Locator,
  month: number,
  day: number,
  { year = NEXT_YEAR, field = "날짜 선택" }: { year?: number; field?: string } = {},
) {
  const picked = dateFieldLabel(year, month, day);
  let fieldLabel = field;
  // The wheels keep snapping while they scroll, so a press can miss; pick again until the
  // field shows the date.
  await expect(async () => {
    const openConfirm = page.getByRole("button", { name: "취소", exact: true });
    if ((await page.getByRole("button", { name: "확인", exact: true }).count()) > 0) {
      await openConfirm.last().click({ timeout: 2000 });
    }
    await panelOf(action).getByText(fieldLabel, { exact: true }).click({ timeout: 2000 });
    // The popover's own heading is also 날짜 선택; it renders after the field.
    const popover = page.getByText("날짜 선택", { exact: true }).last().locator("..");
    await page.waitForTimeout(400);
    await pressWheelItem(popover, `${year}년`);
    await pressWheelItem(popover, `${String(month).padStart(2, "0")}월`);
    await pressWheelItem(popover, `${String(day).padStart(2, "0")}일`);
    await popover.getByRole("button", { name: "확인", exact: true }).click({ timeout: 2000 });
    await expect(page.getByRole("button", { name: "확인", exact: true })).toHaveCount(0);
    const shown = panelOf(action).getByText(picked, { exact: true });
    if ((await shown.count()) === 0) {
      fieldLabel = (await panelOf(action).getByText(DATE_FIELD_LABEL).count())
        ? ((await panelOf(action).getByText(DATE_FIELD_LABEL).first().textContent()) ?? field)
        : field;
    }
    await expect(shown).toBeVisible({ timeout: 1000 });
  }).toPass();
}

async function pickTime(page: Page, field: Locator, hour12?: string, meridiem?: "AM" | "PM") {
  await field.click();
  const popover = page.getByText("시간선택", { exact: true }).locator("..");
  await page.waitForTimeout(400);
  if (hour12) await popover.getByText(hour12, { exact: true }).first().click();
  if (meridiem) await pressWheelItem(popover, meridiem);
  await popover.getByRole("button", { name: "확인", exact: true }).click();
  await expect(page.getByText("시간선택", { exact: true })).toHaveCount(0);
}

async function borderColor(locator: Locator) {
  return locator.evaluate((node) => getComputedStyle(node).borderTopColor);
}

async function backgroundColor(locator: Locator) {
  return locator.evaluate((node) => getComputedStyle(node).backgroundColor);
}

// The colour right behind an element: the first ancestor with a painted background.
async function hostColor(locator: Locator) {
  return locator.evaluate((node) => {
    for (let parent = node.parentElement; parent; parent = parent.parentElement) {
      const colour = getComputedStyle(parent).backgroundColor;
      if (colour !== "rgba(0, 0, 0, 0)" && colour !== "transparent") return colour;
    }
    return null;
  });
}

const TRANSPARENT = /rgba\(0, 0, 0, 0\)|transparent/;

test.beforeEach(async ({ context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
});

test.describe("action editor in the create form (wide)", () => {
  test.beforeEach(() => {
    test.skip(!isWideProject(), "the create form has the action editor on wide only until U3");
  });

  test("+ 액션 추가 adds a soft face with a borderless title, a 알림 없음 chip and the focus", async ({
    page,
  }) => {
    await setUpFormServer(page);
    await openForm(page);
    const action = await addAction(form(page));

    await expect(chipOf(action)).toHaveText("알림 없음");
    await expect(titleOf(action)).toBeFocused();
    expect(await backgroundColor(action)).not.toMatch(TRANSPARENT);
    expect(await backgroundColor(action)).not.toBe(await hostColor(action));
    await expect(action.getByText(/^\d+$/)).toHaveCount(0);
  });

  test("the title has no border at rest, a border on hover and an accent border on focus", async ({
    page,
  }) => {
    await setUpFormServer(page);
    await openForm(page);
    const action = await addAction(form(page), "렌터카 예약 확인");
    await page.getByText("새 링크 추가", { exact: true }).first().click();
    await page.mouse.move(0, 0);

    const title = titleOf(action);
    await expect.poll(() => borderColor(title)).toMatch(TRANSPARENT);
    await title.hover();
    await expect.poll(() => borderColor(title)).not.toMatch(TRANSPARENT);
    const hovered = await borderColor(title);
    await title.focus();
    await page.mouse.move(0, 0);
    await expect.poll(() => borderColor(title)).not.toMatch(TRANSPARENT);
    expect(await borderColor(title)).not.toBe(hovered);
  });

  test("the chip opens a panel in the dialog colour right under it and closes it again", async ({
    page,
  }) => {
    await setUpFormServer(page);
    await openForm(page);
    const action = await addAction(form(page), "렌터카 예약 확인");

    await chipOf(action).click();
    const panel = panelOf(action);
    await expect(panel).toBeVisible();
    for (const mode of ["알림 없음", "한 번", "반복"]) {
      await expect(panel.getByText(mode, { exact: true })).toBeVisible();
    }
    expect(await backgroundColor(panel)).toBe(await hostColor(actions(form(page)).first()));
    const chipBox = (await chipOf(action).boundingBox())!;
    const panelBox = (await panel.boundingBox())!;
    expect(panelBox.y).toBeGreaterThanOrEqual(chipBox.y + chipBox.height - 6);
    expect(panelBox.y).toBeLessThan(chipBox.y + chipBox.height + 12);

    await chipOf(action).click();
    await expect(panel).toHaveCount(0);
  });

  test("한 번 reads 날짜 then 시간 with empty-field labels, and the chip shows MM/DD HH:mm", async ({
    page,
  }) => {
    await setUpFormServer(page);
    await openForm(page);
    const action = await addAction(form(page), "렌터카 예약 확인");
    await pickMode(action, "한 번");

    const panel = panelOf(action);
    const dateLabel = (await panel.getByText("날짜", { exact: true }).boundingBox())!;
    const timeLabel = (await panel.getByText("시간", { exact: true }).boundingBox())!;
    expect(dateLabel.x).toBeLessThan(timeLabel.x);
    await expect(panel.getByText("날짜 선택", { exact: true })).toBeVisible();
    await expect(panel.getByText("시간 선택", { exact: true })).toBeVisible();
    await expect(chipOf(action)).toHaveText("날짜 미정");

    await pickDate(page, action, 11, 20);
    await expect(chipOf(action)).toHaveText("시간 미정");
    await pickTime(page, panel.getByText("시간 선택", { exact: true }));
    await expect(chipOf(action)).toHaveText("11/20 09:00");
  });

  test("반복 reads 요일, 시간, 종료일 with every weekday on, and 월·목 08:00 until 12/31 reads as one line", async ({
    page,
  }) => {
    await setUpFormServer(page);
    await openForm(page);
    const action = await addAction(form(page), "항공권 가격 확인");
    await pickMode(action, "반복");

    const panel = panelOf(action);
    const daysLabel = (await panel.getByText("요일", { exact: true }).boundingBox())!;
    const timeLabel = (await panel.getByText("시간", { exact: true }).boundingBox())!;
    const untilLabel = (await panel.getByText("종료일", { exact: true }).boundingBox())!;
    expect(daysLabel.y).toBeLessThan(timeLabel.y);
    expect(timeLabel.x).toBeLessThan(untilLabel.x);
    await expect(panel.getByText("이 날까지 알려요", { exact: true })).toBeVisible();

    const dayColours = await Promise.all(
      ["월", "화", "수", "목", "금", "토", "일"].map((day) =>
        backgroundColor(panel.getByText(day, { exact: true }).locator("..")),
      ),
    );
    expect(new Set(dayColours).size).toBe(1);
    for (const day of ["화", "수", "금", "토", "일"]) {
      await panel.getByText(day, { exact: true }).click();
    }
    expect(await backgroundColor(panel.getByText("화", { exact: true }).locator(".."))).not.toBe(
      dayColours[0],
    );

    await pickTime(page, panel.getByText("시간 선택", { exact: true }), "08");
    await pickDate(page, action, 12, 31);
    await expect(chipOf(action)).toHaveText(`매주 월·목 오전 8:00 · 12월 31일까지`);

    const visible = await panel.innerText();
    expect(visible).not.toContain("📌");
    expect(visible).not.toContain("반복 요일");
  });

  test("a repeat with every weekday off is not saved", async ({ page }) => {
    const server = await setUpFormServer(page);
    await openForm(page);
    const action = await addAction(form(page), "항공권 가격 확인");
    await pickMode(action, "반복");
    for (const day of ["월", "화", "수", "목", "금", "토", "일"]) {
      await panelOf(action).getByText(day, { exact: true }).click();
    }
    await saveButton(page).click();

    await expect(
      action.getByText("반복 요일을 하나 이상 선택해주세요.", { exact: true }),
    ).toBeVisible();
    await expect(form(page)).toBeVisible();
    expect(server.linkCreates).toHaveLength(0);
  });

  test("a one-time reminder without a time shows 시간 미정, a red time field, its message and the summary", async ({
    page,
  }) => {
    const server = await setUpFormServer(page);
    await openForm(page);
    const action = await addAction(form(page), "숙소 2박 결제");
    await pickMode(action, "한 번");
    await pickDate(page, action, 11, 21);
    const timeField = panelOf(action).getByText("시간 선택", { exact: true }).locator("..");
    const restBorder = await borderColor(timeField);
    await saveButton(page).click();

    await expect(chipOf(action)).toHaveText("시간 미정");
    await expect(action.getByText("시간을 선택해주세요.", { exact: true })).toBeVisible();
    expect(await borderColor(timeField)).not.toBe(restBorder);
    await expect(form(page).getByText("확인할 액션이 1개 있어요", { exact: true })).toBeVisible();
    expect(server.linkCreates).toHaveLength(0);
  });

  test("a one-time reminder without a date shows 날짜 미정", async ({ page }) => {
    await setUpFormServer(page);
    await openForm(page);
    const action = await addAction(form(page), "숙소 2박 결제");
    await pickMode(action, "한 번");
    await pickTime(page, panelOf(action).getByText("시간 선택", { exact: true }));

    await expect(chipOf(action)).toHaveText("날짜 미정");
  });

  test("a past one-time reminder is refused as soon as it is picked and clears once moved ahead", async ({
    page,
  }) => {
    // install, not setFixedTime: the picker wheels need time to run to settle.
    await page.clock.install({ time: new Date(NEXT_YEAR, 2, 15, 12, 0) });
    const server = await setUpFormServer(page);
    await openForm(page);
    const action = await addAction(form(page), "렌터카 예약 확인");
    await pickMode(action, "한 번");
    await pickDate(page, action, 3, 15);
    const chipRest = await borderColor(chipOf(action));
    await pickTime(page, panelOf(action).getByText("시간 선택", { exact: true }));

    await expect(chipOf(action)).toHaveText("03/15 09:00 (지남)");
    expect(await borderColor(chipOf(action))).not.toBe(chipRest);
    await expect(action.getByText(PAST_REMINDER_ERROR, { exact: true })).toBeVisible();
    await expect(page.getByText("과거 일자는 알림 발송은 되지 않아요")).toHaveCount(0);
    await expect(form(page).getByText("확인할 액션이 1개 있어요", { exact: true })).toBeVisible();

    await saveButton(page).click();
    await expect(form(page).getByText("확인할 액션이 1개 있어요", { exact: true })).toBeVisible();
    expect(server.linkCreates).toHaveLength(0);

    await pickTime(page, panelOf(action).getByText("오전 9:00", { exact: true }), undefined, "PM");
    await expect(chipOf(action)).toHaveText("03/15 21:00");
    await expect(action.getByText(PAST_REMINDER_ERROR, { exact: true })).toHaveCount(0);
    await expect(form(page).getByText(/확인할 액션이/)).toHaveCount(0);
  });

  test("an untitled action with a schedule stays with a title error, and the summary counts both errors", async ({
    page,
  }) => {
    const server = await setUpFormServer(page);
    await openForm(page);
    const untitled = await addAction(form(page));
    await pickMode(untitled, "한 번");
    await pickDate(page, untitled, 11, 22);
    await pickTime(page, panelOf(untitled).getByText("시간 선택", { exact: true }));
    await chipOf(untitled).click();
    const missing = await addAction(form(page), "숙소 2박 결제");
    await pickMode(missing, "한 번");
    await pickDate(page, missing, 11, 21);
    const restBorder = await borderColor(titleOf(untitled));
    await saveButton(page).click();

    await expect(actions(form(page))).toHaveCount(2);
    await expect(untitled.getByText(TITLE_REQUIRED_ERROR, { exact: true })).toBeVisible();
    expect(await borderColor(titleOf(untitled))).not.toBe(restBorder);
    await expect(form(page).getByText("확인할 액션이 2개 있어요", { exact: true })).toBeVisible();
    expect(server.linkCreates).toHaveLength(0);

    await titleOf(untitled).fill("렌터카 예약");
    await expect(form(page).getByText("확인할 액션이 1개 있어요", { exact: true })).toBeVisible();
    await pickTime(page, panelOf(missing).getByText("시간 선택", { exact: true }));
    await expect(form(page).getByText(/확인할 액션이/)).toHaveCount(0);

    await saveButton(page).click();
    await expect.poll(() => server.linkCreates.length).toBe(1);
    expect(server.linkCreates[0]).toMatchObject({
      todos: [
        expect.objectContaining({ title: "렌터카 예약" }),
        expect.objectContaining({ title: "숙소 2박 결제" }),
      ],
    });
  });

  test("the title shows n/50 from 40 characters, stops at 50 and turns the counter bold in the accent", async ({
    page,
  }) => {
    await setUpFormServer(page);
    await openForm(page);
    const action = await addAction(form(page));
    const title = titleOf(action);
    const counter = action.getByTestId("todo-editor-title-counter");

    await title.fill("가".repeat(39));
    await expect(counter).toHaveCount(0);
    await title.fill("가".repeat(40));
    await expect(counter).toHaveText("40/50");
    const normalWeight = await counter.evaluate((node) => getComputedStyle(node).fontWeight);
    const normalColour = await counter.evaluate((node) => getComputedStyle(node).color);

    await title.fill("가".repeat(50));
    await title.press("End");
    await page.keyboard.type("나다");
    await expect(title).toHaveValue("가".repeat(50));
    await expect(counter).toHaveText("50/50");
    expect(Number(await counter.evaluate((node) => getComputedStyle(node).fontWeight))).toBe(700);
    expect(Number(normalWeight)).toBeLessThan(700);
    expect(await counter.evaluate((node) => getComputedStyle(node).color)).not.toBe(normalColour);
  });

  test("a pasted title longer than 50 characters is cut at 50", async ({ page }) => {
    await setUpFormServer(page);
    await openForm(page);
    const action = await addAction(form(page));
    await titleOf(action).focus();
    await page.keyboard.insertText("공".repeat(60));

    await expect(titleOf(action)).toHaveValue("공".repeat(50));
  });

  test("× removes the action, and an empty row is left out of 저장 without an error", async ({
    page,
  }) => {
    const server = await setUpFormServer(page);
    await openForm(page);
    await addAction(form(page), "지울 액션");
    const kept = await addAction(form(page), "남길 액션");
    await addAction(form(page));
    await actions(form(page)).first().getByRole("button", { name: "액션 삭제" }).click();
    await expect(actions(form(page))).toHaveCount(2);
    await expect(titleOf(actions(form(page)).first())).toHaveValue("남길 액션");
    await expect(kept).toBeVisible();

    await saveButton(page).click();
    await expect.poll(() => server.linkCreates.length).toBe(1);
    expect(server.linkCreates[0]).toMatchObject({
      todos: [expect.objectContaining({ title: "남길 액션", reminderAt: null })],
    });
  });

  test("AI 정리 with an action error sends nothing and shows the summary", async ({ page }) => {
    const server = await setUpFormServer(page);
    await openForm(page);
    const action = await addAction(form(page), "숙소 2박 결제");
    await pickMode(action, "한 번");
    await aiButton(page).click();

    await expect(form(page).getByText("확인할 액션이 1개 있어요", { exact: true })).toBeVisible();
    await expect(form(page)).toBeVisible();
    expect(server.linkCreates).toHaveLength(0);
  });
});

test.describe("action editor in the link detail (mobile)", () => {
  test.beforeEach(() => {
    test.skip(isWideProject(), "the wide create form covers the same editor");
  });

  test("the chip opens the schedule panel and the title stops at 50 characters", async ({
    page,
  }) => {
    const link = makeLink({ id: 2, url: LINK_URL, title: "액션 편집 확인" });
    await mockApi(page, { links: [link], details: { 2: makeDetail(link, { todos: [] }) } });
    await page.goto("/links/2");
    // #74: the 액션 row's + 추가 opens the editor in place with a new row.
    await page.getByTestId("link-detail-todos").getByRole("button", { name: "액션 추가" }).click();
    const action = page.getByTestId("link-detail-todos-editor").getByTestId("todo-editor").last();

    await expect(titleOf(action)).toBeFocused();
    await expect(chipOf(action)).toHaveText("알림 없음");
    await chipOf(action).click();
    await panelOf(action).getByText("한 번", { exact: true }).click();
    await expect(panelOf(action).getByText("날짜 선택", { exact: true })).toBeVisible();
    await expect(panelOf(action).getByText("시간 선택", { exact: true })).toBeVisible();

    await titleOf(action).focus();
    await page.keyboard.insertText("한".repeat(55));
    await expect(titleOf(action)).toHaveValue("한".repeat(50));
    await expect(action.getByTestId("todo-editor-title-counter")).toHaveText("50/50");
  });
});
