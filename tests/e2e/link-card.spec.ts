import { expect, test } from "@playwright/test";

import {
  boxOf,
  cssOf,
  firstRowCount,
  isWideProject,
  openedUrls,
  stubWindowOpen,
} from "./support/helpers";
import {
  BROKEN_IMAGE,
  GOOD_FAVICON,
  GOOD_IMAGE,
  SLOW_IMAGE,
  makeDetail,
  makeLink,
  mockApi,
} from "./support/mock-api";

// #5 link card: image cell, todo counts, grid, open original vs detail.

const VIDEO = makeLink({
  id: 1,
  url: "https://www.youtube.com/watch?v=r3gesture",
  title: "Reanimated 3로 만드는 60fps 제스처 애니메이션",
  isVideo: true,
  isFavorite: true,
  tags: ["React Native", "애니메이션"],
  todoCounts: { open: 3, dueSoon: 1, overdue: 1, completed: 0 },
});
const PHOTO = makeLink({
  id: 2,
  url: "https://velog.io/@devkim/tanstack-query-v5",
  title:
    "TanStack Query v5 마이그레이션 정리 — 객체 시그니처, isPending, gcTime, 무한 스크롤 쿼리까지 바뀐 점을 한 번에 훑어보는 아주 긴 제목",
  tags: ["React Query", "프론트엔드", "마이그레이션", "아주 긴 태그 이름 하나", "더보기", "끝"],
  todoCounts: { open: 0, dueSoon: 0, overdue: 0, completed: 0 },
});
const FAVICON_ONLY = makeLink({
  id: 3,
  url: "https://www.notion.so/team/onboarding",
  title: "2026 하반기 팀 온보딩 문서",
  thumbnailUrl: null,
  faviconUrl: GOOD_FAVICON,
  status: "G",
  workModel: null,
  todoCounts: { open: 0, dueSoon: 0, overdue: 0, completed: 2 },
});
const BROKEN = makeLink({
  id: 4,
  url: "https://brunch.co.kr/@writer/128",
  title: "기록하는 습관이 바꾼 것들",
  thumbnailUrl: BROKEN_IMAGE,
  status: "F",
  workModel: "gpt-4o-mini",
  todoCounts: { open: 1, dueSoon: 0, overdue: 0, completed: 0 },
});
const DOMAIN_ONLY = makeLink({
  id: 5,
  url: "https://ohou.se/projects/camping",
  title: "초보 캠퍼를 위한 주말 캠핑 준비물",
  thumbnailUrl: null,
  faviconUrl: null,
});
const LINKS = [VIDEO, PHOTO, FAVICON_ONLY, BROKEN, DOMAIN_ONLY];
const DETAILS = Object.fromEntries(LINKS.map((link) => [link.id, makeDetail(link)]));

function card(page: import("@playwright/test").Page, title: string) {
  return page.getByTestId("link-card").filter({ hasText: title });
}

test.describe("layout boundary", () => {
  test("769px and wider is the wide layout, 768px and narrower is mobile", async ({ page }) => {
    test.skip(!isWideProject(), "resizes a desktop browser");
    await mockApi(page, { links: LINKS, details: DETAILS });

    await page.setViewportSize({ width: 769, height: 900 });
    await page.goto("/home");
    await expect(page.getByText("⌘/Ctrl + K").first()).toBeVisible();
    await expect(page.getByRole("button", { name: "검색", exact: true })).toHaveCount(0);

    await page.setViewportSize({ width: 768, height: 900 });
    await expect(page.getByRole("button", { name: "검색", exact: true })).toBeVisible();
    await expect(page.getByText("⌘/Ctrl + K")).toHaveCount(0);
  });
});

test.describe("grid", () => {
  test("wide fills several columns and iPad portrait (820px) shows two", async ({ page }) => {
    test.skip(!isWideProject(), "wide layout");
    await mockApi(page, { links: LINKS, details: DETAILS });
    await page.goto("/links");
    const cards = page.getByTestId("link-card");
    await expect(cards).toHaveCount(LINKS.length);
    expect(await firstRowCount(cards)).toBeGreaterThanOrEqual(3);

    await page.setViewportSize({ width: 820, height: 1180 });
    await expect.poll(() => firstRowCount(cards)).toBe(2);
  });

  test("phones show one card per row, wider mobile screens two", async ({ page }) => {
    test.skip(isWideProject(), "mobile layout");
    await mockApi(page, { links: LINKS, details: DETAILS });
    await page.goto("/home");
    const cards = page.getByTestId("link-card");
    await expect(cards).toHaveCount(LINKS.length);
    expect(await firstRowCount(cards)).toBe(1);

    await page.setViewportSize({ width: 768, height: 1024 });
    await expect.poll(() => firstRowCount(cards)).toBe(2);
  });
});

