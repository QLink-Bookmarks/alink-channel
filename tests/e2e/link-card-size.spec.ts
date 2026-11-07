import { type Locator, type Page, expect, test } from "@playwright/test";

import { contrast, parseColor, textContrast } from "./support/color";
import { firstRowCount, isWideProject } from "./support/helpers";
import {
  BROKEN_IMAGE,
  type MockLink,
  envelope,
  makeDetail,
  makeLink,
  mockApi,
} from "./support/mock-api";

// #84 link card size: 작게·크게 in settings, saved on this device, sets the link card columns.

const STORAGE_KEY = "qlink-link-card-size";
const GAP = 12;
const MIN_WIDTH = {
  small: { wide: 196, mobile: 150 },
  large: { wide: 360, mobile: 280 },
} as const;

const FOLDER_LINKS = Array.from({ length: 10 }, (_, index) =>
  makeLink({
    id: index + 1,
    title: `폴더 링크 ${index + 1}`,
    folderId: 1,
    folderName: "공부",
    folderEmoji: "📚",
  }),
);
const UNCATEGORIZED_LINKS = Array.from({ length: 6 }, (_, index) =>
  makeLink({ id: index + 101, title: `미분류 링크 ${index + 1}` }),
);
const LINKS = [...FOLDER_LINKS, ...UNCATEGORIZED_LINKS];
const DETAILS = Object.fromEntries(LINKS.map((link) => [link.id, makeDetail(link)]));

const EDGE_LINKS: MockLink[] = [
  makeLink({
    id: 201,
    title:
      "아주 긴 제목: 작은 카드 두 열에서도 제목이 두 줄을 넘지 않고 말줄임으로 끝나는지 확인하기 위한 정말 정말 긴 제목입니다",
    url: "https://a-very-long-subdomain-name-for-testing.example-domain-that-is-long.com/path",
  }),
  makeLink({
    id: 202,
    title: "태그가 많은 카드",
    tags: ["리액트 네이티브", "타입스크립트", "디자인 시스템", "접근성", "성능", "테스트"],
  }),
  makeLink({
    id: 203,
    title: "액션이 있는 카드",
    todoCounts: { open: 12, dueSoon: 3, overdue: 2, completed: 1 },
  }),
  makeLink({ id: 204, title: "썸네일 없는 카드", thumbnailUrl: null, faviconUrl: null }),
  makeLink({ id: 205, title: "썸네일 깨진 카드", thumbnailUrl: BROKEN_IMAGE }),
  makeLink({
    id: 206,
    title: "AI 생성 실패 카드",
    url: "https://brunch.co.kr/@writer/128",
    status: "F",
    workModel: "gemini-2.5-flash",
  }),
];

function grid(page: Page) {
  return page.getByTestId("link-card-grid").last();
}

function cards(page: Page) {
  return grid(page).getByTestId("link-card");
}

function sizeOption(page: Page, label: "작게" | "크게") {
  return page
    .getByTestId("settings-link-card-size")
    .getByRole("radio", { name: label, exact: true });
}

/** Columns the confirmed rule gives for the grid's current width. */
async function expectedColumns(page: Page, size: "small" | "large", layout: "wide" | "mobile") {
  const width = (await grid(page).boundingBox())?.width ?? 0;
  return Math.max(1, Math.floor((width + GAP) / (MIN_WIDTH[size][layout] + GAP)));
}

async function expectColumns(page: Page, count: number) {
  await expect(cards(page).first()).toBeVisible();
  await expect.poll(() => firstRowCount(cards(page))).toBe(count);
}

async function pickSize(page: Page, label: "작게" | "크게") {
  await sizeOption(page, label).click();
  await expect(sizeOption(page, label)).toHaveAttribute("aria-checked", "true");
}

/** Wide: the sidebar button. Phones: the bottom tab, which has no button role. */
function navItem(page: Page, label: "설정" | "홈") {
  return isWideProject()
    ? page.getByRole("button", { name: label, exact: true }).first()
    : page.getByText(label, { exact: true }).last();
}

