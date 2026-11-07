import { type Locator, type Page, type Route, expect, test } from "@playwright/test";

import { isWideProject } from "./support/helpers";
import {
  HOUR_MS,
  type MockFolder,
  type MockTodo,
  countTodos,
  iso,
  makeDetail,
  makeLink,
  mockApi,
  scroll,
  settingsHandler,
} from "./support/mock-api";
import {
  type MockImportRecord,
  createMockImportApi,
  makeImportRecord,
} from "./support/mock-import-api";

// #47: the todo feature is called 액션 everywhere, Korean wraps at spaces on the web,
// no functional text is under 11px, status colours meet AA, and the dialog × is a 44px button.

type Theme = "light" | "dark";
type Accent = "gray" | "pink" | "blue";

const THEMES: [Theme, Accent][] = [
  ["light", "gray"],
  ["dark", "gray"],
  ["light", "pink"],
  ["dark", "pink"],
  ["light", "blue"],
  ["dark", "blue"],
];

const OLD_NAMES = /할\s?일|투두/;
const CARD_BADGE_LABEL = "액션 1개, 임박 1개, 기한 지남 1개";
const LONG_URL = `https://example.com/${"averyveryverylongpathsegmentwithoutanyspaces".repeat(4)}?q=${"x".repeat(80)}`;
const LONG_TAG = "띄어쓰기없이아주길게이어지는해시태그이름입니다정말로길어요";
const LONG_TITLE = "띄어쓰기없이아주길게이어지는한국어제목입니다줄바꿈은칸끝에서만일어나야해요";

const FOLDERS: MockFolder[] = [
  { id: 20, ownerId: 1, name: "aws", emoji: "☁️", isShared: false, shareCounts: 0, linkCounts: 2 },
  {
    id: 30,
    ownerId: 1,
    name: "스터디",
    emoji: "📚",
    isShared: true,
    shareCounts: 2,
    linkCounts: 0,
  },
];

function buildFixtures() {
  const link = makeLink({
    id: 1,
    url: "https://velog.io/@devkim/tanstack-query-v5",
    title: "TanStack Query v5 마이그레이션 정리",
  });
  const longLink = makeLink({
    id: 2,
    url: LONG_URL,
    title: LONG_TITLE,
    tags: [LONG_TAG, "react"],
  });
  const todos: MockTodo[] = [
    { id: 21, title: "토요일 2시 방문", reminderAt: iso(-3 * HOUR_MS), completedAt: null },
    { id: 22, title: "범위 정리", reminderAt: iso(5 * HOUR_MS), completedAt: null },
    { id: 23, title: "팀원에게 공유", reminderAt: null, completedAt: null },
  ].map((todo) => ({
    ...todo,
    linkId: 1,
    linkUrl: link.url,
    linkTitle: link.title,
    linkThumbnailUrl: null,
    linkFaviconUrl: null,
  }));
  const detailTodos = todos.map(({ id, title, reminderAt, completedAt }) => ({
    id,
    title,
    reminderAt,
    completedAt,
  }));
  link.todoCounts = countTodos(detailTodos);
  return {
    links: [link, longLink],
    details: {
      1: makeDetail(link, { todos: detailTodos }),
      2: makeDetail(longLink, { todos: [] }),
    },
    todos,
  };
}

function importRecords(): MockImportRecord[] {
  const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();
  return [
    makeImportRecord({
      id: 5,
      fileName: "bookmarks_partial.html",
      createdAt: minutesAgo(30),
      folders: [
        {
          kind: "NEW",
          state: "ACTIVE",
          folderId: 7005,
          name: "자바",
          emoji: null,
          links: [
            {
              linkId: 511,
              title: "Java 21 가상 스레드",
              url: "https://j.test/1",
              state: "IMPORTED",
            },
            { linkId: 512, title: "Effective Java", url: "https://j.test/2", state: "IMPORTED" },
          ],
        },
        {
          kind: "UNFILED",
          state: "ACTIVE",
          folderId: null,
          name: null,
          emoji: null,
          links: [
            { linkId: 531, title: "미분류 링크", url: "https://u.test/1", state: "IMPORTED" },
          ],
        },
      ],
      failures: [
        { title: "주소가 이상한 링크", url: LONG_URL, reason: "URL_INVALID" },
        { title: "", url: "https://t.test/untitled", reason: "TITLE_INVALID" },
      ],
    }),
    makeImportRecord({ id: 4, fileName: "bookmarks_done.html", createdAt: minutesAgo(90) }),
  ];
}

type SetupOptions = {
  theme?: Theme;
  accent?: Accent;
  todos?: MockTodo[];
  failFolders?: boolean;
  handlers?: Record<string, (route: Route) => unknown>;
};

async function setup(page: Page, theme: Theme = "light", accent: Accent = "gray") {
  return setupWith(page, { theme, accent });
}

async function setupWith(page: Page, options: SetupOptions) {
  let api: Awaited<ReturnType<typeof mockApi>> | undefined;
  const imports = createMockImportApi({
    folders: () => api?.folders ?? FOLDERS,
    links: () => api?.links ?? [],
    records: importRecords(),
    handlers: {
      "GET /api/users/me/settings": settingsHandler(
        options.theme ?? "light",
        options.accent ?? "gray",
      ),
      ...options.handlers,
    },
  });
  const fixtures = buildFixtures();
  api = await mockApi(page, {
    ...fixtures,
    todos: options.todos ?? fixtures.todos,
    folders: FOLDERS,
    folderPages: options.failFolders ? { failAll: true } : undefined,
    handlers: imports.handlers,
  });
  return api;
}