test.describe("card content", () => {
  test.beforeEach(async ({ page }) => {
    await mockApi(page, { links: LINKS, details: DETAILS });
    await page.goto(isWideProject() ? "/links" : "/home");
    await expect(page.getByTestId("link-card")).toHaveCount(LINKS.length);
  });

  test("image on top at 16:9, then title, domain and # tags", async ({ page }) => {
    const photo = card(page, "TanStack Query v5");
    const image = photo.getByTestId("link-thumbnail-image");
    await expect(image).toBeVisible();
    const cell = await boxOf(photo.getByTestId("link-thumbnail"));
    expect(cell.width / cell.height).toBeCloseTo(16 / 9, 1);
    const title = await boxOf(photo.getByTestId("link-card-title"));
    expect(title.y).toBeGreaterThanOrEqual(cell.y + cell.height - 1);
    await expect(photo.getByText("velog.io", { exact: true })).toBeVisible();
    await expect(photo.getByText("#React Query", { exact: true })).toBeVisible();
  });

  test("video links show the thumbnail and a video badge at the bottom left", async ({ page }) => {
    const video = card(page, "Reanimated 3");
    await expect(video.getByTestId("link-thumbnail-image")).toBeVisible();
    const badge = video.getByText("영상", { exact: true });
    await expect(badge).toBeVisible();
    const cell = await boxOf(video.getByTestId("link-thumbnail"));
    const badgeBox = await boxOf(badge);
    expect(badgeBox.x - cell.x).toBeLessThan(cell.width / 3);
    expect(badgeBox.y - cell.y).toBeGreaterThan(cell.height / 2);
  });

  test("no image shows the stored favicon and domain, no favicon or a broken image shows the domain only, all in the same cell size", async ({
    page,
  }) => {
    const reference = await boxOf(card(page, "TanStack Query v5").getByTestId("link-thumbnail"));

    const withFavicon = card(page, "온보딩 문서").getByTestId("link-thumbnail-fallback");
    await expect(withFavicon.getByTestId("link-thumbnail-favicon")).toBeVisible();
    await expect(withFavicon.getByText("notion.so", { exact: true })).toBeVisible();

    const domainOnly = card(page, "캠핑 준비물").getByTestId("link-thumbnail-fallback");
    await expect(domainOnly.getByText("ohou.se", { exact: true })).toBeVisible();
    await expect(domainOnly.getByTestId("link-thumbnail-favicon")).toHaveCount(0);

    const broken = card(page, "기록하는 습관").getByTestId("link-thumbnail-fallback");
    await expect(broken.getByText("brunch.co.kr", { exact: true })).toBeVisible();
    await expect(broken.getByTestId("link-thumbnail-favicon")).toHaveCount(0);

    for (const cell of [withFavicon, domainOnly, broken]) {
      const box = await boxOf(cell);
      expect(Math.abs(box.width - reference.width)).toBeLessThanOrEqual(1);
      expect(Math.abs(box.height - reference.height)).toBeLessThanOrEqual(1);
    }
  });

  test("long titles stop at two lines and tags stay on one line", async ({ page }) => {
    const photo = card(page, "TanStack Query v5");
    const title = photo.getByTestId("link-card-title");
    const lineHeight = parseFloat(await cssOf(title, "line-height"));
    expect((await boxOf(title)).height).toBeLessThanOrEqual(lineHeight * 2 + 1);
    expect(await cssOf(title, "-webkit-line-clamp")).toBe("2");

    const tags = photo.getByTestId("link-card-tags");
    const tagsBox = await boxOf(tags);
    expect(tagsBox.height).toBeLessThanOrEqual(21);
    // The last tags wrap out of the one-line row and are clipped.
    const lastTag = await boxOf(photo.getByText("#끝", { exact: true }));
    expect(lastTag.y).toBeGreaterThanOrEqual(tagsBox.y + tagsBox.height - 1);
  });

  test("no favicon next to the domain, no summary model, and the AI status at the end of the domain row", async ({
    page,
  }) => {
    await expect(page.getByTestId("link-card").getByText(/요약 모델/)).toHaveCount(0);
    const generating = card(page, "온보딩 문서");
    const status = generating.getByTestId("link-card-status");
    await expect(status).toHaveText("AI 생성 중...");
    const domain = await boxOf(generating.getByText("notion.so", { exact: true }).last());
    const statusBox = await boxOf(status);
    expect(Math.abs(statusBox.y - domain.y)).toBeLessThan(6);
    expect(statusBox.x).toBeGreaterThan(domain.x);
    await expect(card(page, "기록하는 습관").getByTestId("link-card-status")).toHaveText(
      "gpt-4o-mini 생성 실패",
    );
    // Only the image cell may hold a favicon image.
    await expect(
      page.getByTestId("link-card-body").getByTestId("link-thumbnail-favicon"),
    ).toHaveCount(0);
  });

  test("shortcut links show a star at the image's top left", async ({ page }) => {
    const video = card(page, "Reanimated 3");
    const star = video.getByRole("button", { name: "바로가기 해제" });
    await expect(star).toBeVisible();
    const cell = await boxOf(video.getByTestId("link-thumbnail"));
    const starBox = await boxOf(star);
    expect(starBox.x - cell.x).toBeLessThan(20);
    expect(starBox.y - cell.y).toBeLessThan(20);
  });

  test("cards with zero, one or several todos have the same height", async ({ page }) => {
    const heights = await page
      .getByTestId("link-card")
      .evaluateAll((nodes) => nodes.map((node) => Math.round(node.getBoundingClientRect().height)));
    expect(new Set(heights).size).toBe(1);
  });

  test("todo counts: hidden without todos, split by kind, a single check when all done", async ({
    page,
  }) => {
    await expect(card(page, "TanStack Query v5").getByTestId("todo-count-badge")).toHaveCount(0);
    await expect(card(page, "캠핑 준비물").getByTestId("todo-count-badge")).toHaveCount(0);

    const split = card(page, "Reanimated 3").getByTestId("todo-count-badge");
    await expect(split).toHaveAttribute("aria-label", "할 일 1개, 임박 1개, 기한 지남 1개");
    await expect(split).toHaveText("111");

    const normalOnly = card(page, "기록하는 습관").getByTestId("todo-count-badge");
    await expect(normalOnly).toHaveAttribute("aria-label", "할 일 1개");
    await expect(normalOnly).toHaveText("1");

    const allDone = card(page, "온보딩 문서").getByTestId("todo-count-badge");
    await expect(allDone).toHaveAttribute("aria-label", "할 일 모두 완료");
    await expect(allDone).toHaveText("");
    await expect(allDone.locator("svg")).toHaveCount(1);

    // Bottom right of the card.
    const cardBox = await boxOf(card(page, "Reanimated 3"));
    const badgeBox = await boxOf(split);
    expect(cardBox.x + cardBox.width - (badgeBox.x + badgeBox.width)).toBeLessThan(20);
    expect(cardBox.y + cardBox.height - (badgeBox.y + badgeBox.height)).toBeLessThan(20);
  });
});

