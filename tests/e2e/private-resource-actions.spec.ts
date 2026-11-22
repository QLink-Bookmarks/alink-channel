import { type Route, expect, test } from "@playwright/test";

import { envelope, makeDetail, makeLink, mockApi, scroll } from "./support/mock-api";

const folder = {
  id: 118,
  ownerId: 1,
  name: "공동 산책 자료",
  emoji: "🗺️",
  isShared: true,
  isPublic: true,
  shareCounts: 2,
  linkCounts: 2,
};
const folderPath = `/folders/${folder.id}`;
const entries = [
  { id: 229, title: "해안 산책 영상", ownerId: 1, todoId: 601, todoTitle: "소유자가 등록한 액션" },
  {
    id: 230,
    title: "버스 정류장 지도",
    ownerId: 2,
    todoId: 602,
    todoTitle: "협업자가 등록한 액션",
  },
];
const folderFields = { folderId: folder.id, folderName: folder.name, folderEmoji: folder.emoji };

for (const [role, actorId] of [
  ["owner", 1],
  ["collaborator", 2],
  ["outsider", 3],
  ["guest", null],
] as const) {
  test(`${role} sees the expected actions through folder cards and direct links`, async ({
    page,
    isMobile,
  }) => {
    const isMember = actorId === 1 || actorId === 2;
    const rows = entries.map((entry) =>
      makeLink({
        ...folderFields,
        id: entry.id,
        ownerId: entry.ownerId,
        title: entry.title,
        isPublic: true,
        todoCounts: { open: 1, dueSoon: 0, overdue: 0, completed: 0 },
      }),
    );
    const details = Object.fromEntries(
      entries.map((entry, index) => [
        entry.id,
        makeDetail(rows[index], {
          isOwner: actorId === entry.ownerId,
          todos: [
            { id: entry.todoId, title: entry.todoTitle, completedAt: null, reminderAt: null },
          ],
        }),
      ]),
    );
    const writes: unknown[] = [];
    const state = await mockApi(page, {
      seedSession: actorId !== null,
      folders: isMember ? [{ ...folder, myLinkCounts: 1 }] : [],
      links: rows,
      details,
      handlers: {
        "GET /api/users/me": (route) =>
          route.fulfill({
            json: envelope({
              id: actorId,
              nickname: role,
              role: "USER",
              allowsPrivacy: true,
              allowsAiUsage: true,
            }),
          }),
        ...Object.fromEntries(
          entries.map((entry) => [
            `PUT /api/todos/${entry.todoId}`,
            (route: Route) => {
              const { title } = route.request().postDataJSON();
              writes.push(title);
              const updated = {
                ...details[entry.id],
                todos: [{ ...details[entry.id].todos[0], title }],
              };
              details[entry.id] = updated;
              return route.fulfill({ json: envelope({ id: entry.todoId }) });
            },
          ]),
        ),
      },
    });
    if (!isMember) {
      await page.route(`**/api${folderPath}`, (route) =>
        route.fulfill({
          json: envelope({
            id: folder.id,
            name: folder.name,
            emoji: folder.emoji,
            myLinkCounts: 0,
          }),
        }),
      );
      await page.route(
        (url) =>
          url.pathname === "/api/links" && url.searchParams.get("folderId") === String(folder.id),
        (route) => {
          expect(route.request().headers().authorization).toBeUndefined();
          return route.fulfill({
            json: scroll(
              rows.map(({ id, title, url, thumbnailUrl, faviconUrl, isVideo }) => ({
                id,
                title,
                url,
                thumbnailUrl,
                faviconUrl,
                isVideo,
                contentExcerpt: null,
              })),
            ),
          });
        },
      );
      for (const { id, title, url, thumbnailUrl, faviconUrl, isVideo } of rows) {
        await page.route(`**/api/links/${id}`, (route) => {
          expect(route.request().method()).toBe("GET");
          return route.fulfill({
            json: envelope({
              id,
              title,
              url,
              thumbnailUrl,
              faviconUrl,
              isVideo,
              ...folderFields,
              content: { excerpt: null },
              todos: null,
            }),
          });
        });
      }
    }

    await page.goto(folderPath);
    const list = page.getByTestId("link-list-body");
    await expect(list.getByText("2개 링크", { exact: true })).toBeVisible();
    await expect(list.getByText("0개 링크", { exact: true })).toHaveCount(0);
    for (const entry of entries) {
      const isOwned = entry.ownerId === actorId;
      const card = list.getByTestId("link-card").filter({ hasText: entry.title });
      const badge = card.getByTestId("todo-count-badge");
      await expect(badge).toHaveCount(isMember ? 1 : 0);
      if (isMember) await expect(badge).toHaveAttribute("aria-label", "액션 1개");
      await card.getByTestId("link-card-body").click();
      const direct = `/links/${entry.id}`;
      await expect(page).toHaveURL(isMobile ? direct : `${folderPath}?linkId=${entry.id}`);
      const detail = page.getByTestId("link-detail");
      await expect(detail.getByTestId("link-detail-title")).toHaveText(entry.title);
      const section = detail.getByTestId("link-detail-todos");
      await expect(section).toHaveCount(isMember ? 1 : 0);
      await expect(detail.getByTestId("todo-item-title")).toHaveCount(isMember ? 1 : 0);
      await expect(
        detail.getByText(entries.find(({ id }) => id !== entry.id)!.todoTitle),
      ).toHaveCount(0);
      const title = isOwned ? `${entry.todoTitle} 수정` : entry.todoTitle;
      if (isOwned) {
        await section.getByText(entry.todoTitle).click();
        await section.getByPlaceholder("액션 제목").fill(title);
        await section.getByTestId("link-detail-todos-save").click();
        await expect(section.getByTestId("todo-item-title")).toHaveText(title);
      } else if (isMember) {
        await expect(section.getByTestId("todo-item-title")).toHaveText(title);
      } else {
        await expect(detail.getByText("액션", { exact: true })).toHaveCount(0);
        await expect(detail.getByRole("checkbox")).toHaveCount(0);
      }

      await page.goto(direct);
      await expect(detail.getByTestId("link-detail-title")).toHaveText(entry.title);
      await expect(detail.getByTestId("todo-item-title")).toHaveCount(isMember ? 1 : 0);
      if (isMember) await expect(detail.getByTestId("todo-item-title")).toHaveText(title);
      await page.goto(folderPath);
    }
    expect(writes).toHaveLength(isMember ? 1 : 0);
    expect(
      state.requests.filter(
        ({ method, path }) => method === "GET" && path.startsWith("/api/todos"),
      ),
    ).toEqual([]);
    if (!isMember) {
      expect(state.requests.filter(({ path }) => path.startsWith("/api/todos"))).toEqual([]);
      expect(
        state.requests.filter(({ path }) => /^\/api\/(?:folders|links)(?:\/|$)/.test(path)),
      ).toEqual([]);
    }
  });
}
