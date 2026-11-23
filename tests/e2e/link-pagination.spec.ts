import { type Locator, type Page, expect, test } from "@playwright/test";

import { isWideProject } from "./support/helpers";
import {
  BODY_MATCH_TEXT,
  MANY_LINKS_QUERY,
  OTHER_LINKS_QUERY,
  PAGINATION_FOLDER_ID,
  makePaginationLinks,
  mockLinkPagination,
} from "./support/link-pagination-fixtures";

const ERROR_TITLE = "링크를 불러오지 못했어요";
const FOLDER_ROUTE = `/folders/${PAGINATION_FOLDER_ID}`;
const LINK_COUNT = 65;

test.setTimeout(60_000);

function cards(page: Page) {
  return page.getByTestId("link-card");
}

function scroller(anchor: Locator) {
  return anchor.first().evaluateHandle((element) => {
    let parent = element.parentElement;
    while (parent && !/(auto|scroll)/.test(getComputedStyle(parent).overflowY)) {
      parent = parent.parentElement;
    }
    if (!parent) throw new Error("No scroll view for these link cards");
    return parent;
  });
}

async function scrollNearEnd(page: Page) {
  const view = await scroller(cards(page));
  return view.evaluate((node) => {
    node.scrollTop = node.scrollHeight - node.clientHeight - 45;
    return node.scrollTop;
  });
}

function defaultPageSize() {
  return isWideProject() ? 60 : 30;
}

async function finishList(page: Page, total: number, pageSize = defaultPageSize()) {
  for (let count = pageSize; count < total; count += pageSize) {
    await expect(cards(page)).toHaveCount(count);
    await scrollNearEnd(page);
  }
  await expect(cards(page)).toHaveCount(total);
}

test("wide home keeps six recent cards and nine shortcuts and opens all links", async ({
  page,
}) => {
  test.skip(!isWideProject());
  const requests = await mockLinkPagination(page);
  await page.goto("/home");
  await expect(cards(page)).toHaveCount(6);
  const shortcuts = page.getByText("바로가기 추가", { exact: true }).locator("..").locator("..");
  await expect(shortcuts.getByText(/^여행 기록 \d+$/)).toHaveCount(9);
  expect(requests.map((params) => params.get("size"))).toEqual(expect.arrayContaining(["6", "9"]));
  const recent = page.getByText("🔖 최근 저장", { exact: true }).locator("../..");
  await recent.getByText("전체 →").click();
  await expect(page).toHaveURL(/\/links$/);
  await expect(cards(page)).toHaveCount(60);
});

test("the full list loads all pages and restores the list after opening an appended link", async ({
  page,
}) => {
  const wide = isWideProject();
  await mockLinkPagination(page);
  await page.goto(wide ? "/links" : "/home");
  await expect(cards(page)).toHaveCount(defaultPageSize());
  if (wide) await expect(page.getByText(/개 링크$/)).toHaveCount(0);
  await finishList(page, LINK_COUNT);
  await expect(page.getByLabel("불러오는 중", { exact: true })).toHaveCount(0);
  if (wide) await expect(page.getByText("65개 링크")).toBeVisible();

  const lastCard = cards(page).filter({ hasText: "여행 기록 65" });
  const lastTitle = lastCard.getByTestId("link-card-title");
  await lastTitle.scrollIntoViewIfNeeded();
  const before = await (await scroller(lastCard)).evaluate((node) => node.scrollTop);
  expect(before).toBeGreaterThan(0);
  await lastTitle.click();
  await expect(page).toHaveURL(wide ? /linkId=65/ : /\/links\/65$/);
  await expect(page.getByTestId("link-detail-title")).toHaveText("여행 기록 65");
  await (
    wide ? page.getByTestId("link-detail-close") : page.getByRole("button", { name: "뒤로" })
  ).click();
  await expect(page).toHaveURL(wide ? /\/links$/ : /\/home$/);
  await expect(lastCard).toBeInViewport();
  await expect
    .poll(async () => {
      const current = await (await scroller(lastCard)).evaluate((node) => node.scrollTop);
      return Math.abs(before - current);
    })
    .toBeLessThanOrEqual(2);
});

test("folder detail shows the server count before appending the remaining links", async ({
  page,
}) => {
  await mockLinkPagination(page);
  await page.goto(FOLDER_ROUTE);
  await expect(cards(page)).toHaveCount(defaultPageSize());
  await expect(page.getByText("65개 링크")).toBeVisible();
  await finishList(page, LINK_COUNT);
  await expect(cards(page).last()).toContainText("여행 기록 65");
});

