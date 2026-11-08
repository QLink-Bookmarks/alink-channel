import { type Locator, type Page, type Route, expect, test } from "@playwright/test";

import { cssOf, isWideProject } from "./support/helpers";
import {
  GOOD_IMAGE,
  type MockLink,
  type MockNotification,
  type MockTodo,
  envelope,
  iso,
  makeDetail,
  makeLink,
  mockApi,
  scroll,
} from "./support/mock-api";

// #11: lists keep their scroll position and filters when you leave and come back.

function buildFixtures() {
  const links: MockLink[] = [];
  for (let id = 1; id <= 30; id += 1) {
    links.push(
      makeLink({
        id,
        title: `공부 링크 ${id}`,
        folderId: 1,
        folderName: "공부",
        folderEmoji: "📚",
        isFavorite: id % 3 === 0,
      }),
    );
  }
  for (let id = 31; id <= 60; id += 1) {
    links.push(makeLink({ id, title: `가볼 곳 링크 ${id}`, folderId: 2, folderName: "가볼 곳" }));
  }
  for (let id = 61; id <= 90; id += 1) {
    links.push(makeLink({ id, title: `미분류 링크 ${id}` }));
  }
  const todos: MockTodo[] = Array.from({ length: 60 }, (_, index) => {
    const id = index + 1;
    return {
      id,
      title: `할 일 ${id}`,
      reminderAt: null,
      completedAt: id % 4 === 0 ? iso(-60_000) : null,
      linkId: 1,
      linkUrl: "https://example.com/posts/1",
      linkTitle: "공부 링크 1",
      linkThumbnailUrl: GOOD_IMAGE,
      linkFaviconUrl: null,
    };
  });
  const details = Object.fromEntries(
    links.map((link) => [
      link.id,
      makeDetail(link, {
        todos: todos
          .filter((todo) => todo.linkId === link.id)
          .map(({ id, title, reminderAt, completedAt }) => ({
            id,
            title,
            reminderAt,
            completedAt,
          })),
      }),
    ]),
  );
  const notifications: MockNotification[] = Array.from({ length: 30 }, (_, index) => {
    const id = index + 1;
    const isTodo = id % 2 === 0;
    return {
      id,
      title: isTodo ? `할 일 알림 ${id}` : `공지 ${id}`,
      message: `알림 내용 ${id}`,
      firedAt: iso(-id * 60_000),
      readAt: null,
      context: isTodo ? "TODO" : "ANNOUNCE",
      contextId: id,
    };
  });
  return { links, details, todos, notifications };
}

async function mockScreens(page: Page) {
  const { links, details, todos, notifications } = buildFixtures();
  const answerNotifications = async (route: Route) => {
    const type = new URL(route.request().url()).searchParams.get("type");
    const contents = type ? notifications.filter((item) => item.context === type) : notifications;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(scroll(contents)),
    });
  };
  return mockApi(page, {
    links,
    details,
    todos,
    handlers: {
      "GET /api/notifications": answerNotifications,
      "GET /api/notifications/unread": async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(
            envelope({ unreadCount: notifications.filter((item) => !item.readAt).length }),
          ),
        });
      },
      ...Object.fromEntries(
        notifications.map((item) => [
          `PUT /api/notifications/${item.id}/read`,
          async (route: Route) => {
            item.readAt = new Date().toISOString();
            await route.fulfill({
              status: 200,
              contentType: "application/json",
              body: JSON.stringify(envelope(null)),
            });
          },
        ]),
      ),
    },
  });
}

function linkCards(page: Page) {
  return page.getByTestId("link-card");
}

function todoCards(page: Page) {
  return page.getByTestId(/^todo-item(-overdue)?$/);
}

function notificationCards(page: Page) {
  return page.getByText(/^알림 내용 \d+$/);
}

async function findScroller(anchor: Locator) {
  return anchor.first().evaluateHandle((node) => {
    let element = node.parentElement;
    while (element) {
      const overflowY = getComputedStyle(element).overflowY;
      if (/(auto|scroll)/.test(overflowY) && element.scrollHeight > element.clientHeight) {
        return element;
      }
      element = element.parentElement;
    }
    throw new Error("no vertical scroller around the list");
  });
}

async function scrollTopOf(anchor: Locator) {
  const scroller = await findScroller(anchor);
  return scroller.evaluate((element) => Math.round(element.scrollTop));
}