async function openSettings(page: Page) {
  await navItem(page, "설정").click();
  await expect(page.getByTestId("settings-link-card-size")).toBeVisible();
}

async function openHome(page: Page) {
  await navItem(page, "홈").click();
  await expect(cards(page).first()).toBeVisible();
}

async function storedSize(page: Page) {
  return page.evaluate((key) => window.localStorage.getItem(key), STORAGE_KEY);
}

async function setup(page: Page, links: MockLink[] = LINKS) {
  return mockApi(page, {
    links,
    details: Object.fromEntries(links.map((link) => [link.id, makeDetail(link)])),
  });
}

test.describe("settings row", () => {
  test("phones: 화면 표시 shows 링크 카드 크기 under mode and accent, with 크게 selected at first", async ({
    page,
  }) => {
    test.skip(isWideProject(), "mobile settings");
    await setup(page);
    await page.goto("/settings");

    const row = page.getByTestId("settings-link-card-size");
    await expect(row.getByText("링크 카드 크기", { exact: true })).toBeVisible();
    await expect(sizeOption(page, "크게")).toHaveAttribute("aria-checked", "true");
    await expect(sizeOption(page, "작게")).toHaveAttribute("aria-checked", "false");

    const sectionTitle = await page.getByText("화면 표시", { exact: true }).boundingBox();
    const darkSwitch = await page.getByRole("switch", { name: "다크 모드" }).boundingBox();
    const accent = await page.getByRole("radio", { name: "강조색 회색" }).boundingBox();
    const rowBox = await row.boundingBox();
    expect(sectionTitle!.y).toBeLessThan(darkSwitch!.y);
    expect(darkSwitch!.y).toBeLessThan(rowBox!.y);
    expect(accent!.y).toBeLessThan(rowBox!.y);
    expect(await storedSize(page)).toBeNull();
  });

  test("wide: a new 화면 표시 section under 프로필 holds only 링크 카드 크기, with 작게 selected at first", async ({
    page,
  }) => {
    test.skip(!isWideProject(), "wide settings");
    await setup(page);
    await page.goto("/settings");

    const row = page.getByTestId("settings-link-card-size");
    await expect(row).toBeVisible();
    await expect(sizeOption(page, "작게")).toHaveAttribute("aria-checked", "true");
    await expect(sizeOption(page, "크게")).toHaveAttribute("aria-checked", "false");

    const main = page.locator("main").or(page.locator("body")).first();
    const profile = await main.getByText("프로필", { exact: true }).last().boundingBox();
    const display = await main.getByText("화면 표시", { exact: true }).boundingBox();
    const ai = await main.getByText("AI 제공자", { exact: true }).first().boundingBox();
    const rowBox = await row.boundingBox();
    expect(profile!.y).toBeLessThan(display!.y);
    expect(display!.y).toBeLessThan(rowBox!.y);
    expect(rowBox!.y).toBeLessThan(ai!.y);
    // Mode and accent stay in the sidebar palette, not in this section.
    await expect(page.getByRole("switch", { name: "다크 모드" })).toHaveCount(0);
    const displayCard = row.locator("xpath=..");
    await expect(displayCard.locator("> *")).toHaveCount(1);
  });

  test("pressing a size selects only that one and saves it on this device", async ({ page }) => {
    await setup(page);
    await page.goto("/settings");
    await pickSize(page, "작게");
    await expect(sizeOption(page, "크게")).toHaveAttribute("aria-checked", "false");
    expect(await storedSize(page)).toBe("small");
    await pickSize(page, "크게");
    await expect(sizeOption(page, "작게")).toHaveAttribute("aria-checked", "false");
    expect(await storedSize(page)).toBe("large");
  });
});

