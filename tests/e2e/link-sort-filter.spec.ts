import { type Page, type Route, expect, test } from "@playwright/test";

import { isWideProject } from "./support/helpers";
import { type MockLink, makeDetail, makeLink, mockApi } from "./support/mock-api";

// #79: link lists sort by 저장일·제목 in both directions and filter by ★, behind the row's button.

// Saved one day apart: 1 is the oldest. Titles are in another order, so the two sorts differ.
const TITLES: Record<number, string> = {
  1: "다람쥐 도토리",
  2: "가나 초콜릿",
  3: "마늘빵 굽기",
  4: "나무 심기",
  5: "라면 끓이기",
};

function buildLinks(): MockLink[] {
  return Object.entries(TITLES).map(([id, title]) =>
    makeLink({
      id: Number(id),
      title,
      createdAt: new Date(Date.UTC(2026, 9, Number(id), 9, 0)).toISOString(),
      folderId: Number(id) <= 3 ? 1 : null,
      folderName: Number(id) <= 3 ? "공부" : null,
      folderEmoji: Number(id) <= 3 ? "📚" : null,
      isFavorite: Number(id) === 2 || Number(id) === 4,
    }),
  );
}

async function mockLinks(page: Page, links = buildLinks()) {
  return mockApi(page, {
    links,
    details: Object.fromEntries(links.map((link) => [link.id, makeDetail(link)])),
    folders: [
      {
        id: 1,
        ownerId: 1,
        name: "공부",
        emoji: "📚",
        isShared: false,
        shareCounts: 0,
        linkCounts: 3,
      },
      {
        id: 2,
        ownerId: 1,
        name: "가볼 곳",
        emoji: "☕",
        isShared: false,
        shareCounts: 0,
        linkCounts: 0,
      },
    ],
  });
}

function titles(page: Page) {
  return page.getByTestId("link-card-title");
}

async function expectTitles(page: Page, ids: number[]) {
  await expect(titles(page)).toHaveText(ids.map((id) => TITLES[id]));
}

function coverButton(page: Page) {
  return page.getByTestId("link-filter-row-button");
}

function sortChip(page: Page, name: string | RegExp) {
  return page.getByRole("radio", { name });
}

function favoriteToggle(page: Page) {
  return page.getByRole("switch", { name: "바로가기만 보기" });
}

async function openCover(page: Page) {
  await coverButton(page).click();
  await expect(coverButton(page)).toHaveAttribute("aria-expanded", "true");
}

async function closeCover(page: Page) {
  if ((await coverButton(page).getAttribute("aria-expanded")) === "true") {
    await coverButton(page).click();
  }
  await expect(coverButton(page)).toHaveAttribute("aria-expanded", "false");
}

function linkListRequests(state: Awaited<ReturnType<typeof mockLinks>>) {
  return state.requests
    .filter((request) => request.method === "GET" && request.path === "/api/links")
    .map((request) => new URLSearchParams(request.search));
}

// Newest saved first: 5 4 3 2 1. 가나다: 가나(2) 나무(4) 다람쥐(1) 라면(5) 마늘빵(3).
const NEWEST = [5, 4, 3, 2, 1];
const OLDEST = [1, 2, 3, 4, 5];
const TITLE_ASC = [2, 4, 1, 5, 3];
const TITLE_DESC = [3, 5, 1, 4, 2];