async function scrollListTo(page: Page, anchor: Locator, offsetY: number) {
  const scroller = await findScroller(anchor);
  // Wait for the scroll event and the frames after it, so RN web has reported onScroll.
  await scroller.evaluate(async (element, y) => {
    if (Math.round(element.scrollTop) === y) {
      return;
    }
    const scrolled = new Promise((resolve) => {
      element.addEventListener("scroll", resolve, { once: true });
    });
    element.scrollTop = y;
    await scrolled;
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  }, offsetY);
  await expect.poll(() => scrollTopOf(anchor)).toBe(offsetY);
}

/** Passes once the list has stayed at the offset for five samples in a row. */
async function expectScrollTopToStay(anchor: Locator, offsetY: number) {
  let stableSamples = 0;
  await expect
    .poll(
      async () => {
        const isAtOffset = Math.abs((await scrollTopOf(anchor)) - offsetY) <= 2;
        stableSamples = isAtOffset ? stableSamples + 1 : 0;
        return stableSamples;
      },
      { intervals: [100], timeout: 5_000 },
    )
    .toBeGreaterThanOrEqual(5);
}

async function expectScrollTop(anchor: Locator, offsetY: number) {
  await expect(anchor.first()).toBeVisible();
  await expect
    .poll(async () => Math.abs((await scrollTopOf(anchor)) - offsetY), { timeout: 5_000 })
    .toBeLessThanOrEqual(2);
}

function chip(page: Page, label: string | RegExp) {
  return page
    .getByText(label, typeof label === "string" ? { exact: true } : undefined)
    .first()
    .locator("..");
}

function statusChip(page: Page, name: RegExp) {
  return page.getByRole("radiogroup", { name: "액션 상태" }).getByRole("radio", { name });
}

async function isChipSelected(page: Page, label: string | RegExp, unselectedLabel: string) {
  return (
    (await cssOf(chip(page, label), "background-color")) !==
    (await cssOf(chip(page, unselectedLabel), "background-color"))
  );
}

async function pressBottomTab(page: Page, label: string) {
  await page.getByText(label, { exact: true }).last().click();
}

async function pressSidebar(page: Page, label: string) {
  await page
    .getByText(new RegExp(`^(?:[^\\p{L}\\p{N}\\s]+\\s?)?${label}$`, "u"))
    .first()
    .click();
}

async function openMobileFolder(page: Page, label: string) {
  await pressBottomTab(page, "폴더");
  await expect(page).toHaveURL(/\/folders$/);
  await page.getByText(label, { exact: true }).filter({ visible: true }).first().click();
}

/** The first link card fully on screen, so pressing it does not scroll the list. */
async function cardInView(page: Page) {
  const cards = await linkCards(page).all();
  const viewport = page.viewportSize();
  for (const card of cards) {
    const box = await card.boundingBox();
    if (box && viewport && box.y >= 120 && box.y + box.height <= viewport.height - 100) {
      return card;
    }
  }
  throw new Error("no link card fully on screen");
}

async function maxScrollTopOf(anchor: Locator) {
  const scroller = await findScroller(anchor);
  return scroller.evaluate((element) => Math.round(element.scrollHeight - element.clientHeight));
}

