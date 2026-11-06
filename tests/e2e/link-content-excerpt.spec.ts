import { type Page, type Route, expect, test } from "@playwright/test";

import { boxOf, isWideProject, openedUrls, stubWindowOpen } from "./support/helpers";
import { type MockDetail, envelope, makeDetail, makeLink, mockApi } from "./support/mock-api";
import {
  LONG_BODY,
  type MockContentLink,
  SHORT_BODY,
  contentEntryOf,
  excerptOf,
  withContent,
} from "./support/mock-content";

// #58 C1: the detail excerpt, its silent re-check, the card's excerpt line, and the mobile
// search card's context and title highlight. Server responses are controlled; the page
// body itself is never shown beyond the server-cut excerpt.

const LONG_EXCERPT = excerptOf(LONG_BODY) as string;
const SHORT_EXCERPT = excerptOf(SHORT_BODY) as string;
const SEARCH_WORD = "성산일출봉";

function buildFixtures() {
  const links = [
    makeLink({
      id: 1,
      url: "https://brunch.co.kr/@jeju/east-3days",
      title: "제주 2박 3일 동쪽 일주 코스와 비용 정리",
      tags: ["제주", "여행코스"],
      createdAt: "2026-10-29T10:08:00.000Z",
    }),
    makeLink({
      id: 2,
      url: "https://www.jeju.go.kr/hyeopjae",
      title: "협재 해수욕장 주차·물때 정보",
      createdAt: "2026-10-29T10:07:00.000Z",
    }),
    makeLink({
      id: 3,
      url: "https://example.com/collecting",
      title: "방금 저장한 글",
      createdAt: "2026-10-29T10:06:00.000Z",
    }),
    makeLink({
      id: 4,
      url: "https://example.com/login",
      title: "로그인이 필요한 페이지",
      createdAt: "2026-10-29T10:05:00.000Z",
    }),
    makeLink({
      id: 5,
      url: "https://example.com/old",
      title: "기능 이전에 저장한 링크",
      createdAt: "2026-10-29T10:04:00.000Z",
    }),
    makeLink({
      id: 6,
      url: "https://blog.naver.com/cafe/east",
      title: "제주 동부 카페 지도 (2026 업데이트)",
      tags: ["카페"],
      createdAt: "2026-10-29T10:03:00.000Z",
    }),
    makeLink({
      id: 7,
      url: "https://example.com/ai-generating",
      title: "AI 요약을 만드는 중인 링크",
      status: "G",
      workModel: null,
      createdAt: "2026-10-29T10:02:00.000Z",
    }),
    makeLink({
      id: 8,
      url: "https://visitjeju.net/sunrise",
      title: "성산일출봉 일출 시간표와 입장 마감 안내",
      createdAt: "2026-10-29T10:01:00.000Z",
    }),
  ];
  const details: Record<number, MockDetail> = Object.fromEntries(
    links.map((link) => [
      link.id,
      makeDetail(link, link.id === 7 ? { summary: null } : { summary: "요약 문장" }),
    ]),
  );
  return withContent(links, details);
}

type MockState = Awaited<ReturnType<typeof mockApi>>;

/**
 * Answers searches (`GET /api/links?query=…`) from the current mock state, like the server:
 * title/URL/tag matches first, then links whose body alone matched (two characters or more),
 * with a context of at most 100 units around the match. Other requests fall through.
 */
