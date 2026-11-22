import { expect, test } from "@playwright/test";

import { envelope, makeDetail, makeLink, mockApi, scroll } from "./support/mock-api";

const folder = {
  id: 118,
  ownerId: 1,
  name: "제주 산책 기록",
  emoji: "🗺️",
  isShared: true,
  isPublic: true,
  shareCounts: 1,
  linkCounts: 3,
};
const url = "https://example.test/original";
const image = "https://preview.example.test/walk.jpg";
const favicon = "https://preview.example.test/icon.png";
const excerpt = "돌담을 따라 걷는 아침 산책길과 바다 전망대…";
const action = "다음 산책 코스 고르기";
const publicRows = [
  {
    id: 229,
    title: "제주 동쪽 해안 산책 영상",
    url,
    isVideo: true,
    thumbnailUrl: image,
    faviconUrl: favicon,
    contentExcerpt: excerpt,
  },
  {
    id: 230,
    title: "풍경을 기록하는 지도",
    url,
    isVideo: false,
    thumbnailUrl: null,
    faviconUrl: favicon,
    contentExcerpt: null,
  },
  {
    id: 231,
    title: "길을 걷다가 만난 서점",
    url,
    isVideo: false,
    thumbnailUrl: null,
    faviconUrl: null,
    contentExcerpt: null,
  },
];
const { contentExcerpt, ...publicVideo } = publicRows[0];
const folderFields = { folderId: folder.id, folderName: folder.name, folderEmoji: folder.emoji };
const membersRows = publicRows.map((row, index) => ({
  ...makeLink({
    ...row,
    ...folderFields,
    isPublic: true,
    createdAt: `2026-11-2${4 - index}T09:00:00Z`,
  }),
  contentExcerpt: row.contentExcerpt,
}));
const details = {
  [publicVideo.id]: makeDetail(membersRows[0], {
    memo: "회원만 보는 메모",
    todos: [{ id: 302, title: action, completedAt: null, reminderAt: null }],
  }),
};