test.describe("mobile tabs", () => {
  test.skip(() => isWideProject(), "web mobile bottom tabs");

  test("home and todos each come back where they were left", async ({ page }) => {
    await mockScreens(page);
    await page.goto("/home");
    await expect(linkCards(page)).toHaveCount(30);
    await scrollListTo(page, linkCards(page), 1500);

    await pressBottomTab(page, "액션");
    await expect(page).toHaveURL(/\/todos$/);
    await expect(todoCards(page).first()).toBeVisible();
    await scrollListTo(page, todoCards(page), 900);

    await pressBottomTab(page, "홈");
    await expect(page).toHaveURL(/\/home$/);
    await expectScrollTop(linkCards(page), 1500);

    await pressBottomTab(page, "액션");
    await expectScrollTop(todoCards(page), 900);
  });

  test("pressing the current tab keeps the position", async ({ page }) => {
    await mockScreens(page);
    await page.goto("/home");
    await expect(linkCards(page)).toHaveCount(30);
    await scrollListTo(page, linkCards(page), 1200);

    await pressBottomTab(page, "홈");
    await expect(page).toHaveURL(/\/home$/);
    await expectScrollTopToStay(linkCards(page), 1200);
  });

  test("a list left at the top comes back at the top", async ({ page }) => {
    await mockScreens(page);
    await page.goto("/home");
    await expect(linkCards(page)).toHaveCount(30);

    await pressBottomTab(page, "액션");
    await expect(todoCards(page).first()).toBeVisible();
    await pressBottomTab(page, "홈");
    await expectScrollTop(linkCards(page), 0);
  });

  test("the todo filter and its position are kept", async ({ page }) => {
    await mockScreens(page);
    await page.goto("/todos");
    await expect(todoCards(page)).toHaveCount(60);
    await statusChip(page, /^진행 중 \d+$/).click();
    await expect(todoCards(page)).toHaveCount(45);
    await scrollListTo(page, todoCards(page), 700);

    await pressBottomTab(page, "홈");
    await expect(linkCards(page).first()).toBeVisible();
    await pressBottomTab(page, "액션");

    await expect(todoCards(page)).toHaveCount(45);
    await expect(statusChip(page, /^진행 중 \d+$/)).toBeChecked();
    await expectScrollTop(todoCards(page), 700);
  });

  test("the uncategorized folder comes back where it was when reopened from the folder list", async ({
    page,
  }) => {
    await mockScreens(page);
    await page.goto("/home");
    await expect(linkCards(page)).toHaveCount(30);
    await pressBottomTab(page, "폴더");
    await page.getByText("미분류", { exact: true }).click();
    await expect(page).toHaveURL(/\/folders\/0$/);
    await expect(linkCards(page)).toHaveCount(30);
    await scrollListTo(page, linkCards(page), 1800);

    await pressBottomTab(page, "홈");
    await expect(page).toHaveURL(/\/home$/);
    await pressBottomTab(page, "폴더");
    await page.getByText("미분류", { exact: true }).click();
    await expect(page).toHaveURL(/\/folders\/0$/);
    await expectScrollTop(linkCards(page), 1800);
  });

  test("notifications keep their filter and position after going back", async ({ page }) => {
    await mockScreens(page);
    await page.goto("/home");
    await expect(linkCards(page)).toHaveCount(30);
    await page.getByRole("button", { name: "알림", exact: true }).first().click();
    await expect(page).toHaveURL(/\/notifications$/);
    await expect(notificationCards(page)).toHaveCount(30);
    await chip(page, "액션").click();
    await expect(notificationCards(page)).toHaveCount(15);
    await scrollListTo(page, notificationCards(page), 400);

    await page.getByRole("button", { name: "뒤로" }).click();
    await expect(page).toHaveURL(/\/home$/);
    await page.getByRole("button", { name: "알림", exact: true }).first().click();

    await expect(notificationCards(page)).toHaveCount(15);
    expect(await isChipSelected(page, "액션", "전체")).toBe(true);
    await expectScrollTop(notificationCards(page), 400);
  });
});

test.describe("mobile folder detail and link detail", () => {
  test.skip(() => isWideProject(), "web mobile link detail screen");

  for (const folder of [
    { label: "공부", path: /\/folders\/1$/ },
    { label: "미분류", path: /\/folders\/0$/ },
  ]) {
    test(`back from a link detail returns to ${folder.label} where it was`, async ({ page }) => {
      await mockScreens(page);
      await page.goto("/home");
      await expect(linkCards(page)).toHaveCount(30);
      await openMobileFolder(page, folder.label);
      await expect(page).toHaveURL(folder.path);
      await expect(linkCards(page)).toHaveCount(30);
      await scrollListTo(page, linkCards(page), 1200);

      const card = await cardInView(page);
      await card.getByTestId("link-card-title").click();
      await expect(page).toHaveURL(/\/links\/\d+$/);
      await expect(page.getByTestId("link-detail-title")).toBeVisible();

      await page.getByRole("button", { name: "뒤로" }).click();
      await expect(page).toHaveURL(folder.path);
      await expectScrollTop(linkCards(page), 1200);
    });
  }

  test("deleting the last link at the bottom: the folder comes back at the bottom without it", async ({
    page,
  }) => {
    await mockScreens(page);
    await page.goto("/home");
    await expect(linkCards(page)).toHaveCount(30);
    await openMobileFolder(page, "공부");
    await expect(page).toHaveURL(/\/folders\/1$/);
    await expect(linkCards(page)).toHaveCount(30);
    const bottom = await maxScrollTopOf(linkCards(page));
    await scrollListTo(page, linkCards(page), bottom);

    const lastCard = linkCards(page).last();
    await expect(lastCard).toBeInViewport();
    const lastTitle = (await lastCard.getByTestId("link-card-title").innerText()).trim();
    await lastCard.getByTestId("link-card-title").click();
    await expect(page).toHaveURL(/\/links\/\d+$/);
    await page.getByTestId("link-detail-delete").click();
    await page.getByRole("button", { name: "삭제", exact: true }).click();
    await expect(page).toHaveURL(/\/home$/);

    await openMobileFolder(page, "공부");
    await expect(page).toHaveURL(/\/folders\/1$/);
    await expect(linkCards(page)).toHaveCount(29);
    await expect(linkCards(page).filter({ hasText: lastTitle })).toHaveCount(0);
    await expect
      .poll(
        async () => (await maxScrollTopOf(linkCards(page))) - (await scrollTopOf(linkCards(page))),
      )
      .toBeLessThanOrEqual(2);
    expect(await scrollTopOf(linkCards(page))).toBeGreaterThan(0);
  });
});