async function expectTheme(page: Page, theme: Theme, accent: Accent) {
  await expect
    .poll(() =>
      page.evaluate(() => ({
        dark: document.documentElement.classList.contains("dark"),
        accent: document.documentElement.getAttribute("data-accent") ?? "gray",
      })),
    )
    .toEqual({ dark: theme === "dark", accent });
}

async function settle(page: Page) {
  await expect
    .poll(
      () =>
        page.evaluate(
          () => document.getAnimations().filter((a) => a.playState === "running").length,
        ),
      { timeout: 5_000 },
    )
    .toBe(0);
}

/** Visible text, accessible names, placeholders and tooltips on the page. */
async function visibleCopy(page: Page) {
  return page.evaluate(() => {
    const attributes = Array.from(
      document.querySelectorAll("[aria-label], [placeholder], [title]"),
    ).flatMap((element) =>
      ["aria-label", "placeholder", "title"].map((name) => element.getAttribute(name) ?? ""),
    );
    return [document.body.innerText, ...attributes].join("\n");
  });
}

type ContrastFinding = { text: string; ratio: number; required: number; size: number };

/**
 * Contrast of every visible text whose colour comes from a status token (or the given
 * locators), against what is painted under it: the elements below its centre point,
 * composited bottom to top. Toast fills are siblings, not ancestors, so the ancestor
 * chain alone would miss them.
 */
async function statusContrast(page: Page, extra: Locator[] = []) {
  const handles = await Promise.all(extra.map((locator) => locator.elementHandle()));
  return page.evaluate((extraNodes) => {
    const STATUS = /(^|\s)text-(success|warning|destructive)(-foreground)?(\/\d+)?(\s|$)/;
    const parse = (value: string) => {
      const n = value.match(/[\d.]+/g)?.map(Number) ?? [0, 0, 0, 0];
      return { r: n[0], g: n[1], b: n[2], a: n.length > 3 ? n[3] : 1 };
    };
    const lum = ({ r, g, b }: { r: number; g: number; b: number }) => {
      const c = (v: number) => {
        const x = v / 255;
        return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
      };
      return 0.2126 * c(r) + 0.7152 * c(g) + 0.0722 * c(b);
    };
    type C = { r: number; g: number; b: number; a: number };
    const over = (top: C, bottom: C): C => ({
      r: top.r * top.a + bottom.r * (1 - top.a),
      g: top.g * top.a + bottom.g * (1 - top.a),
      b: top.b * top.a + bottom.b * (1 - top.a),
      a: 1,
    });
    const ownText = (element: Element) =>
      Array.from(element.childNodes)
        .filter((node) => node.nodeType === Node.TEXT_NODE)
        .map((node) => node.textContent ?? "")
        .join("")
        .trim();
    const targets = new Set<Element>([
      ...Array.from(document.querySelectorAll("[class]")).filter((element) =>
        STATUS.test(element.getAttribute("class") ?? ""),
      ),
      ...(extraNodes.filter(Boolean) as Element[]),
    ]);
    const findings: { text: string; ratio: number; required: number; size: number }[] = [];
    for (const element of targets) {
      const text = ownText(element);
      if (!text || !/[\p{L}\p{N}+−-]/u.test(text)) continue;
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      if (rect.width === 0 || rect.height === 0 || style.visibility === "hidden") continue;
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;
      if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) continue;
      const stack = document.elementsFromPoint(x, y);
      const index = stack.indexOf(element);
      // Text under a modal or another layer is not what the user reads right now.
      if (index === -1 && !extraNodes.includes(element as never)) continue;
      const below = stack.slice(Math.max(0, index));
      let background: C = parse(getComputedStyle(document.documentElement).backgroundColor);
      if (background.a === 0) background = { r: 255, g: 255, b: 255, a: 1 };
      for (const layer of below.reverse()) {
        const value = parse(getComputedStyle(layer).backgroundColor);
        if (value.a > 0) background = over(value, background);
      }
      const color = over(parse(style.color), background);
      const [hi, lo] = [lum(color), lum(background)].sort((a, b) => b - a);
      const size = parseFloat(style.fontSize);
      const bold = Number(style.fontWeight) >= 700;
      const required = size >= 24 || (size >= 18.66 && bold) ? 3 : 4.5;
      findings.push({ text, ratio: (hi + 0.05) / (lo + 0.05), required, size });
    }
    return findings;
  }, handles);
}

function failing(findings: ContrastFinding[]) {
  return findings
    .filter((finding) => finding.ratio < finding.required)
    .map((f) => `${f.text} ${f.ratio.toFixed(2)} < ${f.required}`);
}

