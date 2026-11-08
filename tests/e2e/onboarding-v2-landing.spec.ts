import { type Page, expect, test } from "@playwright/test";

// #97: the 2.0.0 onboarding slides, as the web landing renders them (the native pager shows
// the same SLIDES). Five sections in order, no All Around, the AI copy says 모바일 (not 모바일
// 브라우저), the share sheet is the redesigned one (#72) and the Ask & Access section shows a
// body match: the query is in neither card title, only in the highlighted snippets.

const SUBJECTS = ["Archive", "AI", "Ask & Access", "Action", "Amigo"];
const ASK_QUERY = "주차";

async function openLanding(page: Page) {
  await page.route(
    (url) => url.pathname.startsWith("/api/") && !url.host.startsWith("localhost:"),
    (route) => route.fulfill({ status: 401, contentType: "application/json", body: "{}" }),
  );
  await page.goto("/");
  await expect(page.getByText("웹으로 시작하기").first()).toBeVisible({ timeout: 30_000 });
}

/** Scrolls the landing down one screen at a time so every section's reveal has run. */
async function scrollThrough(page: Page) {
  for (let y = 0; y < 14; y += 1) {
    await page.mouse.wheel(0, 700);
    await page.waitForTimeout(120);
  }
}

test.describe("2.0.0 landing slides", () => {
  test("shows the five subjects in order and drops All Around", async ({ page }) => {
    await openLanding(page);
    await scrollThrough(page);

    const subjects = page.getByText(/^(All Around|Archive|AI|Ask & Access|Action|Amigo)$/);
    await expect(subjects).toHaveText(SUBJECTS);
    await expect(page.getByText("All Around")).toHaveCount(0);
    await expect(page.getByText("이게 여기 있었나?")).toHaveCount(0);
  });

  test("the AI section says 모바일 and shows the redesigned share sheet", async ({ page }) => {
    await openLanding(page);
    await scrollThrough(page);

    await expect(page.getByText(/모바일에서/)).toBeVisible();
    await expect(page.getByText(/모바일 브라우저/)).toHaveCount(0);

    await expect(page.getByText("AI 옵션")).toBeVisible();
    await expect(page.getByText("Gemini · 액션 끔")).toBeVisible();
    await expect(page.getByText("그대로 보관")).toBeVisible();
    await expect(page.getByText("요약·태그까지 정리")).toBeVisible();
    await expect(page.getByText("AI 정리", { exact: true })).toBeVisible();
    await expect(page.getByText("AI 요약 저장")).toHaveCount(0);
    await expect(page.getByText("AI 자동 분류")).toHaveCount(0);
  });

  test("the Ask & Access section matches the query in the body, not the title", async ({
    page,
  }) => {
    await openLanding(page);
    await scrollThrough(page);

    const askTitle = page.getByText(/본문으로 찾아요/);
    await askTitle.scrollIntoViewIfNeeded();
    await expect(askTitle).toBeVisible();

    const snippets = page.getByTestId("link-card-snippet");
    await expect(snippets).toHaveCount(2);
    for (const snippet of await snippets.all()) {
      await expect(snippet).toContainText(ASK_QUERY);
      // The matched word is its own styled run inside the snippet.
      await expect(snippet.locator("span", { hasText: ASK_QUERY }).first()).toBeVisible();
    }

    const titles = page.getByTestId("link-card-title");
    for (const title of await titles.all()) {
      await expect(title).not.toContainText(ASK_QUERY);
    }
  });
});
