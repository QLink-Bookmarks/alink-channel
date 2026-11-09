import { type Page, expect, test } from "@playwright/test";

import { boxOf, cssOf, isWideProject, openedUrls, stubWindowOpen } from "./support/helpers";
import {
  BROKEN_IMAGE,
  GOOD_IMAGE,
  HOUR_MS,
  type MockDetail,
  type MockLink,
  TALL_IMAGE,
  countTodos,
  iso,
  makeDetail,
  makeLink,
  mockApi,
} from "./support/mock-api";

// #5 link detail: order, image cell, icon actions, refresh, todos, closing.

const DETAIL_TODOS = [
  { id: 11, title: "토요일 2시 방문", reminderAt: iso(-2 * HOUR_MS), completedAt: null },
  { id: 12, title: "예약 확인", reminderAt: iso(23 * HOUR_MS), completedAt: null },
  { id: 13, title: "사진 정리", reminderAt: null, completedAt: iso(-HOUR_MS) },
];

function buildFixtures() {
  const video = makeLink({
    id: 1,
    url: "https://www.youtube.com/watch?v=r3gesture",
    title: "Reanimated 3로 만드는 60fps 제스처 애니메이션",
    thumbnailUrl: GOOD_IMAGE,
    isVideo: true,
    folderId: 1,
    folderName: "공부",
    folderEmoji: "📚",
    tags: ["React Native"],
    todoCounts: countTodos(DETAIL_TODOS),
  });
  const tall = makeLink({
    id: 2,
    url: "https://www.instagram.com/reel/C9seongsu",
    title: "성수동 카페 투어 5곳",
    thumbnailUrl: TALL_IMAGE,
    isVideo: true,
  });
  const noImage = makeLink({
    id: 3,
    url: "https://www.notion.so/team/onboarding",
    title: "2026 하반기 팀 온보딩 문서",
    thumbnailUrl: null,
    faviconUrl: null,
    status: "G",
    workModel: null,
  });
  const broken = makeLink({
    id: 4,
    url: "https://brunch.co.kr/@writer/128",
    title: "기록하는 습관이 바꾼 것들",
    thumbnailUrl: BROKEN_IMAGE,
  });
  const shared = makeLink({
    id: 5,
    url: "https://ohou.se/projects/camping",
    title: "주말 캠핑 준비물",
    folderId: 9,
    folderName: "캠핑 모임 공유 폴더 이름이 아주 길어서 버튼 줄을 넘칠 수도 있는 경우",
    folderEmoji: "🏕️",
  });
  const links: MockLink[] = [video, tall, noImage, broken, shared];
  const details: Record<number, MockDetail> = {
    1: makeDetail(video, { memo: "12분부터 핵심 예제", todos: DETAIL_TODOS }),
    2: makeDetail(tall),
    3: makeDetail(noImage, { summary: null }),
    4: makeDetail(broken),
    5: makeDetail(shared),
  };
  return { links, details };
}

async function openDetail(page: Page, id: number) {
  await page.goto(isWideProject() ? `/links?linkId=${id}` : `/links/${id}`);
  await expect(page.getByTestId("link-detail-title")).toBeVisible();
  if (isWideProject()) {
    // Wait for the panel's slide-in to finish before measuring or pressing.
    await expect(page.getByTestId("link-detail-close")).toBeInViewport({ ratio: 1 });
  }
}

function editSheet(page: Page) {
  return page.getByRole("slider", { name: "Bottom Sheet" });
}

async function settledSheetBox(page: Page) {
  let previous = await editSheet(page).boundingBox();
  let steadyReads = 0;
  await expect
    .poll(
      async () => {
        const current = await editSheet(page).boundingBox();
        const viewportHeight = page.viewportSize()?.height ?? 0;
        const isSteady =
          current !== null &&
          previous !== null &&
          current.y < viewportHeight - 40 &&
          current.y === previous.y;
        steadyReads = isSteady ? steadyReads + 1 : 0;
        previous = current;
        return steadyReads >= 2;
      },
      { intervals: [250] },
    )
    .toBe(true);
  if (!previous) throw new Error("the sheet is not on screen");
  return previous;
}

async function dragSheetDown(page: Page) {
  const box = await settledSheetBox(page);
  const x = box.x + box.width / 2;
  const y = box.y - 14;
  await page.mouse.move(x, y);
  await page.mouse.down();
  for (let step = 1; step <= 12; step += 1) {
    await page.mouse.move(x, y + step * 40);
  }
  await page.mouse.up();
}

