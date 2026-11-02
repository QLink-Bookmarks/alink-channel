import { SETTINGS_STORAGE_KEY } from "@/lib/theme-storage";
import { type Page, expect, test } from "@playwright/test";

import { isWideProject } from "./support/helpers";
import { makeDetail, makeLink, mockApi } from "./support/mock-api";

// #12 the shell waits for the width check before it draws, and tab roots have no back button.

type ShellState = "none" | "blank" | "mobile" | "wide" | "both";

/**
 * Records every distinct shell state the DOM goes through from the first parsed node,
 * so a shell that is drawn and replaced within a frame is still caught.
 */
async function recordShellStates(page: Page) {
  await page.addInitScript(() => {
    const states: string[] = [];
    (window as unknown as { __shellStates: string[] }).__shellStates = states;

    const classify = () => {
      const root = document.getElementById("root");
      if (!root || root.childElementCount === 0) return "none";
      const hasMobile =
        root.querySelector('[aria-label="새 링크"], [aria-label="검색"]') != null ||
        root.querySelector('[aria-label="뒤로"]') != null;
      const hasWide = (root.textContent ?? "").includes("⌘/Ctrl + K");
      if (hasMobile && hasWide) return "both";
      if (hasMobile) return "mobile";
      if (hasWide) return "wide";
      const hasBlankView = Array.from(root.querySelectorAll(".bg-background")).some(
        (node) => node.childElementCount === 0,
      );
      return hasBlankView ? "blank" : "none";
    };
    const record = () => {
      const next = classify();
      if (states[states.length - 1] !== next) states.push(next);
    };

    new MutationObserver(record).observe(document, {
      attributes: true,
      characterData: true,
      childList: true,
      subtree: true,
    });
    record();
  });
}

async function shellStates(page: Page): Promise<ShellState[]> {
  return page.evaluate(
    () => (window as unknown as { __shellStates: ShellState[] }).__shellStates ?? [],
  );
}

function collectHydrationWarnings(page: Page) {
  const warnings: string[] = [];
  page.on("console", (message) => {
    const text = message.text();
    if (/hydration|did not match|server rendered html|while hydrating/i.test(text))
      warnings.push(text);
  });
  return warnings;
}

/** The page HTML before any script runs: only the blank background view, no shell. */
async function expectServerHtmlWithoutShell(page: Page, path: string) {
  const response = await page.request.get(path);
  expect(response.ok()).toBe(true);
  const html = await response.text();
  const root = html.slice(html.indexOf('<div id="root">'));
  expect(root).toMatch(/<div class="[^"]*\bbg-background"[^>]*><\/div>/);
  for (const marker of [
    "⌘/Ctrl + K",
    'aria-label="새 링크"',
    'aria-label="검색"',
    ">할일<",
    ">전체<",
  ]) {
    expect(root, marker).not.toContain(marker);
  }
}

function firstDrawnState(states: ShellState[]) {
  return states.find((state) => state !== "none");
}

const wideTopbarSearch = (page: Page) => page.getByText("⌘/Ctrl + K").first();
const mobileFab = (page: Page) => page.getByRole("button", { name: "새 링크", exact: true });
const backButton = (page: Page) => page.getByRole("button", { name: "뒤로", exact: true });

const TAB_LABELS = ["홈", "폴더", "할일", "설정"];
const TODOS_TITLE = "투두";
const mobileHeader = (page: Page) => page.getByTestId("app-header").first();
const bottomTab = (page: Page, label: string) => page.getByText(label, { exact: true }).last();

/**
 * The bottom tab whose icon sits on the highlighted background. The bottom tabs expose no
 * accessibility selected state (no role or `accessibilityState` on the tab Pressable), so the
 * highlight is the only observable signal; `bottom-tabs.tsx` is outside this issue.
 */
