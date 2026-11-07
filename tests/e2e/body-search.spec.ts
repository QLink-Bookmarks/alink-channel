import { type Locator, type Page, expect, test } from "@playwright/test";

import { boxOf, isWideProject } from "./support/helpers";
import { type MockDetail, makeDetail, makeLink, mockApi } from "./support/mock-api";
import { CAFE_BODY, LONG_BODY, SUNRISE_BODY, withContent } from "./support/mock-content";
import { type ContentSearchOptions, mockContentSearch } from "./support/mock-content-search";

// #58 C2: searching the page body. Wide: the search dialog's context line under body-only
// results and the thin line between the metadata group and the body group. Wide and mobile:
// metadata matches first, the one-character rule, `%` `_` `\` as literal characters, no
// results, and a deleted link gone from the same search. Server responses are controlled
// (`mock-content-search.ts` searches the current mock state like the server).

const SEARCH_WORD = "성산일출봉";
const WIDE_PLACEHOLDER = "링크 · 요약 · 태그 · 폴더 검색…";
const MOBILE_PLACEHOLDER = "링크 · 요약 · 태그 검색…";
// No label or chip says where a result matched.
const SOURCE_LABELS = /본문|원문|일치/;

const TITLES = {
  memoAndBody: "제주 렌터카 반납 팁",
  longBody: "제주 2박 3일 동쪽 일주 코스와 비용 정리",
  shortBody: "협재 해수욕장 주차·물때 정보",
  cafe: "제주 동부 카페 지도 (2026 업데이트)",
  sunrise: "성산일출봉 일출 시간표와 입장 마감 안내",
  underscoreTitle: "파이썬 snake_case 정리",
  underscoreBody: "변수 이름 규칙",
  axb: "axb 모음",
  percentTitle: "할인 50% 쿠폰",
  percentBody: "적립 혜택 안내",
  fifty: "50개 목록",
  backslashTitle: "윈도우 경로 C:\\Users 정리",
  backslashBody: "경로 구분자",
  seaPhotos: "바다 사진 모음",
} as const;

/** Bodies of the links outside `mock-content.ts`, by id. */
const BODIES: Record<number, string> = {
  9: "공항 근처 렌터카 반납은 출발 두 시간 전에. 아침에 성산일출봉에 들렀다 오면 시간이 빠듯하다.",
  11: "변수 이름은 a_b 형태로 짓고 상수는 대문자로 쓴다.",
  12: "axb 형식의 코드 목록.",
  14: "이번 달은 최대 50% 적립된다.",
  15: "50개를 골랐다.",
  17: "윈도우는 a\\b 처럼 역슬래시로 경로를 나눈다.",
  18: "제주 바다 사진을 모았다.",
};

function buildFixtures() {
  const at = (minute: number) => `2026-10-29T10:${String(minute).padStart(2, "0")}:00.000Z`;
  const links = [
    makeLink({
      id: 9,
      url: "https://blog.example.com/rentcar",
      title: TITLES.memoAndBody,
      createdAt: at(9),
    }),
    makeLink({
      id: 1,
      url: "https://brunch.co.kr/@jeju/east-3days",
      title: TITLES.longBody,
      tags: ["제주", "여행코스"],
      createdAt: at(8),
    }),
    makeLink({
      id: 2,
      url: "https://www.jeju.go.kr/hyeopjae",
      title: TITLES.shortBody,
      createdAt: at(7),
    }),
    makeLink({
      id: 6,
      url: "https://blog.naver.com/cafe/east",
      title: TITLES.cafe,
      tags: ["카페"],
      createdAt: at(3),
    }),
    makeLink({
      id: 8,
      url: "https://visitjeju.net/sunrise",
      title: TITLES.sunrise,
      createdAt: at(1),
    }),
    makeLink({
      id: 10,
      url: "https://docs.example.com/python",
      title: TITLES.underscoreTitle,
      createdAt: at(20),
    }),
    makeLink({
      id: 11,
      url: "https://docs.example.com/naming",
      title: TITLES.underscoreBody,
      createdAt: at(21),
    }),
    makeLink({
      id: 12,
      url: "https://docs.example.com/codes",
      title: TITLES.axb,
      createdAt: at(22),
    }),
    makeLink({
      id: 13,
      url: "https://shop.example.com/coupon",
      title: TITLES.percentTitle,
      createdAt: at(23),
    }),
    makeLink({
      id: 14,
      url: "https://shop.example.com/points",
      title: TITLES.percentBody,
      createdAt: at(24),
    }),
    makeLink({
      id: 15,
      url: "https://shop.example.com/list",
      title: TITLES.fifty,
      createdAt: at(25),
    }),
    makeLink({
      id: 16,
      url: "https://docs.example.com/windows",
      title: TITLES.backslashTitle,
      createdAt: at(26),
    }),
    makeLink({
      id: 17,
      url: "https://docs.example.com/separator",
      title: TITLES.backslashBody,
      createdAt: at(27),
    }),
    makeLink({
      id: 18,
      url: "https://photo.example.com/sea",
      title: TITLES.seaPhotos,
      createdAt: at(28),
    }),
  ];
  const details: Record<number, MockDetail> = Object.fromEntries(
    links.map((link) => [
      link.id,
      makeDetail(link, link.id === 9 ? { memo: `${SEARCH_WORD} 들렀다 반납` } : {}),
    ]),
  );
  return withContent(links, details);
}