test("the chosen card size sets the page size for the first and next requests", async ({
  page,
}) => {
  const wide = isWideProject();
  const requests = await mockLinkPagination(page);
  await page.addInitScript(
    (size) => {
      localStorage.setItem("qlink-link-card-size", size);
    },
    wide ? "large" : "small",
  );
  await page.goto(wide ? FOLDER_ROUTE : "/home");

  if (!wide) {
    await page.getByPlaceholder("링크 · 요약 · 태그 검색…").fill(MANY_LINKS_QUERY);
    await expect(cards(page).first()).toContainText("여행 기록 02");
  }
  await finishList(page, LINK_COUNT, 40);

  const listRequests = requests.filter((params) =>
    wide
      ? params.get("folderId") === String(PAGINATION_FOLDER_ID)
      : params.get("query") === MANY_LINKS_QUERY,
  );
  expect(listRequests.map((params) => [params.get("size"), params.get("cursor")])).toEqual([
    ["40", null],
    ["40", "page:40"],
  ]);
});

test("a short wide list loads more without a scroll and stops at the end", async ({ page }) => {
  test.skip(!isWideProject());
  const requests = await mockLinkPagination(page, {
    links: makePaginationLinks(3),
    respond: () => ({ maxSize: 1 }),
  });
  await page.goto("/links");
  await expect(cards(page)).toHaveCount(3);
  await expect(page.getByText("3개 링크")).toBeVisible();
  expect(
    requests.filter((params) => params.get("size") === "60").map((params) => params.get("cursor")),
  ).toEqual([null, "page:1", "page:2"]);
});

test("sort and shortcut filters restart at their first page", async ({ page }) => {
  const requests = await mockLinkPagination(page);
  await page.goto(isWideProject() ? "/links" : "/home");
  await finishList(page, LINK_COUNT);
  await page.getByTestId("link-filter-row-button").click();
  await page.getByRole("radio", { name: "저장일, 내림차순" }).click();
  await expect(cards(page).first()).toContainText("여행 기록 65");
  await expect(cards(page)).toHaveCount(defaultPageSize());
  expect(requests.find((params) => params.get("order") === "asc")?.get("cursor")).toBeNull();

  await page.getByRole("switch", { name: "바로가기만 보기" }).click();
  await expect(cards(page).first()).toContainText("여행 기록 63");
  await expect(cards(page)).toHaveCount(21);
  expect(requests.find((params) => params.get("isFavorite") === "true")?.get("cursor")).toBeNull();
});

test("mobile home searches three pages, renders a body match, and resets for a new search", async ({
  page,
}) => {
  test.skip(isWideProject());
  const requests = await mockLinkPagination(page);
  await page.goto("/home");
  await expect(cards(page)).toHaveCount(30);
  const search = page.getByPlaceholder("링크 · 요약 · 태그 검색…");
  await search.fill(MANY_LINKS_QUERY);
  await expect(cards(page).first()).toContainText("여행 기록 02");
  await finishList(page, LINK_COUNT);
  await expect(cards(page).last()).toContainText(BODY_MATCH_TEXT);
  const lastTitle = cards(page).last().getByTestId("link-card-title");
  await lastTitle.scrollIntoViewIfNeeded();
  await expect(lastTitle).toBeInViewport();
  await lastTitle.click();
  await expect(page).toHaveURL(/\/links\/1$/);
  await page.getByRole("button", { name: "뒤로" }).click();
  await expect(search).toHaveValue(MANY_LINKS_QUERY);
  await expect(cards(page).last()).toBeInViewport();

  await search.fill(OTHER_LINKS_QUERY);
  await expect(cards(page)).toHaveCount(1);
  await expect(cards(page).first()).toContainText("독서 기록 01");
  expect(
    requests
      .filter((params) => params.get("query") === MANY_LINKS_QUERY)
      .map((params) => params.get("cursor")),
  ).toEqual([null, "page:30", "page:60"]);
  expect(
    requests.find((params) => params.get("query") === OTHER_LINKS_QUERY)?.get("cursor"),
  ).toBeNull();

  await search.fill("일치하지 않는 검색어");
  await expect(page.getByText("아직 링크가 없어요")).toBeVisible();
});

for (const route of ["/home", "/links", FOLDER_ROUTE]) {
  test(`initial errors retry in place on ${route}`, async ({ page }) => {
    test.skip(route === "/links" && !isWideProject());
    let fail = true;
    await mockLinkPagination(page, {
      links: makePaginationLinks(1),
      respond: (params) => ({ fail: fail && params.get("isFavorite") !== "true" }),
    });
    await page.goto(route);
    await expect(page.getByText(ERROR_TITLE)).toBeVisible({ timeout: 15_000 });
    await expect(cards(page)).toHaveCount(0);
    const retry = page.getByRole("button", { name: "다시 시도" });
    await retry.click();
    await expect(retry).toHaveCount(0);
    await expect(retry).toBeVisible({ timeout: 15_000 });
    fail = false;
    await retry.click();
    await expect(cards(page)).toHaveCount(1);
    await expect(page.getByText(ERROR_TITLE)).toHaveCount(0);
  });
}