for (const member of [true, false]) {
  test(`matches folder and detail preview, navigation and action placement (member: ${member})`, async ({
    page,
    isMobile,
  }) => {
    const requests: { method: string; url: URL; token?: string }[] = [];
    page.on("request", (request) => {
      const url = new URL(request.url());
      if (url.pathname.startsWith("/api/")) {
        requests.push({ method: request.method(), url, token: request.headers().authorization });
      }
    });
    await page.route(image, (route) =>
      route.fulfill({ path: "assets/sample-links/jeju-course-route.jpg" }),
    );
    await page.route(favicon, (route) => route.fulfill({ path: "assets/favicon.png" }));
    await page.context().route(url, (route) => route.fulfill({ body: "원본" }));
    await mockApi(page, {
      seedSession: member,
      folders: [folder],
      links: membersRows,
      details,
    });
    await page.route(
      (requestUrl) => /^\/api\/links\/\d+$/.test(requestUrl.pathname),
      (route) => {
        const id = Number(new URL(route.request().url()).pathname.split("/").at(-1));
        if (member && id !== publicVideo.id) return route.fallback();
        const { contentExcerpt: savedExcerpt, ...row } = publicRows.find((item) => item.id === id)!;
        if (member) {
          return route.fulfill({
            json: envelope({
              ...details[id],
              content: { excerpt: contentExcerpt, isPending: false },
            }),
          });
        }
        return route.fulfill({
          json: envelope({
            ...row,
            ...folderFields,
            content: { excerpt: savedExcerpt },
            todos: id === publicVideo.id ? [{ title: action, isCompleted: false }] : [],
          }),
        });
      },
    );
    if (!member) {
      await page.route(`**/api/folders/${folder.id}`, (route) =>
        route.fulfill({
          json: envelope({ id: folder.id, name: folder.name, emoji: folder.emoji }),
        }),
      );
      await page.route(
        (requestUrl) => requestUrl.pathname === "/api/links",
        (route) => {
          const order = new URL(route.request().url()).searchParams.get("order");
          return route.fulfill({
            json: scroll(order === "asc" ? [...publicRows].reverse() : publicRows),
          });
        },
      );
    }

    await page.goto(`/folders/${folder.id}`);
    const viewport = page.getByTestId("resource-detail-viewport");
    const list = viewport.getByTestId("link-list-body");
    const cards = list.getByTestId("link-card");
    await expect(cards).toHaveCount(3);
    await expect(list.getByText("3개 링크", { exact: true })).toBeVisible();
    await expect(cards.nth(0).getByText(excerpt)).toBeVisible();
    await expect(cards.nth(0).getByText("영상", { exact: true })).toBeVisible();
    await expect(cards.nth(0).getByTestId("link-thumbnail-image")).toBeVisible();
    await expect(cards.nth(1).getByTestId("link-thumbnail-fallback")).toBeVisible();
    await expect(cards.nth(1).getByTestId("link-thumbnail-favicon")).toBeVisible();
    await expect(cards.nth(2).getByTestId("link-thumbnail-fallback")).toBeVisible();
    if (isMobile) {
      await expect(viewport.getByTestId("app-header-title")).toHaveText(
        `${folder.emoji} ${folder.name}`,
      );
      const tabs = page.getByRole("navigation", { name: "하단 내비게이션" });
      await expect(tabs.getByRole("button", { name: "폴더" })).toHaveAttribute(
        "aria-current",
        "page",
      );
      await expect(page.getByRole("button", { name: "새 링크" })).toHaveCount(member ? 1 : 0);
    }
    await expect(list.getByText(action)).toHaveCount(0);
    expect(requests.some(({ url }) => url.pathname === "/api/todos")).toBe(false);
    const favorites = list.getByTestId("link-filter-row-favorite");
    const filter = list.getByTestId("link-filter-row-button");
    await filter.click();
    await expect(favorites).toHaveCount(member ? 1 : 0);
    const sort = list.getByRole("radio", { name: /저장일/ });
    await sort.click();
    await expect(cards.first().getByTestId("link-card-title")).toHaveText(publicRows[2].title);
    if ((await filter.getAttribute("aria-expanded")) === "true") await filter.click();

    const card = cards.filter({ hasText: publicVideo.title });
    const openedCard = page.context().waitForEvent("page");
    await card.getByRole("link", { name: /^원본 열기/ }).click();
    const original = await openedCard;
    await expect(original).toHaveURL(url);
    await original.close();
    await card.getByTestId("link-card-body").click();
    await expect(page).toHaveURL(
      isMobile ? `/links/${publicVideo.id}` : `/folders/${folder.id}?linkId=${publicVideo.id}`,
    );
    const detail = viewport.getByTestId("link-detail");
    if (!isMobile) {
      const panel = viewport.getByTestId("detail-panel");
      await expect(panel).toBeVisible();
      const bounds = (await panel.boundingBox())!;
      expect(bounds.width).toBeCloseTo(page.viewportSize()!.width * 0.34, 0);
    }
    await expect(detail.getByTestId("link-detail-thumbnail-image")).toBeVisible();
    await expect(detail.getByTestId("link-thumbnail-hint-play")).toBeVisible();
    const notes = detail.getByTestId("link-detail-my-notes");
    await expect(detail.getByTestId("link-detail-excerpt-text")).toContainText(excerpt);
    await expect(notes.getByTestId("link-detail-todos").getByText(action)).toBeVisible();
    await expect(notes.getByTestId("link-detail-todos-add")).toHaveCount(member ? 1 : 0);
    await expect(notes.getByText("회원만 보는 메모")).toHaveCount(member ? 1 : 0);
    const ordered = await detail
      .locator("[data-testid]")
      .evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-testid")));
    const ownBody = [
      "link-detail-thumbnail",
      "link-detail-title",
      "link-detail-excerpt",
      "link-detail-my-notes",
      "link-detail-folder-row",
      "link-detail-todos",
    ];
    expect(ordered.filter((id) => ownBody.includes(id ?? ""))).toEqual(ownBody);
    const openedExcerpt = page.context().waitForEvent("page");
    await detail.getByRole("link", { name: "이어 읽기" }).click();
    const continued = await openedExcerpt;
    await expect(continued).toHaveURL(url);
    await continued.close();
    if (isMobile) await page.getByRole("button", { name: "뒤로" }).click();
    else await detail.getByRole("button", { name: "닫기" }).click();
    await expect(page).toHaveURL(`/folders/${folder.id}`);
    if (!member) {
      await page.goto(`/links/${publicRows[2].id}`);
      await expect(detail.getByTestId("link-detail-thumbnail-fallback")).toBeVisible();
      await expect(detail.getByTestId("link-detail-excerpt")).toHaveCount(0);
      await expect(detail.getByTestId("link-detail-todos")).toHaveCount(0);
      expect(requests.map(({ method, url, token }) => [method, url.pathname, token])).toEqual(
        expect.arrayContaining([["GET", `/api/folders/${folder.id}`, undefined]]),
      );
      expect(
        requests.filter(({ method, url, token }) => {
          if (method === "POST" && url.pathname === "/api/auth/token/refresh/web" && !token) {
            return false;
          }
          return (
            method !== "GET" ||
            Boolean(token) ||
            !(
              url.pathname === `/api/folders/${folder.id}` ||
              (url.pathname === "/api/links" &&
                url.searchParams.get("folderId") === String(folder.id)) ||
              publicRows.some(({ id }) => url.pathname === `/api/links/${id}`)
            )
          );
        }),
      ).toEqual([]);
    }
  });
}

