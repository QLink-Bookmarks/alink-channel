import { type Page, expect, test } from "@playwright/test";

import { isWideProject } from "./support/helpers";
import {
  type MockNotification,
  type MockTodo,
  iso,
  makeDetail,
  makeLink,
  mockApi,
} from "./support/mock-api";

// #90: the inbox lists notifications by when they were received, newest first.

const MINUTE_MS = 60_000;

// Created order is id order (newest first: D, C, B, A); received order is A, B, C, D.
const NOTIFICATIONS: MockNotification[] = [
  {
    id: 1,
    title: "알림 A",
    message: "내용 A",
    firedAt: iso(-10 * MINUTE_MS),
    readAt: null,
    context: "TODO",
    contextId: 11,
  },
  {
    id: 2,
    title: "알림 B",
    message: "내용 B",
    firedAt: iso(-60 * MINUTE_MS),
    readAt: null,
    context: "ANNOUNCE",
    contextId: 7,
  },
  {
    id: 3,
    title: "알림 C",
    message: "내용 C",
    firedAt: iso(-120 * MINUTE_MS),
    readAt: null,
    context: "TODO",
    contextId: 12,
  },
  {
    id: 4,
    title: "알림 D",
    message: "내용 D",
    firedAt: iso(-180 * MINUTE_MS),
    readAt: null,
    context: "ANNOUNCE",
    contextId: 8,
  },
];

function todoFor(id: number, linkId: number): MockTodo {
  return {
    id,
    title: `액션 ${id}`,
    reminderAt: null,
    completedAt: null,
    linkId,
    linkUrl: `https://example.com/${linkId}`,
    linkTitle: `링크 ${linkId}`,
    linkThumbnailUrl: null,
    linkFaviconUrl: null,
  };
}

async function mockInbox(page: Page) {
  const link = makeLink({ id: 101, title: "링크 101" });
  return mockApi(page, {
    links: [link],
    details: { 101: makeDetail(link) },
    todos: [todoFor(11, 101), todoFor(12, 101)],
    notifications: NOTIFICATIONS,
  });
}

function shownTitles(page: Page) {
  return page.getByText(/^알림 [A-D]$/);
}

function requestsTo(state: Awaited<ReturnType<typeof mockApi>>, path: string) {
  return state.requests
    .filter((request) => request.method === "GET" && request.path === path)
    .map((request) => new URLSearchParams(request.search));
}

// The inbox filter row: the innermost box holding both `전체` and `공지사항`, so the sidebar or
// bottom tab `액션` is never picked.
function chip(page: Page, label: string) {
  const row = page
    .locator("div")
    .filter({ has: page.getByText("공지사항", { exact: true }) })
    .filter({ has: page.getByText("전체", { exact: true }) })
    .last();
  return row.getByText(label, { exact: true });
}

test.describe("notification inbox order", () => {
  test("lists notifications by when they were received, newest first, in every tab", async ({
    page,
  }) => {
    const state = await mockInbox(page);
    await page.goto("/notifications");

    await expect(shownTitles(page)).toHaveText(["알림 A", "알림 B", "알림 C", "알림 D"]);
    const [first] = requestsTo(state, "/api/notifications");
    expect(first.get("orderKey")).toBe("fired_at");
    expect(first.get("order")).toBe("desc");

    await chip(page, "액션").click();
    await expect(shownTitles(page)).toHaveText(["알림 A", "알림 C"]);
    await chip(page, "공지사항").click();
    await expect(shownTitles(page)).toHaveText(["알림 B", "알림 D"]);
    await chip(page, "전체").click();
    await expect(shownTitles(page)).toHaveText(["알림 A", "알림 B", "알림 C", "알림 D"]);

    for (const params of requestsTo(state, "/api/notifications")) {
      expect([params.get("orderKey"), params.get("order")]).toEqual(["fired_at", "desc"]);
    }
  });

  test("an action notification looks up its action and opens the link", async ({ page }) => {
    const state = await mockInbox(page);
    await page.goto("/notifications");
    await expect(shownTitles(page)).toHaveCount(4);

    await page.getByText("알림 A", { exact: true }).click();

    await expect(page).toHaveURL(isWideProject() ? /\/links\?linkId=101$/ : /\/links\/101$/);
    const lookups = requestsTo(state, "/api/todos").filter((params) => params.get("size") === "50");
    expect(lookups.map((params) => [params.get("orderKey"), params.get("order")])).toEqual([
      ["created_at", "desc"],
    ]);
  });
});