async function tapAboveSheet(page: Page) {
  await settledSheetBox(page);
  await page
    .getByRole("button", { name: "Bottom sheet backdrop" })
    .click({ position: { x: 195, y: 40 } });
}

test.describe("layout", () => {
  test("top to bottom: toolbar, image, title and source, AI surface, 내 정리 rows, delete; no URL line or button row", async ({
    page,
  }) => {
    const { links, details } = buildFixtures();
    await mockApi(page, { links, details });
    await openDetail(page, 1);
    const order = [
      ...(isWideProject() ? ["link-detail-toolbar"] : []),
      "link-detail-image",
      "link-detail-title",
      "link-detail-meta",
      "link-detail-summary",
      "link-detail-folder-row",
      "link-detail-tags",
      "link-detail-memo",
      "link-detail-todos",
      "link-detail-delete",
    ];
    let previous = -Infinity;
    for (const id of order) {
      const box = await boxOf(page.getByTestId(id));
      expect(box.y, id).toBeGreaterThan(previous);
      previous = box.y;
    }
    await expect(page.getByTestId("link-detail-refresh")).toBeVisible();
    const detail = page.getByTestId("link-detail");
    await expect(page.getByTestId("link-detail-url")).toHaveCount(0);
    await expect(page.getByTestId("link-detail-actions")).toHaveCount(0);
    await expect(detail.getByText(links[0].url, { exact: true })).toHaveCount(0);
    await expect(detail.getByText("원본 열기", { exact: true })).toHaveCount(0);
    await expect(detail.getByText("#React Native", { exact: true })).toBeVisible();
    await expect(page.getByTestId("link-detail-meta")).toContainText("youtube.com");
  });

  test("landscape and tall images share one 16:9 cell, a missing image is a low 120px fallback, and the toolbar is on the first screen", async ({
    page,
  }) => {
    const { links, details } = buildFixtures();
    await mockApi(page, { links, details });
    const sizes: { width: number; height: number }[] = [];
    for (const id of [1, 2]) {
      await openDetail(page, id);
      const cell = page.getByTestId("link-detail-image");
      await expect(cell.getByTestId("link-detail-thumbnail-image")).toBeVisible();
      sizes.push(await boxOf(cell));
      await expect(page.getByTestId("link-detail-toolbar")).toBeInViewport();
    }
    expect(Math.abs(sizes[1].width - sizes[0].width)).toBeLessThanOrEqual(1);
    expect(Math.abs(sizes[1].height - sizes[0].height)).toBeLessThanOrEqual(1);
    if (isWideProject()) {
      expect(sizes[0].height).toBeLessThanOrEqual(242);
    } else {
      expect(sizes[0].width / sizes[0].height).toBeCloseTo(16 / 9, 1);
    }
    await openDetail(page, 3);
    const low = await boxOf(page.getByTestId("link-detail-image"));
    expect(Math.round(low.height)).toBeLessThanOrEqual(122);
    expect(Math.round(low.height)).toBeGreaterThanOrEqual(118);
    expect(Math.abs(low.width - sizes[0].width)).toBeLessThanOrEqual(1);
  });

  test("a tall image fits inside the cell instead of being stretched or cropped", async ({
    page,
  }) => {
    const { links, details } = buildFixtures();
    await mockApi(page, { links, details });
    await openDetail(page, 2);
    const image = page.getByTestId("link-detail-thumbnail-image");
    await expect(image).toBeVisible();
    await expect.poll(() => cssOf(image.locator("img").first(), "object-fit")).toBe("contain");
  });

  test("missing or broken images show the domain only", async ({ page }) => {
    const { links, details } = buildFixtures();
    await mockApi(page, { links, details });
    for (const [id, domain] of [
      [3, "notion.so"],
      [4, "brunch.co.kr"],
    ] as const) {
      await openDetail(page, id);
      const fallback = page.getByTestId("link-detail-thumbnail-fallback");
      await expect(fallback.getByText(domain, { exact: true })).toBeVisible();
      await expect(fallback.locator("img")).toHaveCount(0);
    }
  });

  test("a play icon for video links and a small faint hand on other images; the low fallback of a missing image has none (#46, #74)", async ({
    page,
  }) => {
    const { links, details } = buildFixtures();
    await mockApi(page, { links, details });
    await openDetail(page, 1);
    await expect(page.getByTestId("link-thumbnail-hint-play")).toBeVisible();
    await expect(page.getByTestId("link-thumbnail-hint-play")).toHaveText("");
    await expect(page.getByTestId("link-thumbnail-hint-open")).toHaveCount(0);
    await openDetail(page, 5);
    await expect(page.getByTestId("link-detail-thumbnail-image")).toBeVisible();
    await expect(page.getByTestId("link-thumbnail-hint-play")).toHaveCount(0);
    const hand = page.getByTestId("link-thumbnail-hint-open");
    await expect(hand).toBeVisible();
    await expect(hand).toHaveText("");
    const look = await hand.evaluate((node) => {
      const circle = node.firstElementChild as HTMLElement;
      const icon = node.querySelector("svg");
      const frame = node.parentElement?.getBoundingClientRect();
      const box = circle.getBoundingClientRect();
      return {
        size: box.width,
        circleBackground: getComputedStyle(circle).backgroundColor,
        iconColor: icon ? getComputedStyle(icon).color : "",
        centered: frame
          ? Math.abs(box.left + box.width / 2 - (frame.left + frame.width / 2)) <= 1 &&
            Math.abs(box.top + box.height / 2 - (frame.top + frame.height / 2)) <= 1
          : false,
      };
    });
    expect(look.size).toBeGreaterThanOrEqual(30);
    expect(look.size).toBeLessThanOrEqual(40);
    expect(look.centered).toBe(true);
    const alphaOf = (value: string) => {
      const numbers = value.match(/[\d.]+/g)?.map(Number) ?? [];
      return numbers.length > 3 ? numbers[3] : 1;
    };
    expect(alphaOf(look.circleBackground)).toBeLessThan(0.9);
    expect(alphaOf(look.iconColor)).toBeLessThan(1);
    await openDetail(page, 3);
    const fallback = page.getByTestId("link-detail-thumbnail-fallback");
    await expect(fallback.getByText("notion.so", { exact: true })).toBeVisible();
    await expect(page.getByTestId("link-thumbnail-hint-play")).toHaveCount(0);
    await expect(fallback.getByTestId("link-thumbnail-hint-open")).toHaveCount(0);
  });

  test("hovering the image shows 원본 열기 (#46)", async ({ page }) => {
    test.skip(!isWideProject(), "hover label is for the wide pointer");
    const { links, details } = buildFixtures();
    await mockApi(page, { links, details });
    await openDetail(page, 5);
    await page.getByTestId("link-detail-image").hover();
    await expect(page.getByText("원본 열기", { exact: true }).last()).toBeVisible();
  });

  test("pressing the image opens the original and the same detail stays", async ({ page }) => {
    await stubWindowOpen(page);
    const { links, details } = buildFixtures();
    await mockApi(page, { links, details });
    await openDetail(page, 1);
    const before = page.url();
    await page.getByTestId("link-detail-image").click();
    expect(await openedUrls(page)).toEqual([links[0].url]);
    expect(page.url()).toBe(before);
    await expect(page.getByTestId("link-detail-title")).toContainText("Reanimated 3");
  });
});

