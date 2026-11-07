import { type Page, type Route, expect, test } from "@playwright/test";

import { isWideProject } from "./support/helpers";
import {
  GOOD_IMAGE,
  HOUR_MS,
  type MockTodo,
  iso,
  makeDetail,
  makeLink,
  mockApi,
} from "./support/mock-api";

// #79: the actions tab picks one status (with counts) and sorts by 알림일·만든 날·완료일.

const LINK = makeLink({ id: 1, title: "채용 공고" });

function todo(
  id: number,
  title: string,
  {
    reminderAt = null,
    completedAt = null,
    createdDay,
  }: {
    reminderAt?: string | null;
    completedAt?: string | null;
    createdDay: number;
  },
): MockTodo {
  return {
    id,
    title,
    reminderAt,
    completedAt,
    createdAt: new Date(Date.UTC(2026, 9, createdDay, 9, 0)).toISOString(),
    linkId: LINK.id,
    linkUrl: LINK.url,
    linkTitle: LINK.title,
    linkThumbnailUrl: GOOD_IMAGE,
    linkFaviconUrl: null,
  };
}

// Ids follow the made day: the server sorts 만든 날 by id.
function buildTodos(): MockTodo[] {
  return [
    todo(1, "지난 알림 A", { reminderAt: iso(-3 * HOUR_MS), createdDay: 1 }),
    todo(4, "지난 알림 B", { reminderAt: iso(-5 * HOUR_MS), createdDay: 4 }),
    todo(2, "곧 알림", { reminderAt: iso(2 * HOUR_MS), createdDay: 2 }),
    todo(5, "나중 알림", { reminderAt: iso(48 * HOUR_MS), createdDay: 5 }),
    todo(3, "알림 없음", { createdDay: 3 }),
    todo(6, "끝낸 일 1", {
      reminderAt: iso(-9 * HOUR_MS),
      completedAt: iso(-1 * HOUR_MS),
      createdDay: 6,
    }),
    todo(7, "끝낸 일 2", { completedAt: iso(-5 * HOUR_MS), createdDay: 7 }),
  ];
}

async function mockTodos(page: Page, todos = buildTodos(), handlers = {}) {
  return mockApi(page, {
    links: [LINK],
    details: {
      [LINK.id]: makeDetail(LINK, {
        todos: todos.map(({ id, title, reminderAt, completedAt }) => ({
          id,
          title,
          reminderAt,
          completedAt,
        })),
      }),
    },
    todos,
    handlers,
  });
}

function todoTitles(page: Page) {
  return page.getByTestId("todo-item-title");
}

async function expectTodoTitles(page: Page, titles: string[]) {
  await expect(todoTitles(page)).toHaveText(titles);
}

function statusChip(page: Page, name: string | RegExp) {
  return page.getByRole("radiogroup", { name: "액션 상태" }).getByRole("radio", { name });
}

function coverButton(page: Page) {
  return page.getByTestId("todo-filter-row-button");
}

function sortChip(page: Page, name: string | RegExp) {
  return page.getByRole("radiogroup", { name: "정렬 기준" }).getByRole("radio", { name });
}

function sectionHeaders(page: Page) {
  return page.getByText(/^(🔥 기간지남|⏳ 진행 중|✓ 완료)$/);
}

async function openCover(page: Page) {
  await coverButton(page).click();
  await expect(coverButton(page)).toHaveAttribute("aria-expanded", "true");
}

async function closeCover(page: Page) {
  await coverButton(page).click();
  await expect(coverButton(page)).toHaveAttribute("aria-expanded", "false");
}

const ALL_IN_SECTIONS = [
  "지난 알림 B",
  "지난 알림 A",
  "곧 알림",
  "나중 알림",
  "알림 없음",
  "끝낸 일 1",
  "끝낸 일 2",
];