/** Visible texts whose font size is under 11px. Emoji and one-letter initials are decoration. */
async function smallTexts(page: Page) {
  return page.evaluate(() => {
    const results: string[] = [];
    for (const element of Array.from(document.querySelectorAll("body *"))) {
      const text = Array.from(element.childNodes)
        .filter((node) => node.nodeType === Node.TEXT_NODE)
        .map((node) => node.textContent ?? "")
        .join("")
        .trim();
      // One-letter initials standing in for a missing favicon or avatar are decoration.
      if (!text || !/[\p{L}\p{N}]/u.test(text) || [...text].length === 1) continue;
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      if (rect.width === 0 || rect.height === 0 || style.visibility === "hidden") continue;
      if (rect.bottom < 0 || rect.top > innerHeight) continue;
      if (parseFloat(style.fontSize) < 11) results.push(`${text} (${style.fontSize})`);
    }
    return results;
  });
}

/** The text of an element split into the lines the browser drew. */
async function renderedLines(locator: Locator) {
  return locator.evaluate((element) => {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    const lines: { top: number; text: string }[] = [];
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const value = node.textContent ?? "";
      for (let index = 0; index < value.length; index += 1) {
        const range = document.createRange();
        range.setStart(node, index);
        range.setEnd(node, index + 1);
        const rect = range.getBoundingClientRect();
        if (rect.width === 0 && value[index] !== " ") continue;
        const top = Math.round(rect.top);
        const line = lines.find((entry) => Math.abs(entry.top - top) < 4);
        if (line) line.text += value[index];
        else lines.push({ top, text: value[index] });
      }
    }
    return lines.sort((a, b) => a.top - b.top).map((line) => line.text);
  });
}

function expectBreaksAtSpaces(lines: string[]) {
  for (let index = 0; index < lines.length - 1; index += 1) {
    const end = lines[index];
    const next = lines[index + 1];
    expect(
      /\s$/.test(end) || /^\s/.test(next) || /[^\p{Script=Hangul}]$/u.test(end),
      `"${end}" | "${next}"`,
    ).toBe(true);
  }
}

async function noHorizontalOverflow(page: Page) {
  return page.evaluate(
    () => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
  );
}