test("pressing the hand in the middle of the image still opens the original (#46)", async ({
  page,
}) => {
  await stubWindowOpen(page);
  const { links, details } = buildFixtures();
  await mockApi(page, { links, details });
  await openDetail(page, 5);
  const hand = page.getByTestId("link-thumbnail-hint-open");
  await expect(hand).toBeVisible();
  const box = await boxOf(hand);
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  expect(await openedUrls(page)).toEqual([links[4].url]);
});

test("pressing the low fallback of a missing image opens the original (#46)", async ({ page }) => {
  await stubWindowOpen(page);
  const { links, details } = buildFixtures();
  await mockApi(page, { links, details });
  await openDetail(page, 3);
  const fallback = page.getByTestId("link-detail-thumbnail-fallback");
  await expect(fallback).toBeVisible();
  await fallback.click();
  expect(await openedUrls(page)).toEqual([links[2].url]);
});

test.describe("actions", () => {
  test("the toolbar reads ★, 공유, 수정, 새로고침 in one row, with 닫기 at the end in the wide panel; 링크 삭제 sits at the bottom in red", async ({
    page,
  }) => {
    const { links, details } = buildFixtures();
    await mockApi(page, { links, details });
    await openDetail(page, 1);
    const toolbar = page.getByTestId("link-detail-toolbar");
    const names = ["바로가기 추가", "공유", "수정", "새로고침"];
    let previousX = -Infinity;
    const top = (await boxOf(toolbar.getByRole("button", { name: names[0] }))).y;
    for (const name of names) {
      const button = toolbar.getByRole("button", { name, exact: true });
      const box = await boxOf(button);
      expect(box.x, name).toBeGreaterThan(previousX);
      expect(Math.abs(box.y - top), name).toBeLessThanOrEqual(1);
      previousX = box.x;
    }
    await expect(toolbar.getByRole("button", { name: "바로가기 추가" })).toHaveText("");
    for (const name of names.slice(1)) {
      await expect(toolbar.getByRole("button", { name, exact: true })).toHaveText(name);
    }
    if (isWideProject()) {
      const close = await boxOf(toolbar.getByRole("button", { name: "닫기" }));
      expect(close.x).toBeGreaterThan(previousX);
    } else {
      await expect(page.getByRole("button", { name: "뒤로" })).toBeVisible();
      await expect(page.getByRole("button", { name: "닫기" })).toHaveCount(0);
    }
    await expect(page.getByRole("button", { name: "수정하기" })).toHaveCount(0);
    const deleteButton = page.getByRole("button", { name: "링크 삭제" });
    await expect(deleteButton).toHaveText("링크 삭제");
    expect((await boxOf(deleteButton)).y).toBeGreaterThan(
      (await boxOf(page.getByTestId("link-detail-todos"))).y,
    );
    const color = await cssOf(deleteButton.locator("svg"), "color");
    const [red, green, blue] = color.match(/\d+/g)!.map(Number);
    expect(red, color).toBeGreaterThanOrEqual(150);
    expect(Math.max(green, blue), color).toBeLessThanOrEqual(red / 3);
  });

  test("a link in a shared folder shows add to personal folder instead of edit, and a long folder name stays inside its row", async ({
    page,
  }) => {
    const { links, details } = buildFixtures();
    await mockApi(page, { links, details });
    await openDetail(page, 5);
    const toolbar = page.getByTestId("link-detail-toolbar");
    await expect(toolbar.getByRole("button", { name: "개인 폴더로 추가" })).toBeVisible();
    await expect(toolbar.getByRole("button", { name: "수정", exact: true })).toHaveCount(0);
    const toolbarBox = await boxOf(toolbar);
    for (const button of await toolbar.getByRole("button").all()) {
      const box = await boxOf(button);
      expect(
        Math.abs(box.y + box.height / 2 - (toolbarBox.y + toolbarBox.height / 2)),
      ).toBeLessThanOrEqual(1);
      expect(box.x + box.width).toBeLessThanOrEqual((page.viewportSize()?.width ?? 0) + 1);
    }
    const row = page.getByTestId("link-detail-folder-row");
    const rowBox = await boxOf(row);
    const name = await boxOf(page.getByTestId("link-detail-folder-name"));
    expect(name.x + name.width).toBeLessThanOrEqual(rowBox.x + rowBox.width);
    const pencil = await boxOf(row.getByRole("button", { name: "폴더 이동" }));
    expect(pencil.x).toBeGreaterThanOrEqual(name.x + name.width - 1);
  });

  test("hovering the star shows 바로가기; the other commands carry their names", async ({
    page,
  }) => {
    test.skip(!isWideProject(), "hover is wide only");
    const { links, details } = buildFixtures();
    await mockApi(page, { links, details });
    await openDetail(page, 1);
    await page.getByTestId("link-detail-favorite").hover();
    await expect(page.getByRole("tooltip", { name: "바로가기" })).toHaveCount(1);
    await expect(page.getByTestId("link-detail-share")).toHaveText("공유");
  });

  test("summary shows the provider and model next to its heading, and a missing summary leaves no placeholder", async ({
    page,
  }) => {
    const { links, details } = buildFixtures();
    await mockApi(page, { links, details });
    await openDetail(page, 1);
    const summary = page.getByTestId("link-detail-summary");
    const heading = await boxOf(summary.getByText("한 줄 요약", { exact: true }));
    const model = page.getByTestId("link-detail-summary-model");
    await expect(model).toContainText("OpenAI");
    await expect(model).toContainText("gpt-4o-mini");
    await expect(model.getByTestId("ai-provider-logo-openai")).toBeVisible();
    const modelBox = await boxOf(model.getByText("gpt-4o-mini", { exact: true }));
    expect(Math.abs(modelBox.y - heading.y)).toBeLessThan(8);
    await openDetail(page, 3);
    await expect(page.getByTestId("link-detail-summary")).toHaveCount(0);
    await expect(page.getByText("요약이 아직 없어요")).toHaveCount(0);
  });

  test("toggling the shortcut changes the detail star and the card star together", async ({
    page,
  }) => {
    test.skip(!isWideProject(), "the card stays visible behind the wide overlay");
    const { links, details } = buildFixtures();
    await mockApi(page, { links, details });
    await openDetail(page, 2);
    const cardStar = page
      .getByTestId("link-card")
      .filter({ hasText: "성수동 카페 투어" })
      .getByTestId("link-card-favorite");
    await expect(cardStar).toHaveAttribute("aria-label", "바로가기 추가");
    await page.getByTestId("link-detail-favorite").click();
    await expect(page.getByTestId("link-detail-favorite")).toHaveAttribute(
      "aria-label",
      "바로가기 해제",
    );
    await expect(cardStar).toHaveAttribute("aria-label", "바로가기 해제");
  });

  test("adding a tag shows it with # in the detail and the card, and the PUT keeps the image, favicon and video flag", async ({
    page,
  }) => {
    const { links, details } = buildFixtures();
    const state = await mockApi(page, { links, details });
    await openDetail(page, 1);
    const tagsSection = page.getByTestId("link-detail-tags");
    await tagsSection.getByRole("button", { name: "태그 편집" }).click();
    await tagsSection.getByPlaceholder("태그").fill("새태그");
    await tagsSection.getByPlaceholder("태그").press("Enter");
    await expect(page.getByTestId("link-detail-tags").getByText("#새태그")).toBeVisible();

    const put = state.requests.find((r) => r.method === "PUT" && r.path === "/api/links/1");
    expect(put?.body).toMatchObject({
      thumbnailUrl: GOOD_IMAGE,
      faviconUrl: null,
      isVideo: true,
      tags: ["React Native", "새태그"],
    });
    // The detail keeps showing the image and the video icon after the update.
    await expect(page.getByTestId("link-detail-thumbnail-image")).toBeVisible();
    await expect(page.getByTestId("link-thumbnail-hint-play")).toBeVisible();

    if (isWideProject()) {
      const card = page.getByTestId("link-card").filter({ hasText: "Reanimated 3" });
      await expect(card.getByText("#새태그")).toBeVisible();
      await expect(card.getByTestId("link-thumbnail-image")).toBeVisible();
    }
  });

  test("deleting closes the detail and removes the card", async ({ page }) => {
    const { links, details } = buildFixtures();
    await mockApi(page, { links, details });
    await openDetail(page, 4);
    await page.getByTestId("link-detail-delete").click();
    await page.getByRole("button", { name: "삭제", exact: true }).click();
    await expect(page.getByTestId("link-detail")).toHaveCount(0);
    if (!isWideProject()) {
      await page.goto("/home");
    }
    await expect(page.getByTestId("link-card").first()).toBeVisible();
    await expect(page.getByTestId("link-card").filter({ hasText: "기록하는 습관" })).toHaveCount(0);
  });
});

