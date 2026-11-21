import { type Locator, type Page, expect, test } from "@playwright/test";

import { isWideProject } from "./support/helpers";
import {
  BODY_MATCH_TEXT,
  MANY_LINKS_QUERY,
  OTHER_LINKS_QUERY,
  makePaginationLinks,
  mockLinkPagination,
} from "./support/link-pagination-fixtures";

const ERROR_TITLE = "링크를 불러오지 못했어요";
const SEARCH_PLACEHOLDER = "링크 · 요약 · 태그 · 폴더 검색…";

test.skip(() => !isWideProject(), "the search dialog is wide only");
test.setTimeout(60_000);

async function openSearch(page: Page, mode: "link" | "both" = "link") {
  if (mode === "both") {
    await page.goto("/home");
    await openIntegratedSearch(page);
  } else {
    await page.goto("/links");
    await page.getByText("⌘/Ctrl + K").first().click();
  }
  const dialog = page.getByRole("dialog");
  return {
    dialog,
    input: dialog.getByPlaceholder(SEARCH_PLACEHOLDER),
    rows: dialog.getByTestId("search-link-result"),
    loading: dialog.getByLabel("불러오는 중", { exact: true }),
    retry: dialog.getByRole("button", { name: "다시 시도" }),
    announcement: dialog.getByRole("status"),
  };
}

async function openIntegratedSearch(page: Page) {
  const homeSearch = page.getByPlaceholder("웹 검색 또는 내 링크 검색…");
  await homeSearch.fill(MANY_LINKS_QUERY);
  await homeSearch.press("Enter");
}

function searchCursors(requests: URLSearchParams[], query = MANY_LINKS_QUERY) {
  return requests.filter((params) => params.get("query") === query).map((p) => p.get("cursor"));
}

async function tabThrough(page: Page, rows: Locator) {
  for (const row of await rows.all()) {
    await page.keyboard.press("Tab");
    await expect(row).toBeFocused();
  }
}

function scrollView(rows: Locator) {
  return rows.first().evaluateHandle((row) => {
    let view = row.parentElement;
    while (view && !/auto|scroll/.test(getComputedStyle(view).overflowY)) {
      view = view.parentElement;
    }
    if (!view) throw new Error("Could not find the search scroll view");
    return view;
  });
}

test("scrolls through three pages, shows the body match and count, and resets for a new term", async ({
  page,
}) => {
  const requests = await mockLinkPagination(page, { links: makePaginationLinks(20) });
  await page.setViewportSize({ width: 1280, height: 550 });
  const { dialog, input, rows, loading } = await openSearch(page);
  await input.fill(MANY_LINKS_QUERY);

  for (const count of [8, 16]) {
    await expect(rows).toHaveCount(count);
    await expect(dialog.getByText(/^📌 링크 \(/)).toHaveCount(0);
    await (
      await scrollView(rows)
    ).evaluate((view) => {
      view.scrollTop = view.scrollHeight;
    });
  }
  await expect(rows).toHaveCount(20);
  await expect(rows.last()).toContainText("독서 기록 01");
  await expect(rows.last().getByTestId("search-link-snippet")).toContainText(BODY_MATCH_TEXT);
  await expect(dialog.getByTestId("search-link-group-divider")).toHaveCount(1);
  await expect(dialog.getByText("📌 링크 (20)")).toBeVisible();
  await expect(loading).toHaveCount(0);
  expect(searchCursors(requests)).toEqual([null, "page:8", "page:16"]);

  await input.fill(OTHER_LINKS_QUERY);
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText("독서 기록 01");
  await expect(dialog.getByText("📌 링크 (1)")).toBeVisible();
  expect(await (await scrollView(rows)).evaluate((view) => view.scrollTop)).toBe(0);
  expect(searchCursors(requests, OTHER_LINKS_QUERY)).toEqual([null]);

  await input.fill("없는 기록");
  await expect(dialog.getByText("📌 링크 (0)")).toBeVisible();
  await expect(dialog.getByText("최신 검색어가 없어요")).toBeVisible();
});

test("loads a short first page without scrolling and keeps a late response under its original term", async ({
  page,
}) => {
  let releasePage: () => void = () => {};
  const pendingPage = new Promise<void>((resolve) => {
    releasePage = resolve;
  });
  const requests = await mockLinkPagination(page, {
    links: makePaginationLinks(5),
    respond: async (params) => {
      if (params.get("query") === MANY_LINKS_QUERY && params.has("cursor")) await pendingPage;
      return { maxSize: 2 };
    },
  });
  const { dialog, input, rows, loading } = await openSearch(page);
  await input.fill(MANY_LINKS_QUERY);
  await expect(rows).toHaveCount(2);
  await expect(loading).toBeVisible();
  expect(searchCursors(requests)).toEqual([null, "page:2"]);

  await input.fill(OTHER_LINKS_QUERY);
  await expect(dialog.getByText("📌 링크 (1)")).toBeVisible();
  const lateResponse = page.waitForResponse((response) => {
    const params = new URL(response.url()).searchParams;
    return params.get("query") === MANY_LINKS_QUERY && params.get("cursor") === "page:2";
  });
  releasePage();
  expect((await lateResponse).ok()).toBe(true);
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText("독서 기록 01");
});

test("blocks the old selection and cursor as soon as a new term is entered", async ({ page }) => {
  let releaseNew: () => void = () => {};
  const pendingNew = new Promise<void>((resolve) => {
    releaseNew = resolve;
  });
  const requests = await mockLinkPagination(page, {
    links: makePaginationLinks(20),
    respond: async (params) => {
      if (params.get("query") === OTHER_LINKS_QUERY) await pendingNew;
      return {};
    },
  });
  await page.setViewportSize({ width: 1280, height: 700 });
  const { dialog, input, rows, loading, announcement } = await openSearch(page, "both");
  await expect(rows).toHaveCount(8);
  await expect(dialog.getByRole("button", { name: /Google에서/ })).toBeVisible();
  for (let i = 0; i < 8; i += 1) await input.press("ArrowDown");
  await expect(announcement).toHaveText("여행 기록 09");
  expect(searchCursors(requests)).toEqual([null]);

  await input.evaluate((element: HTMLInputElement, term) => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    setter?.call(element, term);
    element.dispatchEvent(new Event("input", { bubbles: true }));
    for (const key of ["ArrowDown", "Enter"]) {
      element.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
    }
  }, OTHER_LINKS_QUERY);
  await expect(input).toHaveValue(OTHER_LINKS_QUERY);
  await expect(dialog).toBeVisible();
  await expect(page.getByTestId("link-detail")).toHaveCount(0);
  await expect(rows).toHaveCount(0);
  await expect(announcement).toBeEmpty();
  await expect(loading).toBeVisible();
  expect(searchCursors(requests)).toEqual([null]);
  await expect.poll(() => searchCursors(requests, OTHER_LINKS_QUERY)).toEqual([null]);

  releaseNew();
  await expect(rows).toHaveCount(1);
  await input.press("ArrowDown");
  await expect(announcement).toHaveText("독서 기록 01");
  await input.press("Enter");
  await expect(page.getByTestId("link-detail-title")).toHaveText("독서 기록 01");
});