test.describe("mobile home", () => {
  test.skip(() => isWideProject(), "web mobile home");

  test("one row: folder chips and the icon button, with no second sort row", async ({ page }) => {
    const state = await mockLinks(page);
    await page.goto("/home");
    await expectTitles(page, NEWEST);

    for (const name of ["전체", "🗂️ 미분류", "📚 공부", "☕ 가볼 곳"]) {
      await expect(page.getByRole("radio", { name, exact: true })).toBeVisible();
    }
    await expect(page.getByRole("radio", { name: "전체", exact: true })).toBeChecked();
    await expect(coverButton(page)).toHaveAccessibleName("정렬·필터 열기");
    for (const old of ["최신순", "오래된순", "가나다순"]) {
      await expect(page.getByText(old, { exact: true })).toHaveCount(0);
    }
    const last = linkListRequests(state).at(-1);
    expect(last?.get("orderKey")).toBe("created_at");
    expect(last?.get("order")).toBe("desc");
  });

  test("a folder chip shows that folder only and leaves the button at its icon", async ({
    page,
  }) => {
    await mockLinks(page);
    await page.goto("/home");
    await page.getByRole("radio", { name: "📚 공부" }).click();
    await expectTitles(page, [3, 2, 1]);
    await expect(coverButton(page)).toHaveAccessibleName("정렬·필터 열기");
  });

  test("criterion chips sort by title and save date both ways, one on at a time", async ({
    page,
  }) => {
    await mockLinks(page);
    await page.goto("/home");
    await openCover(page);
    await expect(sortChip(page, "저장일, 내림차순")).toBeChecked();
    await expect(favoriteToggle(page)).toBeVisible();

    await sortChip(page, "제목").click();
    await expectTitles(page, TITLE_ASC);
    await expect(sortChip(page, "제목, 오름차순")).toBeChecked();
    await expect(sortChip(page, "저장일")).not.toBeChecked();

    await sortChip(page, "제목, 오름차순").click();
    await expectTitles(page, TITLE_DESC);
    await expect(sortChip(page, "제목, 내림차순")).toBeChecked();

    await sortChip(page, "저장일").click();
    await expectTitles(page, NEWEST);
    await sortChip(page, "저장일, 내림차순").click();
    await expectTitles(page, OLDEST);
    await expect(sortChip(page, "저장일, 오름차순")).toBeChecked();
    await expect(
      page.getByRole("radiogroup", { name: "정렬 기준" }).getByRole("radio", { checked: true }),
    ).toHaveCount(1);
  });

  test("★ shows shortcuts only and pressing it again shows everything", async ({ page }) => {
    await mockLinks(page);
    await page.goto("/home");
    await openCover(page);
    await favoriteToggle(page).click();
    await expect(favoriteToggle(page)).toBeChecked();
    await expectTitles(page, [4, 2]);
    await favoriteToggle(page).click();
    await expectTitles(page, NEWEST);
  });

  test("the collapsed button reads the applied values and goes back to its icon at the default", async ({
    page,
  }) => {
    await mockLinks(page);
    await page.goto("/home");

    await openCover(page);
    await sortChip(page, "제목").click();
    await favoriteToggle(page).click();
    await closeCover(page);
    await expect(coverButton(page)).toHaveAccessibleName(
      "정렬·필터 열기, 적용 중: 제목 오름차순, 바로가기만",
    );
    await expect(coverButton(page).getByText("제목", { exact: true })).toBeVisible();

    await openCover(page);
    await expect(coverButton(page)).toHaveAccessibleName(
      "정렬·필터 닫기, 적용 중: 제목 오름차순, 바로가기만",
    );
    await favoriteToggle(page).click();
    await closeCover(page);
    await expect(coverButton(page)).toHaveAccessibleName("정렬·필터 열기, 적용 중: 제목 오름차순");

    await openCover(page);
    await sortChip(page, "저장일").click();
    await closeCover(page);
    await expect(coverButton(page)).toHaveAccessibleName("정렬·필터 열기");
  });

  test("sort and ★ stay when another folder chip is pressed", async ({ page }) => {
    await mockLinks(page);
    await page.goto("/home");
    await openCover(page);
    await sortChip(page, "제목").click();
    await favoriteToggle(page).click();
    await closeCover(page);
    await expectTitles(page, [2, 4]);

    await page.getByRole("radio", { name: "📚 공부" }).click();
    await expectTitles(page, [2]);
    await expect(coverButton(page)).toHaveAccessibleName(
      "정렬·필터 열기, 적용 중: 제목 오름차순, 바로가기만",
    );
  });

  test("a search keeps the folder, the sort and ★", async ({ page }) => {
    const state = await mockLinks(page);
    await page.goto("/home");
    await page.getByRole("radio", { name: "📚 공부" }).click();
    await openCover(page);
    await sortChip(page, "제목").click();
    await favoriteToggle(page).click();
    await closeCover(page);

    await page.getByPlaceholder("링크 · 요약 · 태그 검색…").fill("가나");
    await expect
      .poll(() => {
        const last = linkListRequests(state).at(-1);
        return last
          ? [
              last.get("query"),
              last.get("folderId"),
              last.get("orderKey"),
              last.get("order"),
              last.get("isFavorite"),
            ]
          : null;
      })
      .toEqual(["가나", "1", "title", "asc", "true"]);
  });

  test("empty results say why: ★ on, or a folder with no links", async ({ page }) => {
    await mockLinks(
      page,
      buildLinks().map((link) => ({ ...link, isFavorite: false })),
    );
    await page.goto("/home");
    await openCover(page);
    await favoriteToggle(page).click();
    await closeCover(page);
    await expect(page.getByText("조건에 맞는 링크가 없어요")).toBeVisible();
    await expect(page.getByText("바로가기만 보는 중이에요.")).toBeVisible();
    await expect(coverButton(page)).toHaveAccessibleName("정렬·필터 열기, 적용 중: 바로가기만");

    await openCover(page);
    await favoriteToggle(page).click();
    await closeCover(page);
    await page.getByRole("radio", { name: "☕ 가볼 곳" }).click();
    await expect(page.getByText("조건에 맞는 링크가 없어요")).toBeVisible();
    await expect(page.getByText("이 폴더에는 아직 링크가 없어요.")).toBeVisible();
  });

  test("an account without links still sees the first-link guide", async ({ page }) => {
    await mockLinks(page, []);
    await page.goto("/home");
    await expect(page.getByText("조건에 맞는 링크가 없어요")).toHaveCount(0);
    await expect(page.getByTestId("link-filter-row")).toHaveCount(0);
  });

  test("the row works while the list loads", async ({ page }) => {
    let release!: () => void;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    await mockLinks(page);
    await page.route(
      (url) => url.pathname === "/api/links",
      async (route: Route) => {
        await held;
        await route.fallback();
      },
    );
    await page.goto("/home");
    await openCover(page);
    await expect(sortChip(page, "저장일, 내림차순")).toBeVisible();
    release();
    await expectTitles(page, NEWEST);
  });
});