test.describe("todos in the detail", () => {
  test("todos sit in one full-width column under the 액션 label with + 추가 at its right, without the link row", async ({
    page,
  }) => {
    const { links, details } = buildFixtures();
    await mockApi(page, { links, details });
    await openDetail(page, 1);
    const section = page.getByTestId("link-detail-todos");
    const cards = section.getByTestId(/^todo-item(-overdue)?$/);
    await expect(cards).toHaveCount(3);
    await expect(section.getByText(/액션 \d+개/)).toHaveCount(0);
    await expect(section.getByText("+ 액션 추가 / 수정")).toHaveCount(0);
    await expect(page.getByTestId("link-detail-todo-grid")).toHaveCount(0);
    await expect(section.getByTestId("todo-item-link")).toHaveCount(0);
    const label = await boxOf(section.getByText("액션", { exact: true }));
    const add = await boxOf(section.getByRole("button", { name: "액션 추가" }));
    expect(Math.abs(add.y + add.height / 2 - (label.y + label.height / 2))).toBeLessThanOrEqual(2);
    const sectionBox = await boxOf(section);
    expect(Math.abs(add.x + add.width - 8 - (sectionBox.x + sectionBox.width))).toBeLessThanOrEqual(
      1,
    );
    const boxes = await cards.evaluateAll((nodes) =>
      nodes.map((node) => {
        const box = node.getBoundingClientRect();
        return { x: box.x, y: box.y, width: box.width, bottom: box.bottom };
      }),
    );
    for (const [index, box] of boxes.entries()) {
      expect(Math.abs(box.x - sectionBox.x)).toBeLessThanOrEqual(1);
      expect(Math.abs(box.width - sectionBox.width)).toBeLessThanOrEqual(1);
      if (index > 0) expect(Math.round(box.y - boxes[index - 1].bottom)).toBe(8);
    }
  });

  test("completing a todo in the detail updates the card's todo counts", async ({ page }) => {
    test.skip(!isWideProject(), "the card stays visible behind the wide overlay");
    const { links, details } = buildFixtures();
    await mockApi(page, { links, details });
    await openDetail(page, 1);
    const badge = page
      .getByTestId("link-card")
      .filter({ hasText: "Reanimated 3" })
      .getByTestId("todo-count-badge");
    await expect(badge).toHaveAttribute("aria-label", "임박 1개, 기한 지남 1개");
    await page
      .getByTestId("link-detail-todos")
      .getByTestId(/^todo-item(-overdue)?$/)
      .filter({ hasText: "예약 확인" })
      .getByRole("checkbox")
      .click();
    await expect(badge).toHaveAttribute("aria-label", "기한 지남 1개");
  });
});