test("public folder applies both sorts and passes the corresponding cursor unchanged", async ({
  page,
}) => {
  await mockApi(page, { seedSession: false });
  await page.route(`**/api/folders/${folder.id}`, (route) =>
    route.fulfill({ json: envelope({ id: folder.id, name: folder.name, emoji: folder.emoji }) }),
  );
  const requests: [string, string, string | null][] = [];
  await page.route(
    (url) => url.pathname === "/api/links",
    (route) => {
      const request = route.request();
      const params = new URL(request.url()).searchParams;
      const key = params.get("orderKey")!;
      const order = params.get("order")!;
      const cursor = params.get("cursor");
      requests.push([key, order, cursor]);
      expect(request.headers().authorization).toBeUndefined();
      expect(params.get("folderId")).toBe(String(folder.id));
      expect(params.has("isFavorite")).toBe(false);
      const ascending =
        key === "title" ? [publicRows[2], publicRows[0], publicRows[1]] : [...publicRows].reverse();
      const rows = order === "asc" ? ascending : ascending.reverse();
      const nextCursor = `opaque+${key}/${order}=`;
      if (cursor !== null) expect(cursor).toBe(nextCursor);
      return route.fulfill({
        json: cursor ? scroll(rows.slice(1)) : scroll(rows.slice(0, 1), nextCursor),
      });
    },
  );

  await page.goto(`/folders/${folder.id}`);
  const list = page.getByTestId("link-list-body");
  const filter = list.getByTestId("link-filter-row-button");
  const titles = list.getByTestId("link-card-title");
  const expectSort = async (key: string, order: string, expected: number[]) => {
    await expect(titles).toHaveText(expected.map((index) => publicRows[index].title));
    expect(requests.filter(([k, o]) => k === key && o === order)).toEqual([
      [key, order, null],
      [key, order, `opaque+${key}/${order}=`],
    ]);
  };
  const choose = async (name: RegExp) => {
    if ((await filter.getAttribute("aria-expanded")) !== "true") await filter.click();
    await list.getByRole("radio", { name }).click();
  };
  await expectSort("created_at", "desc", [0, 1, 2]);
  await choose(/저장일/);
  await expectSort("created_at", "asc", [2, 1, 0]);
  await choose(/제목/);
  await expectSort("title", "asc", [2, 0, 1]);
  await choose(/제목/);
  await expectSort("title", "desc", [1, 0, 2]);
});

