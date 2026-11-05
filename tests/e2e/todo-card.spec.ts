import { type Locator, type Page, expect, test } from "@playwright/test";

import { boxOf, cssOf, firstRowCount, isWideProject } from "./support/helpers";
import {
  GOOD_IMAGE,
  HOUR_MS,
  type MockTodo,
  countTodos,
  iso,
  makeDetail,
  makeLink,
  mockApi,
} from "./support/mock-api";

// #5 todo card: same card on the wide home, the todo screen and the link detail.

function buildFixtures() {
  const withImage = makeLink({
    id: 1,
    url: "https://velog.io/@devkim/tanstack-query-v5",
    title: "TanStack Query v5 마이그레이션 정리",
    thumbnailUrl: GOOD_IMAGE,
  });
  const noImage = makeLink({
    id: 2,
    url: "https://www.notion.so/team/onboarding",
    title: "2026 하반기 팀 온보딩 문서",
    thumbnailUrl: null,
    faviconUrl: null,
  });
  const todos: MockTodo[] = [
    {
      id: 21,
      title: "토요일 2시 방문",
      reminderAt: iso(-3 * HOUR_MS),
      completedAt: null,
      linkId: 1,
      linkUrl: withImage.url,
      linkTitle: withImage.title,
      linkThumbnailUrl: GOOD_IMAGE,
      linkFaviconUrl: null,
    },
    {
      id: 22,
      title: "useInfiniteQuery 적용 범위 정리",
      reminderAt: iso(5 * HOUR_MS),
      completedAt: null,
      linkId: 1,
      linkUrl: withImage.url,
      linkTitle: withImage.title,
      linkThumbnailUrl: GOOD_IMAGE,
      linkFaviconUrl: null,
    },
    {
      id: 23,
      title: "온보딩 문서 팀원에게 공유",
      reminderAt: null,
      completedAt: null,
      linkId: 2,
      linkUrl: noImage.url,
      linkTitle: noImage.title,
      linkThumbnailUrl: null,
      linkFaviconUrl: null,
    },
    {
      id: 24,
      title: "예제 코드 따라 치기",
      reminderAt: iso(30 * HOUR_MS),
      completedAt: null,
      linkId: 1,
      linkUrl: withImage.url,
      linkTitle: withImage.title,
      linkThumbnailUrl: GOOD_IMAGE,
      linkFaviconUrl: null,
    },
  ];
  const detailTodos = (linkId: number) =>
    todos
      .filter((todo) => todo.linkId === linkId)
      .map(({ id, title, reminderAt, completedAt }) => ({ id, title, reminderAt, completedAt }));
  withImage.todoCounts = countTodos(detailTodos(1));
  noImage.todoCounts = countTodos(detailTodos(2));
  return {
    links: [withImage, noImage],
    details: {
      1: makeDetail(withImage, { todos: detailTodos(1) }),
      2: makeDetail(noImage, { todos: detailTodos(2) }),
    },
    todos,
  };
}

function todoCards(page: Page) {
  return page.getByTestId(/^todo-item(-overdue)?$/);
}

function todoCard(page: Page, title: string) {
  return todoCards(page).filter({ hasText: title });
}