type MockState = Awaited<ReturnType<typeof mockApi>>;

async function setup(page: Page, options: ContentSearchOptions = {}) {
  let state: MockState | null = null;
  state = await mockApi(page, buildFixtures());
  const search = await mockContentSearch(page, () => state!, { bodies: BODIES, ...options });
  await page.goto(isWideProject() ? "/links" : "/home");
  await expect(page.getByTestId("link-card").first()).toBeVisible();
  return { state: state!, search };
}

function dialogOf(page: Page) {
  return page.getByRole("dialog");
}

async function openSearchDialog(page: Page) {
  await page.getByText("⌘/Ctrl + K").first().click();
  const input = page.getByPlaceholder(WIDE_PLACEHOLDER);
  await expect(input).toBeVisible();
  return input;
}

/** The searched link titles in the order shown: dialog rows (wide) or home cards (mobile). */
async function resultTitles(page: Page): Promise<string[]> {
  if (isWideProject()) {
    // A row's first line reads "domain — title".
    const lines = await dialogOf(page).getByTestId("search-link-title").allTextContents();
    return lines.map((line) => line.split(" — ").slice(1).join(" — ").trim());
  }
  return page.getByTestId("link-card-title").allInnerTexts();
}

/** Types `query` into the search field of the current layout. */
async function searchFor(page: Page, query: string) {
  if (isWideProject()) {
    const input = dialogOf(page).getByPlaceholder(WIDE_PLACEHOLDER);
    if (!(await input.isVisible())) {
      await openSearchDialog(page);
    }
    await dialogOf(page).getByPlaceholder(WIDE_PLACEHOLDER).fill(query);
    return;
  }
  await page.getByPlaceholder(MOBILE_PLACEHOLDER).fill(query);
}

async function expectResults(page: Page, titles: string[]) {
  await expect.poll(() => resultTitles(page), { timeout: 10_000 }).toEqual(titles);
}

function resultRow(page: Page, title: string): Locator {
  return dialogOf(page).getByTestId("search-link-result").filter({ hasText: title });
}