test.describe("columns", () => {
  test("before any choice: a 390 phone home shows one column, a 1280 wide home's 최근 저장 four", async ({
    page,
  }) => {
    await setup(page);
    await page.goto("/home");
    await expectColumns(page, isWideProject() ? 4 : 1);
  });

  test("phones: 작게 gives two columns at 375 and 390, 크게 brings back one", async ({ page }) => {
    test.skip(isWideProject(), "mobile layout");
    await setup(page);
    await page.goto("/home");
    await openSettings(page);
    await pickSize(page, "작게");
    await openHome(page);
    await expectColumns(page, 2);
    await page.setViewportSize({ width: 375, height: 812 });
    await expectColumns(page, 2);

    await openSettings(page);
    await pickSize(page, "크게");
    await openHome(page);
    await expectColumns(page, 1);
  });

  test("1280 wide home: 크게 gives two columns in 최근 저장, 작게 four", async ({ page }) => {
    test.skip(!isWideProject(), "wide layout");
    await setup(page);
    await page.goto("/home");
    await openSettings(page);
    await pickSize(page, "크게");
    await openHome(page);
    await expectColumns(page, 2);

    await openSettings(page);
    await pickSize(page, "작게");
    await openHome(page);
    await expectColumns(page, 4);
  });

  test("the chosen size also applies to folder detail, 미분류 and 전체 보기", async ({ page }) => {
    await setup(page);
    const layout = isWideProject() ? "wide" : "mobile";
    const paths = isWideProject()
      ? ["/folders/1", "/folders/0", "/links"]
      : ["/folders/1", "/folders/0"];

    for (const size of ["small", "large"] as const) {
      await page.goto("/settings");
      await pickSize(page, size === "small" ? "작게" : "크게");
      for (const path of paths) {
        await page.goto(path);
        await expect(cards(page).first()).toBeVisible();
        const expected = await expectedColumns(page, size, layout);
        await expectColumns(page, expected);
        if (size === "small" && !isWideProject()) {
          expect(expected, `${path} small on a phone`).toBe(2);
        }
        if (size === "large" && !isWideProject()) {
          expect(expected, `${path} large on a phone`).toBe(1);
        }
      }
    }
  });

  test("phones: search results on home use the chosen size", async ({ page }) => {
    test.skip(isWideProject(), "the mobile home search shows cards");
    await setup(page);
    await page.goto("/settings");
    await pickSize(page, "작게");
    await page.goto("/home");
    await page.getByPlaceholder("링크 · 요약 · 태그 검색…").fill("링크");
    await expect(cards(page).first()).toBeVisible();
    await expect(page.getByTestId("link-card-title").first()).toContainText("링크");
    await expectColumns(page, 2);

    await page.goto("/settings");
    await pickSize(page, "크게");
    await page.goto("/home");
    await page.getByPlaceholder("링크 · 요약 · 태그 검색…").fill("링크");
    await expectColumns(page, 1);
  });

  /** Folder detail columns per size with the sidebar open, collapsed, then open again. */
  async function expectFolderColumnsAcrossSidebar(
    page: Page,
    cases: readonly (readonly ["작게" | "크게", "small" | "large", number, number])[],
  ) {
    for (const [label, size, columns, collapsedColumns] of cases) {
      await page.goto("/settings");
      await pickSize(page, label);
      await page.goto("/folders/1");
      await expectColumns(page, columns);
      const expandedWidth = (await grid(page).boundingBox())!.width;

      await page.getByRole("button", { name: "사이드바 줄이기" }).click();
      await expect
        .poll(async () => (await grid(page).boundingBox())!.width)
        .toBeGreaterThan(expandedWidth + 100);
      expect(await expectedColumns(page, size, "wide")).toBe(collapsedColumns);
      await expectColumns(page, collapsedColumns);

      await page.getByRole("button", { name: "사이드바 펼치기" }).click();
      await expectColumns(page, columns);
    }
  }

  test("1280 wide folder detail: 작게 four and 크게 two; collapsing the sidebar gives five and three, expanding brings them back", async ({
    page,
  }) => {
    test.skip(!isWideProject(), "wide layout");
    await page.setViewportSize({ width: 1280, height: 900 });
    await setup(page);
    await expectFolderColumnsAcrossSidebar(page, [
      ["작게", "small", 4, 5],
      ["크게", "large", 2, 3],
    ]);
  });

  test("1440 wide folder detail: 작게 five and 크게 three, as the column rule gives", async ({
    page,
  }) => {
    test.skip(!isWideProject(), "wide layout");
    await page.setViewportSize({ width: 1440, height: 1000 });
    await setup(page);
    // Collapsed, the list is 1312px wide: 작게 fits a sixth column, while 크게 (360px each)
    // still fits three, so its cards only widen.
    await expectFolderColumnsAcrossSidebar(page, [
      ["작게", "small", 5, 6],
      ["크게", "large", 3, 3],
    ]);
  });

  test("wide: opening a card's detail leaves the list's columns as they were", async ({ page }) => {
    test.skip(!isWideProject(), "the detail overlays the list on wide");
    await page.setViewportSize({ width: 1440, height: 1000 });
    await setup(page);
    await page.goto("/settings");
    await pickSize(page, "크게");
    await page.goto("/folders/1");
    await expectColumns(page, 3);
    const before = await cards(page).first().boundingBox();

    await cards(page).nth(4).getByTestId("link-card-title").click();
    await expect(page).toHaveURL(/linkId=5/);
    await expect(page.getByText("요약 문장").first()).toBeVisible();
    await expectColumns(page, 3);
    expect((await cards(page).first().boundingBox())!.width).toBeCloseTo(before!.width, 0);
  });

  test("768px: 작게 four and 크게 two; widening to 769 switches to the wide home with the wide rule", async ({
    page,
  }) => {
    test.skip(!isWideProject(), "resizes a desktop browser");
    await setup(page);

    for (const [label, size, columns] of [
      ["작게", "small", 4],
      ["크게", "large", 2],
    ] as const) {
      await page.setViewportSize({ width: 768, height: 1000 });
      await page.goto("/settings");
      await pickSize(page, label);
      await page.goto("/home");
      await expect(page.getByPlaceholder("링크 · 요약 · 태그 검색…")).toBeVisible();
      await expectColumns(page, columns);

      await page.setViewportSize({ width: 769, height: 1000 });
      await expect(page.getByText("⌘/Ctrl + K").first()).toBeVisible();
      await expect(cards(page).first()).toBeVisible();
      await expectColumns(page, await expectedColumns(page, size, "wide"));
    }
  });

  test("a 320 phone shows one column even with 작게, and nothing overflows the screen", async ({
    page,
  }) => {
    test.skip(isWideProject(), "mobile layout");
    await setup(page);
    await page.setViewportSize({ width: 320, height: 700 });
    await page.goto("/settings");
    await pickSize(page, "작게");
    await page.goto("/home");
    await expectColumns(page, 1);
    const box = await cards(page).first().boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(320);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  });

  test("loading placeholders use the chosen size's columns", async ({ page }) => {
    let releaseLinks: () => void = () => {};
    const linksHeld = new Promise<void>((resolve) => {
      releaseLinks = resolve;
    });
    await mockApi(page, {
      links: LINKS,
      details: DETAILS,
      handlers: {
        "GET /api/links": async (route) => {
          await linksHeld;
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify(
              envelope({ isEmpty: false, contents: LINKS, nextCursor: null, hasNext: false }),
            ),
          });
        },
      },
    });
    await page.goto("/settings");
    await pickSize(page, isWideProject() ? "크게" : "작게");
    await page.goto(isWideProject() ? "/links" : "/home");
    const skeletons = grid(page).getByTestId("link-card-skeleton");
    await expect(skeletons.first()).toBeVisible();
    const expected = await expectedColumns(
      page,
      isWideProject() ? "large" : "small",
      isWideProject() ? "wide" : "mobile",
    );
    await expect.poll(() => firstRowCount(skeletons)).toBe(expected);
    if (!isWideProject()) {
      expect(expected).toBe(2);
    }
    releaseLinks();
    await expectColumns(page, expected);
  });

  test("a single link sits in one column's width at the left, for both sizes", async ({ page }) => {
    const single = [makeLink({ id: 1, title: "하나뿐인 링크" })];
    await setup(page, single);
    const layout = isWideProject() ? "wide" : "mobile";

    for (const [label, size] of [
      ["작게", "small"],
      ["크게", "large"],
    ] as const) {
      await page.goto("/settings");
      await pickSize(page, label);
      await page.goto(isWideProject() ? "/links" : "/home");
      await expect(cards(page)).toHaveCount(1);
      const gridBox = (await grid(page).boundingBox())!;
      const cardBox = (await cards(page).first().boundingBox())!;
      const columns = await expectedColumns(page, size, layout);
      const columnWidth = (gridBox.width - GAP * (columns - 1)) / columns;
      expect(cardBox.x).toBeCloseTo(gridBox.x, 0);
      expect(Math.abs(cardBox.width - columnWidth)).toBeLessThanOrEqual(1);
    }
  });
});