test("the web result can be focused and opened by keyboard with link pages remaining", async ({
  page,
}) => {
  let releaseNext: () => void = () => {};
  const pendingNext = new Promise<void>((resolve) => {
    releaseNext = resolve;
  });
  await mockLinkPagination(page, {
    links: makePaginationLinks(20),
    respond: async (params) => {
      if (params.get("query") === MANY_LINKS_QUERY && params.has("cursor")) await pendingNext;
      return {};
    },
  });
  await page.addInitScript(() => {
    window.open = (url) => {
      sessionStorage.setItem("opened-web-result", String(url));
      return null;
    };
  });
  await page.setViewportSize({ width: 1280, height: 700 });
  const { dialog, input, rows, announcement } = await openSearch(page, "both");
  const webTitle = `Google에서 "${MANY_LINKS_QUERY}" 검색`;
  const webResult = dialog.getByRole("button", { name: /Google에서/ });
  await expect(rows).toHaveCount(8);
  await expect(webResult).toBeVisible();

  await input.press("ArrowUp");
  await expect(announcement).toHaveText(webTitle);
  await tabThrough(page, rows);
  await page.keyboard.press("Tab");
  await expect(webResult).toBeFocused();
  await expect(dialog.getByText(/^📌 링크 \(/)).toHaveCount(0);
  await page.keyboard.press("Enter");
  await expect(dialog).toHaveCount(0);
  expect(await page.evaluate(() => sessionStorage.getItem("opened-web-result"))).toBe(
    `https://www.google.com/search?q=${encodeURIComponent(MANY_LINKS_QUERY)}`,
  );
  releaseNext();
});

test("preserves selection on a slow and repeatedly failing next page, then opens an appended link by keyboard", async ({
  page,
}) => {
  let releasePage: () => void = () => {};
  const pendingPage = new Promise<void>((resolve) => {
    releasePage = resolve;
  });
  let releaseRetry: () => void = () => {};
  const pendingRetry = new Promise<void>((resolve) => {
    releaseRetry = resolve;
  });
  let attempts = 0;
  let fail = true;
  const requests = await mockLinkPagination(page, {
    links: makePaginationLinks(20),
    theme: "dark",
    respond: async (params) => {
      if (params.get("cursor") === "page:8") {
        attempts += 1;
        if (attempts === 1) await pendingPage;
        if (attempts === 2) await pendingRetry;
        return { fail };
      }
      return {};
    },
  });
  await page.setViewportSize({ width: 1280, height: 700 });
  const { dialog, input, rows, loading, retry, announcement } = await openSearch(page, "both");
  await expect(rows).toHaveCount(8);
  await expect(dialog.getByText(`Google에서 "${MANY_LINKS_QUERY}" 검색`)).toBeVisible();
  await expect
    .poll(() => page.locator("html").evaluate((node) => node.classList.contains("dark")))
    .toBe(true);
  for (let i = 0; i < 8; i += 1) {
    await page.keyboard.press("ArrowDown");
  }
  await expect(announcement).toHaveText("여행 기록 09");
  expect(searchCursors(requests)).toEqual([null]);
  await page.keyboard.press("ArrowDown");
  await expect(loading).toBeVisible();
  await expect(announcement).toHaveText("여행 기록 09");

  const view = await scrollView(rows);
  await view.evaluate(async (node) => {
    for (let i = 0; i < 2; i += 1) {
      node.scrollTop = 0;
      await new Promise(requestAnimationFrame);
      node.scrollTop = node.scrollHeight - node.clientHeight - 10;
      await new Promise(requestAnimationFrame);
    }
  });
  const before = await view.evaluate((node) => node.scrollTop);
  releasePage();
  await expect(dialog.getByText(ERROR_TITLE)).toBeVisible();
  await expect(rows).toHaveCount(8);
  await expect(announcement).toHaveText("여행 기록 09");
  expect(await view.evaluate((node) => node.scrollTop)).toBeCloseTo(before, 0);
  expect(searchCursors(requests)).toEqual([null, "page:8"]);

  await tabThrough(page, rows);
  await page.keyboard.press("Tab");
  await expect(retry).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(loading).toBeVisible();
  await expect(retry).toHaveCount(0);
  await expect.poll(() => searchCursors(requests)).toEqual([null, "page:8", "page:8"]);
  releaseRetry();
  await expect(retry).toBeVisible();
  await expect(input).toBeFocused();
  fail = false;
  await tabThrough(page, rows);
  await page.keyboard.press("Tab");
  await expect(retry).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(rows).toHaveCount(16);
  expect(searchCursors(requests)).toEqual([null, "page:8", "page:8", "page:8"]);
  await expect(announcement).toHaveText("여행 기록 09");
  await expect(input).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(announcement).toHaveText("여행 기록 10");
  await expect(rows.nth(8)).toBeInViewport({ ratio: 1 });
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("link-detail-title")).toHaveText("여행 기록 10");
});