test.describe("wide sidebar", () => {
  test.skip(() => !isWideProject(), "web wide sidebar");

  test("all links, a folder and uncategorized come back where they were", async ({ page }) => {
    await mockScreens(page);
    await page.goto("/links");
    await expect(linkCards(page)).toHaveCount(30);
    await scrollListTo(page, linkCards(page), 900);

    await pressSidebar(page, "공부");
    await expect(page).toHaveURL(/\/folders\/1$/);
    await expect(linkCards(page)).toHaveCount(30);
    await scrollListTo(page, linkCards(page), 700);

    await pressSidebar(page, "미분류");
    await expect(page).toHaveURL(/\/folders\/0$/);
    await expect(linkCards(page)).toHaveCount(30);
    await scrollListTo(page, linkCards(page), 500);

    await pressSidebar(page, "홈");
    await expect(page).toHaveURL(/\/home$/);

    await pressSidebar(page, "전체");
    await expectScrollTop(linkCards(page), 900);
    await pressSidebar(page, "공부");
    await expectScrollTop(linkCards(page), 700);
    await pressSidebar(page, "미분류");
    await expectScrollTop(linkCards(page), 500);
  });

  test("a folder opened for the first time starts at the top, and the other keeps its place", async ({
    page,
  }) => {
    await mockScreens(page);
    await page.goto("/folders/1");
    await expect(linkCards(page)).toHaveCount(30);
    await scrollListTo(page, linkCards(page), 800);

    await pressSidebar(page, "가볼 곳");
    await expect(page).toHaveURL(/\/folders\/2$/);
    await expect(linkCards(page).filter({ hasText: "가볼 곳 링크" })).toHaveCount(30);
    await expectScrollTop(linkCards(page), 0);

    await pressSidebar(page, "공부");
    await expect(linkCards(page).filter({ hasText: "공부 링크" })).toHaveCount(30);
    await expectScrollTop(linkCards(page), 800);
  });

  test("todos and notifications come back where they were", async ({ page }) => {
    await mockScreens(page);
    await page.goto("/todos");
    await expect(todoCards(page)).toHaveCount(60);
    await scrollListTo(page, todoCards(page), 600);

    await page.getByRole("button", { name: "알림", exact: true }).first().click();
    await expect(page).toHaveURL(/\/notifications$/);
    await expect(notificationCards(page)).toHaveCount(30);
    await scrollListTo(page, notificationCards(page), 500);

    await pressSidebar(page, "액션");
    await expect(page).toHaveURL(/\/todos$/);
    await expectScrollTop(todoCards(page), 600);

    await page.getByRole("button", { name: "알림", exact: true }).first().click();
    await expectScrollTop(notificationCards(page), 500);
  });

  test("opening and closing the detail overlay keeps the list position", async ({ page }) => {
    await mockScreens(page);
    await page.goto("/links");
    await expect(linkCards(page)).toHaveCount(30);
    await scrollListTo(page, linkCards(page), 900);

    await linkCards(page)
      .filter({ hasText: "공부 링크 20" })
      .getByTestId("link-card-title")
      .click();
    await expect(page).toHaveURL(/\/links\?linkId=20/);
    await page.getByTestId("link-detail-close").click();
    await expect(page).not.toHaveURL(/linkId=/);
    await expectScrollTop(linkCards(page), 900);
  });

  test("order and favorites-only stay selected with the position", async ({ page }) => {
    await mockScreens(page);
    await page.goto("/folders/1");
    await expect(linkCards(page)).toHaveCount(30);

    await page.getByTestId("link-filter-row-button").click();
    await page.getByRole("radio", { name: "저장일, 내림차순" }).click();
    await page.getByRole("switch", { name: "바로가기만 보기" }).click();
    await page.getByTestId("link-filter-row-button").click();
    await expect(linkCards(page)).toHaveCount(10);
    await scrollListTo(page, linkCards(page), 200);

    await pressSidebar(page, "홈");
    await expect(page).toHaveURL(/\/home$/);
    await pressSidebar(page, "공부");

    await expect(linkCards(page)).toHaveCount(10);
    await expect(page.getByTestId("link-filter-row-button")).toHaveAccessibleName(
      "정렬·필터 열기, 적용 중: 저장일 오름차순, 바로가기만",
    );
    await expectScrollTop(linkCards(page), 200);
  });

  test("an empty favorites-only folder shows the empty state again at the top", async ({
    page,
  }) => {
    await mockScreens(page);
    await page.goto("/folders/2");
    await expect(linkCards(page)).toHaveCount(30);
    await page.getByTestId("link-filter-row-button").click();
    await page.getByRole("switch", { name: "바로가기만 보기" }).click();
    await page.getByTestId("link-filter-row-button").click();
    await expect(page.getByText("조건에 맞는 링크가 없어요")).toBeVisible();
    await expect(linkCards(page)).toHaveCount(0);

    await pressSidebar(page, "홈");
    await expect(page).toHaveURL(/\/home$/);
    await pressSidebar(page, "가볼 곳");

    await expect(page.getByText("조건에 맞는 링크가 없어요")).toBeInViewport();
    await expect(linkCards(page)).toHaveCount(0);
  });
});