test.describe("todo screen", () => {
  test.beforeEach(async ({ page }) => {
    const fixtures = buildFixtures();
    await mockApi(page, fixtures);
    await page.goto("/todos");
    await expect(todoCards(page)).toHaveCount(4);
  });

  test("a card shows the check, title, reminder and the linked link row (small image, domain, title)", async ({
    page,
  }) => {
    const card = todoCard(page, "useInfiniteQuery");
    await expect(card.getByRole("checkbox")).toBeVisible();
    await expect(card.getByTestId("todo-item-title")).toHaveText("useInfiniteQuery 적용 범위 정리");
    await expect(card.getByTestId("todo-item-reminder")).toBeVisible();
    const linkRow = card.getByTestId("todo-item-link");
    await expect(linkRow.getByTestId("todo-item-link-thumbnail")).toBeVisible();
    await expect(linkRow).toContainText("velog.io");
    await expect(linkRow).toContainText("TanStack Query v5 마이그레이션 정리");
    const title = await boxOf(card.getByTestId("todo-item-title"));
    expect((await boxOf(linkRow)).y).toBeGreaterThan(title.y);
  });

  test("an overdue card has a red border, a light red background and a red reminder", async ({
    page,
  }) => {
    const overdue = page.getByTestId("todo-item-overdue");
    await expect(overdue).toHaveCount(1);
    await expect(overdue).toContainText("토요일 2시 방문");
    const normal = todoCard(page, "useInfiniteQuery");
    expect(await cssOf(overdue, "border-top-color")).not.toBe(
      await cssOf(normal, "border-top-color"),
    );
    expect(await cssOf(overdue, "background-color")).not.toBe(
      await cssOf(normal, "background-color"),
    );
    const overdueTime = overdue.getByTestId("todo-item-reminder").locator("div").last();
    const normalTime = normal.getByTestId("todo-item-reminder").locator("div").last();
    expect(await cssOf(overdueTime, "color")).not.toBe(await cssOf(normalTime, "color"));
    const [r, g, b] = (await cssOf(overdueTime, "color")).match(/\d+/g)!.map(Number);
    expect(r).toBeGreaterThan(g + 60);
    expect(r).toBeGreaterThan(b + 60);
  });

  test("a linked link without an image shows the fallback in the small image cell", async ({
    page,
  }) => {
    const card = todoCard(page, "온보딩 문서 팀원에게");
    const fallback = card.getByTestId("todo-item-link-thumbnail-fallback");
    await expect(fallback).toBeVisible();
    await expect(fallback).toHaveText("N");
  });

  test("checking strikes the title through, and checking again restores it", async ({ page }) => {
    const card = todoCard(page, "온보딩 문서 팀원에게");
    const title = card.getByTestId("todo-item-title");
    expect(await cssOf(title, "text-decoration-line")).toBe("none");
    await card.getByRole("checkbox").click();
    await expect.poll(() => cssOf(title, "text-decoration-line")).toBe("line-through");
    await card.getByRole("checkbox").click();
    await expect.poll(() => cssOf(title, "text-decoration-line")).toBe("none");
  });

  test("wide shows several columns, phones one card per row", async ({ page }) => {
    if (isWideProject()) {
      // The upcoming section holds two cards side by side.
      const upcoming = page
        .getByTestId("todo-grid")
        .nth(1)
        .getByTestId(/^todo-item(-overdue)?$/);
      expect(await firstRowCount(upcoming)).toBe(2);
    } else {
      await expect(page.getByTestId("todo-grid")).toHaveCount(0);
      expect(await firstRowCount(todoCards(page))).toBe(1);
    }
  });
});

test.describe("same card everywhere", () => {
  test("wide home today's todos use the same card in several columns", async ({ page }) => {
    test.skip(!isWideProject(), "wide home");
    await mockApi(page, buildFixtures());
    await page.goto("/home");
    await expect(todoCards(page)).toHaveCount(4);
    expect(await firstRowCount(todoCards(page))).toBeGreaterThanOrEqual(2);
    await expect(todoCard(page, "useInfiniteQuery").getByTestId("todo-item-link")).toContainText(
      "velog.io",
    );
  });

  test("completing a todo on the wide home updates the recent card's counts", async ({ page }) => {
    test.skip(!isWideProject(), "wide home shows todos and cards together");
    await mockApi(page, buildFixtures());
    await page.goto("/home");
    const badge = page
      .getByTestId("link-card")
      .filter({ hasText: "TanStack Query v5" })
      .getByTestId("todo-count-badge");
    await expect(badge).toHaveAttribute("aria-label", "액션 1개, 임박 1개, 기한 지남 1개");
    await todoCard(page, "useInfiniteQuery").getByRole("checkbox").click();
    await expect(badge).toHaveAttribute("aria-label", "액션 1개, 기한 지남 1개");
  });

  test("completing a todo on the todo screen updates the link card's counts", async ({ page }) => {
    const state = await mockApi(page, buildFixtures());
    await page.goto("/todos");
    await todoCard(page, "토요일 2시 방문").getByRole("checkbox").click();
    await expect
      .poll(() => state.requests.some((r) => r.path === "/api/todos/21/completed"))
      .toBe(true);
    await page.goto(isWideProject() ? "/links" : "/home");
    await expect(
      page
        .getByTestId("link-card")
        .filter({ hasText: "TanStack Query v5" })
        .getByTestId("todo-count-badge"),
    ).toHaveAttribute("aria-label", "액션 1개, 임박 1개");
  });

  test("an empty todo screen shows the existing empty message", async ({ page }) => {
    await mockApi(page, { links: [], todos: [] });
    await page.goto("/todos");
    await expect(page.getByText("해당하는 액션이 없어요")).toBeVisible();
  });

  test("the check has room for a finger and does not trigger the card", async ({ page }) => {
    test.skip(isWideProject(), "touch");
    await mockApi(page, buildFixtures());
    await page.goto("/todos");
    const card = todoCard(page, "온보딩 문서 팀원에게");
    await card.getByRole("checkbox").tap();
    await expect(page).toHaveURL(/\/todos$/);
    await expect
      .poll(() => cssOf(card.getByTestId("todo-item-title"), "text-decoration-line"))
      .toBe("line-through");
  });
});

