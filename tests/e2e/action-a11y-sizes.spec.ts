import { type Locator, type Page, expect, test } from "@playwright/test";

import { boxOf, cssOf, isWideProject } from "./support/helpers";
import { openDetailAt, setUpDetail } from "./support/link-detail-fixtures";
import { type ApiHandler, mockSignedInApi } from "./support/mock-save-flow-api";

// #89: names and roles of the action controls, the detail title size, the web mobile press
// areas, the new link sheet height and its 768 proportions, the locked schedule panel while
// saving, and the small alignments.

const CARD_SCHEDULE = /^렌터카 예약 확인, \d{2}\/\d{2} \d{2}:\d{2}, 고치기$/;

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

async function openDetail(page: Page, id = 1) {
  await openDetailAt(page, id, isWideProject());
}

async function startEditing(page: Page) {
  await todosRow(page).getByRole("button", { name: CARD_SCHEDULE }).click();
  await expect(editor(page)).toBeVisible();
}

// Clicks `dx`/`dy` px past the box's left/top edge (negative = outside).
async function clickOutside(page: Page, target: Locator, dx: number, dy: number) {
  await target.scrollIntoViewIfNeeded();
  const box = await boxOf(target);
  await page.mouse.click(box.x + dx, box.y + dy);
}

// Pressing a card opens its own schedule panel; open it when it is not.
async function openPanel(row: Locator) {
  const panel = row.getByTestId("todo-schedule-panel");
  if ((await panel.count()) === 0) await row.getByTestId("todo-schedule-chip").click();
  await expect(panel).toBeVisible();
  return panel;
}