test.describe("card content on wide", () => {
  test("small wide cards show the whole failed AI label and cut only the domain", async ({
    page,
  }) => {
    test.skip(!isWideProject(), "wide layout");
    await setup(page, EDGE_LINKS);
    await page.goto("/home");
    await expect(cards(page)).toHaveCount(EDGE_LINKS.length);
    await expectColumns(page, 4);

    const status = cards(page)
      .filter({ hasText: "AI 생성 실패 카드" })
      .getByTestId("link-card-status");
    await expect(status).toHaveText("gemini-2.5-flash 생성 실패");
    expect(await status.evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true);
  });
});

test.describe("card content in two small columns", () => {
  test("long titles, many tags, actions, missing or broken images and a failed AI label stay inside the card and end in an ellipsis", async ({
    page,
  }) => {
    test.skip(isWideProject(), "two columns on a phone");
    await setup(page, EDGE_LINKS);
    await page.goto("/settings");
    await pickSize(page, "작게");
    await page.goto("/home");
    await expect(cards(page)).toHaveCount(EDGE_LINKS.length);
    await expectColumns(page, 2);

    const escapes = await cards(page).evaluateAll((nodes) =>
      nodes.flatMap((card) => {
        const box = card.getBoundingClientRect();
        return Array.from(card.querySelectorAll("*"))
          .filter((child) => {
            const rect = child.getBoundingClientRect();
            if (rect.width === 0 || rect.height === 0) return false;
            // Tags that do not fit wrap below the row's clipped area by design.
            if (child.closest('[data-testid="link-card-tags"]') && rect.top >= box.bottom) {
              return false;
            }
            return rect.left < box.left - 1 || rect.right > box.right + 1;
          })
          .map((child) => `${card.textContent?.slice(0, 12)}: ${child.textContent?.slice(0, 20)}`);
      }),
    );
    expect(escapes).toEqual([]);

    const failed = cards(page).filter({ hasText: "AI 생성 실패 카드" });
    const status = failed.getByTestId("link-card-status");
    await expect(status).toHaveText("gemini-2.5-flash 생성 실패");
    const statusFit = await status.evaluate((node) => ({
      ellipsis: getComputedStyle(node).textOverflow,
      truncated: node.scrollWidth > node.clientWidth,
    }));
    expect(statusFit).toEqual({ ellipsis: "ellipsis", truncated: true });
    const domain = failed.getByText("brunch.co.kr", { exact: true });
    const domainBox = await domain.boundingBox();
    expect(domainBox!.width).toBeGreaterThan(0);
    expect(await domain.evaluate((node) => getComputedStyle(node).textOverflow)).toBe("ellipsis");

    const longCard = cards(page).filter({ hasText: "아주 긴 제목" });
    const longDomain = longCard.getByText(/a-very-long-subdomain/);
    expect(
      await longDomain.evaluate((node) => ({
        ellipsis: getComputedStyle(node).textOverflow,
        truncated: node.scrollWidth > node.clientWidth,
      })),
    ).toEqual({ ellipsis: "ellipsis", truncated: true });
    const title = longCard.getByTestId("link-card-title");
    expect(await title.evaluate((node) => node.scrollHeight > node.clientHeight + 1)).toBe(true);

    const actions = cards(page).filter({ hasText: "액션이 있는 카드" });
    await expect(actions.getByRole("button", { name: /^액션 \d+개/ })).toBeInViewport();
  });
});