test.describe("folder detail on mobile", () => {
  test.skip(() => isWideProject(), "web mobile folder detail");

  test("N개 링크 on the left and the same button, with sort and ★", async ({ page }) => {
    await mockLinks(page);
    await page.goto("/folders/1");
    await expect(page.getByTestId("link-filter-row").getByText("3개 링크")).toBeVisible();
    await expectTitles(page, [3, 2, 1]);

    await openCover(page);
    await sortChip(page, "제목").click();
    await expectTitles(page, [2, 1, 3]);
    await favoriteToggle(page).click();
    await expectTitles(page, [2]);
    await closeCover(page);
    await expect(coverButton(page)).toHaveAccessibleName(
      "정렬·필터 열기, 적용 중: 제목 오름차순, 바로가기만",
    );
  });

  test("the uncategorized folder has the same row", async ({ page }) => {
    await mockLinks(page);
    await page.goto("/folders/0");
    await expect(page.getByTestId("link-filter-row").getByText("2개 링크")).toBeVisible();
    await expectTitles(page, [5, 4]);
    await openCover(page);
    await sortChip(page, "제목").click();
    await expectTitles(page, [4, 5]);
  });

  test("a folder with no links at the default shows the usual empty message", async ({ page }) => {
    await mockLinks(page);
    await page.goto("/folders/2");
    await expect(page.getByText("아직 링크가 없어요")).toBeVisible();
    await expect(page.getByText("새 링크를 추가하면 이곳에 표시돼요.")).toBeVisible();
  });

  test("sort and ★ are kept per folder and after a link detail", async ({ page }) => {
    await mockLinks(page);
    await page.goto("/folders/1");
    await openCover(page);
    await sortChip(page, "제목").click();
    await closeCover(page);
    await expectTitles(page, [2, 1, 3]);

    await titles(page).first().click();
    await expect(page).toHaveURL(/\/links\/2$/);
    await page.getByRole("button", { name: "뒤로" }).click();
    await expect(page).toHaveURL(/\/folders\/1$/);
    await expectTitles(page, [2, 1, 3]);
    await expect(coverButton(page)).toHaveAccessibleName("정렬·필터 열기, 적용 중: 제목 오름차순");

    await page.goto("/folders/0");
    await expect(coverButton(page)).toHaveAccessibleName("정렬·필터 열기");
    await expectTitles(page, [5, 4]);
  });

  test("a shortcut released in the detail is gone from the ★ list on return", async ({ page }) => {
    await mockLinks(page);
    await page.goto("/folders/0");
    await openCover(page);
    await favoriteToggle(page).click();
    await closeCover(page);
    await expectTitles(page, [4]);

    await titles(page).first().click();
    await expect(page).toHaveURL(/\/links\/4$/);
    await page.getByRole("button", { name: "바로가기 해제" }).first().click();
    await expect(page.getByRole("button", { name: "바로가기 추가" }).first()).toBeVisible();
    await page.getByRole("button", { name: "뒤로" }).click();
    await expect(page.getByText("조건에 맞는 링크가 없어요")).toBeVisible();
    await expect(titles(page)).toHaveCount(0);
  });
});