test("shows the first page loading and error, retries via Tab and Enter, and keeps the web result usable", async ({
  page,
}) => {
  let releasePage: () => void = () => {};
  const pendingPage = new Promise<void>((resolve) => {
    releasePage = resolve;
  });
  let fail = true;
  const requests = await mockLinkPagination(page, {
    links: makePaginationLinks(5),
    respond: async (params) => {
      if (params.get("query") === MANY_LINKS_QUERY) {
        await pendingPage;
        return { fail };
      }
      return {};
    },
  });
  await page.addInitScript(() => {
    window.open = (url) => {
      sessionStorage.setItem("opened-web-result", String(url));
      return null;
    };
  });
  const { dialog, input, rows, loading, retry } = await openSearch(page, "both");
  await expect(loading).toBeVisible();
  await expect(dialog.getByText(/^📌 링크 \(/)).toHaveCount(0);
  releasePage();
  await expect(dialog.getByText(ERROR_TITLE)).toBeVisible({ timeout: 12_000 });
  await expect(dialog.getByText("최신 검색어가 없어요")).toHaveCount(0);
  const webResult = dialog.getByText(`Google에서 "${MANY_LINKS_QUERY}" 검색`);
  await webResult.click();
  await expect(dialog).toHaveCount(0);
  expect(await page.evaluate(() => sessionStorage.getItem("opened-web-result"))).toBe(
    `https://www.google.com/search?q=${encodeURIComponent(MANY_LINKS_QUERY)}`,
  );

  await openIntegratedSearch(page);
  await expect(retry).toBeVisible({ timeout: 12_000 });
  await page.keyboard.press("Tab");
  await expect(retry).toBeFocused();
  const before = searchCursors(requests).length;
  await page.keyboard.press("Enter");
  await expect.poll(() => searchCursors(requests).length).toBeGreaterThan(before);
  await expect(retry).toBeVisible({ timeout: 12_000 });
  await expect(input).toHaveValue(MANY_LINKS_QUERY);
  fail = false;
  await page.keyboard.press("Tab");
  await expect(retry).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(rows).toHaveCount(5);
  await expect(dialog.getByText("📌 링크 (5)")).toBeVisible();
  expect(new Set(searchCursors(requests))).toEqual(new Set([null]));
});