test.describe("body search: order, one character, literal characters, no results", () => {
  test("metadata matches come first, then body-only matches, each group in the chosen order", async ({
    page,
  }) => {
    await setup(page);
    await searchFor(page, SEARCH_WORD);
    // Memo (9) and title (8) matches, newest first; then the body-only matches (1, 6).
    await expectResults(page, [TITLES.memoAndBody, TITLES.sunrise, TITLES.longBody, TITLES.cafe]);

    if (!isWideProject()) {
      // 저장일 ↑ (oldest first): each group flips, the metadata group stays first.
      await page.getByTestId("link-filter-row-button").click();
      await page.getByRole("radio", { name: "저장일, 내림차순" }).click();
      await expectResults(page, [TITLES.sunrise, TITLES.memoAndBody, TITLES.cafe, TITLES.longBody]);
    }
  });

  test("a one-character query leaves out body-only matches, two characters bring them back", async ({
    page,
  }) => {
    const { search } = await setup(page);
    await searchFor(page, "제");
    // 18 has "제" in its body only: not a result, and nothing explains it.
    await expectResults(page, [TITLES.memoAndBody, TITLES.longBody, TITLES.cafe]);
    await expect(page.getByText(/한 글자|두 글자|2자/)).toHaveCount(0);

    await searchFor(page, "제주");
    await expectResults(page, [TITLES.memoAndBody, TITLES.longBody, TITLES.cafe, TITLES.seaPhotos]);
    expect(search.queries).toContain("제");
  });

  test("`_`, `%` and `\\` are searched as the characters themselves", async ({ page }) => {
    const { search } = await setup(page);
    const cases: [string, string[]][] = [
      // One character: metadata only.
      ["_", [TITLES.underscoreTitle]],
      // a_b in a body; "axb" does not match.
      ["a_b", [TITLES.underscoreBody]],
      ["%", [TITLES.percentTitle]],
      // The title match first, then the body match; not "50개": % is not a wildcard.
      ["50%", [TITLES.percentTitle, TITLES.percentBody]],
      ["\\", [TITLES.backslashTitle]],
      ["a\\b", [TITLES.backslashBody]],
    ];
    for (const [query, titles] of cases) {
      await searchFor(page, query);
      await expectResults(page, titles);
      // The app sends the query as typed.
      expect(search.queries.at(-1)).toBe(query);
    }
  });

  test("typing the word one syllable at a time ends with the full word's results", async ({
    page,
  }) => {
    const { search } = await setup(page);
    const input = isWideProject()
      ? await openSearchDialog(page)
      : page.getByPlaceholder(MOBILE_PLACEHOLDER);
    await input.pressSequentially(SEARCH_WORD, { delay: 40 });
    await expectResults(page, [TITLES.memoAndBody, TITLES.sunrise, TITLES.longBody, TITLES.cafe]);
    expect(search.queries.at(-1)).toBe(SEARCH_WORD);
  });

  test("no results show the existing empty state", async ({ page }) => {
    await setup(page);
    await searchFor(page, "없는검색어");
    if (isWideProject()) {
      const dialog = dialogOf(page);
      await expect(dialog.getByText("📌 링크 (0)")).toBeVisible();
      await expect(dialog.getByText("최신 검색어가 없어요")).toBeVisible();
    } else {
      await expect(page.getByText("아직 링크가 없어요")).toBeVisible();
      await expect(page.getByTestId("link-card")).toHaveCount(0);
    }
  });
});