test.describe("wide hover", () => {
  test.skip(() => !isWideProject(), "hover is wide only");

  test("hovering the counts shows the sentence as a tooltip", async ({ page }) => {
    await mockApi(page, { links: LINKS, details: DETAILS });
    await page.goto("/links");
    await card(page, "Reanimated 3").getByTestId("todo-count-badge").hover();
    await expect(
      page.getByText("할 일 1개, 임박 1개, 기한 지남 1개", { exact: true }).first(),
    ).toBeVisible();
  });

  test("hovering a card turns its border to the accent and shows open, move and delete", async ({
    page,
  }) => {
    await mockApi(page, { links: LINKS, details: DETAILS });
    await page.goto("/links");
    const photo = card(page, "TanStack Query v5");
    await expect(photo.getByTestId("link-card-hover-actions")).toBeHidden();
    const before = await cssOf(photo, "border-top-color");
    await photo.hover();
    const actions = photo.getByTestId("link-card-hover-actions");
    await expect(actions).toBeVisible();
    await expect(actions.getByRole("button", { name: "원본 열기" })).toBeVisible();
    await expect(actions.getByRole("button", { name: "폴더 이동" })).toBeVisible();
    await expect(actions.getByRole("button", { name: "삭제" })).toBeVisible();
    await expect.poll(() => cssOf(photo, "border-top-color")).not.toBe(before);
    const cell = await boxOf(photo.getByTestId("link-thumbnail"));
    const actionsBox = await boxOf(actions);
    expect(cell.x + cell.width - (actionsBox.x + actionsBox.width)).toBeLessThan(20);
    expect(actionsBox.y - cell.y).toBeLessThan(20);
  });

  test("the hover open button opens the original without opening the detail", async ({ page }) => {
    await stubWindowOpen(page);
    await mockApi(page, { links: LINKS, details: DETAILS });
    await page.goto("/links");
    const photo = card(page, "TanStack Query v5");
    await photo.hover();
    await photo.getByRole("button", { name: "원본 열기" }).click();
    expect(await openedUrls(page)).toEqual([PHOTO.url]);
    await expect(page).not.toHaveURL(/linkId=/);
  });
});