async function selectedTabLabel(page: Page) {
  const backgrounds = await Promise.all(
    TAB_LABELS.map((label) =>
      bottomTab(page, label).evaluate((node) => {
        const icon = node.parentElement?.firstElementChild;
        return icon ? getComputedStyle(icon).backgroundColor : "";
      }),
    ),
  );
  const selected = TAB_LABELS.filter(
    (_, index) => backgrounds[index] !== "" && backgrounds[index] !== "rgba(0, 0, 0, 0)",
  );
  return selected.length === 1 ? selected[0] : null;
}

test.describe("first frame on web", () => {
  test.skip(() => !isWideProject(), "widths are set per test");

  for (const path of ["/home", "/links", "/folders", "/todos", "/settings"]) {
    test(`the page HTML for ${path} has only the blank view`, async ({ page }) => {
      await expectServerHtmlWithoutShell(page, path);
    });
  }

  for (const width of [769, 1280]) {
    test(`wide ${width}px: refreshing home never shows the mobile shell`, async ({ page }) => {
      const warnings = collectHydrationWarnings(page);
      await page.setViewportSize({ width, height: 800 });
      await mockApi(page);
      await recordShellStates(page);
      await page.goto("/home");
      await expect(wideTopbarSearch(page)).toBeVisible();
      await page.reload();
      await expect(wideTopbarSearch(page)).toBeVisible();

      const states = await shellStates(page);
      expect(firstDrawnState(states)).toBe("blank");
      expect(states).toContain("wide");
      expect(states).not.toContain("mobile");
      expect(states).not.toContain("both");
      await expect(mobileFab(page)).toHaveCount(0);
      expect(warnings).toEqual([]);
    });
  }

  test("mobile 768px: refreshing home never shows the wide shell", async ({ page }) => {
    const warnings = collectHydrationWarnings(page);
    await page.setViewportSize({ width: 768, height: 800 });
    await mockApi(page);
    await recordShellStates(page);
    await page.goto("/home");
    await expect(mobileFab(page)).toBeVisible();
    await page.reload();
    await expect(mobileFab(page)).toBeVisible();

    const states = await shellStates(page);
    expect(firstDrawnState(states)).toBe("blank");
    expect(states).toContain("mobile");
    expect(states).not.toContain("wide");
    expect(states).not.toContain("both");
    expect(warnings).toEqual([]);
  });
});

test.describe("wide 769px direct entry keeps the address", () => {
  test.skip(() => !isWideProject(), "wide only");

  const link = makeLink({ id: 7, title: "바로 연 링크" });

  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 769, height: 800 });
    await mockApi(page, { links: [link], details: { 7: makeDetail(link) } });
  });

  test("/links stays on all links", async ({ page }) => {
    const warnings = collectHydrationWarnings(page);
    await page.goto("/links");
    await expect(page.getByTestId("link-card")).toHaveCount(1);
    await expect(page).toHaveURL(/\/links$/);
    expect(warnings).toEqual([]);
  });

  test("/links?linkId stays on all links with the detail overlay", async ({ page }) => {
    const warnings = collectHydrationWarnings(page);
    await page.goto("/links?linkId=7");
    await expect(page.getByTestId("link-card")).toHaveCount(1);
    await expect(page.getByTestId("link-detail-title")).toHaveText("바로 연 링크");
    await expect(page).toHaveURL(/\/links\?linkId=7$/);
    expect(warnings).toEqual([]);
  });

  test("/links/:id opens the detail overlay over all links", async ({ page }) => {
    const warnings = collectHydrationWarnings(page);
    await page.goto("/links/7");
    await expect(page.getByTestId("link-detail-title")).toHaveText("바로 연 링크");
    await expect(page.getByTestId("link-card")).toHaveCount(1);
    expect(warnings).toEqual([]);
  });

  test("/folders goes to home", async ({ page }) => {
    const warnings = collectHydrationWarnings(page);
    await page.goto("/folders");
    await expect(page).toHaveURL(/\/home$/);
    await expect(wideTopbarSearch(page)).toBeVisible();
    expect(warnings).toEqual([]);
  });
});