test.describe("action names and roles", () => {
  test("the detail cards are buttons named by title, schedule and 고치기; their checkboxes name the action", async ({
    page,
  }) => {
    await setUpDetail(page);
    await openDetail(page);
    const row = todosRow(page);
    await expect(row.getByRole("button", { name: CARD_SCHEDULE })).toBeVisible();
    await expect(
      row.getByRole("button", { name: "숙소 2박 결제, 고치기", exact: true }),
    ).toBeVisible();
    await expect(
      row.getByRole("checkbox", { name: "완료 표시, 렌터카 예약 확인", exact: true }),
    ).not.toBeChecked();
    await expect(
      row.getByRole("checkbox", { name: "완료 취소, 숙소 2박 결제", exact: true }),
    ).toBeChecked();

    await row.getByRole("checkbox", { name: "완료 표시, 렌터카 예약 확인", exact: true }).click();
    await expect(
      row.getByRole("checkbox", { name: "완료 취소, 렌터카 예약 확인", exact: true }),
    ).toBeChecked();
    await expect(editor(page)).toHaveCount(0);
  });

  test("in the editor the checkbox and × name the action, and a blank title reads 제목 없는 액션", async ({
    page,
  }) => {
    await setUpDetail(page);
    await openDetail(page);
    await startEditing(page);
    const row = editorRow(page, "렌터카 예약 확인");
    await expect(
      row.getByRole("checkbox", { name: "완료 표시, 렌터카 예약 확인", exact: true }),
    ).toBeVisible();
    await expect(
      row.getByRole("button", { name: "액션 삭제, 렌터카 예약 확인", exact: true }),
    ).toBeVisible();

    await row.getByPlaceholder("액션 제목").fill("");
    const blank = editor(page).getByTestId("todo-editor").first();
    await expect(
      blank.getByRole("checkbox", { name: "완료 표시, 제목 없는 액션", exact: true }),
    ).toBeVisible();
    await expect(
      blank.getByRole("button", { name: "액션 삭제, 제목 없는 액션", exact: true }),
    ).toBeVisible();
  });

  test("the actions tab cards name their checkbox with the action's title", async ({ page }) => {
    await setUpDetail(page);
    await page.goto("/todos");
    await expect(
      page.getByRole("checkbox", { name: "완료 표시, 렌터카 예약 확인", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /^렌터카 예약 확인, \d{2}\/\d{2} \d{2}:\d{2}, / }),
    ).toBeVisible();
  });

  test("the schedule mode is a radio group and the weekdays are checkboxes, each with its state", async ({
    page,
  }) => {
    await setUpDetail(page);
    await openDetail(page);
    await startEditing(page);
    const row = editorRow(page, "렌터카 예약 확인");
    const modes = (await openPanel(row)).getByRole("radiogroup", { name: "알림" });
    await expect(modes.getByRole("radio", { name: "한 번", exact: true })).toBeChecked();
    await expect(modes.getByRole("radio", { name: "알림 없음", exact: true })).not.toBeChecked();
    await expect(modes.getByRole("radio", { name: "반복", exact: true })).not.toBeChecked();

    await modes.getByRole("radio", { name: "반복", exact: true }).click();
    await expect(modes.getByRole("radio", { name: "반복", exact: true })).toBeChecked();
    await expect(modes.getByRole("radio", { name: "한 번", exact: true })).not.toBeChecked();
    const weekdays = row.getByRole("group", { name: "요일" });
    await expect(weekdays.getByRole("checkbox")).toHaveCount(7);
    const monday = weekdays.getByRole("checkbox", { name: "월", exact: true });
    const before = await monday.isChecked();
    await monday.click();
    await expect(monday).toBeChecked({ checked: !before });

    // Space works on the radios and the weekday checkboxes, as on a button.
    await monday.focus();
    await page.keyboard.press("Space");
    await expect(monday).toBeChecked({ checked: before });
    await modes.getByRole("radio", { name: "한 번", exact: true }).focus();
    await page.keyboard.press("Space");
    await expect(modes.getByRole("radio", { name: "한 번", exact: true })).toBeChecked();
  });

  test("the link title is the one h1; 한 줄 요약, 미리보기 and 내 정리 are h2", async ({
    page,
  }) => {
    await setUpDetail(page);
    await openDetail(page);
    const detail = page.getByTestId("link-detail");
    await expect(detail.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect(detail.getByRole("heading", { level: 1 })).toHaveText(
      "제주 2박 3일 동쪽 일주 코스와 비용 정리",
    );
    for (const name of ["한 줄 요약", "미리보기", "내 정리"]) {
      await expect(detail.getByRole("heading", { level: 2, name, exact: true })).toBeVisible();
    }
  });
});

test.describe("detail title and focus ring", () => {
  test("the detail title is 20px wide and 18px on mobile, 700, line height 1.35", async ({
    page,
  }) => {
    await setUpDetail(page);
    await openDetail(page);
    const title = page.getByTestId("link-detail-title");
    const size = isWideProject() ? 20 : 18;
    await expect(title).toHaveCSS("font-size", `${size}px`);
    await expect(title).toHaveCSS("font-weight", "700");
    const lineHeight = parseFloat(await cssOf(title, "line-height"));
    expect(lineHeight / size).toBeCloseTo(1.35, 2);
  });

  test("Tab through the detail shows the same theme ring on every control, never the browser outline", async ({
    page,
  }) => {
    test.skip(!isWideProject(), "keyboard focus is checked on web wide");
    await setUpDetail(page);
    await openDetail(page);
    await page.getByTestId("link-detail-title").click();

    const seen: { name: string; outline: string; ring: string | null }[] = [];
    // Back from the title to the toolbar, then forward to 링크 삭제.
    const keys = [...Array<string>(8).fill("Shift+Tab"), ...Array<string>(30).fill("Tab")];
    for (const key of keys) {
      await page.keyboard.press(key);
      // Let the 150ms ring transitions finish before reading the shadow.
      await page.waitForTimeout(200);
      const read = await page.evaluate(() => {
        const active = document.activeElement as HTMLElement | null;
        const detail = document.querySelector('[data-testid="link-detail"]');
        if (!active || !detail?.contains(active)) return null;
        const ringOf = (node: Element | null) => {
          if (!node) return null;
          const match = getComputedStyle(node).boxShadow.match(/(rgba?\([^)]*\)) 0px 0px 0px 3px/);
          return match ? match[1] : null;
        };
        const style = getComputedStyle(active);
        return {
          name: active.getAttribute("aria-label") ?? active.textContent?.trim() ?? "",
          outline: `${style.outlineStyle} ${style.outlineColor}`,
          // The card draws its ring on itself around its press target.
          ring: ringOf(active) ?? ringOf(active.parentElement),
        };
      });
      if (read && !seen.some((entry) => entry.name === read.name)) seen.push(read);
    }

    const names = seen.map((entry) => entry.name);
    const report = JSON.stringify(seen, null, 1);
    for (const expected of ["새로고침", "닫기", "폴더 이동", "액션 추가", "링크 삭제"]) {
      expect(
        names.some((name) => name.includes(expected)),
        `${expected} in ${report}`,
      ).toBe(true);
    }
    expect(
      names.some((name) => /고치기$/.test(name)),
      report,
    ).toBe(true);
    expect(
      names.some((name) => name.startsWith("완료 표시, ")),
      report,
    ).toBe(true);
    const rings = new Set(seen.map((entry) => entry.ring));
    expect([...rings], JSON.stringify(seen, null, 1)).toHaveLength(1);
    expect([...rings][0]).not.toBeNull();
    for (const entry of seen) {
      expect(entry.outline.startsWith("auto"), entry.name).toBe(false);
    }
  });
});