async function routeSearch(page: Page, getState: () => MockState) {
  await page.route(
    (url) => url.pathname === "/api/links" && url.searchParams.has("query"),
    async (route: Route) => {
      const url = new URL(route.request().url());
      const query = (url.searchParams.get("query") ?? "").trim();
      const lower = query.toLowerCase();
      const links = getState().links as MockContentLink[];
      const isMeta = (link: MockContentLink) =>
        [link.title, link.url, ...link.tags].some((value) => value.toLowerCase().includes(lower));
      const meta = links
        .filter(isMeta)
        .map((link) => ({ ...link, matchedFields: ["TITLE"], contentSnippet: null }));
      const body = links
        .filter((link) => !isMeta(link) && query.length >= 2)
        .flatMap((link) => {
          const text = contentEntryOf(link.id).body;
          const index = text?.indexOf(query) ?? -1;
          if (!text || index < 0) return [];
          const from = Math.max(0, index - 15);
          const head = from > 0 ? "…" : "";
          const window = text.slice(from, from + 98 - head.length);
          const tail = from + window.length < text.length ? "…" : "";
          const start = head.length + (index - from);
          return [
            {
              ...link,
              matchedFields: ["CONTENT"],
              contentSnippet: {
                text: `${head}${window}${tail}`,
                highlights: [{ start, end: start + query.length }],
              },
            },
          ];
        });
      const contents = [...meta, ...body];
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(
          envelope({ isEmpty: contents.length === 0, contents, nextCursor: null, hasNext: false }),
        ),
      });
    },
  );
}

async function openDetail(page: Page, id: number) {
  await page.goto(isWideProject() ? `/links?linkId=${id}` : `/links/${id}`);
  await expect(page.getByTestId("link-detail-title")).toBeVisible();
  if (isWideProject()) {
    await expect(page.getByTestId("link-detail-close")).toBeInViewport({ ratio: 1 });
  }
}

function card(page: Page, title: string) {
  return page.getByTestId("link-card").filter({ hasText: title });
}

function detailGets(state: MockState, id: number) {
  return state.requests.filter((r) => r.method === "GET" && r.path === `/api/links/${id}`).length;
}

/** Words that would reveal that the page body is stored or being collected. */
const STATUS_WORDS = /본문|원문|발췌|수집|가져오는 중|가져오지 못|차단/;