test.describe("the todo feature is called 액션", () => {
  test("navigation, the actions screen and its empty state use 액션", async ({ page }) => {
    await setup(page);
    await page.goto("/todos");
    if (isWideProject()) {
      await expect(page.getByRole("button", { name: /^액션$/ }).first()).toBeVisible();
    } else {
      await expect(page.getByTestId("app-header").first()).toContainText("액션");
      await expect(page.getByText("액션", { exact: true }).last()).toBeVisible();
    }
    await expect(page.getByText("토요일 2시 방문")).toBeVisible();
    expect(await visibleCopy(page)).not.toMatch(OLD_NAMES);

    await page
      .getByText(/^✓ 완료/)
      .first()
      .click();
    await expect(page.getByText("해당하는 액션이 없어요")).toBeVisible();
  });

  test("home, link cards, link detail, notifications and settings use 액션", async ({ page }) => {
    await setup(page);
    await page.goto("/home");
    await expect(page.getByText("TanStack Query v5 마이그레이션 정리").first()).toBeVisible();
    if (isWideProject()) {
      await expect(page.getByText("✅ 액션 3")).toBeVisible();
      await expect(page.getByText("오늘의 액션")).toBeVisible();
    }
    expect(await visibleCopy(page)).not.toMatch(OLD_NAMES);

    await page.goto("/links");
    await expect(page.getByLabel(CARD_BADGE_LABEL).first()).toBeAttached({ timeout: 30_000 });
    expect(await visibleCopy(page)).not.toMatch(OLD_NAMES);

    await page.goto(isWideProject() ? "/links?linkId=1" : "/links/1");
    await expect(page.getByTestId("link-detail-title")).toBeVisible();
    await expect(
      page.getByTestId("link-detail-todos").getByText("액션", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByTestId("link-detail-todos").getByRole("button", { name: "액션 추가" }),
    ).toBeVisible();
    expect(await visibleCopy(page)).not.toMatch(OLD_NAMES);

    await page.goto(isWideProject() ? "/links?linkId=2" : "/links/2");
    await expect(
      page.getByTestId("link-detail-todos").getByRole("button", { name: "액션 추가" }),
    ).toBeVisible();

    await page.goto("/notifications");
    await expect(page.getByText("액션", { exact: true }).first()).toBeVisible();
    expect(await visibleCopy(page)).not.toMatch(OLD_NAMES);

    await page.goto("/settings");
    await expect(page.getByText("액션 기한이 다가오면 알림을 보내요.")).toBeVisible();
    expect(await visibleCopy(page)).not.toMatch(OLD_NAMES);
  });

  test("the link detail's action editor uses 액션 in its fields and failure message", async ({
    page,
  }) => {
    await setup(page);
    await page.route(
      (url) => url.pathname.startsWith("/api/todos"),
      (route) =>
        route.request().method() === "GET"
          ? route.fallback()
          : route.fulfill({ status: 500, contentType: "application/json", body: "{}" }),
    );
    await page.goto(isWideProject() ? "/links?linkId=2" : "/links/2");
    await page.getByTestId("link-detail-todos").getByRole("button", { name: "액션 추가" }).click();
    const field = page.getByPlaceholder("액션 제목").last();
    await expect(field).toBeVisible();
    expect(await visibleCopy(page)).not.toMatch(OLD_NAMES);

    const save = page.getByTestId("link-detail-todos-save");
    await expect(save).toBeEnabled();

    await field.fill("마감 전에 제출");
    await save.click();
    await expect(
      page.getByText("액션을 저장하지 못했어요. 잠시 후 다시 시도해주세요."),
    ).toBeVisible();
    await expect(field).toHaveValue("마감 전에 제출");
  });
});

test.describe("Korean line breaking on the web", () => {
  for (const width of [390, 768, 769, 1280]) {
    test(`words break only at spaces and long URLs stay inside at ${width}px`, async ({ page }) => {
      test.skip(!isWideProject(), "widths are set explicitly");
      await page.setViewportSize({ width, height: 800 });
      await setup(page);

      await page.goto("/settings/imports");
      const meta = page.getByText(/새 폴더 1개/).first();
      await expect(meta).toBeVisible({ timeout: 30_000 });
      expect(await meta.evaluate((node) => getComputedStyle(node).wordBreak)).toBe("keep-all");
      expectBreaksAtSpaces(await renderedLines(meta));
      expect(await noHorizontalOverflow(page)).toBe(true);

      await page.goto("/links");
      await expect(page.getByText(LONG_TITLE).first()).toBeVisible();
      await settle(page);
      expect(await noHorizontalOverflow(page)).toBe(true);
      const card = page.getByTestId("link-card").filter({ hasText: LONG_TITLE }).first();
      const cardBox = (await card.boundingBox())!;
      for (const text of [page.getByText(LONG_TITLE).first(), card.getByTestId("link-card-tags")]) {
        const box = (await text.boundingBox())!;
        expect(box.x + box.width).toBeLessThanOrEqual(cardBox.x + cardBox.width + 1);
      }

      await page.goto(width > 768 ? "/links?linkId=2" : "/links/2");
      await expect(page.getByTestId("link-detail-title")).toBeVisible();
      await settle(page);
      expect(await noHorizontalOverflow(page)).toBe(true);

      await page.goto("/settings/imports/5");
      await expect(page.getByText("주소가 이상한 링크").first()).toBeVisible();
      expect(await noHorizontalOverflow(page)).toBe(true);
    });
  }
});

test.describe("no functional text under 11px", () => {
  test("tabs, sidebar, cards, notifications and the feedback form", async ({ page }) => {
    await setup(page);
    await page.route(
      (url) => url.pathname === "/api/notifications/unread",
      (route) =>
        route.fulfill({
          contentType: "application/json",
          body: JSON.stringify({ success: true, data: { unreadCount: 12 }, error: null }),
        }),
    );
    const loaded: Record<string, string> = {
      "/home": "TanStack Query v5 마이그레이션 정리",
      "/links": "TanStack Query v5 마이그레이션 정리",
      "/todos": "토요일 2시 방문",
      "/settings/imports": "일부 실패",
    };
    for (const [path, marker] of Object.entries(loaded)) {
      await page.goto(path);
      await expect(page.getByText(marker).first()).toBeVisible({ timeout: 30_000 });
      await settle(page);
      if (path === "/home") {
        await expect(page.getByText("9+", { exact: true }).first()).toBeVisible();
      }
      expect(await smallTexts(page), path).toEqual([]);
    }

    await page.goto("/settings");
    await page.getByText("피드백", { exact: true }).click();
    await expect(page.getByText("이미지 첨부").first()).toBeVisible();
    await settle(page);
    expect(await smallTexts(page), "feedback").toEqual([]);
  });
});

test.describe("status colours meet AA", () => {
  for (const [theme, accent] of THEMES) {
    test(`badges, numbers, reasons, overdue text and the red button — ${theme} ${accent}`, async ({
      page,
    }) => {
      test.skip(!isWideProject(), "colours are the same on both layouts; the wide one shows more");
      await setup(page, theme, accent);

      await page.goto("/settings/imports");
      await expect(page.getByText("일부 실패").first()).toBeVisible({ timeout: 30_000 });
      await expectTheme(page, theme, accent);
      await settle(page);
      let findings = await statusContrast(page);
      expect(findings.map((f) => f.text)).toEqual(expect.arrayContaining(["완료", "일부 실패"]));
      expect(failing(findings)).toEqual([]);

      await page.goto("/settings/imports/5");
      await expect(page.getByText("주소가 이상한 링크").first()).toBeVisible();
      await settle(page);
      findings = await statusContrast(page);
      expect(findings.length).toBeGreaterThan(1);
      expect(failing(findings)).toEqual([]);

      await page.getByRole("button", { name: "이 가져오기 되돌리기" }).click();
      const dialog = page.getByRole("dialog");
      const reverse = dialog.getByRole("button", { name: "되돌리기", exact: true });
      await expect(reverse).toBeVisible();
      await settle(page);
      const reverseLabel = reverse.getByText("되돌리기", { exact: true });
      findings = await statusContrast(page, [reverseLabel]);
      expect(failing(findings)).toEqual([]);
      await reverse.hover();
      await settle(page);
      expect(failing(await statusContrast(page, [reverseLabel]))).toEqual([]);

      await page.goto("/todos");
      await expect(page.getByText("토요일 2시 방문")).toBeVisible();
      await settle(page);
      findings = await statusContrast(page);
      expect(findings.map((f) => f.text)).toEqual(
        expect.arrayContaining([expect.stringMatching(/\(지남\)$/)]),
      );
      expect(failing(findings)).toEqual([]);

      await page.goto("/links");
      await expect(page.getByLabel(CARD_BADGE_LABEL).first()).toBeAttached({ timeout: 30_000 });
      await settle(page);
      findings = await statusContrast(page);
      expect(findings.length).toBeGreaterThanOrEqual(1);
      expect(failing(findings)).toEqual([]);
    });
  }

  for (const [theme, accent] of THEMES) {
    test(`overdue and due-soon text on actions and cards — mobile ${theme} ${accent}`, async ({
      page,
    }) => {
      test.skip(isWideProject(), "the wide layout is covered above");
      await setup(page, theme, accent);
      await page.goto("/todos");
      await expect(page.getByText("토요일 2시 방문")).toBeVisible({ timeout: 30_000 });
      await expectTheme(page, theme, accent);
      await settle(page);
      let findings = await statusContrast(page);
      expect(findings.map((f) => f.text)).toEqual(
        expect.arrayContaining([expect.stringMatching(/\(지남\)$/)]),
      );
      expect(failing(findings)).toEqual([]);

      await page.goto("/links");
      await expect(page.getByLabel(CARD_BADGE_LABEL).first()).toBeAttached({ timeout: 30_000 });
      await settle(page);
      findings = await statusContrast(page);
      expect(findings.length).toBeGreaterThanOrEqual(1);
      expect(failing(findings)).toEqual([]);
    });
  }

  for (const [theme, accent] of THEMES) {
    test(`success and error toasts — ${theme} ${accent}`, async ({ page }) => {
      test.skip(isWideProject(), "the edit sheet flow is the mobile one");
      await setup(page, theme, accent);
      await page.goto("/links/1");
      await expect(page.getByTestId("link-detail-title")).toBeVisible();
      await expectTheme(page, theme, accent);

      const sheet = page.getByRole("slider", { name: "Bottom Sheet" });
      await page.getByRole("button", { name: "수정", exact: true }).click();
      await sheet.getByPlaceholder("링크 제목").fill("고친 제목");
      await sheet.getByRole("button", { name: "저장", exact: true }).click();
      const saved = page.getByText("수정했어요.").first();
      await expect(saved).toBeVisible();
      await settle(page);
      let findings = await statusContrast(page, [saved]);
      expect(findings.map((f) => f.text)).toContain("수정했어요.");
      expect(failing(findings)).toEqual([]);
      await page.getByText("닫기", { exact: true }).last().click();
      await expect(saved).toBeHidden();

      await page.route("**/api/links/1", (route) =>
        route.request().method() === "PUT" ? route.abort("internetdisconnected") : route.fallback(),
      );
      await page.getByRole("button", { name: "수정", exact: true }).click();
      await sheet.getByPlaceholder("링크 제목").fill("실패할 제목");
      await sheet.getByRole("button", { name: "저장", exact: true }).click();
      const failed = page.getByText("수정에 실패했어요.").first();
      await expect(failed).toBeVisible();
      await settle(page);
      findings = await statusContrast(page, [
        failed,
        page.getByText("잠시 후 다시 시도해주세요.").first(),
      ]);
      expect(findings.map((f) => f.text)).toContain("수정에 실패했어요.");
      expect(failing(findings)).toEqual([]);
    });
  }
});

/** True when the element's focus ring is painted entirely inside every clipping ancestor. */
async function ringIsUnclipped(locator: Locator) {
  return locator.evaluate((node) => {
    const shadow = getComputedStyle(node).boxShadow;
    if (!shadow || shadow === "none") return { visible: false, unclipped: false };
    const layers = shadow.split(/,(?![^(]*\))/);
    const outer = layers
      .filter((layer) => !/inset/.test(layer))
      .map((layer) => {
        const lengths = layer.replace(/rgba?\([^)]*\)/g, "").match(/-?[\d.]+px/g) ?? [];
        return parseFloat(lengths[3] ?? "0");
      });
    const spread = Math.max(0, ...outer);
    const rect = node.getBoundingClientRect();
    const ring = {
      left: rect.left - spread,
      top: rect.top - spread,
      right: rect.right + spread,
      bottom: rect.bottom + spread,
    };
    for (let parent = node.parentElement; parent; parent = parent.parentElement) {
      const style = getComputedStyle(parent);
      if (/^(visible)$/.test(style.overflowX) && /^(visible)$/.test(style.overflowY)) continue;
      const box = parent.getBoundingClientRect();
      const clip = {
        left: box.left + parent.clientLeft,
        top: box.top + parent.clientTop,
        right: box.left + parent.clientLeft + parent.clientWidth,
        bottom: box.top + parent.clientTop + parent.clientHeight,
      };
      if (
        ring.left < clip.left - 0.5 ||
        ring.top < clip.top - 0.5 ||
        ring.right > clip.right + 0.5 ||
        ring.bottom > clip.bottom + 0.5
      ) {
        return { visible: true, unclipped: false };
      }
    }
    return { visible: true, unclipped: true };
  });
}