test("Tab through the action editor: the controls show that ring and the title field the ring colour", async ({
  page,
}) => {
  test.skip(!isWideProject(), "keyboard focus is checked on web wide");
  await setUpDetail(page);
  await openDetail(page);
  await startEditing(page);
  const titleField = editorRow(page, "렌터카 예약 확인").getByPlaceholder("액션 제목");
  await expect(titleField).toBeFocused();

  const seen: {
    name: string;
    tag: string;
    outline: string;
    ring: string | null;
    border: string;
  }[] = [];
  for (let step = 0; step < 30; step += 1) {
    await page.keyboard.press("Tab");
    await page.waitForTimeout(200);
    const read = await page.evaluate(() => {
      const active = document.activeElement as HTMLElement | null;
      const editorRoot = document.querySelector('[data-testid="link-detail-todos"]');
      if (!active || !editorRoot?.contains(active)) return null;
      const style = getComputedStyle(active);
      const match = style.boxShadow.match(/(rgba?\([^)]*\)) 0px 0px 0px 3px/);
      return {
        name: active.getAttribute("aria-label") ?? active.textContent?.trim() ?? "",
        tag: active.tagName,
        outline: style.outlineStyle,
        ring: match ? match[1] : null,
        border: style.borderTopColor,
      };
    });
    if (read && !seen.some((entry) => entry.name === read.name && entry.tag === read.tag)) {
      seen.push(read);
    }
  }

  const report = JSON.stringify(seen, null, 1);
  const controls = seen.filter((entry) => entry.tag !== "INPUT");
  const fields = seen.filter((entry) => entry.tag === "INPUT");
  for (const expected of ["액션 삭제, ", "완료 표시, ", "취소", "저장"]) {
    expect(
      controls.some((entry) => entry.name.startsWith(expected)),
      `${expected} in ${report}`,
    ).toBe(true);
  }
  expect(fields.length, report).toBeGreaterThan(0);
  const rings = new Set(controls.map((entry) => entry.ring));
  expect([...rings], report).toHaveLength(1);
  const ring = [...rings][0];
  expect(ring, report).not.toBeNull();
  for (const entry of seen) expect(entry.outline, entry.name).not.toBe("auto");
  // The text fields mark focus with a border in the same theme ring colour.
  for (const field of fields) expect(field.border, report).toBe(ring);
});