test.describe("mobile 768px direct entry", () => {
  test.skip(() => !isWideProject(), "widths are set per test");

  test("/links goes to home", async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 800 });
    await mockApi(page);
    await page.goto("/links");
    await expect(page).toHaveURL(/\/home$/);
    await expect(mobileFab(page)).toBeVisible();
  });

  test("/links?linkId goes to that link's detail page", async ({ page }) => {
    const link = makeLink({ id: 7, title: "바로 연 링크" });
    await page.setViewportSize({ width: 768, height: 800 });
    await mockApi(page, { links: [link], details: { 7: makeDetail(link) } });
    await page.goto("/links?linkId=7");
    await expect(page).toHaveURL(/\/links\/7$/);
    await expect(page.getByTestId("link-detail-title")).toHaveText("바로 연 링크");
    await expect(backButton(page)).toBeVisible();
  });
});

type BlankFrame = { dark: boolean; background: string };

/** Background and dark class of the first frame the blank pre-shell view is in the DOM. */
async function recordFirstBlankFrame(page: Page) {
  await page.addInitScript(() => {
    const target = window as unknown as { __firstBlank: BlankFrame | null };
    target.__firstBlank = null;
    const observer = new MutationObserver(() => {
      const blank = document.querySelector<HTMLElement>("#root .bg-background");
      if (!blank || target.__firstBlank) return;
      target.__firstBlank = {
        dark: document.documentElement.classList.contains("dark"),
        background: getComputedStyle(blank).backgroundColor,
      };
      observer.disconnect();
    });
    observer.observe(document, { childList: true, subtree: true });
  });
}

async function storeTheme(page: Page, theme: "light" | "dark") {
  await page.addInitScript(
    (value) => {
      window.sessionStorage.setItem(
        value.key,
        JSON.stringify({ display: { theme: value.theme, accent: "gray" } }),
      );
    },
    { key: SETTINGS_STORAGE_KEY, theme },
  );
}

async function shellBackground(page: Page) {
  await expect(wideTopbarSearch(page)).toBeVisible();
  return page.evaluate(() => {
    const views = Array.from(document.querySelectorAll<HTMLElement>("#root .bg-background"));
    return getComputedStyle(views[0]).backgroundColor;
  });
}

async function firstBlankFrame(page: Page) {
  return page.evaluate(
    () => (window as unknown as { __firstBlank: BlankFrame | null }).__firstBlank,
  );
}

test.describe("blank first frame follows the stored theme", () => {
  test.skip(() => !isWideProject(), "one width is enough");

  const DARK_BACKGROUND = "rgb(21, 23, 30)";
  const LIGHT_BACKGROUND = "rgb(250, 250, 250)";

  for (const theme of ["dark", "light"] as const) {
    test(`stored ${theme}: the blank frame already uses the ${theme} background`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: 1280, height: 800 });
      await mockApi(page, {
        handlers: {
          "GET /api/users/me/settings": (route) =>
            route.fulfill({
              contentType: "application/json",
              body: JSON.stringify({
                success: true,
                data: {
                  display: { theme, accent: "gray" },
                  behavior: { allowsReminderNotification: false },
                  ai: { defaultProvider: null, defaultModel: null },
                  providers: [],
                },
                error: null,
              }),
            }),
        },
      });
      await storeTheme(page, theme);
      await recordFirstBlankFrame(page);
      await page.goto("/home");
      await page.reload();
      await expect(wideTopbarSearch(page)).toBeVisible();

      const expected = theme === "dark" ? DARK_BACKGROUND : LIGHT_BACKGROUND;
      expect(await firstBlankFrame(page)).toEqual({ dark: theme === "dark", background: expected });
      if (theme === "dark") {
        await expect.poll(() => shellBackground(page)).toBe(expected);
      }
    });
  }

  test("nothing stored: the blank frame stays light as before", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await mockApi(page);
    await recordFirstBlankFrame(page);
    await page.goto("/home");
    await expect(wideTopbarSearch(page)).toBeVisible();
    expect(await firstBlankFrame(page)).toEqual({ dark: false, background: LIGHT_BACKGROUND });
  });

  test("unreadable stored value: the blank frame stays light as before", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await mockApi(page);
    await page.addInitScript(
      (key) => window.sessionStorage.setItem(key, "{broken"),
      SETTINGS_STORAGE_KEY,
    );
    await recordFirstBlankFrame(page);
    await page.goto("/home");
    await expect(wideTopbarSearch(page)).toBeVisible();
    expect(await firstBlankFrame(page)).toEqual({ dark: false, background: LIGHT_BACKGROUND });
  });
});