// #15 completing a todo moves it to another section; the cards left behind keep their size.

function buildSectionFixtures() {
  const link = makeLink({
    id: 3,
    url: "https://careers.lg.com/apply",
    title: "LG Careers 채용 공고",
    thumbnailUrl: null,
    faviconUrl: null,
  });
  const todo = (
    id: number,
    title: string,
    reminderAt: string | null,
    completedAt: string | null = null,
  ): MockTodo => ({
    id,
    title,
    reminderAt,
    completedAt,
    linkId: 3,
    linkUrl: link.url,
    linkTitle: link.title,
    linkThumbnailUrl: null,
    linkFaviconUrl: null,
  });
  const todos = [
    todo(31, "서류 최종 제출", iso(-3 * HOUR_MS)),
    todo(32, "지원서 최종 제출", iso(-4 * HOUR_MS)),
    todo(33, "이력서 작성 시작", iso(-5 * HOUR_MS)),
    todo(34, "알림 없는 할 일", null),
    todo(35, "이미 끝낸 일", iso(-7 * HOUR_MS), iso(-1 * HOUR_MS)),
    todo(36, "이미 끝낸 알림 없는 일", null, iso(-1 * HOUR_MS)),
  ];
  const detailTodos = todos.map(({ id, title, reminderAt, completedAt }) => ({
    id,
    title,
    reminderAt,
    completedAt,
  }));
  link.todoCounts = countTodos(detailTodos);
  return {
    links: [link],
    details: { 3: makeDetail(link, { todos: detailTodos }) },
    todos,
  };
}

function sectionHeader(page: Page, label: string) {
  return page.getByText(label, { exact: true });
}

async function heightsByTitle(cards: Locator): Promise<Record<string, number>> {
  const entries = await cards.evaluateAll((nodes) =>
    nodes.map((node) => [
      node.querySelector('[data-testid="todo-item-title"]')?.textContent ?? "",
      Math.round(node.getBoundingClientRect().height),
    ]),
  );
  return Object.fromEntries(entries);
}

async function expectNoClippedCards(cards: Locator) {
  const clipped = await cards.evaluateAll((nodes) =>
    nodes
      .filter((node) => node.scrollHeight > node.clientHeight + 1)
      .map((node) => node.querySelector('[data-testid="todo-item-title"]')?.textContent),
  );
  expect(clipped).toEqual([]);
}

async function expectSameHeights(
  cards: Locator,
  before: Record<string, number>,
  { changed = [] as string[], exact = true } = {},
) {
  await expectNoClippedCards(cards);
  const after = await heightsByTitle(cards);
  expect(Object.keys(after).length).toBeGreaterThan(0);
  if (!exact) return;
  for (const [title, height] of Object.entries(after)) {
    if (changed.includes(title)) {
      expect(height, `height of "${title}"`).toBeGreaterThanOrEqual(before[title] - 1);
    } else {
      expect(height, `height of "${title}"`).toBe(before[title]);
    }
  }
}

async function expectCardsComplete(cards: Locator, { withReminder = false } = {}) {
  const count = await cards.count();
  for (let index = 0; index < count; index += 1) {
    const card = cards.nth(index);
    await expect(card.getByRole("checkbox")).toBeVisible();
    await expect(card.getByTestId("todo-item-title")).toBeVisible();
    await expect(card.getByTestId("todo-item-link")).toBeVisible();
    if (withReminder) {
      await expect(card.getByTestId("todo-item-reminder")).toBeVisible();
    }
  }
}

async function expectHeaderRightBelow(page: Page, cards: Locator, label: string) {
  const bottoms = await cards.evaluateAll((nodes) =>
    nodes.map((node) => node.getBoundingClientRect().bottom),
  );
  const header = await boxOf(sectionHeader(page, label));
  const gap = header.y - Math.max(...bottoms);
  expect(gap).toBeGreaterThan(0);
  expect(gap).toBeLessThan(40);
}