test.describe("status chips", () => {
  test("four chips with counts that add up, 전체 first, and no old chips", async ({ page }) => {
    await mockTodos(page);
    await page.goto("/todos");
    for (const name of ["전체 7", "진행 중 3", "기간지남 2", "완료 2"]) {
      await expect(statusChip(page, name)).toBeVisible();
    }
    await expect(statusChip(page, "전체 7")).toBeChecked();
    await expect(coverButton(page)).toHaveAccessibleName("정렬·필터 열기");
    for (const old of [/^미완료/, /알림예정/, /알림없음/]) {
      await expect(page.getByRole("radio", { name: old })).toHaveCount(0);
    }
  });

  test("전체 shows 기간지남 → 진행 중 → 완료, soonest first, no reminder last", async ({
    page,
  }) => {
    await mockTodos(page);
    await page.goto("/todos");
    await expect(sectionHeaders(page)).toHaveText(["🔥 기간지남", "⏳ 진행 중", "✓ 완료"]);
    await expectTodoTitles(page, ALL_IN_SECTIONS);
  });

  test("진행 중 and 기간지남 are single lists of their own actions", async ({ page }) => {
    await mockTodos(page);
    await page.goto("/todos");

    await statusChip(page, /^진행 중/).click();
    await expectTodoTitles(page, ["곧 알림", "나중 알림", "알림 없음"]);
    await expect(sectionHeaders(page)).toHaveCount(0);
    await expect(page.getByTestId("todo-item-overdue")).toHaveCount(0);

    await statusChip(page, /^기간지남/).click();
    await expectTodoTitles(page, ["지난 알림 B", "지난 알림 A"]);
    await expect(page.getByTestId("todo-item-overdue")).toHaveCount(2);
  });

  test("완료 lists done actions newest done first with the icon button", async ({ page }) => {
    await mockTodos(page);
    await page.goto("/todos");
    await statusChip(page, /^완료/).click();
    await expectTodoTitles(page, ["끝낸 일 1", "끝낸 일 2"]);
    await expect(coverButton(page)).toHaveAccessibleName("정렬·필터 열기");

    await openCover(page);
    await expect(sortChip(page, /.*/)).toHaveCount(3);
    await expect(sortChip(page, "완료일, 내림차순")).toBeChecked();

    await closeCover(page);
    await statusChip(page, /^진행 중/).click();
    await openCover(page);
    await expect(sortChip(page, /.*/)).toHaveCount(2);
    await expect(sortChip(page, "알림일, 오름차순")).toBeChecked();
    await expect(sortChip(page, "만든 날")).toBeVisible();
  });

  test("an empty 완료 shows the usual message and 완료 0", async ({ page }) => {
    await mockTodos(
      page,
      buildTodos().filter((item) => !item.completedAt),
    );
    await page.goto("/todos");
    await statusChip(page, "완료 0").click();
    await expect(page.getByText("해당하는 액션이 없어요")).toBeVisible();
    await expect(page.getByText("다른 필터를 선택해보세요.")).toBeVisible();
  });
});

test.describe("sort", () => {
  test("알림일 ↓ puts late reminders first and keeps no reminder last", async ({ page }) => {
    await mockTodos(page);
    await page.goto("/todos");
    await statusChip(page, /^진행 중/).click();
    await openCover(page);
    await sortChip(page, "알림일, 오름차순").click();
    await expect(sortChip(page, "알림일, 내림차순")).toBeChecked();
    await expectTodoTitles(page, ["나중 알림", "곧 알림", "알림 없음"]);
  });

  test("만든 날 sorts newest made first, then oldest, and the pill reads it", async ({ page }) => {
    await mockTodos(page);
    await page.goto("/todos");
    await statusChip(page, /^진행 중/).click();
    await openCover(page);
    await sortChip(page, "만든 날").click();
    await expectTodoTitles(page, ["나중 알림", "알림 없음", "곧 알림"]);
    await closeCover(page);
    await expect(coverButton(page)).toHaveAccessibleName(
      "정렬·필터 열기, 적용 중: 만든 날 내림차순",
    );

    await openCover(page);
    await sortChip(page, "만든 날, 내림차순").click();
    await expectTodoTitles(page, ["곧 알림", "알림 없음", "나중 알림"]);
  });

  test("leaving 완료 with 완료일 goes back to 알림일 ↑ and the icon", async ({ page }) => {
    await mockTodos(page);
    await page.goto("/todos");
    await statusChip(page, /^완료/).click();
    await openCover(page);
    await sortChip(page, "완료일, 내림차순").click();
    await closeCover(page);
    await expect(coverButton(page)).toHaveAccessibleName(
      "정렬·필터 열기, 적용 중: 완료일 오름차순",
    );

    await statusChip(page, /^진행 중/).click();
    await expect(coverButton(page)).toHaveAccessibleName("정렬·필터 열기");
    await expectTodoTitles(page, ["곧 알림", "나중 알림", "알림 없음"]);
  });

  test("만든 날 ↓ chosen under 전체 stays under 기간지남", async ({ page }) => {
    await mockTodos(page);
    await page.goto("/todos");
    await openCover(page);
    await sortChip(page, "만든 날").click();
    await closeCover(page);
    await statusChip(page, /^기간지남/).click();
    await expect(coverButton(page)).toHaveAccessibleName(
      "정렬·필터 열기, 적용 중: 만든 날 내림차순",
    );
    await expectTodoTitles(page, ["지난 알림 B", "지난 알림 A"]);
  });

  test("a sort under 전체 keeps the section order and sorts inside each", async ({ page }) => {
    await mockTodos(page);
    await page.goto("/todos");
    await openCover(page);
    await sortChip(page, "만든 날").click();
    await expect(sectionHeaders(page)).toHaveText(["🔥 기간지남", "⏳ 진행 중", "✓ 완료"]);
    await expectTodoTitles(page, [
      "지난 알림 B",
      "지난 알림 A",
      "나중 알림",
      "알림 없음",
      "곧 알림",
      "끝낸 일 2",
      "끝낸 일 1",
    ]);
  });
});