test("mobile search retries the current search term after an initial error", async ({ page }) => {
  test.skip(isWideProject());
  let fail = true;
  const requests = await mockLinkPagination(page, {
    respond: (params) => ({ fail: fail && params.get("query") === OTHER_LINKS_QUERY }),
  });
  await page.goto("/home");
  await expect(cards(page)).toHaveCount(30);
  const search = page.getByPlaceholder("링크 · 요약 · 태그 검색…");
  await search.fill(OTHER_LINKS_QUERY);
  await expect(page.getByText(ERROR_TITLE)).toBeVisible({ timeout: 15_000 });
  await expect(search).toHaveValue(OTHER_LINKS_QUERY);
  const requestsForSearch = () =>
    requests.filter((params) => params.get("query") === OTHER_LINKS_QUERY);
  const failedAttempts = requestsForSearch().length;
  fail = false;
  await page.getByRole("button", { name: "다시 시도" }).click();
  await expect(cards(page)).toHaveCount(1);
  await expect(cards(page).first()).toContainText("독서 기록 01");
  expect(requestsForSearch()).toHaveLength(failedAttempts + 1);
});

for (const route of ["/home", "/links", "/folders/0"]) {
  test(`an offline first visit stays loading until reconnecting on ${route}`, async ({ page }) => {
    const wide = isWideProject();
    test.skip(route === "/links" && !wide);
    const links = makePaginationLinks(1).map((link) => ({ ...link, folderId: 0 }));
    const requests = await mockLinkPagination(page, { links });
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
      const addEventListener = window.addEventListener.bind(window);
      window.addEventListener = ((...args: Parameters<typeof window.addEventListener>) => {
        const [type] = args;
        addEventListener(...args);
        if (type === "offline" && !navigator.onLine) {
          window.dispatchEvent(new Event("offline"));
        }
      }) as typeof window.addEventListener;
    });

    await page.goto(route);
    await expect(page.getByTestId("link-card-skeleton").first()).toBeVisible();
    await expect(cards(page)).toHaveCount(0);
    await expect(page.getByText(/최근 저장 링크가 없어요|아직 링크가 없어요/)).toHaveCount(0);
    expect(requests).toHaveLength(0);

    await page.evaluate(() => {
      Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
      window.dispatchEvent(new Event("online"));
    });
    await expect(cards(page)).toHaveCount(1);
    await expect(page.getByTestId("link-card-skeleton")).toHaveCount(0);
  });
}

test("an empty folder shows its empty message after the first response", async ({ page }) => {
  let release: () => void = () => {};
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  await mockLinkPagination(page, {
    links: [],
    respond: async () => {
      await pending;
      return {};
    },
  });
  await page.goto(FOLDER_ROUTE);
  await expect(page.getByTestId("link-card-grid")).toBeVisible();
  await expect(cards(page)).toHaveCount(0);
  await expect(page.getByText("아직 링크가 없어요")).toHaveCount(0);
  release();
  await expect(page.getByText("아직 링크가 없어요")).toBeVisible();
});

test("next-page loading and failures preserve the cards and scroll, and retry the same cursor in dark mode", async ({
  page,
}) => {
  const pageSize = defaultPageSize();
  const nextPageCursor = `page:${pageSize}`;
  let release: () => void = () => {};
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  let fail = true;
  const requests = await mockLinkPagination(page, {
    theme: "dark",
    respond: async (params) => {
      if (!params.has("cursor")) return {};
      await pending;
      return { fail };
    },
  });
  await page.goto(FOLDER_ROUTE);
  await expect(cards(page)).toHaveCount(pageSize);
  await expect
    .poll(() => page.locator("html").evaluate((el) => el.classList.contains("dark")))
    .toBe(true);
  await scrollNearEnd(page);
  await expect(page.getByLabel("불러오는 중", { exact: true })).toBeVisible();
  await expect(cards(page)).toHaveCount(pageSize);
  const view = await scroller(cards(page));
  await view.evaluate(async (node) => {
    node.scrollTop -= 250;
    await new Promise((resolve) => requestAnimationFrame(resolve));
    node.scrollTop += 250;
  });
  const before = await view.evaluate((node) => node.scrollTop);

  release();
  await expect(page.getByText(ERROR_TITLE)).toBeVisible();
  await expect(cards(page)).toHaveCount(pageSize);
  expect(await view.evaluate((node) => node.scrollTop)).toBeCloseTo(before, 0);
  expect(requests.filter((params) => params.has("cursor"))).toHaveLength(1);

  const retry = page.getByRole("button", { name: "다시 시도" });
  await retry.click();
  await expect.poll(() => requests.filter((params) => params.has("cursor")).length).toBe(2);
  await expect(page.getByText(ERROR_TITLE)).toBeVisible();
  fail = false;
  await retry.click();
  await expect(cards(page)).toHaveCount(Math.min(2 * pageSize, LINK_COUNT));
  expect(
    requests.filter((params) => params.has("cursor")).map((params) => params.get("cursor")),
  ).toEqual([nextPageCursor, nextPageCursor, nextPageCursor]);
  if (2 * pageSize < LINK_COUNT) await scrollNearEnd(page);
  await expect(cards(page)).toHaveCount(LINK_COUNT);
  await expect(cards(page).filter({ hasText: `여행 기록 ${pageSize + 1}` })).toHaveCount(1);
  await expect(retry).toHaveCount(0);
});