test.describe("window resize after the first frame", () => {
  test.skip(() => !isWideProject(), "widths are set per test");

  test("crossing 768/769 swaps the shells", async ({ page }) => {
    await page.setViewportSize({ width: 769, height: 800 });
    await mockApi(page);
    await page.goto("/home");
    await expect(wideTopbarSearch(page)).toBeVisible();

    await page.setViewportSize({ width: 768, height: 800 });
    await expect(mobileFab(page)).toBeVisible();
    await expect(wideTopbarSearch(page)).toHaveCount(0);

    await page.setViewportSize({ width: 769, height: 800 });
    await expect(wideTopbarSearch(page)).toBeVisible();
    await expect(mobileFab(page)).toHaveCount(0);
  });
});

test.describe("signed out", () => {
  test("opening home goes to login", async ({ page }) => {
    await page.goto("/home");
    await expect(page).toHaveURL(/\/login$/);
  });
});

test.describe("mobile tab roots have no back button", () => {
  test.skip(() => isWideProject(), "mobile header");

  test("tapping each bottom tab shows no back button and selects the tab", async ({ page }) => {
    await mockApi(page);
    await page.goto("/home");
    await expect(mobileFab(page)).toBeVisible();
    await page.addStyleTag({
      content: "#error-toast, .tsqd-parent-container { display: none !important; }",
    });
    await expect.poll(() => selectedTabLabel(page)).toBe("홈");

    const tabs = [
      { label: "폴더", path: /\/folders$/ },
      { label: "할일", path: /\/todos$/ },
      { label: "설정", path: /\/settings$/ },
      { label: "홈", path: /\/home$/ },
    ];
    for (const tab of tabs) {
      await bottomTab(page, tab.label).click();
      await expect(page).toHaveURL(tab.path);
      await expect.poll(() => selectedTabLabel(page)).toBe(tab.label);
      await expect(backButton(page)).toHaveCount(0);
    }
  });

  for (const [path, label] of [
    ["/folders", "폴더"],
    ["/todos", "할일"],
    ["/settings", "설정"],
  ]) {
    test(`opening ${path} directly shows no back button`, async ({ page }) => {
      await mockApi(page);
      await page.goto(path);
      await expect.poll(() => selectedTabLabel(page)).toBe(label);
      await expect(backButton(page)).toHaveCount(0);
      await page.reload();
      await expect.poll(() => selectedTabLabel(page)).toBe(label);
      await expect(backButton(page)).toHaveCount(0);
    });
  }

  test("tab roots keep their header title and right buttons", async ({ page }) => {
    await mockApi(page);
    const roots = [
      { path: "/home", title: "", buttons: ["검색", "알림"] },
      { path: "/folders", title: "폴더", buttons: [] },
      { path: "/todos", title: TODOS_TITLE, buttons: [] },
      { path: "/settings", title: "설정", buttons: [] },
    ];
    for (const root of roots) {
      await page.goto(root.path);
      await expect(bottomTab(page, "홈")).toBeVisible();
      const header = mobileHeader(page);
      await expect(header.getByTestId("app-header-title")).toHaveText(
        root.title ? [root.title] : [],
      );
      await expect
        .poll(() =>
          header
            .getByTestId("app-header-right")
            .getByRole("button")
            .evaluateAll((nodes) => nodes.map((node) => node.getAttribute("aria-label"))),
        )
        .toEqual(root.buttons);
    }
  });

  test("uncategorized from the folders tab has a back button to the list", async ({ page }) => {
    await mockApi(page);
    await page.goto("/folders");
    await page.getByText("미분류", { exact: true }).first().click();
    await expect(page).toHaveURL(/\/folders\/0$/);
    await backButton(page).click();
    await expect(page).toHaveURL(/\/folders$/);
    await expect(backButton(page)).toHaveCount(0);
  });

  test("folder detail from the folders tab has a back button to the list", async ({ page }) => {
    await mockApi(page);
    await page.goto("/folders");
    await page.getByText("공부", { exact: true }).first().click();
    await expect(page).toHaveURL(/\/folders\/1$/);
    await backButton(page).click();
    await expect(page).toHaveURL(/\/folders$/);
    await expect(backButton(page)).toHaveCount(0);
  });

  test("link detail from home has a back button to home", async ({ page }) => {
    const link = makeLink({ id: 3, title: "홈에서 연 링크" });
    await mockApi(page, { links: [link], details: { 3: makeDetail(link) } });
    await page.goto("/home");
    await page.getByTestId("link-card-title").first().click();
    await expect(page).toHaveURL(/\/links\/3$/);
    await backButton(page).click();
    await expect(page).toHaveURL(/\/home$/);
  });

  test("notifications from home has a back button to home", async ({ page }) => {
    await mockApi(page);
    await page.goto("/home");
    await page.getByRole("button", { name: /알림/ }).first().click();
    await expect(page).toHaveURL(/\/notifications$/);
    await backButton(page).click();
    await expect(page).toHaveURL(/\/home$/);
  });

  test("announcements and feedbacks from settings step back one screen at a time", async ({
    page,
  }) => {
    const json = (data: unknown) => ({
      contentType: "application/json",
      body: JSON.stringify({ success: true, data, error: null }),
    });
    const post = { id: 5, title: "첫 게시글", author: "운영자", createdAt: "2026-10-30T10:00:00Z" };
    await mockApi(page, {
      handlers: {
        "GET /api/users/me": (route) =>
          route.fulfill(
            json({
              id: 1,
              username: "e2e",
              nickname: "관리자",
              role: "ADMIN",
              avatarEmoji: "🌸",
              allowsPrivacy: true,
              allowsAiUsage: true,
            }),
          ),
        "GET /api/posts": (route) =>
          route.fulfill(
            json({ isEmpty: false, contents: [post], nextCursor: null, hasNext: false }),
          ),
        "GET /api/posts/5": (route) =>
          route.fulfill(
            json({
              ...post,
              contents: "본문",
              type: "ANNOUNCEMENT",
              authorId: 1,
              imageUrls: [],
              updatedAt: post.createdAt,
            }),
          ),
      },
    });

    for (const entry of [
      { label: "공지사항", list: /\/announcements$/, detail: /\/announcements\/5$/ },
      { label: "피드백", list: /\/feedbacks$/, detail: /\/feedbacks\/5$/ },
    ]) {
      await page.goto("/settings");
      await expect(backButton(page)).toHaveCount(0);
      await page.getByText(entry.label, { exact: true }).first().click();
      await expect(page).toHaveURL(entry.list);
      await expect(backButton(page)).toBeVisible();
      await page.getByText(post.title).first().click();
      await expect(page).toHaveURL(entry.detail);
      await expect(backButton(page)).toBeVisible();
      await backButton(page).click();
      await expect(page).toHaveURL(entry.list);
      await backButton(page).click();
      await expect(page).toHaveURL(/\/settings$/);
      await expect(backButton(page)).toHaveCount(0);
    }
  });

  test("folder detail opened directly has a back button to home", async ({ page }) => {
    await mockApi(page);
    await page.goto("/folders/1");
    await backButton(page).click();
    await expect(page).toHaveURL(/\/home$/);
  });
});