test.describe("checking an action", () => {
  test("done in the link detail, it is under 완료 with the counts moved", async ({ page }) => {
    await mockTodos(page);
    await page.goto("/todos");
    await expect(statusChip(page, "완료 2")).toBeVisible();
    await todoTitles(page).filter({ hasText: "곧 알림" }).click();
    await expect(page).toHaveURL(isWideProject() ? /\/todos\?linkId=1/ : /\/links\/1$/);

    const detailCard = page
      .getByTestId("link-detail-todos")
      .getByTestId(/^todo-item(-overdue)?$/)
      .filter({ hasText: "곧 알림" });
    await detailCard.getByRole("checkbox").click();
    await expect(detailCard.getByRole("checkbox")).toBeChecked();
    if (isWideProject()) {
      await page.getByTestId("link-detail-close").click();
    } else {
      await page.getByRole("button", { name: "뒤로" }).click();
    }
    await expect(page).toHaveURL(/\/todos$/);

    await expect(statusChip(page, "완료 3")).toBeVisible();
    await expect(statusChip(page, "진행 중 2")).toBeVisible();
    await statusChip(page, /^완료/).click();
    await expectTodoTitles(page, ["곧 알림", "끝낸 일 1", "끝낸 일 2"]);
  });

  test("under 진행 중 it leaves the list and the counts move", async ({ page }) => {
    await mockTodos(page);
    await page.goto("/todos");
    await statusChip(page, /^진행 중/).click();
    await page
      .getByTestId("todo-item")
      .filter({ hasText: "곧 알림" })
      .getByRole("checkbox")
      .click();
    await expectTodoTitles(page, ["나중 알림", "알림 없음"]);
    await expect(statusChip(page, "진행 중 2")).toBeVisible();
    await expect(statusChip(page, "완료 3")).toBeVisible();
    await expect(statusChip(page, "전체 7")).toBeVisible();
  });

  test("under 완료 unchecking moves it back and reverses the counts", async ({ page }) => {
    await mockTodos(page);
    await page.goto("/todos");
    await statusChip(page, /^완료/).click();
    await page
      .getByTestId(/^todo-item(-overdue)?$/)
      .filter({ hasText: "끝낸 일 1" })
      .getByRole("checkbox")
      .click();
    await expectTodoTitles(page, ["끝낸 일 2"]);
    await expect(statusChip(page, "완료 1")).toBeVisible();
    // Its reminder is past, so it comes back as 기간지남.
    await expect(statusChip(page, "기간지남 3")).toBeVisible();
  });

  // Regression (found on the dev server): a status list seen before stayed as it was after a check
  // elsewhere, so 완료 lacked the action just completed until a pull to refresh.
  test("checked under 진행 중, it is in 완료 when that chip is opened next", async ({ page }) => {
    await mockTodos(page);
    await page.goto("/todos");
    // See 완료 first, so its list is cached without the action.
    await statusChip(page, /^완료/).click();
    await expectTodoTitles(page, ["끝낸 일 1", "끝낸 일 2"]);
    await statusChip(page, /^진행 중/).click();
    await expectTodoTitles(page, ["곧 알림", "나중 알림", "알림 없음"]);
    await page
      .getByTestId("todo-item")
      .filter({ hasText: "곧 알림" })
      .getByRole("checkbox")
      .click();
    await expect(statusChip(page, "완료 3")).toBeVisible();

    await statusChip(page, "완료 3").click();
    // 완료일 ↓: the action just completed comes first.
    await expectTodoTitles(page, ["곧 알림", "끝낸 일 1", "끝낸 일 2"]);
  });

  test("unchecked under 완료, it is in 진행 중 when that chip is opened next", async ({ page }) => {
    await mockTodos(page);
    await page.goto("/todos");
    // See 진행 중 first, so its list is cached without the action.
    await statusChip(page, /^진행 중/).click();
    await expectTodoTitles(page, ["곧 알림", "나중 알림", "알림 없음"]);
    await statusChip(page, /^완료/).click();
    await page
      .getByTestId("todo-item")
      .filter({ hasText: "끝낸 일 2" })
      .getByRole("checkbox")
      .click();
    await expect(statusChip(page, "진행 중 4")).toBeVisible();

    await statusChip(page, "진행 중 4").click();
    await expect(todoTitles(page)).toHaveCount(4);
    await expect(todoTitles(page).filter({ hasText: "끝낸 일 2" })).toBeVisible();
  });

  test("under 전체 it moves to the 완료 section", async ({ page }) => {
    await mockTodos(page);
    await page.goto("/todos");
    await page
      .getByTestId("todo-item")
      .filter({ hasText: "알림 없음" })
      .getByRole("checkbox")
      .click();
    await expectTodoTitles(page, [
      "지난 알림 B",
      "지난 알림 A",
      "곧 알림",
      "나중 알림",
      // In the 완료 section by 알림일: its missing reminder ties with 끝낸 일 2 and keeps its place.
      "끝낸 일 1",
      "알림 없음",
      "끝낸 일 2",
    ]);
    await expect(sectionHeaders(page)).toHaveText(["🔥 기간지남", "⏳ 진행 중", "✓ 완료"]);
    await expect(statusChip(page, "완료 3")).toBeVisible();
  });
});