test.describe("opening", () => {
  test("pressing outside the image opens the detail (wide overlay, mobile full screen)", async ({
    page,
  }) => {
    await stubWindowOpen(page);
    await mockApi(page, { links: LINKS, details: DETAILS });
    await page.goto(isWideProject() ? "/links" : "/home");
    await card(page, "TanStack Query v5").getByTestId("link-card-title").click();
    if (isWideProject()) {
      await expect(page).toHaveURL(/\/links\?linkId=2/);
      await expect(page.getByTestId("link-detail-close")).toBeVisible();
      await expect(page.getByTestId("link-card")).toHaveCount(LINKS.length);
    } else {
      await expect(page).toHaveURL(/\/links\/2$/);
      await expect(page.getByTestId("link-card")).toHaveCount(0);
    }
    await expect(page.getByTestId("link-detail-title")).toContainText("TanStack Query v5");
    expect(await openedUrls(page)).toEqual([]);
  });

  test("pressing the image cell, fallback included, opens the original instead of the detail", async ({
    page,
  }) => {
    await stubWindowOpen(page);
    await mockApi(page, { links: LINKS, details: DETAILS });
    const listPath = isWideProject() ? "/links" : "/home";
    await page.goto(listPath);
    await card(page, "TanStack Query v5").getByTestId("link-card-image").click();
    await card(page, "캠핑 준비물").getByTestId("link-card-image").click();
    expect(await openedUrls(page)).toEqual([PHOTO.url, DOMAIN_ONLY.url]);
    await expect(page.getByTestId("link-detail")).toHaveCount(0);
    expect(new URL(page.url()).pathname).toBe(listPath);
  });
});

test.describe("states", () => {
  test("while loading, card skeletons with the image cell fill the grid, then cards take their place", async ({
    page,
  }) => {
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const state = await mockApi(page, {
      links: LINKS,
      details: DETAILS,
      handlers: {
        "GET /api/links": async (route) => {
          await gate;
          await route.fulfill({
            contentType: "application/json",
            body: JSON.stringify({
              success: true,
              data: { isEmpty: false, contents: state.links, nextCursor: null, hasNext: false },
              error: null,
            }),
          });
        },
      },
    });
    await page.goto(isWideProject() ? "/links" : "/home");
    const skeletons = page.getByTestId("link-card-skeleton");
    await expect(skeletons.first()).toBeVisible();
    const skeletonBox = await boxOf(skeletons.first());
    release();
    await expect(page.getByTestId("link-card")).toHaveCount(LINKS.length);
    await expect(skeletons).toHaveCount(0);
    const cardBox = await boxOf(page.getByTestId("link-card").first());
    expect(Math.abs(cardBox.x - skeletonBox.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(cardBox.y - skeletonBox.y)).toBeLessThanOrEqual(1);
    expect(Math.abs(cardBox.width - skeletonBox.width)).toBeLessThanOrEqual(1);
  });

  test("an image still loading keeps its cell, so the card does not change size", async ({
    page,
  }) => {
    const slow = makeLink({ id: 6, title: "느린 이미지", thumbnailUrl: SLOW_IMAGE });
    const fast = makeLink({ id: 7, title: "빠른 이미지", thumbnailUrl: GOOD_IMAGE });
    await mockApi(page, { links: [slow, fast] });
    // The slow image never finishes, so do not wait for the load event.
    await page.goto(isWideProject() ? "/links" : "/home", { waitUntil: "domcontentloaded" });
    const slowCard = card(page, "느린 이미지");
    await expect(slowCard.getByTestId("link-thumbnail-image-loading")).toBeVisible();
    await expect(card(page, "빠른 이미지").getByTestId("link-thumbnail-image-loading")).toHaveCount(
      0,
    );
    const slowBox = await boxOf(slowCard);
    const fastBox = await boxOf(card(page, "빠른 이미지"));
    expect(Math.abs(slowBox.height - fastBox.height)).toBeLessThanOrEqual(1);
  });

  test("an empty list shows the existing empty message", async ({ page }) => {
    await mockApi(page, { links: [] });
    await page.goto(isWideProject() ? "/links" : "/home");
    await expect(page.getByText("아직 링크가 없어요")).toBeVisible();
    await expect(page.getByTestId("link-card")).toHaveCount(0);
  });

  test("no request goes to the Google favicon service", async ({ page }) => {
    const googleRequests: string[] = [];
    page.on("request", (request) => {
      if (request.url().includes("google.com/s2/favicons")) googleRequests.push(request.url());
    });
    await mockApi(page, { links: LINKS, details: DETAILS });
    await page.goto(isWideProject() ? "/home" : "/home");
    await expect(page.getByTestId("link-card").first()).toBeVisible();
    expect(googleRequests).toEqual([]);
  });
});