test.describe("detail excerpt", () => {
  test("sits under the summary and above the tags, without a heading, with 이어 읽기 inline after …", async ({
    page,
  }) => {
    await mockApi(page, buildFixtures());
    await openDetail(page, 1);

    const excerpt = page.getByTestId("link-detail-excerpt");
    await expect(excerpt).toBeVisible();
    const summary = await boxOf(page.getByTestId("link-detail-summary"));
    const block = await boxOf(excerpt);
    const tags = await boxOf(page.getByTestId("link-detail-tags"));
    expect(block.y).toBeGreaterThan(summary.y + summary.height - 1);
    expect(tags.y).toBeGreaterThan(block.y + block.height - 1);

    await expect(page.getByTestId("link-detail-excerpt-text")).toHaveText(
      `${LONG_EXCERPT} 이어 읽기`,
    );
    // 100-unit cap: the text before "…" is the first 100 characters of the body.
    const text = (await page.getByTestId("link-detail-excerpt-text").textContent()) ?? "";
    const beforeEllipsis = text.slice(0, text.indexOf("…"));
    expect(beforeEllipsis).toBe(LONG_BODY.slice(0, 100));
    // No heading, source line or status: only the excerpt and the link.
    await expect(excerpt).toHaveText(`${LONG_EXCERPT} 이어 읽기`);
    await expect(page.getByTestId("link-detail").getByText(STATUS_WORDS)).toHaveCount(0);

    // "이어 읽기" and its icon follow "…" as one unbroken piece.
    const link = page.getByRole("link", { name: "이어 읽기", exact: true });
    await expect(link).toBeVisible();
    await expect(link).toHaveCSS("text-decoration-line", "underline");
    const fragments = await link.evaluate((node) => node.getClientRects().length);
    expect(fragments).toBe(1);
    const icon = await boxOf(link.locator("svg"));
    const linkBox = await boxOf(link);
    expect(icon.y).toBeGreaterThanOrEqual(linkBox.y);
    expect(icon.y + icon.height).toBeLessThanOrEqual(linkBox.y + linkBox.height);
  });

  test("a body under 100 characters shows its first 30% and …", async ({ page }) => {
    await mockApi(page, buildFixtures());
    await openDetail(page, 2);
    const text = (await page.getByTestId("link-detail-excerpt-text").textContent()) ?? "";
    expect(text.replace(/\s+/g, " ").trim()).toBe(`${SHORT_EXCERPT} 이어 읽기`);
    expect(text.slice(0, text.indexOf("…"))).toHaveLength(Math.floor(SHORT_BODY.length * 0.3));
  });

  test("이어 읽기 opens the original like the image does, and the detail stays", async ({
    page,
  }) => {
    await stubWindowOpen(page);
    await mockApi(page, buildFixtures());
    await openDetail(page, 1);

    await page.getByTestId("link-detail-excerpt-text").click({ position: { x: 4, y: 4 } });
    expect(await openedUrls(page)).toEqual([]);

    await page.getByRole("link", { name: "이어 읽기", exact: true }).click();
    await expect.poll(() => openedUrls(page)).toEqual(["https://brunch.co.kr/@jeju/east-3days"]);
    await page.getByTestId("link-detail-image").click();
    await expect
      .poll(() => openedUrls(page))
      .toEqual(["https://brunch.co.kr/@jeju/east-3days", "https://brunch.co.kr/@jeju/east-3days"]);
    await expect(page.getByTestId("link-detail-title")).toHaveText(
      "제주 2박 3일 동쪽 일주 코스와 비용 정리",
    );
  });

  test("on wide, pressing the excerpt line just above 이어 읽기 opens nothing", async ({
    page,
  }) => {
    test.skip(!isWideProject(), "the 44px area is mobile only; a pointer needs none");
    await stubWindowOpen(page);
    await mockApi(page, buildFixtures());
    await openDetail(page, 1);
    const link = await boxOf(page.getByTestId("link-detail-continue"));
    // One 20px line up, at the link's horizontal centre: excerpt text, not the link.
    await page.mouse.click(link.x + link.width / 2, link.y + link.height / 2 - 20);
    await page.waitForTimeout(300);
    expect(await openedUrls(page)).toEqual([]);
    await page.getByTestId("link-detail-continue").click();
    await expect.poll(() => openedUrls(page)).toHaveLength(1);
  });

  test("이어 읽기 has a 44px press area on mobile", async ({ page }) => {
    test.skip(isWideProject(), "touch target on web mobile");
    await stubWindowOpen(page);
    await mockApi(page, buildFixtures());
    await openDetail(page, 1);
    const box = await boxOf(page.getByTestId("link-detail-continue"));
    expect(box.height).toBeGreaterThanOrEqual(44);
    // Pressing the top edge of the padded area still opens the original.
    await page.getByTestId("link-detail-continue").click({ position: { x: box.width / 2, y: 2 } });
    await expect.poll(() => openedUrls(page)).toHaveLength(1);
  });

  test("the excerpt text can be selected", async ({ page }) => {
    await mockApi(page, buildFixtures());
    await openDetail(page, 1);
    const text = page.getByTestId("link-detail-excerpt-text");
    await expect(text).toHaveCSS("user-select", "text");
    await text.selectText();
    const selected = await page.evaluate(() => window.getSelection()?.toString() ?? "");
    expect(selected).toContain(LONG_EXCERPT.slice(0, 20));
  });

  for (const [id, label] of [
    [5, "a link saved before the feature (no record)"],
    [4, "a failed or blocked page"],
    [3, "a page still being collected"],
  ] as const) {
    test(`${label} has no excerpt block and no status words; the summary runs into the tags`, async ({
      page,
    }) => {
      await mockApi(page, buildFixtures());
      await openDetail(page, id);
      await expect(page.getByTestId("link-detail-tags")).toBeVisible();
      await expect(page.getByTestId("link-detail-excerpt")).toHaveCount(0);
      await expect(page.getByRole("link", { name: "이어 읽기" })).toHaveCount(0);
      await expect(page.getByTestId("link-detail").getByText(STATUS_WORDS)).toHaveCount(0);
    });
  }

  test("a response without the content field (server not deployed) looks as before", async ({
    page,
  }) => {
    const { links, details } = buildFixtures();
    const { content: _content, ...legacy } = details[1];
    await mockApi(page, { links, details: { ...details, 1: legacy as MockDetail } });
    await openDetail(page, 1);
    await expect(page.getByTestId("link-detail-tags")).toBeVisible();
    await expect(page.getByTestId("link-detail-excerpt")).toHaveCount(0);
  });
});