test.describe("refresh", () => {
  test("spins and locks until done, runs once however often it is pressed", async ({ page }) => {
    const { links, details } = buildFixtures();
    let release: () => void = () => {};
    let detailGets = 0;
    let blockNext = false;
    const state = await mockApi(page, {
      links,
      details,
      handlers: {
        "GET /api/links/1": async (route) => {
          detailGets += 1;
          if (blockNext) {
            blockNext = false;
            await new Promise<void>((resolve) => {
              release = resolve;
            });
          }
          await route.fulfill({
            contentType: "application/json",
            body: JSON.stringify({ success: true, data: state.details[1], error: null }),
          });
        },
      },
    });
    await openDetail(page, 1);
    const refresh = page.getByTestId("link-detail-refresh");
    await expect.poll(() => detailGets).toBeGreaterThan(0);
    const getsBeforeRefresh = detailGets;
    blockNext = true;
    await refresh.click();
    await expect(refresh).toHaveAttribute("aria-label", "새로고침 중");
    await expect(refresh).toBeDisabled();
    await refresh.click({ force: true });
    await refresh.click({ force: true });
    const spinning = await refresh
      .locator("svg")
      .evaluate((node) => getComputedStyle(node.parentElement as Element).transform);
    expect(spinning).not.toBe("none");
    release();
    await expect(refresh).toHaveAttribute("aria-label", "새로고침");
    await expect(refresh).toBeEnabled();
    expect(detailGets).toBe(getsBeforeRefresh + 1);
  });

  test("a failed refresh stops spinning, keeps the content, shows a toast and turns red until a later success", async ({
    page,
  }) => {
    test.setTimeout(90_000);
    const { links, details } = buildFixtures();
    let failing = false;
    const state = await mockApi(page, {
      links,
      details,
      handlers: {
        "GET /api/links/1": async (route) => {
          if (failing) {
            await route.fulfill({ status: 500, body: "{}" });
            return;
          }
          await route.fulfill({
            contentType: "application/json",
            body: JSON.stringify({ success: true, data: state.details[1], error: null }),
          });
        },
      },
    });
    await openDetail(page, 1);
    const refresh = page.getByTestId("link-detail-refresh");
    const normalColor = await cssOf(refresh.locator("svg"), "color");
    // Pointer away from the button, so hover does not tint the icon when it is read.
    const restColor = async () => {
      await page.mouse.move(1, 1);
      return cssOf(refresh.locator("svg"), "color");
    };
    failing = true;
    await refresh.click();
    // React Query retries three times before giving up.
    await expect(page.getByText("새로고침에 실패했어요.")).toBeVisible({ timeout: 30_000 });
    await expect(refresh).toHaveAttribute("aria-label", "새로고침 실패, 다시 시도");
    await expect(refresh).toBeEnabled();
    await expect(page.getByTestId("link-detail-title")).toContainText("Reanimated 3");
    const failedColor = await restColor();
    expect(failedColor).not.toBe(normalColor);

    failing = false;
    await refresh.click();
    await expect(refresh).toHaveAttribute("aria-label", "새로고침");
    expect(await restColor()).toBe(normalColor);
  });
});