test.describe("card heights in a row", () => {
  const WITH_EXCERPT = {
    ...makeLink({ id: 301, title: "요약이 있는 카드" }),
    contentExcerpt: "본문 앞부분을 한 줄로 보여 주는 발췌 문장입니다.",
  } as MockLink;
  const WITHOUT_EXCERPT = makeLink({ id: 302, title: "요약이 없는 카드" });

  test("a card with an excerpt and one without in the same row share top and bottom, with the tags at the bottom of both", async ({
    page,
  }) => {
    await setup(page, [WITH_EXCERPT, WITHOUT_EXCERPT]);
    await page.goto("/settings");
    await pickSize(page, "작게");
    await page.goto("/home");
    await expect(cards(page)).toHaveCount(2);
    await expectColumns(page, 2);

    const withExcerpt = cards(page).filter({ hasText: "요약이 있는 카드" });
    const withoutExcerpt = cards(page).filter({ hasText: "요약이 없는 카드" });
    await expect(withExcerpt.getByTestId("link-card-excerpt")).toBeVisible();
    await expect(withoutExcerpt.getByTestId("link-card-excerpt")).toHaveCount(0);

    const tall = (await withExcerpt.boundingBox())!;
    const short = (await withoutExcerpt.boundingBox())!;
    expect(Math.abs(tall.y - short.y)).toBeLessThanOrEqual(1);
    expect(Math.abs(tall.y + tall.height - (short.y + short.height))).toBeLessThanOrEqual(1);

    const tallTags = (await withExcerpt.getByTestId("link-card-tags").boundingBox())!;
    const shortTags = (await withoutExcerpt.getByTestId("link-card-tags").boundingBox())!;
    expect(
      Math.abs(tallTags.y + tallTags.height - (shortTags.y + shortTags.height)),
    ).toBeLessThanOrEqual(1);
    const shortTitle = (await withoutExcerpt.getByTestId("link-card-title").boundingBox())!;
    const tallTitle = (await withExcerpt.getByTestId("link-card-title").boundingBox())!;
    expect(Math.abs(tallTitle.y - shortTitle.y)).toBeLessThanOrEqual(1);
  });

  test("phones: in one column each card keeps its own height", async ({ page }) => {
    test.skip(isWideProject(), "one column on a phone");
    await setup(page, [WITH_EXCERPT, WITHOUT_EXCERPT]);
    await page.goto("/home");
    await expect(cards(page)).toHaveCount(2);
    await expectColumns(page, 1);

    const tall = (await cards(page).filter({ hasText: "요약이 있는 카드" }).boundingBox())!;
    const short = (await cards(page).filter({ hasText: "요약이 없는 카드" }).boundingBox())!;
    expect(tall.height - short.height).toBeGreaterThan(10);
  });
});