test.describe("silent re-check", () => {
  test("a pending body is fetched again and its excerpt appears without a reload; the card gets its line", async ({
    page,
  }) => {
    test.setTimeout(60_000);
    const fixtures = buildFixtures();
    const state = await mockApi(page, fixtures);
    if (isWideProject()) {
      await openDetail(page, 3);
    } else {
      await page.goto("/home");
      await card(page, "방금 저장한 글").getByTestId("link-card-title").click();
      await expect(page.getByTestId("link-detail-title")).toHaveText("방금 저장한 글");
    }
    await expect(page.getByTestId("link-detail-tags")).toBeVisible();
    await expect(page.getByTestId("link-detail-excerpt")).toHaveCount(0);

    // Collection finishes on the server.
    state.details[3] = {
      ...state.details[3],
      content: { excerpt: LONG_EXCERPT, isPending: false },
    } as MockDetail;
    state.links = state.links.map((link) =>
      link.id === 3 ? { ...link, contentExcerpt: LONG_EXCERPT } : link,
    );

    await expect(page.getByTestId("link-detail-excerpt-text")).toHaveText(
      `${LONG_EXCERPT} 이어 읽기`,
      { timeout: 8_000 },
    );
    await expect(page.getByTestId("link-detail").getByText(STATUS_WORDS)).toHaveCount(0);

    if (!isWideProject()) {
      await page.goBack();
    }
    await expect(card(page, "방금 저장한 글").getByTestId("link-card-excerpt")).toHaveText(
      LONG_EXCERPT,
    );
  });

  test("a body that stays pending is fetched again three times (3, 6 and 12 seconds), then never", async ({
    page,
  }) => {
    test.setTimeout(60_000);
    const state = await mockApi(page, buildFixtures());
    await openDetail(page, 3);
    const opened = Date.now();
    await expect.poll(() => detailGets(state, 3)).toBeGreaterThan(0);
    const initial = detailGets(state, 3);

    await page.waitForTimeout(Math.max(0, 2_000 - (Date.now() - opened)));
    expect(detailGets(state, 3)).toBe(initial);
    await expect.poll(() => detailGets(state, 3), { timeout: 4_000 }).toBe(initial + 1);
    await expect.poll(() => detailGets(state, 3), { timeout: 5_000 }).toBe(initial + 2);
    await expect.poll(() => detailGets(state, 3), { timeout: 8_000 }).toBe(initial + 3);
    await page.waitForTimeout(5_000);
    expect(detailGets(state, 3)).toBe(initial + 3);
    await expect(page.getByTestId("link-detail-excerpt")).toHaveCount(0);
  });

  test("a body that is not pending is never fetched again", async ({ page }) => {
    test.setTimeout(30_000);
    const state = await mockApi(page, buildFixtures());
    await openDetail(page, 4);
    await expect.poll(() => detailGets(state, 4)).toBeGreaterThan(0);
    const initial = detailGets(state, 4);
    await page.waitForTimeout(7_000);
    expect(detailGets(state, 4)).toBe(initial);
  });

  test("closing the detail before the first re-check stops it", async ({ page }) => {
    test.setTimeout(30_000);
    const state = await mockApi(page, buildFixtures());
    if (isWideProject()) {
      await openDetail(page, 3);
      await expect.poll(() => detailGets(state, 3)).toBeGreaterThan(0);
      await page.getByTestId("link-detail-close").click();
    } else {
      await page.goto("/home");
      await card(page, "방금 저장한 글").getByTestId("link-card-title").click();
      await expect(page.getByTestId("link-detail-title")).toHaveText("방금 저장한 글");
      await expect.poll(() => detailGets(state, 3)).toBeGreaterThan(0);
      await page.goBack();
    }
    await expect(page.getByTestId("link-detail")).toHaveCount(0);
    const afterClose = detailGets(state, 3);
    await page.waitForTimeout(5_000);
    expect(detailGets(state, 3)).toBe(afterClose);
  });
});