test.describe("open and close", () => {
  test("a missing link shows the existing not-found message", async ({ page }) => {
    test.setTimeout(60_000);
    const { links, details } = buildFixtures();
    await mockApi(page, { links, details });
    await page.goto(isWideProject() ? "/links?linkId=999" : "/links/999");
    await expect(page.getByText("찾으시는 링크가 없어요")).toBeVisible({ timeout: 30_000 });
  });

  test("a direct address or a reload opens the same detail", async ({ page }) => {
    const { links, details } = buildFixtures();
    await mockApi(page, { links, details });
    await openDetail(page, 4);
    await page.reload();
    await expect(page.getByTestId("link-detail-title")).toContainText("기록하는 습관");
  });

  test("wide: Esc, the dimmed backdrop and the close button close it and the list stays", async ({
    page,
  }) => {
    test.skip(!isWideProject(), "wide overlay");
    const { links, details } = buildFixtures();
    await mockApi(page, { links, details });
    const close = async (how: "esc" | "backdrop" | "button") => {
      await page.goto("/links");
      await page
        .getByTestId("link-card")
        .filter({ hasText: "기록하는 습관" })
        .getByTestId("link-card-title")
        .click();
      await expect(page.getByTestId("link-detail")).toBeVisible();
      // Wait for the slide-in to finish before pressing anything on the panel.
      await expect(page.getByTestId("link-detail-close")).toBeInViewport({ ratio: 1 });
      if (how === "esc") await page.keyboard.press("Escape");
      if (how === "backdrop") await page.mouse.click(300, 400);
      if (how === "button") await page.getByTestId("link-detail-close").click();
      await expect(page.getByTestId("link-detail"), `closed by ${how}`).toHaveCount(0);
      await expect(page).toHaveURL(/\/links$/);
      await expect(page.getByTestId("link-card")).toHaveCount(links.length);
    };
    await close("esc");
    await close("backdrop");
    await close("button");
  });

  test("wide: the detail panel and the cards have no shadow", async ({ page }) => {
    test.skip(!isWideProject(), "wide overlay");
    const { links, details } = buildFixtures();
    await mockApi(page, { links, details });
    await openDetail(page, 1);
    const panel = page.getByTestId("link-detail").locator("xpath=..");
    expect(await cssOf(panel, "box-shadow")).toBe("none");
    const cards = page.getByTestId("link-card");
    for (const node of await cards.all()) {
      expect(await cssOf(node, "box-shadow")).toBe("none");
    }
  });

  test("mobile: the header shows back and the link title, and back returns to the list", async ({
    page,
  }) => {
    test.skip(isWideProject(), "mobile screen");
    const { links, details } = buildFixtures();
    await mockApi(page, { links, details });
    await page.goto("/home");
    await page
      .getByTestId("link-card")
      .filter({ hasText: "기록하는 습관" })
      .getByTestId("link-card-title")
      .click();
    await expect(page).toHaveURL(/\/links\/4$/);
    await expect(page.getByRole("button", { name: "뒤로" })).toBeVisible();
    await expect(page.getByText("기록하는 습관이 바꾼 것들").first()).toBeVisible();
    await page.getByRole("button", { name: "뒤로" }).click();
    await expect(page).toHaveURL(/\/home$/);
    await expect(page.getByTestId("link-card").first()).toBeVisible();
  });
});