test.describe("short lists", () => {
  const SHORT_LINKS = [
    {
      ...makeLink({ id: 401, title: "짧은 목록 요약 카드" }),
      contentExcerpt: "본문 앞부분을 한 줄로 보여 주는 발췌 문장입니다.",
    } as MockLink,
    makeLink({ id: 402, title: "짧은 목록 카드" }),
  ];

  /** Each card's height with its `grow` turned off in place: the card's own content height. */
  async function naturalHeights(page: Page) {
    return grid(page).evaluate((node) => {
      const parts = [
        ...node.querySelectorAll<HTMLElement>(
          '[data-testid="link-card"], [data-testid="link-card-body"]',
        ),
      ];
      parts.forEach((part) => (part.style.flexGrow = "0"));
      const heights = [...node.querySelectorAll('[data-testid="link-card"]')].map(
        (card) => card.getBoundingClientRect().height,
      );
      parts.forEach((part) => (part.style.flexGrow = ""));
      return heights;
    });
  }

  for (const count of [1, 2]) {
    for (const size of ["크게", "작게"] as const) {
      test(`${count} link(s), ${size}: cards keep their own height and the grid ends at the last card`, async ({
        page,
      }) => {
        await setup(page, SHORT_LINKS.slice(0, count));
        await page.goto("/settings");
        await pickSize(page, size);
        await page.goto(isWideProject() ? "/links" : "/home");
        await expect(cards(page)).toHaveCount(count);
        const columns = !isWideProject() && size === "크게" ? 1 : count;
        await expectColumns(page, columns);

        const natural = await naturalHeights(page);
        const boxes = await cards(page).evaluateAll((nodes) =>
          nodes.map((node) => node.getBoundingClientRect().toJSON() as DOMRect),
        );
        const rowHeight = Math.max(...natural);
        boxes.forEach((box, index) => {
          const expected = columns === 1 ? natural[index] : rowHeight;
          expect(Math.abs(box.height - expected)).toBeLessThanOrEqual(1);
        });

        const gridBox = (await grid(page).boundingBox())!;
        const lastBottom = Math.max(...boxes.map((box) => box.bottom));
        expect(Math.abs(gridBox.y + gridBox.height - lastBottom)).toBeLessThanOrEqual(1);
      });
    }
  }
});