test.describe("web mobile press areas", () => {
  test("a press 11.5px left of the card's checkbox marks it done and does not open the editor", async ({
    page,
  }) => {
    test.skip(isWideProject(), "web mobile");
    await setUpDetail(page);
    await openDetail(page);
    const checkbox = todosRow(page).getByRole("checkbox", {
      name: "완료 표시, 렌터카 예약 확인",
      exact: true,
    });
    await expect(checkbox).toHaveCSS("width", "16px");
    await clickOutside(page, checkbox, -11.5, 8);
    await expect(
      todosRow(page).getByRole("checkbox", { name: "완료 취소, 렌터카 예약 확인", exact: true }),
    ).toBeChecked();
    await expect(editor(page)).toHaveCount(0);
  });

  test("a press 11.5px above the editor checkbox and 5.5px right of the × reach them", async ({
    page,
  }) => {
    test.skip(isWideProject(), "web mobile");
    await setUpDetail(page);
    await openDetail(page);
    await startEditing(page);
    const row = editorRow(page, "렌터카 예약 확인");
    const checkbox = row.getByRole("checkbox", { name: "완료 표시, 렌터카 예약 확인" });
    await clickOutside(page, checkbox, 8, -11.5);
    await expect(
      row.getByRole("checkbox", { name: "완료 취소, 렌터카 예약 확인", exact: true }),
    ).toBeChecked();

    const remove = editorRow(page, "숙소 2박 결제").getByRole("button", {
      name: "액션 삭제, 숙소 2박 결제",
    });
    await expect(remove).toHaveCSS("width", "32px");
    await clickOutside(page, remove, 37.5, 16);
    await expect(editorRow(page, "숙소 2박 결제")).toHaveCount(0);
  });
});

test.describe("saving locks the open schedule panel", () => {
  test("while saving, the open panel is dimmed and its mode, date and time do not respond", async ({
    page,
  }) => {
    test.skip(!isWideProject(), "web wide");
    await setUpDetail(page, { todoWrites: { delayMs: 1500 } });
    await openDetail(page);
    await startEditing(page);
    const row = editor(page).getByTestId("todo-editor").first();
    await row.getByPlaceholder("액션 제목").fill("렌터카 예약 다시 확인");
    const panel = await openPanel(row);
    await expect(panel).toHaveCSS("opacity", "1");

    await page.getByTestId("link-detail-todos-save").click();
    await expect(page.getByTestId("link-detail-todos-save").getByLabel("저장 중")).toBeVisible();
    await expect(panel).toHaveCSS("opacity", "0.5");
    await expect(panel).toHaveCSS("pointer-events", "none");
    for (const name of ["알림 없음", "한 번", "반복"]) {
      await expect(panel.getByRole("radio", { name, exact: true })).toBeDisabled();
    }
    for (const button of await panel.getByRole("button").all()) {
      await expect(button).toBeDisabled();
    }
    // Keyboard too: Enter on a mode does nothing while saving.
    const none = panel.getByRole("radio", { name: "알림 없음", exact: true });
    await none.focus();
    await page.keyboard.press("Enter");
    await expect(panel.getByRole("radio", { name: "한 번", exact: true })).toBeChecked();
  });
});

test.describe("링크 삭제 alignment", () => {
  test("the delete icon starts at the 내 정리 label's left edge", async ({ page }) => {
    await setUpDetail(page);
    await openDetail(page);
    const icon = page.getByTestId("link-detail-delete").locator("svg").first();
    const label = page.getByTestId("link-detail-my-notes").getByText("내 정리", { exact: true });
    const iconBox = await boxOf(icon);
    const labelBox = await boxOf(label);
    expect(Math.abs(iconBox.x - labelBox.x)).toBeLessThanOrEqual(1);
  });
});

// The new link form: the mobile sheet's height and 768 proportions, the wide dialog's width
// and the notice for no AI providers.

const PAGE_WITH_IMAGE = "https://example.com/article";
const PNG_PIXEL = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkaPhfDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

async function setUpForm(page: Page, { providers = true }: { providers?: boolean } = {}) {
  const handler: ApiHandler = async ({ path, request, respond }) => {
    if (path === "/api/link-previews" && request.method() === "POST") {
      await respond(
        {
          url: PAGE_WITH_IMAGE,
          title: "미리보기 대표 제목",
          thumbnailUrl: "https://images.archivelink.app/dev-preview-test.png",
          faviconUrl: null,
          isVideo: false,
        },
        201,
      );
      return true;
    }
    if (path === "/api/ai/providers/models" && !providers) {
      await respond([]);
      return true;
    }
    return false;
  };
  await mockSignedInApi(page, [handler]);
  await page.route("https://images.archivelink.app/**", (route) =>
    route.fulfill({ status: 200, contentType: "image/png", body: PNG_PIXEL }),
  );
}