test.describe("todo cards and saving edits (#27)", () => {
  test("a long todo title wraps inside its full-width card", async ({ page }) => {
    const { links, details } = buildFixtures();
    const link = links[0];
    const longTodos = [
      {
        id: 21,
        title: "토요일 2시 방문 전에 예약 확인하고 주차 가능 여부와 대기 시간까지 미리 알아보기",
        reminderAt: iso(-2 * HOUR_MS),
        completedAt: null,
      },
      { id: 22, title: "예약 확인", reminderAt: null, completedAt: null },
    ];
    await mockApi(page, {
      links,
      details: { ...details, [link.id]: { ...details[link.id], todos: longTodos } },
    });
    await openDetail(page, 1);
    const section = page.getByTestId("link-detail-todos");
    const cards = section.getByTestId(/^todo-item(-overdue)?$/);
    await expect(cards).toHaveCount(2);
    const sectionBox = await boxOf(section);
    const [first, second] = await cards.evaluateAll((nodes) =>
      nodes.map((node) => node.getBoundingClientRect().toJSON() as DOMRect),
    );
    expect(first.height).toBeGreaterThan(second.height);
    expect(Math.abs(first.width - sectionBox.width)).toBeLessThanOrEqual(1);
    expect(first.right).toBeLessThanOrEqual(sectionBox.x + sectionBox.width + 1);
  });

  test("after a keyboard press, the hover name comes back when focus returns to the button", async ({
    page,
  }) => {
    test.skip(!isWideProject(), "hover names on the wide panel");
    const { links, details } = buildFixtures();
    await mockApi(page, { links, details });
    await openDetail(page, 1);
    const favorite = page.getByTestId("link-detail-favorite");
    const share = page.getByTestId("link-detail-share");
    await favorite.focus();
    await expect(page.getByRole("tooltip", { name: "바로가기" })).toHaveCount(1);
    await page.keyboard.press("Enter");
    await expect(favorite).toHaveAttribute("aria-label", "바로가기 해제");
    await share.focus();
    await expect(page.getByRole("tooltip")).toHaveCount(0);
    await favorite.focus();
    await expect(page.getByRole("tooltip", { name: "바로가기" })).toHaveCount(1);
  });

  test("after discarding the unsaved-changes prompt, 수정 opens the sheet again with the saved text", async ({
    page,
  }) => {
    test.skip(isWideProject(), "the edit sheet on mobile");
    const { links, details } = buildFixtures();
    await mockApi(page, { links, details });
    await openDetail(page, 1);
    const prompt = page.getByRole("dialog", { name: "저장하지 않은 변경사항이 있어요" });
    const title = page.getByPlaceholder("링크 제목");

    await page.getByTestId("link-detail-edit").click();
    await title.fill("고친 제목");
    await settledSheetBox(page);
    await page
      .getByRole("button", { name: "Bottom sheet backdrop" })
      .click({ position: { x: 195, y: 40 } });
    await expect(prompt).toBeVisible();
    await page.getByRole("button", { name: "저장 안 함" }).click();
    await expect(title).toHaveCount(0);

    await page.getByTestId("link-detail-edit").click();
    await settledSheetBox(page);
    await expect(title).toHaveValue(details[1].title);
    await page.waitForTimeout(1000);
    await expect(title).toBeInViewport();
  });

  test("tapping outside the dirty edit sheet asks first, Escape keeps editing on screen, and 수정 opens the sheet again after discarding", async ({
    page,
  }) => {
    test.skip(isWideProject(), "the edit sheet on mobile");
    const { links, details } = buildFixtures();
    await mockApi(page, { links, details });
    await openDetail(page, 1);
    const prompt = page.getByRole("dialog", { name: "저장하지 않은 변경사항이 있어요" });
    const title = page.getByPlaceholder("링크 제목");

    await page.getByTestId("link-detail-edit").click();
    await title.fill("고친 제목");
    await tapAboveSheet(page);
    await expect(prompt).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(prompt).toHaveCount(0);
    await settledSheetBox(page);
    await expect(title).toHaveValue("고친 제목");
    await expect(title).toBeInViewport();

    await tapAboveSheet(page);
    await expect(prompt).toBeVisible();
    await page.getByRole("button", { name: "저장 안 함" }).click();
    await expect(title).toHaveCount(0);
    await page.getByTestId("link-detail-edit").click();
    await settledSheetBox(page);
    await expect(title).toHaveValue(details[1].title);
    await page.waitForTimeout(1000);
    await expect(title).toBeInViewport();
  });

  test("dragging down the dirty edit sheet asks first, Escape keeps editing on screen, and 수정 opens the sheet again after discarding", async ({
    page,
  }) => {
    test.skip(isWideProject(), "the edit sheet on mobile");
    const { links, details } = buildFixtures();
    await mockApi(page, { links, details });
    await openDetail(page, 1);
    const prompt = page.getByRole("dialog", { name: "저장하지 않은 변경사항이 있어요" });
    const title = page.getByPlaceholder("링크 제목");

    await page.getByTestId("link-detail-edit").click();
    await title.fill("고친 제목");
    await dragSheetDown(page);
    await expect(prompt).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(prompt).toHaveCount(0);
    await settledSheetBox(page);
    await expect(title).toHaveValue("고친 제목");
    await expect(title).toBeInViewport();

    await dragSheetDown(page);
    await expect(prompt).toBeVisible();
    await page.getByRole("button", { name: "저장 안 함" }).click();
    await expect(title).toHaveCount(0);
    await page.getByTestId("link-detail-edit").click();
    await settledSheetBox(page);
    await expect(title).toHaveValue(details[1].title);
    await page.waitForTimeout(1000);
    await expect(title).toBeInViewport();
  });

  test("pressing save twice quickly saves once and shows one message", async ({ page }) => {
    const { links, details } = buildFixtures();
    const state = await mockApi(page, { links, details });
    await page.route("**/api/links/1", async (route) => {
      if (route.request().method() === "PUT") {
        await new Promise((resolve) => setTimeout(resolve, 400));
      }
      await route.fallback();
    });
    await openDetail(page, 1);
    await page.getByTestId("link-detail-edit").click();
    const title = page.getByPlaceholder("링크 제목");
    await title.fill("새 제목");
    await page.getByRole("button", { name: "저장", exact: true }).dblclick();
    await expect(page.getByText("수정했어요.").first()).toBeVisible();
    await page.waitForTimeout(800);
    expect(
      state.requests.filter((r) => r.method === "PUT" && r.path === "/api/links/1"),
    ).toHaveLength(1);
    await expect(page.getByText("수정했어요.")).toHaveCount(1);
  });
});