test.describe("completing a todo keeps the other cards intact", () => {
  test.beforeEach(async ({ page }) => {
    await mockApi(page, buildSectionFixtures());
    await page.goto("/todos");
    await expect(page.getByTestId("todo-item-overdue")).toHaveCount(3);
  });

  test("the overdue cards left behind keep their size and the next section follows them", async ({
    page,
  }) => {
    const overdue = page.getByTestId("todo-item-overdue");
    const before = await heightsByTitle(todoCards(page));
    await todoCard(page, "서류 최종 제출").getByRole("checkbox").click();
    await expect(overdue).toHaveCount(2);
    await expect(todoCard(page, "서류 최종 제출").getByRole("checkbox")).toBeChecked();
    await expectSameHeights(todoCards(page), before, { changed: ["서류 최종 제출"] });
    await expectCardsComplete(overdue, { withReminder: true });
    await expectCardsComplete(todoCards(page));
    await expectHeaderRightBelow(page, overdue, "🕊 알림없음");
  });

  test("unchecking brings the todo back to the overdue section with every card intact", async ({
    page,
  }) => {
    const overdue = page.getByTestId("todo-item-overdue");
    const before = await heightsByTitle(todoCards(page));
    await todoCard(page, "서류 최종 제출").getByRole("checkbox").click();
    await expect(overdue).toHaveCount(2);
    await todoCard(page, "서류 최종 제출").getByRole("checkbox").click();
    await expect(overdue).toHaveCount(3);
    await expectSameHeights(todoCards(page), before);
    await expectCardsComplete(overdue, { withReminder: true });
    await expectCardsComplete(todoCards(page));
    await expectHeaderRightBelow(page, overdue, "🕊 알림없음");
  });

  test("completing the last overdue todo removes the section and leaves the others intact", async ({
    page,
  }) => {
    const overdue = page.getByTestId("todo-item-overdue");
    const before = await heightsByTitle(todoCards(page));
    for (const title of ["서류 최종 제출", "지원서 최종 제출", "이력서 작성 시작"]) {
      await todoCard(page, title).getByRole("checkbox").click();
    }
    await expect(overdue).toHaveCount(0);
    await expect(sectionHeader(page, "🔥 기간지남")).toHaveCount(0);
    await expect(todoCards(page)).toHaveCount(6);
    await expectSameHeights(todoCards(page), before, {
      changed: ["서류 최종 제출", "지원서 최종 제출", "이력서 작성 시작"],
      exact: !isWideProject(),
    });
    await expectCardsComplete(todoCards(page));
  });

  test("completing and unchecking a todo without a reminder keeps every card intact", async ({
    page,
  }) => {
    const before = await heightsByTitle(todoCards(page));
    const card = todoCard(page, "알림 없는 할 일");
    await card.getByRole("checkbox").click();
    await expect(sectionHeader(page, "🕊 알림없음")).toHaveCount(0);
    await expectSameHeights(todoCards(page), before, { changed: ["알림 없는 할 일"] });
    await expectCardsComplete(todoCards(page));
    await card.getByRole("checkbox").click();
    await expect(sectionHeader(page, "🕊 알림없음")).toHaveCount(1);
    await expect(async () => {
      await expectSameHeights(todoCards(page), before);
    }).toPass();
    await expectCardsComplete(todoCards(page));
  });

  test("cards in one grid row share a height and keep the link row at the bottom", async ({
    page,
  }) => {
    test.skip(!isWideProject(), "the grid is wide only");
    const completedCards = page.getByTestId("todo-grid").last().getByTestId("todo-item");
    await expect.poll(() => firstRowCount(completedCards)).toBe(2);
    const rows = await completedCards.evaluateAll((cards) =>
      cards.map((card) => {
        const rect = card.getBoundingClientRect();
        const link = card.querySelector('[data-testid="todo-item-link"]')!.getBoundingClientRect();
        return {
          height: Math.round(rect.height),
          linkGap: Math.round(rect.bottom - link.bottom),
        };
      }),
    );
    expect(rows).toHaveLength(2);
    expect(rows[1].height).toBe(rows[0].height);
    for (const row of rows) expect(row.linkGap).toBeLessThanOrEqual(1);
  });

  test("completing and unchecking a todo in the link detail keeps every card intact", async ({
    page,
  }) => {
    await page.goto(isWideProject() ? "/links?linkId=3" : "/links/3");
    const cards = page.getByTestId("link-detail-todos").getByTestId(/^todo-item(-overdue)?$/);
    await expect(cards).toHaveCount(6);
    const before = await heightsByTitle(cards);
    const checkbox = cards.filter({ hasText: "서류 최종 제출" }).getByRole("checkbox");
    await checkbox.click();
    await expect(checkbox).toBeChecked();
    await expectSameHeights(cards, before, { changed: ["서류 최종 제출"] });
    await expectCardsComplete(cards);
    await checkbox.click();
    await expect(checkbox).not.toBeChecked();
    await expectSameHeights(cards, before);
    await expectCardsComplete(cards);
  });
});