test.describe("dialog close button", () => {
  test("is a 44px button named 닫기 at the same place, reachable by Tab", async ({ page }) => {
    test.skip(!isWideProject(), "the folder dialog is the wide one");
    await setup(page);
    await page.goto("/home");
    await page.getByRole("button", { name: "내 폴더에 폴더 추가" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await settle(page);

    const close = dialog.getByRole("button", { name: "닫기", exact: true });
    await expect(close).toHaveCount(1);
    const box = (await close.boundingBox())!;
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);

    const inner = await close.evaluate((node) => {
      const content = node.parentElement!.getBoundingClientRect();
      const style = getComputedStyle(node.parentElement!);
      const icon = node.querySelector("svg")!.getBoundingClientRect();
      return {
        right: content.right - parseFloat(style.borderRightWidth) - (icon.left + icon.width / 2),
        top: icon.top + icon.height / 2 - (content.top + parseFloat(style.borderTopWidth)),
      };
    });
    // The icon stays where it was: 16px inset plus half of the 16px icon.
    expect(inner.right).toBeCloseTo(24, 0);
    expect(inner.top).toBeCloseTo(24, 0);

    await page.mouse.click(box.x + 3, box.y + box.height - 3);
    await expect(dialog).toHaveCount(0);

    // The folder dialog's emoji grid keeps growing under Tab, so the keyboard check uses
    // the link edit dialog, which has the same close button and few stops.
    await page.goto("/links?linkId=2");
    await page.getByRole("button", { name: "수정", exact: true }).click();
    await expect(dialog).toBeVisible();
    const editorClose = dialog.getByRole("button", { name: "닫기", exact: true });
    let focused = false;
    for (let step = 0; step < 15 && !focused; step += 1) {
      await page.keyboard.press("Tab");
      focused = await editorClose.evaluate((node) => node === document.activeElement);
    }
    expect(focused).toBe(true);
    expect(await editorClose.evaluate((node) => getComputedStyle(node).boxShadow)).not.toBe("none");
    expect(await ringIsUnclipped(editorClose)).toEqual({ visible: true, unclipped: true });
    await page.keyboard.press("Enter");
    await expect(dialog).toHaveCount(0);
  });

  test("its focus ring is not cut off in the clipped ⌘K search dialog", async ({ page }) => {
    test.skip(!isWideProject(), "the ⌘K dialog is the wide search");
    await setup(page);
    await page.goto("/home");
    await page.getByText("⌘/Ctrl + K").first().click({ timeout: 30_000 });
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await settle(page);
    const close = dialog.getByRole("button", { name: "닫기", exact: true });
    let focused = false;
    for (let step = 0; step < 30 && !focused; step += 1) {
      await page.keyboard.press("Tab");
      focused = await close.evaluate((node) => node === document.activeElement);
    }
    expect(focused).toBe(true);
    expect(await ringIsUnclipped(close)).toEqual({ visible: true, unclipped: true });
  });
});

test.describe("more 액션 copy on screen", () => {
  test("the wide home says 오늘의 액션이 없어요 when there are none", async ({ page }) => {
    test.skip(!isWideProject(), "the today section is on the wide home");
    await setupWith(page, { todos: [] });
    await page.goto("/home");
    await expect(page.getByText("오늘의 액션이 없어요")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText("✅ 액션 0")).toBeVisible();
  });

  test("the 액션 chip in notifications leaves only action notifications", async ({ page }) => {
    const notifications = Array.from({ length: 6 }, (_, index) => {
      const id = index + 1;
      const isAction = id % 2 === 0;
      return {
        id,
        title: isAction ? `액션 알림 ${id}` : `공지 ${id}`,
        message: isAction ? `마감이 다가와요 ${id}` : `새 공지 ${id}`,
        firedAt: iso(-id * 60_000),
        readAt: null,
        context: isAction ? "TODO" : "ANNOUNCE",
        contextId: id,
      };
    });
    await setupWith(page, {
      handlers: {
        "GET /api/notifications": (route) => {
          const type = new URL(route.request().url()).searchParams.get("type");
          const contents = type
            ? notifications.filter((item) => item.context === type)
            : notifications;
          return route.fulfill({
            contentType: "application/json",
            body: JSON.stringify(scroll(contents)),
          });
        },
      },
    });
    await page.goto("/notifications");
    await expect(page.getByText(/^새 공지 \d$/)).toHaveCount(3, { timeout: 30_000 });
    const chips = page
      .locator("div")
      .filter({ has: page.getByText("공지사항", { exact: true }) })
      .filter({ has: page.getByText("액션", { exact: true }) })
      .last();
    await chips.getByText("액션", { exact: true }).click();
    await expect(page.getByText(/^마감이 다가와요 \d$/)).toHaveCount(3);
    await expect(page.getByText(/^새 공지 \d$/)).toHaveCount(0);
  });

  test("the withdrawal dialog says 링크와 폴더, 액션이 모두 삭제되며", async ({ page }) => {
    await setup(page);
    await page.goto("/settings");
    await page.getByText("회원 탈퇴", { exact: true }).click();
    await expect(
      page.getByText("탈퇴하면 저장한 링크와 폴더, 액션이 모두 삭제되며 되돌릴 수 없어요."),
    ).toBeVisible();
    expect(await visibleCopy(page)).not.toMatch(OLD_NAMES);
    await page.getByRole("button", { name: "취소" }).click();
  });

  test("the privacy policy and the web landing use 액션", async ({ page }) => {
    await page.route(
      (url) => url.pathname.startsWith("/api/") && !url.host.startsWith("localhost:"),
      (route) => route.fulfill({ status: 401, contentType: "application/json", body: "{}" }),
    );
    await page.goto("/privacy");
    await expect(page.getByText(/액션 알림/).first()).toBeVisible({ timeout: 30_000 });
    expect(await visibleCopy(page)).not.toMatch(OLD_NAMES);

    await page.goto("/");
    const badge = page.getByText("액션 2/3 완료");
    await badge.scrollIntoViewIfNeeded({ timeout: 30_000 });
    await expect(badge).toBeVisible();
    for (let y = 0; y < 12; y += 1) await page.mouse.wheel(0, 900);
    expect(await visibleCopy(page)).not.toMatch(OLD_NAMES);
  });

  test("the agreements notification step uses 액션", async ({ page }) => {
    test.skip(!isWideProject(), "one layout is enough for this copy");
    await setupWith(page, {
      handlers: {
        "GET /api/users/me": (route) =>
          route.fulfill({
            contentType: "application/json",
            body: JSON.stringify({
              success: true,
              data: {
                id: 1,
                username: "e2e",
                nickname: "테스터",
                avatarEmoji: "🌸",
                allowsPrivacy: false,
                allowsAiUsage: false,
              },
              error: null,
            }),
          }),
      },
    });
    await page.goto("/agreements");
    await expect(page.getByText(/액션 알림을 받으시려면/)).toBeVisible({ timeout: 30_000 });
    expect(await visibleCopy(page)).not.toMatch(OLD_NAMES);
  });
});

test.describe("Korean line breaking in sheets, failures and empty states", () => {
  for (const width of [390, 768, 769, 1280]) {
    test(`breaks only at spaces at ${width}px`, async ({ page }) => {
      test.skip(!isWideProject(), "widths are set explicitly");
      await page.setViewportSize({ width, height: 800 });

      await setup(page);
      await page.goto("/settings/imports/5");
      await page.getByRole("button", { name: "이 가져오기 되돌리기" }).click({ timeout: 30_000 });
      const subtitle = page.getByText(/남길 항목은 체크를 풀어 주세요\./).last();
      await expect(subtitle).toBeVisible();
      await settle(page);
      expectBreaksAtSpaces(await renderedLines(subtitle));
      const summary = page.getByText(/지우고|옮겨요/).last();
      if (await summary.count()) expectBreaksAtSpaces(await renderedLines(summary));

      await page.goto("/todos");
      await expect(page.getByText("토요일 2시 방문")).toBeVisible();
      await page
        .getByText(/^✓ 완료/)
        .first()
        .click();
      for (const text of ["해당하는 액션이 없어요", "다른 필터를 선택해보세요."]) {
        const node = page.getByText(text, { exact: true });
        await expect(node).toBeVisible();
        expectBreaksAtSpaces(await renderedLines(node));
      }

      if (width > 768) {
        await page.unrouteAll({ behavior: "ignoreErrors" });
        await setupWith(page, { failFolders: true });
        await page.goto("/home");
        const message = page.getByText("연결 상태를 확인하고 다시 시도해 주세요.").first();
        await expect(message).toBeVisible({ timeout: 30_000 });
        expectBreaksAtSpaces(await renderedLines(message));
        expect(await noHorizontalOverflow(page)).toBe(true);
      }
    });
  }
});

test.describe("zoomed web mobile", () => {
  test("at 200% zoom (195px wide) tab labels, tags and the unread badge stay whole", async ({
    page,
  }) => {
    test.skip(isWideProject(), "the bottom tabs are the mobile layout");
    await page.setViewportSize({ width: 195, height: 422 });
    await setup(page);
    await page.route(
      (url) => url.pathname === "/api/notifications/unread",
      (route) =>
        route.fulfill({
          contentType: "application/json",
          body: JSON.stringify({ success: true, data: { unreadCount: 12 }, error: null }),
        }),
    );
    await page.goto("/home");
    await expect(page.getByText("9+", { exact: true }).first()).toBeVisible({ timeout: 30_000 });
    await settle(page);

    for (const label of ["홈", "폴더", "액션", "설정"]) {
      const tab = page.getByText(label, { exact: true }).last();
      const fits = await tab.evaluate((node) => {
        const lineHeight = parseFloat(getComputedStyle(node).lineHeight) || 16;
        return {
          oneLine: node.getBoundingClientRect().height < lineHeight * 1.6,
          notClipped: node.scrollWidth <= node.clientWidth + 1,
        };
      });
      expect(fits, label).toEqual({ oneLine: true, notClipped: true });
    }

    const badge = page.getByText("9+", { exact: true }).first();
    const badgeBox = (await badge.boundingBox())!;
    const circle = (await badge.locator("..").boundingBox())!;
    expect(badgeBox.x).toBeGreaterThanOrEqual(circle.x - 0.5);
    expect(badgeBox.x + badgeBox.width).toBeLessThanOrEqual(circle.x + circle.width + 0.5);

    const card = page.getByTestId("link-card").first();
    await card.scrollIntoViewIfNeeded();
    const cardBox = (await card.boundingBox())!;
    const tags = (await card.getByTestId("link-card-tags").boundingBox())!;
    expect(tags.x + tags.width).toBeLessThanOrEqual(cardBox.x + cardBox.width + 1);
    expect(await noHorizontalOverflow(page)).toBe(true);
  });
});

test.describe("input errors", () => {
  for (const [theme, accent] of THEMES) {
    test(`error text and the red input border stand out — ${theme} ${accent}`, async ({ page }) => {
      test.skip(!isWideProject(), "the folder dialog is the wide one");
      await setup(page, theme, accent);
      await page.route(
        (url) => url.pathname === "/api/folders",
        (route) =>
          route.request().method() === "POST"
            ? route.fulfill({ status: 500, contentType: "application/json", body: "{}" })
            : route.fallback(),
      );
      await page.goto("/home");
      await expectTheme(page, theme, accent);
      await page.getByRole("button", { name: "내 폴더에 폴더 추가" }).click({ timeout: 30_000 });
      const dialog = page.getByRole("dialog");
      const name = dialog.getByPlaceholder("예: 디자인 레퍼런스");
      await name.fill("만들어지면 안 되는 폴더");
      await dialog.getByRole("button", { name: "저장" }).click();
      const error = dialog.getByText("폴더 생성에 실패했어요");
      await expect(error).toBeVisible();
      await settle(page);
      const findings = await statusContrast(page, [error]);
      expect(findings.map((f) => f.text)).toEqual(
        expect.arrayContaining([expect.stringMatching(/^폴더 생성에 실패했어요/)]),
      );
      expect(failing(findings)).toEqual([]);

      // No screen draws a red input border today (and Tailwind 3 has no aria-invalid variant),
      // so this checks the colour such a border uses against the dialog surface.
      const border = await name.evaluate((node) => {
        const parse = (value: string) => value.match(/[\d.]+/g)!.map(Number);
        const lum = ([r, g, b]: number[]) => {
          const ch = (v: number) => {
            const x = v / 255;
            return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
          };
          return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b);
        };
        const probe = document.createElement("span");
        probe.style.color = "hsl(var(--destructive))";
        document.body.append(probe);
        const color = parse(getComputedStyle(probe).color);
        probe.remove();
        let surface = node.parentElement;
        while (
          surface &&
          /rgba\(.*, 0\)$|transparent/.test(getComputedStyle(surface).backgroundColor)
        ) {
          surface = surface.parentElement;
        }
        const background = parse(getComputedStyle(surface ?? document.body).backgroundColor);
        const [hi, lo] = [lum(color), lum(background)].sort((a, b) => b - a);
        return (hi + 0.05) / (lo + 0.05);
      });
      expect(border).toBeGreaterThanOrEqual(3);
    });
  }
});