test.describe("search dialog context line and group line", () => {
  test.skip(() => !isWideProject(), "the search dialog is wide only");

  test("body-only results get a one-line context with the match bold, after a thin line; no labels", async ({
    page,
  }) => {
    await setup(page);
    await searchFor(page, SEARCH_WORD);
    await expectResults(page, [TITLES.memoAndBody, TITLES.sunrise, TITLES.longBody, TITLES.cafe]);
    const dialog = dialogOf(page);

    // Title match: no context, the title highlighted as before.
    const titleRow = resultRow(page, TITLES.sunrise);
    await expect(titleRow.getByTestId("search-link-snippet")).toHaveCount(0);
    await expect(titleRow.getByText(SEARCH_WORD, { exact: true })).toHaveCSS("font-weight", "600");

    // Memo + body: in the metadata group, with a context.
    const memoRow = resultRow(page, TITLES.memoAndBody);
    await expect(memoRow.getByTestId("search-link-snippet")).toContainText(SEARCH_WORD);

    // Body only: a muted one-line context, the match bold and visible inside the line.
    for (const title of [TITLES.longBody, TITLES.cafe]) {
      const row = resultRow(page, title);
      const context = row.getByTestId("search-link-snippet");
      await expect(context).toBeVisible();
      const match = context.getByText(SEARCH_WORD, { exact: true });
      await expect(match).toHaveCSS("font-weight", "600");
      const contextBox = await boxOf(context);
      expect(contextBox.height).toBeLessThanOrEqual(18);
      const matchBox = await boxOf(match);
      expect(matchBox.x + matchBox.width).toBeLessThanOrEqual(contextBox.x + contextBox.width + 1);
      expect(await context.evaluate((node) => getComputedStyle(node).textOverflow)).toBe(
        "ellipsis",
      );
    }
    // The context is muted; the match is not.
    const cafeContext = resultRow(page, TITLES.cafe).getByTestId("search-link-snippet");
    const contextColor = await cafeContext.evaluate((node) => getComputedStyle(node).color);
    const matchColor = await cafeContext
      .getByText(SEARCH_WORD, { exact: true })
      .evaluate((node) => getComputedStyle(node).color);
    expect(matchColor).not.toBe(contextColor);

    // One thin line, between the metadata group and the body group.
    const divider = dialog.getByTestId("search-link-group-divider");
    await expect(divider).toHaveCount(1);
    const dividerBox = await boxOf(divider);
    const lastMeta = await boxOf(resultRow(page, TITLES.sunrise));
    const firstBody = await boxOf(resultRow(page, TITLES.longBody));
    expect(dividerBox.y).toBeGreaterThanOrEqual(lastMeta.y + lastMeta.height - 1);
    expect(dividerBox.y + dividerBox.height).toBeLessThanOrEqual(firstBody.y + 1);

    await expect(dialog.getByText(SOURCE_LABELS)).toHaveCount(0);
  });

  test("a body-only result without a context shows its title only, still after the line", async ({
    page,
  }) => {
    await setup(page, { withoutSnippet: [6] });
    await searchFor(page, SEARCH_WORD);
    await expectResults(page, [TITLES.memoAndBody, TITLES.sunrise, TITLES.longBody, TITLES.cafe]);
    await expect(resultRow(page, TITLES.cafe).getByTestId("search-link-snippet")).toHaveCount(0);
    await expect(resultRow(page, TITLES.longBody).getByTestId("search-link-snippet")).toBeVisible();
    await expect(dialogOf(page).getByTestId("search-link-group-divider")).toHaveCount(1);
  });

  test("only body-only results: contexts and no line at the top", async ({ page }) => {
    await setup(page);
    await searchFor(page, "광치기해변");
    // CAFE_BODY and LONG_BODY both mention it; no title, tag or memo does.
    expect(CAFE_BODY).toContain("광치기해변");
    expect(LONG_BODY).toContain("광치기해변");
    expect(SUNRISE_BODY).not.toContain("광치기해변");
    await expectResults(page, [TITLES.longBody, TITLES.cafe]);
    await expect(dialogOf(page).getByTestId("search-link-snippet")).toHaveCount(2);
    await expect(dialogOf(page).getByTestId("search-link-group-divider")).toHaveCount(0);
  });

  test("↑↓ and Enter follow the shown order into the body group", async ({ page }) => {
    await setup(page);
    await searchFor(page, SEARCH_WORD);
    await expectResults(page, [TITLES.memoAndBody, TITLES.sunrise, TITLES.longBody, TITLES.cafe]);
    for (let i = 0; i < 4; i += 1) {
      await page.keyboard.press("ArrowDown");
    }
    await page.keyboard.press("ArrowUp");
    // Third row: the first body-only result.
    await page.keyboard.press("Enter");
    await expect(dialogOf(page)).toHaveCount(0);
    await expect(page.getByTestId("link-detail")).toContainText(TITLES.longBody);
  });

  test("an Enter that confirms a Hangul syllable does not open the highlighted row", async ({
    page,
  }) => {
    await setup(page);
    await searchFor(page, SEARCH_WORD);
    await expectResults(page, [TITLES.memoAndBody, TITLES.sunrise, TITLES.longBody, TITLES.cafe]);
    await page.keyboard.press("ArrowDown");

    // While composing (isComposing), and Safari's composition-ending keydown (keyCode 229).
    for (const composing of [{ isComposing: true }, { keyCode: 229 }]) {
      await page.evaluate((init) => {
        const event = new KeyboardEvent("keydown", {
          key: "Enter",
          bubbles: true,
          cancelable: true,
          isComposing: init.isComposing ?? false,
        });
        if (init.keyCode != null) {
          Object.defineProperty(event, "keyCode", { value: init.keyCode });
        }
        (document.activeElement ?? document.body).dispatchEvent(event);
      }, composing);
      await page.waitForTimeout(300);
      await expect(dialogOf(page)).toHaveCount(1);
      await expect(page.getByTestId("link-detail")).toHaveCount(0);
    }

    // A plain Enter still opens the highlighted (first) row.
    await page.keyboard.press("Enter");
    await expect(dialogOf(page)).toHaveCount(0);
    await expect(page.getByTestId("link-detail")).toContainText(TITLES.memoAndBody);
  });

  test("after deleting a link from its detail, the same search no longer shows it", async ({
    page,
  }) => {
    await setup(page);
    await searchFor(page, SEARCH_WORD);
    await expectResults(page, [TITLES.memoAndBody, TITLES.sunrise, TITLES.longBody, TITLES.cafe]);
    await resultRow(page, TITLES.cafe).click();
    await expect(page.getByTestId("link-detail")).toContainText(TITLES.cafe);

    await page.getByTestId("link-detail-delete").click();
    await page.getByRole("button", { name: "삭제", exact: true }).click();
    await expect(page.getByTestId("link-detail")).toHaveCount(0);

    await openSearchDialog(page);
    await searchFor(page, SEARCH_WORD);
    await expectResults(page, [TITLES.memoAndBody, TITLES.sunrise, TITLES.longBody]);
  });
});
