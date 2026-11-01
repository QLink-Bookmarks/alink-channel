import { expect, test } from "@playwright/test";

import { cssOf, isWideProject } from "./support/helpers";
import { GOOD_FAVICON, makeDetail, makeLink, mockApi } from "./support/mock-api";

// #5 header icon buttons, search results without the due label, list favicons only.

test.describe("header icon buttons", () => {
  test("transparent at rest, a soft rounded square on hover, the unread count unchanged", async ({
    page,
  }) => {
    await mockApi(page, {
      handlers: {
        "GET /api/notifications/unread": (route) =>
          route.fulfill({
            contentType: "application/json",
            body: JSON.stringify({ success: true, data: { unreadCount: 3 }, error: null }),
          }),
      },
    });
    await page.goto("/home");
    const names = isWideProject() ? ["알림", "설정"] : ["검색", "알림"];
    for (const name of names) {
      const button = page.getByRole("button", { name, exact: true });
      await expect(button).toBeVisible();
      await expect
        .poll(() => cssOf(button, "background-color"), { message: name })
        .toBe("rgba(0, 0, 0, 0)");
      if (isWideProject()) {
        await button.hover();
        await expect
          .poll(() => cssOf(button, "background-color"), { message: name })
          .not.toBe("rgba(0, 0, 0, 0)");
        expect(parseFloat(await cssOf(button, "border-top-left-radius"))).toBe(12);
        await page.mouse.move(0, 0);
      }
    }
    await expect(page.getByLabel("안 읽은 알림 3개")).toBeVisible();
  });

  test("mobile back button is transparent too", async ({ page }) => {
    test.skip(isWideProject(), "mobile header");
    const link = makeLink({ id: 1 });
    await mockApi(page, { links: [link], details: { 1: makeDetail(link) } });
    await page.goto("/links/1");
    const back = page.getByRole("button", { name: "뒤로" });
    await expect(back).toBeVisible();
    expect(await cssOf(back, "background-color")).toBe("rgba(0, 0, 0, 0)");
  });
});

test.describe("search results and shortcuts", () => {
  test("link results show the stored favicon and no due date label", async ({ page }) => {
    test.skip(!isWideProject(), "the search dialog opens from the wide top bar");
    const withFavicon = makeLink({
      id: 1,
      url: "https://www.notion.so/team/onboarding",
      title: "온보딩 문서",
      thumbnailUrl: null,
      faviconUrl: GOOD_FAVICON,
      todoCounts: { open: 1, dueSoon: 1, overdue: 0, completed: 0 },
    });
    const withImage = makeLink({ id: 2, url: "https://velog.io/@a/b", title: "온보딩 회고" });
    await mockApi(page, { links: [withFavicon, withImage] });
    await page.goto("/links");
    await expect(page.getByTestId("link-card")).toHaveCount(2);
    await page.getByText("⌘/Ctrl + K").first().click();
    const input = page.getByPlaceholder("링크 · 요약 · 태그 · 폴더 검색…");
    await input.fill("온보딩");
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("온보딩 문서")).toBeVisible();
    await expect(dialog.getByText(/마감/)).toHaveCount(0);
    const images = dialog.locator("img");
    await expect(images.first()).toBeVisible();
    const sources = await images.evaluateAll((nodes) =>
      nodes.map((node) => node.getAttribute("src")),
    );
    expect(sources).toContain(GOOD_FAVICON);
    expect(sources.some((src) => src?.includes("google.com"))).toBe(false);
  });

  test("shortcut tiles use the stored favicon", async ({ page }) => {
    test.skip(!isWideProject(), "shortcut tiles are on the wide home");
    const shortcut = makeLink({
      id: 1,
      url: "https://www.notion.so/team",
      title: "노션 팀",
      thumbnailUrl: null,
      faviconUrl: GOOD_FAVICON,
      isFavorite: true,
    });
    await mockApi(page, { links: [shortcut], details: { 1: makeDetail(shortcut) } });
    await page.goto("/home");
    const tileImage = page.locator(`img[src="${GOOD_FAVICON}"]`);
    await expect(tileImage.first()).toBeVisible();
  });
});