test.describe("member removal icon", () => {
  for (const theme of ["light", "dark"] as const) {
    test(`uses the red text colour like the other delete icons — ${theme}`, async ({ page }) => {
      test.skip(!isWideProject(), "the share dialog is the wide one");
      await setupWith(page, {
        theme,
        handlers: {
          "GET /api/folders/30/members": (route) =>
            route.fulfill({
              contentType: "application/json",
              body: JSON.stringify({
                success: true,
                data: {
                  ownerId: 1,
                  ownerNickname: "테스터",
                  members: [
                    { userId: 1, role: "OWNER", userNickname: "테스터" },
                    { userId: 2, role: "MEMBER", userNickname: "친구" },
                  ],
                },
                error: null,
              }),
            }),
        },
      });
      await page.goto("/folders/30");
      await page.getByRole("button", { name: "폴더 공유" }).first().click({ timeout: 30_000 });
      const remove = page.getByRole("button", { name: "친구 멤버 제외" });
      await expect(remove).toBeVisible();
      const [icon, expected] = await remove.evaluate((node) => {
        const probe = document.createElement("span");
        probe.style.color = "hsl(var(--destructive-text))";
        document.body.append(probe);
        const value = getComputedStyle(probe).color;
        probe.remove();
        return [getComputedStyle(node.querySelector("svg")!).stroke, value];
      });
      expect(icon).toBe(expected);
    });
  }
});

