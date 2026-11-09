import { expect, test } from "@playwright/test";

import { boxOf, cssOf, openedUrls, stubWindowOpen } from "./support/helpers";
import { mockApi } from "./support/mock-api";

// #97: 설정 › 앱 정보 gets an 에이링크 사용팁 row under 피드백 that opens the tips page in a new
// tab, and announcement bodies can be selected for copying.

const TIPS_URL = "https://warp-raft-63c.notion.site/ALink-Tips-412d602d12548000ab51c9da56783374";
const POST_BODY = "공지 본문 첫 문단입니다. 드래그해서 복사할 수 있어요.";

test.describe("settings 앱 정보", () => {
  test("에이링크 사용팁 sits under 피드백 and opens the tips page in a new tab", async ({
    page,
  }) => {
    await stubWindowOpen(page);
    await mockApi(page);
    await page.goto("/settings");

    const feedback = page.getByText("피드백", { exact: true }).first();
    const tips = page.getByText("에이링크 사용팁", { exact: true });
    const privacy = page.getByText("개인정보처리방침", { exact: true });
    await expect(tips).toBeVisible();
    expect((await boxOf(tips)).y).toBeGreaterThan((await boxOf(feedback)).y);
    expect((await boxOf(privacy)).y).toBeGreaterThan((await boxOf(tips)).y);

    await tips.click();
    expect(await openedUrls(page)).toEqual([TIPS_URL]);
    await expect(page).toHaveURL(/\/settings$/);
  });
});

test.describe("announcement detail", () => {
  test("the title and body can be selected and copied", async ({ page }) => {
    const json = (data: unknown) => ({
      contentType: "application/json",
      body: JSON.stringify({ success: true, data, error: null }),
    });
    const post = {
      id: 5,
      title: "2.0.0 업데이트 안내",
      author: "운영자",
      createdAt: "2026-11-09T01:00:00Z",
    };
    await mockApi(page, {
      handlers: {
        "GET /api/posts": (route) =>
          route.fulfill(
            json({ isEmpty: false, contents: [post], nextCursor: null, hasNext: false }),
          ),
        "GET /api/posts/5": (route) =>
          route.fulfill(
            json({
              ...post,
              contents: POST_BODY,
              type: "ANNOUNCEMENT",
              authorId: 1,
              imageUrls: [],
              updatedAt: post.createdAt,
            }),
          ),
      },
    });
    await page.goto("/announcements/5");

    const body = page.getByText(POST_BODY, { exact: true });
    await expect(body).toBeVisible();
    expect(await cssOf(body, "user-select")).toBe("text");
    expect(await cssOf(page.getByText(post.title, { exact: true }), "user-select")).toBe("text");

    await body.click({ clickCount: 3 });
    const selected = await page.evaluate(() => window.getSelection()?.toString() ?? "");
    expect(selected).toContain("드래그해서 복사할 수 있어요.");
  });
});