test.describe("keeping the choice", () => {
  test("작게 survives a web refresh and a new tab", async ({ page, context }) => {
    await setup(page);
    await page.goto("/settings");
    await pickSize(page, "작게");
    await page.reload();
    await expect(sizeOption(page, "작게")).toHaveAttribute("aria-checked", "true");
    await page.goto("/home");
    await expectColumns(page, isWideProject() ? 4 : 2);
    await page.close();

    const next = await context.newPage();
    await setup(next);
    await next.goto("/home");
    await expectColumns(next, isWideProject() ? 4 : 2);
    await next.goto("/settings");
    await expect(sizeOption(next, "작게")).toHaveAttribute("aria-checked", "true");
  });

  test("signing out and back in on this device keeps the chosen size", async ({ page }) => {
    await setup(page);
    await page.goto("/settings");
    await pickSize(page, isWideProject() ? "크게" : "작게");
    await page.getByRole("button", { name: "로그아웃", exact: true }).click();
    await page.getByRole("dialog").getByRole("button", { name: "로그아웃" }).click();
    await expect(page.getByText("로그아웃 되었어요")).toBeVisible();
    expect(await storedSize(page)).toBe(isWideProject() ? "large" : "small");

    // The mock signs the page back in on the next load.
    await page.goto("/home");
    await expectColumns(page, 2);
    await page.goto("/settings");
    await expect(sizeOption(page, isWideProject() ? "크게" : "작게")).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });

  test("changing the size after scrolling home leaves a scrollable list without overlaps", async ({
    page,
  }) => {
    test.skip(isWideProject(), "the mobile home scrolls its cards");
    await setup(page);
    await page.goto("/home");
    await expectColumns(page, 1);
    await cards(page).nth(8).scrollIntoViewIfNeeded();

    await openSettings(page);
    await pickSize(page, "작게");
    await openHome(page);
    await expectColumns(page, 2);
    const overlaps = await cards(page).evaluateAll((nodes) => {
      const rects = nodes.map((node) => node.getBoundingClientRect());
      return rects.some((a, i) =>
        rects.some(
          (b, j) =>
            i < j &&
            a.left < b.right - 1 &&
            b.left < a.right - 1 &&
            a.top < b.bottom - 1 &&
            b.top < a.bottom - 1,
        ),
      );
    });
    expect(overlaps).toBe(false);
    const last = cards(page).last();
    await last.scrollIntoViewIfNeeded();
    await expect(last).toBeInViewport();
  });

  test("pressing 작게 and 크게 back and forth quickly ends on the last one pressed", async ({
    page,
  }) => {
    await setup(page);
    await page.goto("/home");
    await openSettings(page);
    const order = ["작게", "크게", "작게", "크게", "작게", "크게", "작게"] as const;
    for (const label of order) {
      await sizeOption(page, label).click({ delay: 0 });
    }
    await expect(sizeOption(page, "작게")).toHaveAttribute("aria-checked", "true");
    await expect(sizeOption(page, "크게")).toHaveAttribute("aria-checked", "false");
    expect(await storedSize(page)).toBe("small");
    await openHome(page);
    await expectColumns(page, isWideProject() ? 4 : 2);
  });

  test("changing mode or accent keeps the size, also after reloading settings from the server", async ({
    page,
  }) => {
    test.skip(isWideProject(), "mode and accent sit next to the size on phones");
    const state = await setup(page);
    await page.goto("/settings");
    await pickSize(page, "작게");
    await page.getByRole("switch", { name: "다크 모드" }).click();
    await page.getByRole("radio", { name: "강조색 분홍" }).click();
    await expect(sizeOption(page, "작게")).toHaveAttribute("aria-checked", "true");
    const settingsSaves = () =>
      state.requests.filter(
        (request) => request.path === "/api/users/me/settings" && request.method === "PATCH",
      );
    await expect.poll(() => settingsSaves().length).toBeGreaterThan(0);
    const saves = settingsSaves();
    expect(JSON.stringify(saves.map((save) => save.body))).toMatch(/dark|pink/);
    for (const save of saves) {
      expect(JSON.stringify(save.body)).not.toMatch(/small|large|cardSize|CardSize/);
    }

    await page.reload();
    await expect(sizeOption(page, "작게")).toHaveAttribute("aria-checked", "true");
    expect(await storedSize(page)).toBe("small");
  });
});