test.describe("warning toast", () => {
  for (const [theme, accent] of THEMES) {
    test(`login expiry shows a readable warning toast — ${theme} ${accent}`, async ({ page }) => {
      test.skip(!isWideProject(), "one layout is enough for the toast colours");
      await setup(page, theme, accent);
      await page.goto("/home");
      await expect(page.getByText("TanStack Query v5 마이그레이션 정리").first()).toBeVisible({
        timeout: 30_000,
      });
      await expectTheme(page, theme, accent);

      const expired = {
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({
          success: false,
          data: null,
          error: { code: "AUTH_401_0001", message: "토큰이 만료됐어요" },
        }),
      };
      await page.route(
        (url) => url.pathname === "/api/auth/token/refresh/web",
        (route) => route.fulfill(expired),
      );
      await page.route(
        (url) => url.pathname === "/api/todos",
        (route) => route.fulfill(expired),
      );
      await page
        .getByRole("button", { name: /^액션$/ })
        .first()
        .click();

      const title = page.getByText("다시 로그인해주세요", { exact: true });
      await expect(title).toBeVisible({ timeout: 30_000 });
      await settle(page);
      await expectTheme(page, theme, accent);
      const findings = await statusContrast(page, [
        title,
        page.getByText("인증 정보가 만료됐어요.", { exact: true }),
        page.getByText("닫기", { exact: true }).last(),
      ]);
      expect(findings.map((f) => f.text)).toEqual(
        expect.arrayContaining(["다시 로그인해주세요", "인증 정보가 만료됐어요.", "닫기"]),
      );
      expect(failing(findings)).toEqual([]);
    });
  }
});
