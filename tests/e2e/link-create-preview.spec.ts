import { type Page, expect, test } from "@playwright/test";

import { type ApiHandler, mockSignedInApi } from "./support/mock-save-flow-api";

// Issue #5, section 4: the link create screen fetches a preview (main image,
// favicon, title, video) before saving. The web build calls the server preview API
// (`EXPO_PUBLIC_LINK_PREVIEW_URL`, mocked here by path), so these tests need that
// variable set for the web server, e.g. in `.env.local`.

type PreviewData = {
  title: string | null;
  thumbnailUrl: string | null;
  faviconUrl: string | null;
  isVideo: boolean;
};

const PAGE_WITH_IMAGE = "https://example.com/article";
const PAGE_WITH_FAVICON_ONLY = "https://favicon-only.example.com/";
const PAGE_WITHOUT_TITLE = "https://no-title.example.com/";
const PAGE_UNREACHABLE = "https://unreachable.example.com/";

const THUMBNAIL_URL = "https://images.archivelink.app/dev-preview-test.png";
const OTHER_THUMBNAIL_URL = "https://images.archivelink.app/dev-preview-other.png";
const FAVICON_URL = "https://images.archivelink.app/dev-favicon-test.png";

const previews: Record<string, PreviewData> = {
  [PAGE_WITH_IMAGE]: {
    title: "미리보기 대표 제목",
    thumbnailUrl: THUMBNAIL_URL,
    faviconUrl: null,
    isVideo: true,
  },
  "https://example.com/second": {
    title: "두 번째 페이지 제목",
    thumbnailUrl: OTHER_THUMBNAIL_URL,
    faviconUrl: null,
    isVideo: false,
  },
  [PAGE_WITH_FAVICON_ONLY]: {
    title: "파비콘만 있는 페이지",
    thumbnailUrl: null,
    faviconUrl: FAVICON_URL,
    isVideo: false,
  },
  [PAGE_WITHOUT_TITLE]: { title: null, thumbnailUrl: null, faviconUrl: null, isVideo: false },
};

// 1x1 PNG served for the stored preview images.
const PNG_PIXEL = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkaPhfDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

type PreviewServer = {
  requests: { url: string; at: number }[];
  // While held, preview requests wait until `release()` is called.
  hold: () => void;
  release: () => void;
  linkCreates: Record<string, unknown>[];
  aiRequests: Record<string, unknown>[];
};

async function setUpPreviewServer(page: Page): Promise<PreviewServer> {
  let gate: Promise<void> | null = null;
  let openGate: (() => void) | null = null;
  const server: PreviewServer = {
    requests: [],
    hold: () => {
      gate = new Promise((resolve) => {
        openGate = resolve;
      });
    },
    release: () => {
      openGate?.();
      gate = null;
    },
    linkCreates: [],
    aiRequests: [],
  };

  const handlePreview: ApiHandler = async ({ path, request, respond }) => {
    if (path !== "/api/link-previews" || request.method() !== "POST") {
      return false;
    }
    const { url } = request.postDataJSON() as { url: string };
    server.requests.push({ url, at: Date.now() });
    if (gate) {
      await gate;
    }
    if (url === PAGE_UNREACHABLE) {
      await respond(null, 500);
      return true;
    }
    const preview = previews[url] ?? {
      title: null,
      thumbnailUrl: null,
      faviconUrl: null,
      isVideo: false,
    };
    await respond({ url, ...preview }, 201);
    return true;
  };

  const recordSaves: ApiHandler = async ({ path, request, respond }) => {
    if (path === "/api/links" && request.method() === "POST") {
      server.linkCreates.push(request.postDataJSON() as Record<string, unknown>);
      await respond({ id: 101 }, 201);
      return true;
    }
    if (path === "/api/links/ai" && request.method() === "PUT") {
      server.aiRequests.push(request.postDataJSON() as Record<string, unknown>);
      await respond({ id: 102 });
      return true;
    }
    return false;
  };

  await mockSignedInApi(page, [handlePreview, recordSaves]);
  await page.route("https://images.archivelink.app/**", (route) =>
    route.fulfill({ status: 200, contentType: "image/png", body: PNG_PIXEL }),
  );
  return server;
}