function sheet(page: Page) {
  return page.getByRole("slider", { name: "Bottom Sheet" });
}

async function openForm(page: Page) {
  await page.goto("/home");
  await page.evaluate(() => navigator.clipboard.writeText(""));
  if ((page.viewportSize()?.width ?? 0) >= 769) {
    await page.getByText("새 링크", { exact: true }).first().click();
  } else {
    await page.getByLabel("새 링크").click();
  }
  await expect(page.getByText("새 링크 추가", { exact: true }).first()).toBeVisible();
}

async function settledTop(locator: Locator) {
  let previous: number | null = null;
  let steady = 0;
  await expect
    .poll(
      async () => {
        const current = (await locator.boundingBox())?.y ?? null;
        steady = current !== null && current === previous ? steady + 1 : 0;
        previous = current;
        return steady >= 2;
      },
      { intervals: [250] },
    )
    .toBe(true);
  return previous as unknown as number;
}

test.describe("new link sheet", () => {
  test.use({ permissions: ["clipboard-read", "clipboard-write"] });

  test("opens all the way up, 8px under the top safe area", async ({ page }) => {
    test.skip(isWideProject(), "web mobile");
    await setUpForm(page);
    await openForm(page);
    // The sheet (its drag handle and body) is the parent of the body slider.
    const top = await settledTop(sheet(page).locator("xpath=.."));
    expect(Math.round(top)).toBe(8);
  });

  test("at 768 the image is at most 240px high and 저장·AI 정리 are 48px high", async ({
    page,
  }) => {
    test.skip(isWideProject(), "web mobile");
    await page.setViewportSize({ width: 768, height: 1024 });
    await setUpForm(page);
    await openForm(page);
    await sheet(page)
      .getByPlaceholder(/^https:\/\//)
      .fill(PAGE_WITH_IMAGE);
    const image = page.getByTestId("link-create-preview-image");
    await expect(image).toBeVisible();
    expect(Math.round((await boxOf(image)).height)).toBeLessThanOrEqual(240);
    for (const name of ["저장", "AI 정리"]) {
      await expect(page.getByRole("button", { name, exact: true })).toHaveCSS("height", "48px");
    }
  });
});

test.describe("new link dialog and providers", () => {
  test.use({ permissions: ["clipboard-read", "clipboard-write"] });

  test("the wide dialog is 720px wide", async ({ page }) => {
    test.skip(!isWideProject(), "web wide");
    await setUpForm(page);
    await openForm(page);
    const dialog = page.getByRole("dialog", { name: "새 링크 추가" });
    expect(Math.round((await boxOf(dialog)).width)).toBe(720);
  });

  test("with no providers, the list shows a small 13/600 title and one grey 12/400 line", async ({
    page,
  }) => {
    await setUpForm(page, { providers: false });
    await openForm(page);
    await page.getByRole("button", { name: /^AI 제공자, / }).click();
    const empty = page.getByTestId("ai-provider-picker-empty");
    await expect(empty).toBeVisible();
    const title = empty.getByText("사용할 수 있는 AI 제공자가 없어요", { exact: true });
    const description = empty.getByText("잠시 후 다시 시도해주세요.", { exact: true });
    await expect(title).toHaveCSS("font-size", "13px");
    await expect(title).toHaveCSS("font-weight", "600");
    await expect(description).toHaveCSS("font-size", "12px");
    await expect(description).toHaveCSS("font-weight", "400");
    const muted = await page.evaluate(() => {
      const probe = document.createElement("span");
      probe.style.color = "hsl(var(--muted-foreground))";
      document.body.append(probe);
      const color = getComputedStyle(probe).color;
      probe.remove();
      return color;
    });
    await expect(description).toHaveCSS("color", muted);
    expect((await boxOf(description)).height).toBeLessThanOrEqual(20);
  });
});