test.describe("excerpt stays through edits", () => {
  test("changing tags, memo and shortcut keeps the same excerpt, though PUT responses carry no content", async ({
    page,
  }) => {
    let state: MockState | null = null;
    // Like the server, the PUT response echoes the link without `content`.
    const putLink = async (route: Route) => {
      const payload = route.request().postDataJSON() as Partial<MockDetail>;
      const current = state!.details[1];
      const next = { ...current, ...payload } as MockDetail;
      state!.details[1] = next;
      state!.links = state!.links.map((link) =>
        link.id === 1 ? { ...link, title: next.title, tags: next.tags } : link,
      );
      const { content: _content, ...echo } = next as MockDetail & { content?: unknown };
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(envelope(echo)),
      });
    };
    state = await mockApi(page, { ...buildFixtures(), handlers: { "PUT /api/links/1": putLink } });
    await openDetail(page, 1);
    const excerptText = page.getByTestId("link-detail-excerpt-text");
    await expect(excerptText).toHaveText(`${LONG_EXCERPT} 이어 읽기`);

    const tagsSection = page.getByTestId("link-detail-tags");
    await tagsSection.getByRole("button", { name: "+ 태그 추가" }).click();
    await tagsSection.getByPlaceholder("태그").fill("새태그");
    await tagsSection.getByPlaceholder("태그").blur();
    await expect(tagsSection.getByText("#새태그")).toBeVisible();
    await expect(excerptText).toHaveText(`${LONG_EXCERPT} 이어 읽기`);

    const memo = page.getByTestId("link-detail-memo");
    await memo.getByRole("button", { name: "메모 추가" }).click();
    await memo.getByPlaceholder("메모를 입력해주세요").fill("렌터카 예약");
    await memo.getByRole("button", { name: "확인" }).click();
    await expect(memo.getByText("렌터카 예약", { exact: true })).toBeVisible();
    await expect(excerptText).toHaveText(`${LONG_EXCERPT} 이어 읽기`);

    await page.getByTestId("link-detail-favorite").click();
    await expect(page.getByTestId("link-detail-favorite")).toHaveAttribute(
      "aria-label",
      "바로가기 해제",
    );
    await expect(excerptText).toHaveText(`${LONG_EXCERPT} 이어 읽기`);
    await expect(page.getByTestId("link-detail-excerpt")).toHaveCount(1);
  });

  test("closing and opening the detail again shows the excerpt once, the same", async ({
    page,
  }) => {
    await mockApi(page, buildFixtures());
    if (isWideProject()) {
      await openDetail(page, 1);
      await page.getByTestId("link-detail-close").click();
      await expect(page.getByTestId("link-detail")).toHaveCount(0);
      await card(page, "제주 2박 3일").getByTestId("link-card-title").click();
    } else {
      await page.goto("/home");
      await card(page, "제주 2박 3일").getByTestId("link-card-title").click();
      await expect(page.getByTestId("link-detail-excerpt")).toHaveCount(1);
      await page.goBack();
      await card(page, "제주 2박 3일").getByTestId("link-card-title").click();
    }
    await expect(page.getByTestId("link-detail-excerpt")).toHaveCount(1);
    await expect(page.getByTestId("link-detail-excerpt-text")).toHaveText(
      `${LONG_EXCERPT} 이어 읽기`,
    );
  });

  test("while the AI summary is generating and after it is done, the summary section is as before and the excerpt stays below it", async ({
    page,
  }) => {
    const state = await mockApi(page, buildFixtures());
    await openDetail(page, 7);
    const summary = page.getByTestId("link-detail-summary");
    await expect(summary.getByText("요약이 아직 없어요")).toBeVisible();
    await expect(page.getByTestId("link-detail-excerpt")).toBeVisible();
    const excerptBox = await boxOf(page.getByTestId("link-detail-excerpt"));
    expect(excerptBox.y).toBeGreaterThan((await boxOf(summary)).y);

    state.details[7] = {
      ...state.details[7],
      status: "A",
      workModel: "gemini-2.5-flash",
      summary: "제주 동쪽 2박 3일 코스 요약",
    };
    await page.getByTestId("link-detail-refresh").click();
    await expect(summary.getByText("제주 동쪽 2박 3일 코스 요약")).toBeVisible();
    await expect(summary.getByText("요약 모델 - gemini-2.5-flash")).toBeVisible();
    await expect(page.getByTestId("link-detail-excerpt-text")).toHaveText(
      `${LONG_EXCERPT} 이어 읽기`,
    );
    const after = await boxOf(page.getByTestId("link-detail-excerpt"));
    expect(after.y).toBeGreaterThan((await boxOf(summary)).y);
  });
});