test("reloading the page starts lists at the top with default filters", async ({ page }) => {
  await mockScreens(page);
  await page.goto("/todos");
  await expect(todoCards(page)).toHaveCount(60);
  await statusChip(page, /^진행 중 \d+$/).click();
  await expect(todoCards(page)).toHaveCount(45);
  await scrollListTo(page, todoCards(page), 500);

  await page.reload();

  await expect(todoCards(page)).toHaveCount(60);
  await expect(statusChip(page, /^전체 \d+$/)).toBeChecked();
  await expectScrollTop(todoCards(page), 0);
});

test.describe("changes made elsewhere show up right away", () => {
  test("completing a todo in the link detail shows on the todo tab", async ({ page }) => {
    test.skip(isWideProject(), "mobile link detail screen");
    await mockScreens(page);
    await page.goto("/todos");
    await expect(todoCards(page)).toHaveCount(60);
    const title = page.getByTestId("todo-item-title").filter({ hasText: /^할 일 1$/ });
    expect(await cssOf(title, "text-decoration-line")).toBe("none");

    await pressBottomTab(page, "홈");
    await linkCards(page)
      .filter({ hasText: "공부 링크 1" })
      .first()
      .getByTestId("link-card-title")
      .click();
    await expect(page).toHaveURL(/\/links\/1$/);
    const detailTodo = page.getByTestId("link-detail-todos").getByText("할 일 1", { exact: true });
    await expect(detailTodo).toBeVisible();
    const completed = page.waitForResponse(
      (response) =>
        response.request().method() === "PUT" &&
        new URL(response.url()).pathname === "/api/todos/1/completed",
    );
    await page
      .getByTestId("link-detail-todos")
      .getByTestId(/^todo-item(-overdue)?$/)
      .filter({ has: page.getByText("할 일 1", { exact: true }) })
      .getByRole("checkbox")
      .click();
    await completed;

    await pressBottomTab(page, "액션");
    await expect(page).toHaveURL(/\/todos$/);
    await expect.poll(() => cssOf(title, "text-decoration-line")).toBe("line-through");
  });

  test("a read notification shows as read and the bell count drops", async ({ page }) => {
    test.skip(!isWideProject(), "wide header keeps the bell on every screen");
    await mockScreens(page);
    await page.goto("/notifications");
    await expect(notificationCards(page)).toHaveCount(30);
    await expect(page.getByLabel("안 읽은 알림 30개")).toBeVisible();

    await page.getByText("공지 1", { exact: true }).click();
    await expect(page).toHaveURL(/\/announcements\/1$/);
    await page.getByRole("button", { name: "알림", exact: true }).first().click();
    await expect(page).toHaveURL(/\/notifications$/);

    await expect(page.getByLabel("안 읽은 알림 29개")).toBeVisible();
    const readCard = page
      .getByText("공지 1", { exact: true })
      .locator("xpath=ancestor::*[@tabindex][1]");
    await expect.poll(() => cssOf(readCard, "opacity")).toBe("0.7");
  });
});