test.describe("wide lists", () => {
  test.skip(() => !isWideProject(), "web wide");

  for (const screen of [
    { name: "all links", path: "/links", count: "5개 링크", newest: NEWEST, titleAsc: TITLE_ASC },
    {
      name: "a folder",
      path: "/folders/1",
      count: "3개 링크",
      newest: [3, 2, 1],
      titleAsc: [2, 1, 3],
    },
  ]) {
    test(`${screen.name}: the count line is the row, and the cover opens to its content`, async ({
      page,
    }) => {
      await mockLinks(page);
      await page.goto(screen.path);
      const row = page.getByTestId("link-filter-row");
      await expect(row.getByText(screen.count)).toBeVisible();
      await expectTitles(page, screen.newest);

      const rowBox = await row.boundingBox();
      const buttonBox = await coverButton(page).boundingBox();
      expect(rowBox && buttonBox).toBeTruthy();
      expect(buttonBox!.x + buttonBox!.width).toBeGreaterThan(rowBox!.x + rowBox!.width - 50);

      await openCover(page);
      await expect(row.getByText(screen.count)).toBeVisible();
      await sortChip(page, "제목").click();
      await expectTitles(page, screen.titleAsc);
    });
  }

  test("a card opens the detail and keeps the order and the pill", async ({ page }) => {
    await mockLinks(page);
    await page.goto("/links");
    await openCover(page);
    await sortChip(page, "제목").click();
    await closeCover(page);
    await expectTitles(page, TITLE_ASC);

    await titles(page).nth(1).click();
    await expect(page).toHaveURL(/\/links\?linkId=4/);
    await expectTitles(page, TITLE_ASC);
    await expect(coverButton(page)).toHaveAccessibleName("정렬·필터 열기, 적용 중: 제목 오름차순");
  });
});

test.describe("errors and memory", () => {
  test("a failed list shows the error, and 다시 시도 recovers or stays", async ({ page }) => {
    test.setTimeout(60_000);
    let isDown = true;
    await mockLinks(page);
    // Registered after mockApi, so it is asked first and falls back to it once the network is up.
    await page.route(
      (url) => url.pathname === "/api/links",
      async (route: Route) => {
        if (isDown) {
          await route.fulfill({ status: 500, body: "{}" });
          return;
        }
        await route.fallback();
      },
    );
    await page.goto(isWideProject() ? "/links" : "/home");
    await expect(page.getByText("링크를 불러오지 못했어요")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText("네트워크 연결을 확인한 뒤 다시 시도해주세요.")).toBeVisible();
    await expect(page.getByText("아직 링크가 없어요")).toHaveCount(0);
    await expect(coverButton(page)).toBeVisible();

    const retry = page.getByRole("button", { name: "다시 시도" });
    await retry.click();
    // The list loads again (with its own backoff attempts), then the error comes back.
    await expect(page.getByText("링크를 불러오지 못했어요")).toHaveCount(0);
    await expect(page.getByText("링크를 불러오지 못했어요")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText("아직 링크가 없어요")).toHaveCount(0);

    isDown = false;
    await page.getByRole("button", { name: "다시 시도" }).click();
    await expect(titles(page)).toHaveCount(5, { timeout: 20_000 });
    await expect(page.getByText("링크를 불러오지 못했어요")).toHaveCount(0);
  });

  test("reloading starts every list at the default", async ({ page }) => {
    await mockLinks(page);
    await page.goto(isWideProject() ? "/links" : "/home");
    await openCover(page);
    await sortChip(page, "제목").click();
    await favoriteToggle(page).click();
    await closeCover(page);
    await expectTitles(page, [2, 4]);

    await page.reload();
    await expectTitles(page, NEWEST);
    await expect(coverButton(page)).toHaveAccessibleName("정렬·필터 열기");
  });
});