function isWide(page: Page) {
  return (page.viewportSize()?.width ?? 0) >= 769;
}

async function openAddLink(page: Page) {
  await page.goto("/home");
  if (isWide(page)) {
    await page.getByText("새 링크", { exact: true }).first().click();
  } else {
    await page.getByLabel("새 링크").click();
  }
  await expect(titleInput(page)).toBeVisible();
}

function urlInput(page: Page) {
  return page.getByPlaceholder(/^https:\/\//);
}

function titleInput(page: Page) {
  return page.locator('input[maxlength="300"]');
}

function saveButton(page: Page) {
  return page.getByRole("button", { name: /저장/ });
}

function aiButton(page: Page) {
  return page.getByRole("button", { name: /AI 정리/ });
}

function previewImage(page: Page) {
  return page.getByTestId("link-create-preview-image");
}

async function expectPreviewLoading(page: Page) {
  await expect(page.getByTestId("link-create-preview-image-loading")).toBeVisible();
  await expect(page.getByTestId("link-create-title-loading")).toBeVisible();
  await expect(saveButton(page)).toBeDisabled();
  await expect(aiButton(page)).toBeDisabled();
}

async function expectPreviewDone(page: Page) {
  await expect(page.getByTestId("link-create-preview-image-loading")).toHaveCount(0);
  await expect(page.getByTestId("link-create-title-loading")).toHaveCount(0);
  await expect(saveButton(page)).toBeEnabled();
  await expect(aiButton(page)).toBeEnabled();
}

async function lastRequest(list: Record<string, unknown>[]) {
  await expect.poll(() => list.length).toBeGreaterThan(0);
  return list.at(-1);
}

test.beforeEach(async ({ context }) => {
  // The form reads the clipboard on open; an empty, readable clipboard keeps it quiet.
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
});

test("typed URL: waits for typing to pause, shows loading and locks both buttons, then fills title and image", async ({
  page,
}) => {
  const server = await setUpPreviewServer(page);
  await openAddLink(page);
  server.hold();

  await urlInput(page).pressSequentially(PAGE_WITH_IMAGE, { delay: 10 });
  const typedAt = Date.now();

  // Loading shows as soon as a previewable URL is typed, before the request goes out.
  await expectPreviewLoading(page);
  await expect.poll(() => server.requests.length, { timeout: 3000 }).toBe(1);
  expect(server.requests[0].url).toBe(PAGE_WITH_IMAGE);
  expect(server.requests[0].at - typedAt).toBeGreaterThanOrEqual(400);

  // Still loading while the server works; the buttons stay locked.
  await expectPreviewLoading(page);
  await saveButton(page).click({ force: true });
  expect(server.linkCreates).toHaveLength(0);

  server.release();
  await expectPreviewDone(page);
  await expect(titleInput(page)).toHaveValue("미리보기 대표 제목");
  await expect(previewImage(page)).toBeVisible();

  // The title stays editable.
  await titleInput(page).fill("직접 고친 제목");
  await saveButton(page).click();
  expect(await lastRequest(server.linkCreates)).toMatchObject({
    url: PAGE_WITH_IMAGE,
    title: "직접 고친 제목",
    thumbnailUrl: THUMBNAIL_URL,
    faviconUrl: null,
    isVideo: true,
  });
});

test("pasted URL: fetches the preview right away", async ({ page }) => {
  const server = await setUpPreviewServer(page);
  await openAddLink(page);

  // `fill` replaces the value in one change, as a paste does.
  await urlInput(page).fill(PAGE_WITH_IMAGE);
  const pastedAt = Date.now();
  await expect.poll(() => server.requests.length, { timeout: 3000 }).toBe(1);
  expect(server.requests[0].at - pastedAt).toBeLessThan(400);
  await expect(titleInput(page)).toHaveValue("미리보기 대표 제목");
  await expect(previewImage(page)).toBeVisible();
});

test("clipboard URL on open: fills the field and fetches the preview right away", async ({
  page,
}) => {
  const server = await setUpPreviewServer(page);
  await page.goto("/home");
  await page.evaluate((url) => navigator.clipboard.writeText(url), PAGE_WITH_IMAGE);
  if (isWide(page)) {
    await page.getByText("새 링크", { exact: true }).first().click();
  } else {
    await page.getByLabel("새 링크").click();
  }

  await expect(urlInput(page)).toHaveValue(PAGE_WITH_IMAGE);
  await expect.poll(() => server.requests.length, { timeout: 3000 }).toBe(1);
  await expect(titleInput(page)).toHaveValue("미리보기 대표 제목");
});

test("page with only a favicon: no image at the top, saves faviconUrl only", async ({ page }) => {
  const server = await setUpPreviewServer(page);
  await openAddLink(page);

  await urlInput(page).fill(PAGE_WITH_FAVICON_ONLY);
  await expectPreviewDone(page);
  await expect(titleInput(page)).toHaveValue("파비콘만 있는 페이지");
  await expect(previewImage(page)).toHaveCount(0);

  await saveButton(page).click();
  expect(await lastRequest(server.linkCreates)).toMatchObject({
    thumbnailUrl: null,
    faviconUrl: FAVICON_URL,
    isVideo: false,
  });
});

test("page without a title: title stays empty, direct save needs a title, AI organize does not", async ({
  page,
}) => {
  const server = await setUpPreviewServer(page);
  await openAddLink(page);

  await urlInput(page).fill(PAGE_WITHOUT_TITLE);
  await expectPreviewDone(page);
  await expect(titleInput(page)).toHaveValue("");
  await expect(previewImage(page)).toHaveCount(0);

  await saveButton(page).click();
  await expect(page.getByText("제목을 입력해주세요.")).toBeVisible();
  expect(server.linkCreates).toHaveLength(0);

  await aiButton(page).click();
  expect(await lastRequest(server.aiRequests)).toMatchObject({
    url: PAGE_WITHOUT_TITLE,
    title: null,
    thumbnailUrl: null,
    faviconUrl: null,
    isVideo: false,
  });
});

test("preview request fails: loading ends and the link saves without images", async ({ page }) => {
  const server = await setUpPreviewServer(page);
  await openAddLink(page);

  await urlInput(page).fill(PAGE_UNREACHABLE);
  await expect.poll(() => server.requests.length).toBe(1);
  await expectPreviewDone(page);
  await expect(titleInput(page)).toHaveValue("");
  await expect(previewImage(page)).toHaveCount(0);

  await titleInput(page).fill("열리지 않는 주소");
  await saveButton(page).click();
  expect(await lastRequest(server.linkCreates)).toMatchObject({
    url: PAGE_UNREACHABLE,
    title: "열리지 않는 주소",
    thumbnailUrl: null,
    faviconUrl: null,
    isVideo: false,
  });
});

test("changing the URL fetches again; a title the user edited is kept", async ({ page }) => {
  const server = await setUpPreviewServer(page);
  await openAddLink(page);

  await urlInput(page).fill(PAGE_WITH_IMAGE);
  await expect(titleInput(page)).toHaveValue("미리보기 대표 제목");

  // Not edited yet: the new URL's title replaces it.
  await urlInput(page).fill("https://example.com/second");
  await expect
    .poll(() => server.requests.map((entry) => entry.url))
    .toContain("https://example.com/second");
  await expect(titleInput(page)).toHaveValue("두 번째 페이지 제목");
  await expect(previewImage(page).locator("img")).toHaveAttribute("src", OTHER_THUMBNAIL_URL);

  // Edited: later previews leave it alone.
  await titleInput(page).fill("내가 정한 제목");
  await urlInput(page).fill(PAGE_WITH_FAVICON_ONLY);
  await expect
    .poll(() => server.requests.map((entry) => entry.url))
    .toContain(PAGE_WITH_FAVICON_ONLY);
  await expectPreviewDone(page);
  await expect(titleInput(page)).toHaveValue("내가 정한 제목");
  await expect(previewImage(page)).toHaveCount(0);

  await saveButton(page).click();
  expect(await lastRequest(server.linkCreates)).toMatchObject({
    url: PAGE_WITH_FAVICON_ONLY,
    title: "내가 정한 제목",
    thumbnailUrl: null,
    faviconUrl: FAVICON_URL,
  });
});