test.describe("dark mode", () => {
  test("selected and unselected items are told apart and their labels are readable", async ({
    page,
  }) => {
    await mockApi(page, {
      links: LINKS,
      details: DETAILS,
      handlers: {
        "GET /api/users/me/settings": (route) =>
          route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify(
              envelope({
                display: { theme: "dark", accent: "gray" },
                behavior: { allowsReminderNotification: false },
                ai: { defaultProvider: null, defaultModel: null },
                providers: [],
              }),
            ),
          }),
      },
    });
    await page.goto("/settings");
    await expect(page.locator("html.dark, body.dark, .dark").first()).toBeAttached();
    const selected = sizeOption(page, isWideProject() ? "작게" : "크게");
    const unselected = sizeOption(page, isWideProject() ? "크게" : "작게");
    await expect(selected).toHaveAttribute("aria-checked", "true");

    const background = (target: Locator) =>
      target.evaluate((node) => getComputedStyle(node).backgroundColor);
    const track = selected.locator("xpath=..");
    const selectedBg = parseColor(await background(selected));
    const trackBg = parseColor(await background(track));
    expect(contrast(selectedBg, trackBg)).toBeGreaterThan(1.1);
    expect(await textContrast(selected.getByText(/작게|크게/))).toBeGreaterThanOrEqual(4.5);
    expect(await textContrast(unselected.getByText(/작게|크게/))).toBeGreaterThanOrEqual(3);
  });
});