test.describe("card excerpt line", () => {
  test.beforeEach(async ({ page }) => {
    await mockApi(page, buildFixtures());
    await page.goto(isWideProject() ? "/links" : "/home");
    await expect(page.getByTestId("link-card")).toHaveCount(8);
  });

  test("a card with an excerpt shows one muted line under the domain, a card without shows none", async ({
    page,
  }) => {
    const withExcerpt = card(page, "제주 2박 3일");
    const line = withExcerpt.getByTestId("link-card-excerpt");
    await expect(line).toHaveText(LONG_EXCERPT);
    const domain = await boxOf(withExcerpt.getByText("brunch.co.kr", { exact: true }).last());
    const lineBox = await boxOf(line);
    const tags = await boxOf(withExcerpt.getByTestId("link-card-tags"));
    expect(lineBox.y).toBeGreaterThan(domain.y);
    expect(tags.y).toBeGreaterThan(lineBox.y);
    // One line, cut with an ellipsis, never two.
    expect(lineBox.height).toBeLessThan(30);
    await expect(line).toHaveCSS("text-overflow", "ellipsis");

    for (const title of ["방금 저장한 글", "로그인이 필요한", "기능 이전에 저장한"]) {
      await expect(card(page, title).getByTestId("link-card-excerpt")).toHaveCount(0);
    }
    // Same as the detail's excerpt, never longer.
    await expect(card(page, "협재 해수욕장").getByTestId("link-card-excerpt")).toHaveText(
      SHORT_EXCERPT,
    );
  });

  test("the line has no label or icon, and the rest of the card is unchanged", async ({ page }) => {
    const withExcerpt = card(page, "제주 2박 3일");
    await expect(withExcerpt.getByText(STATUS_WORDS)).toHaveCount(0);
    await expect(withExcerpt.getByTestId("link-card-excerpt").locator("svg")).toHaveCount(0);
    await expect(withExcerpt.getByText("#제주", { exact: true })).toBeVisible();
    await expect(withExcerpt.getByText("#여행코스", { exact: true })).toBeVisible();
    await expect(withExcerpt.getByTestId("link-thumbnail")).toBeVisible();
    await expect(card(page, "AI 요약을").getByTestId("link-card-status")).toHaveText(
      "AI 생성 중...",
    );
  });
});