test.describe("loading, errors and memory", () => {
  test("without counts the chips show names only and the list still works", async ({ page }) => {
    await mockTodos(page, buildTodos(), {
      "GET /api/todos/counts": async (route: Route) => {
        await route.fulfill({ status: 500, body: "{}" });
      },
    });
    await page.goto("/todos");
    await expectTodoTitles(page, ALL_IN_SECTIONS);
    for (const name of ["전체", "진행 중", "기간지남", "완료"]) {
      await expect(statusChip(page, name)).toBeVisible();
    }
    await statusChip(page, "완료").click();
    await expectTodoTitles(page, ["끝낸 일 1", "끝낸 일 2"]);
  });

  test("a failed list shows the error instead of the empty message, and retries", async ({
    page,
  }) => {
    test.setTimeout(60_000);
    let isDown = true;
    await mockTodos(page);
    await page.route(
      (url) => url.pathname === "/api/todos",
      async (route: Route) => {
        if (isDown) {
          await route.fulfill({ status: 500, body: "{}" });
          return;
        }
        await route.fallback();
      },
    );
    await page.goto("/todos");
    await expect(page.getByText("액션을 불러오지 못했어요")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText("네트워크 연결을 확인한 뒤 다시 시도해주세요.")).toBeVisible();
    await expect(page.getByText("해당하는 액션이 없어요")).toHaveCount(0);
    await expect(statusChip(page, "전체 7")).toBeVisible();

    await page.getByRole("button", { name: "다시 시도" }).click();
    await expect(page.getByText("액션을 불러오지 못했어요")).toHaveCount(0);
    await expect(page.getByText("액션을 불러오지 못했어요")).toBeVisible({ timeout: 20_000 });

    isDown = false;
    await page.getByRole("button", { name: "다시 시도" }).click();
    await expectTodoTitles(page, ALL_IN_SECTIONS);
  });

  test("status and sort stay after another tab, and reset on reload", async ({ page }) => {
    await mockTodos(page);
    await page.goto("/todos");
    await statusChip(page, /^진행 중/).click();
    await openCover(page);
    await sortChip(page, "만든 날").click();
    await closeCover(page);
    await expectTodoTitles(page, ["나중 알림", "알림 없음", "곧 알림"]);

    if (isWideProject()) {
      await page.getByText("홈", { exact: true }).first().click();
      await expect(page).toHaveURL(/\/home$/);
      await page.getByText("액션", { exact: true }).first().click();
    } else {
      await page.getByText("홈", { exact: true }).last().click();
      await expect(page).toHaveURL(/\/home$/);
      await page.getByText("액션", { exact: true }).last().click();
    }
    await expect(page).toHaveURL(/\/todos$/);
    await expect(statusChip(page, "진행 중 3")).toBeChecked();
    await expectTodoTitles(page, ["나중 알림", "알림 없음", "곧 알림"]);

    await page.reload();
    await expect(statusChip(page, "전체 7")).toBeChecked();
    await expect(coverButton(page)).toHaveAccessibleName("정렬·필터 열기");
  });
});

test.describe("wide", () => {
  test.skip(() => !isWideProject(), "web wide");

  test("the same row above the grid, the 전체 count by the title, and a card opens the detail", async ({
    page,
  }) => {
    await mockTodos(page);
    await page.goto("/todos");
    await expect(page.getByText("7개", { exact: true })).toBeVisible();
    await expect(page.getByTestId("todo-grid").first()).toBeVisible();
    await statusChip(page, /^진행 중/).click();
    await expect(page.getByTestId("todo-grid")).toHaveCount(1);
    await todoTitles(page).first().click();
    await expect(page).toHaveURL(/\/todos\?linkId=1/);
    await expect(statusChip(page, "진행 중 3")).toBeChecked();
  });
});