for (const role of ["guest", "outsider", "former-member-owner"] as const) {
  test(`public folder card and direct link agree on link ownership for ${role}`, async ({
    page,
    isMobile,
  }) => {
    const canEdit = role === "former-member-owner";
    const requested: { path: string; token?: string; method: string }[] = [];
    const account = await mockApi(page, { seedSession: role !== "guest", folders: [] });
    const folderPath = `/folders/${folder.id}`;
    const linkPath = `/links/${publicVideo.id}`;
    await page.route(`**/api${folderPath}`, (route) =>
      route.fulfill({ json: envelope({ id: folder.id, name: folder.name, emoji: folder.emoji }) }),
    );
    const title = publicVideo.title;
    let favorite = false;
    await page.route(
      (url) =>
        url.pathname === "/api/links" && url.searchParams.get("folderId") === String(folder.id),
      (route) => {
        expect(route.request().headers().authorization).toBeUndefined();
        return route.fulfill({ json: scroll([{ ...publicRows[0], title }]) });
      },
    );
    await page.route(`**/api${linkPath}/favorite`, (route) => {
      const request = route.request();
      requested.push({
        method: request.method(),
        path: `/api${linkPath}/favorite`,
        token: request.headers().authorization,
      });
      expect(canEdit).toBe(true);
      expect(request.headers().authorization).toBe("Bearer e2e-access-token");
      favorite = request.postDataJSON().isFavorite;
      return route.fulfill({ json: envelope(null) });
    });
    await page.route(`**/api${linkPath}`, (route) => {
      const { method, path, token } = {
        method: route.request().method(),
        path: new URL(route.request().url()).pathname,
        token: route.request().headers().authorization,
      };
      requested.push({ method, path, token });
      const data =
        canEdit && token
          ? {
              ...details[publicVideo.id],
              title,
              isOwner: true,
              isFavorite: favorite,
              content: { excerpt, isPending: false },
            }
          : {
              ...publicVideo,
              ...folderFields,
              title,
              content: { excerpt },
              todos: [{ title: action, isCompleted: false }],
            };
      return route.fulfill({ json: envelope(data) });
    });
    await page.goto(folderPath);
    const list = page.getByTestId("link-list-body");
    await list.getByTestId("link-card-body").click();
    await expect(page).toHaveURL(isMobile ? linkPath : `${folderPath}?linkId=${publicVideo.id}`);
    const detail = page.getByTestId("link-detail");
    const edit = page.getByTestId("link-detail-edit");
    const toolbar = page.getByTestId("link-detail-toolbar");
    await expect(detail.getByTestId("link-detail-title")).toHaveText(title);
    await expect(edit).toHaveCount(canEdit ? 1 : 0);
    await expect(detail.getByText("회원만 보는 메모")).toHaveCount(canEdit ? 1 : 0);
    if (canEdit) {
      await toolbar.getByRole("button", { name: "바로가기 추가" }).click();
      await expect(toolbar.getByRole("button", { name: "바로가기 해제" })).toBeVisible();
    }
    if (isMobile) await page.getByRole("button", { name: "뒤로" }).click();
    else await detail.getByRole("button", { name: "닫기" }).click();
    await expect(page).toHaveURL(folderPath);
    await expect(list.getByTestId("link-card-title")).toHaveText(title);
    await page.goto(linkPath);
    await expect(detail.getByTestId("link-detail-title")).toHaveText(title);
    await expect(edit).toHaveCount(canEdit ? 1 : 0);
    await expect(toolbar.getByRole("button", { name: "바로가기 해제" })).toHaveCount(
      canEdit ? 1 : 0,
    );
    expect(requested.filter(({ method }) => method === "PUT")).toHaveLength(canEdit ? 1 : 0);
    for (const request of requested) {
      expect(request.token).toBe(role === "guest" ? undefined : "Bearer e2e-access-token");
    }
    if (!canEdit) {
      expect(
        account.requests.filter(({ path }) => /^\/api\/(?:folders|links|todos)(?:\/|$)/.test(path)),
      ).toEqual([]);
    }
  });
}