test.describe("mobile search cards", () => {
  test.skip(() => isWideProject(), "the mobile home search field");

  test("a body-only match shows the context in place of the excerpt, a title match keeps the excerpt with the title highlighted", async ({
    page,
  }) => {
    let state: MockState | null = null;
    state = await mockApi(page, buildFixtures());
    await routeSearch(page, () => state!);
    await page.goto("/home");
    await expect(page.getByTestId("link-card")).toHaveCount(8);

    await page.getByPlaceholder("링크 · 요약 · 태그 검색…").fill(SEARCH_WORD);
    // Title match (8), then body-only matches (1, 6, 7).
    await expect(page.getByTestId("link-card")).toHaveCount(4);
    const titles = await page.getByTestId("link-card-title").allTextContents();
    expect(titles[0]).toBe("성산일출봉 일출 시간표와 입장 마감 안내");

    // Title match: the excerpt line stays, the title is highlighted, no context.
    const titleMatch = card(page, "성산일출봉 일출 시간표");
    await expect(titleMatch.getByTestId("link-card-excerpt")).toBeVisible();
    await expect(titleMatch.getByTestId("link-card-snippet")).toHaveCount(0);
    await expect(
      titleMatch.getByTestId("link-card-title").getByText(SEARCH_WORD, { exact: true }),
    ).toHaveCSS("font-weight", "600");

    // Body-only match: the context replaces the excerpt, two lines at most, the match bold.
    const bodyMatch = card(page, "제주 동부 카페 지도");
    await expect(bodyMatch.getByTestId("link-card-excerpt")).toHaveCount(0);
    const context = bodyMatch.getByTestId("link-card-snippet");
    await expect(context).toContainText(SEARCH_WORD);
    const match = context.getByText(SEARCH_WORD, { exact: true });
    await expect(match).toBeVisible();
    await expect(match).toHaveCSS("font-weight", "600");
    const contextBox = await boxOf(context);
    expect(contextBox.height).toBeLessThan(17 * 2 + 4);
    // The match is inside the visible lines, not cut off behind the ellipsis.
    const matchBox = await boxOf(match);
    expect(matchBox.y + matchBox.height).toBeLessThanOrEqual(contextBox.y + contextBox.height + 1);
    await expect(page.getByTestId("link-card-grid").getByText(STATUS_WORDS)).toHaveCount(0);

    // Clearing the query brings the excerpt line back.
    await page.getByPlaceholder("링크 · 요약 · 태그 검색…").fill("");
    await expect(page.getByTestId("link-card")).toHaveCount(8);
    await expect(card(page, "제주 동부 카페 지도").getByTestId("link-card-snippet")).toHaveCount(0);
    await expect(card(page, "제주 동부 카페 지도").getByTestId("link-card-excerpt")).toBeVisible();
    await expect(
      page.getByTestId("link-card-title").getByText(SEARCH_WORD, { exact: true }),
    ).toHaveCount(0);
  });
});

test.describe("wide hover delete and search", () => {
  test.skip(() => !isWideProject(), "hover actions and the search dialog are wide only");

  test("after deleting a card from its hover actions, the same search no longer shows it", async ({
    page,
  }) => {
    let state: MockState | null = null;
    state = await mockApi(page, buildFixtures());
    await routeSearch(page, () => state!);
    await page.goto("/links");
    await expect(page.getByTestId("link-card")).toHaveCount(8);

    const searchOnce = async () => {
      await page.getByText("⌘/Ctrl + K").first().click();
      const input = page.getByPlaceholder("링크 · 요약 · 태그 · 폴더 검색…");
      await input.fill(SEARCH_WORD);
      const dialog = page.getByRole("dialog");
      await expect(dialog.getByText("성산일출봉 일출 시간표와 입장 마감 안내")).toBeVisible();
      return dialog;
    };

    const first = await searchOnce();
    await expect(first.getByText("제주 동부 카페 지도 (2026 업데이트)")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);

    const target = card(page, "제주 동부 카페 지도");
    await target.hover();
    await target.getByRole("button", { name: "삭제" }).click();
    await page.getByRole("button", { name: "삭제", exact: true }).click();
    await expect(card(page, "제주 동부 카페 지도")).toHaveCount(0);

    const second = await searchOnce();
    await expect(second.getByText("제주 동부 카페 지도 (2026 업데이트)")).toHaveCount(0);
  });
});
