import { type Locator, type Page, expect, test } from "@playwright/test";

import { boxOf, isWideProject } from "./support/helpers";
import { makeLink } from "./support/mock-api";
import { type ApiHandler, mockSignedInApi } from "./support/mock-save-flow-api";

const PAGE_WITH_IMAGE = "https://example.com/article";
const THUMBNAIL_URL = "https://images.archivelink.app/dev-preview-test.png";
const PNG_PIXEL = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkaPhfDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);
const SAVE_FAILED = "링크 저장에 실패했습니다. 잠시 후 다시 시도해주세요.";

type FormServer = {
  linkCreates: Record<string, unknown>[];
  savedLinks: Record<string, unknown>[];
  aiRequests: Record<string, unknown>[];
  failNextCreates: number;
  failNextAi: number;
  createDelayMs: number;
  folders: (typeof PICKABLE_FOLDER)[];
};

const LONG_FOLDER_NAME = "캠핑 모임 공유 폴더 이름이 아주 길어서 한 줄에 다 들어가지 않는 경우";

const PICKABLE_FOLDER = {
  id: 2,
  ownerId: 1,
  name: "가볼 곳",
  emoji: "☕",
  isShared: false,
  shareCounts: 0,
  linkCounts: 0,
};

async function setUpFormServer(page: Page): Promise<FormServer> {
  const server: FormServer = {
    linkCreates: [],
    savedLinks: [],
    aiRequests: [],
    failNextCreates: 0,
    failNextAi: 0,
    createDelayMs: 0,
    folders: [PICKABLE_FOLDER],
  };
  const handler: ApiHandler = async ({ path, request, respond }) => {
    if (path === "/api/folders" && request.method() === "GET") {
      await respond({
        isEmpty: false,
        contents: server.folders,
        nextCursor: null,
        hasNext: false,
      });
      return true;
    }
    if (path === "/api/links" && request.method() === "GET") {
      const folderId = new URL(request.url()).searchParams.get("folderId");
      const contents = server.savedLinks
        .map((payload, index) =>
          makeLink({
            id: 101 + index,
            url: String(payload.url),
            title: String(payload.title),
            folderId: (payload.folderId as number | null) ?? null,
            folderName: payload.folderId ? PICKABLE_FOLDER.name : null,
            folderEmoji: payload.folderId ? PICKABLE_FOLDER.emoji : null,
          }),
        )
        .filter((link) => folderId == null || String(link.folderId) === folderId);
      await respond({ isEmpty: contents.length === 0, contents, nextCursor: null, hasNext: false });
      return true;
    }
    if (path === "/api/links/ai" && request.method() === "PUT") {
      server.aiRequests.push(request.postDataJSON() as Record<string, unknown>);
      await new Promise((resolve) => setTimeout(resolve, 300));
      if (server.failNextAi > 0) {
        server.failNextAi -= 1;
        await respond(null, 500);
        return true;
      }
      await respond({ id: 102 });
      return true;
    }
    if (path === "/api/link-previews" && request.method() === "POST") {
      const { url } = request.postDataJSON() as { url: string };
      const hasImage = url === PAGE_WITH_IMAGE;
      await respond(
        {
          url,
          title: hasImage ? "미리보기 대표 제목" : null,
          thumbnailUrl: hasImage ? THUMBNAIL_URL : null,
          faviconUrl: null,
          isVideo: false,
        },
        201,
      );
      return true;
    }
    if (path === "/api/links" && request.method() === "POST") {
      server.linkCreates.push(request.postDataJSON() as Record<string, unknown>);
      if (server.createDelayMs) {
        await new Promise((resolve) => setTimeout(resolve, server.createDelayMs));
      }
      if (server.failNextCreates > 0) {
        server.failNextCreates -= 1;
        await respond(null, 500);
        return true;
      }
      server.savedLinks.push(server.linkCreates[server.linkCreates.length - 1]);
      await respond({ id: 100 + server.savedLinks.length }, 201);
      return true;
    }
    return false;
  };
  await mockSignedInApi(page, [handler]);
  await page.route("https://images.archivelink.app/**", (route) =>
    route.fulfill({ status: 200, contentType: "image/png", body: PNG_PIXEL }),
  );
  return server;
}

function isWide(page: Page) {
  return (page.viewportSize()?.width ?? 0) >= 769;
}

function form(page: Page): Locator {
  return isWide(page)
    ? page.getByRole("dialog", { name: "새 링크 추가" })
    : page.getByRole("slider", { name: "Bottom Sheet" });
}

async function openForm(page: Page) {
  await page.goto("/home");
  await page.evaluate(() => navigator.clipboard.writeText(""));
  if (isWide(page)) {
    await page.getByText("새 링크", { exact: true }).first().click();
  } else {
    await page.getByLabel("새 링크").click();
  }
  await expect(page.getByText("새 링크 추가", { exact: true }).first()).toBeVisible();
  await expect(saveButton(page)).toBeVisible();
}

function urlInput(page: Page) {
  return page.getByRole("textbox", { name: "URL", exact: true });
}

function titleInput(page: Page) {
  return page.getByRole("textbox", { name: "제목", exact: true });
}

function saveButton(page: Page) {
  return page.getByRole("button", { name: "저장", exact: true });
}

function aiButton(page: Page) {
  return page.getByRole("button", { name: "AI 정리", exact: true });
}

function closeButton(page: Page) {
  return isWide(page)
    ? form(page).getByRole("button", { name: /close|닫기/i })
    : page.getByRole("button", { name: "닫기", exact: true });
}

async function settledSheetTop(page: Page) {
  let previous: number | null = null;
  let steadyReads = 0;
  await expect
    .poll(
      async () => {
        const current = (await form(page).boundingBox())?.y ?? null;
        const viewportHeight = page.viewportSize()?.height ?? 0;
        const isSteady = current !== null && current < viewportHeight - 40 && current === previous;
        steadyReads = isSteady ? steadyReads + 1 : 0;
        previous = current;
        return steadyReads >= 2;
      },
      { intervals: [250] },
    )
    .toBe(true);
}

async function expectClosed(page: Page) {
  await expect(page.getByText("새 링크 추가", { exact: true })).toHaveCount(0);
}

test.beforeEach(async ({ context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
});

test.describe("new link form actions and copy (#46)", () => {
  test("one filled 주 버튼: AI 정리 is the gradient and wider, 저장 is the outline, and there is no 취소", async ({
    page,
  }) => {
    await setUpFormServer(page);
    await openForm(page);

    await expect(page.getByRole("button", { name: "취소", exact: true })).toHaveCount(0);
    await expect(saveButton(page)).toBeVisible();
    await expect(aiButton(page)).toBeVisible();
    await expect
      .poll(async () =>
        Math.abs((await boxOf(aiButton(page))).y - (await boxOf(saveButton(page))).y),
      )
      .toBeLessThanOrEqual(1);
    const save = await boxOf(saveButton(page));
    const ai = await boxOf(aiButton(page));
    expect(ai.width).toBeGreaterThan(save.width);
    expect(ai.x).toBeGreaterThan(save.x);

    const saveBorder = await saveButton(page).evaluate(
      (node) => getComputedStyle(node).borderTopWidth,
    );
    expect(parseFloat(saveBorder)).toBeGreaterThan(0);
    const aiHasGradient = await aiButton(page).evaluate((node) =>
      Array.from(node.querySelectorAll<HTMLElement>("*")).some((child) =>
        getComputedStyle(child).backgroundImage.includes("gradient"),
      ),
    );
    expect(aiHasGradient).toBe(true);
  });

  test("wide and mobile share the same title, field names and folder default, and say 액션 instead of 할 일", async ({
    page,
  }) => {
    await setUpFormServer(page);
    await openForm(page);
    const scope = form(page);

    for (const text of ["새 링크 추가", "URL", "📋 클립보드 자동 감지", "제목", "AI 제공자"]) {
      await expect(scope.getByText(text, { exact: true }).first()).toBeVisible();
    }
    await expect(scope.getByText("폴더", { exact: true }).first()).toBeVisible();
    await expect(scope.getByText("없음 - ✨ AI 자동 분류", { exact: true })).toBeVisible();
    await expect(urlInput(page)).toHaveAttribute("placeholder", "https://www.example.com");
    await expect(scope.getByText("링크 추가", { exact: true })).toHaveCount(0);
    await expect(scope.getByText("링크 제목", { exact: true })).toHaveCount(0);
    await expect(scope.getByText("액션 생성", { exact: true })).toBeVisible();
    await expect(
      scope.getByText("AI 정리 때 링크에 마감일이 있으면 액션을 자동으로 만들어줘요"),
    ).toBeVisible();
    await expect(scope.getByText(/할 일/)).toHaveCount(0);

    if (isWide(page)) {
      await expect(scope.getByText("✅ 액션 (선택, 여러 개 가능)")).toBeAttached();
      await expect(scope.getByText("액션 추가")).toBeAttached();
      await expect(scope.getByText("메모 (선택)")).toBeAttached();
    } else {
      await expect(scope.getByText(/✅ 액션/)).toHaveCount(0);
      await expect(scope.getByText("메모 (선택)")).toHaveCount(0);
    }
  });

  test("a picked folder shows its name without the AI sparkle", async ({ page }) => {
    await setUpFormServer(page);
    await openForm(page);

    if (isWide(page)) {
      await form(page)
        .getByRole("button", { name: /^폴더, / })
        .click();
    } else {
      await form(page).getByRole("button", { name: "변경" }).first().click();
    }
    await page.getByRole("radio", { name: /가볼 곳/ }).click();
    await expect(form(page).getByText("☕ 가볼 곳", { exact: true })).toBeVisible();
    await expect(form(page).getByText(/✨/)).toHaveCount(0);
  });

  test("empty URL and empty title keep the form open with the field messages", async ({ page }) => {
    const server = await setUpFormServer(page);
    await openForm(page);

    await saveButton(page).click();
    await expect(page.getByText("URL을 입력해주세요.")).toBeVisible();
    await expect(page.getByText("제목을 입력해주세요.")).toBeVisible();
    await aiButton(page).click();
    await expect(page.getByText("URL을 입력해주세요.")).toBeVisible();

    await urlInput(page).fill("https://example.com/plain");
    await expect(saveButton(page)).toBeEnabled();
    await saveButton(page).click();
    await expect(page.getByText("제목을 입력해주세요.")).toBeVisible();
    await expect(page.getByText("URL을 입력해주세요.")).toHaveCount(0);
    expect(server.linkCreates).toHaveLength(0);
    await expect(form(page)).toBeVisible();
  });

  test("a failed save shows the message right above the buttons, keeps the input, and a retry closes the form", async ({
    page,
  }) => {
    const server = await setUpFormServer(page);
    server.failNextCreates = 1;
    await openForm(page);

    await urlInput(page).fill("https://example.com/plain");
    await titleInput(page).fill("실패 뒤 다시 저장");
    await expect(saveButton(page)).toBeEnabled();
    await saveButton(page).click();

    const alert = page.getByRole("alert").filter({ hasText: SAVE_FAILED });
    await expect(alert).toBeVisible();
    await expect
      .poll(async () => {
        const alertBox = await boxOf(alert);
        const saveBox = await boxOf(saveButton(page));
        const gap = saveBox.y - (alertBox.y + alertBox.height);
        return (
          gap >= -1 && gap < 24 && saveBox.y + saveBox.height <= (page.viewportSize()?.height ?? 0)
        );
      })
      .toBe(true);
    await expect(titleInput(page)).toHaveValue("실패 뒤 다시 저장");

    await saveButton(page).click();
    await expectClosed(page);
    expect(server.linkCreates).toHaveLength(2);
  });

  test("a double press on 저장 creates one link", async ({ page }) => {
    const server = await setUpFormServer(page);
    server.createDelayMs = 600;
    await openForm(page);

    await urlInput(page).fill("https://example.com/plain");
    await titleInput(page).fill("한 번만 저장");
    await expect(saveButton(page)).toBeEnabled();
    await saveButton(page).dblclick();
    await expectClosed(page);
    expect(server.linkCreates).toHaveLength(1);
  });

  test("a saved link shows up in the list and in its folder without a reload", async ({ page }) => {
    const server = await setUpFormServer(page);
    await openForm(page);
    await urlInput(page).fill("https://example.com/plain");
    await titleInput(page).fill("폴더에 저장한 새 링크");
    if (isWide(page)) {
      await form(page)
        .getByRole("button", { name: /^폴더, / })
        .click();
    } else {
      await form(page).getByRole("button", { name: "변경" }).first().click();
    }
    await page.getByRole("radio", { name: /가볼 곳/ }).click();
    await expect(saveButton(page)).toBeEnabled();
    await saveButton(page).click();
    await expectClosed(page);
    expect(server.linkCreates[0]?.folderId).toBe(2);

    if (isWide(page)) {
      await page.keyboard.press("Escape");
      await expect(page.getByText("폴더에 저장한 새 링크").first()).toBeVisible();
      await page
        .getByRole("button", { name: /가볼 곳, 링크/ })
        .first()
        .click();
    } else {
      await page.getByText("홈", { exact: true }).last().click();
      await expect(page).toHaveURL(/\/home$/);
      await expect(page.getByText("폴더에 저장한 새 링크").first()).toBeVisible();
      await page.getByText("폴더", { exact: true }).last().click();
      await page
        .getByRole("button", { name: /가볼 곳, 링크/ })
        .first()
        .click();
    }
    await expect(page).toHaveURL(/\/folders\/2/);
    await expect(page.getByText("폴더에 저장한 새 링크").first()).toBeVisible();
  });

  test("a failed AI 정리 shows the failure notice and keeps the form and the input", async ({
    page,
  }) => {
    const server = await setUpFormServer(page);
    server.failNextAi = 1;
    await openForm(page);
    await urlInput(page).fill("https://example.com/plain");
    await expect(aiButton(page)).toBeEnabled();
    await aiButton(page).click();
    await expect(page.getByText("AI 정리 실패").first()).toBeVisible();
    await expect(form(page)).toBeVisible();
    await expect(urlInput(page)).toHaveValue("https://example.com/plain");
    expect(server.aiRequests).toHaveLength(1);
  });

  test("a double press on AI 정리 sends one request", async ({ page }) => {
    const server = await setUpFormServer(page);
    await openForm(page);
    await urlInput(page).fill("https://example.com/plain");
    await expect(aiButton(page)).toBeEnabled();
    await aiButton(page).dblclick();
    await expect(page.getByText("AI 정리 시작").first()).toBeVisible();
    expect(server.aiRequests).toHaveLength(1);
  });

  test("a very long folder name stays on one line and the buttons keep their shape", async ({
    page,
  }) => {
    const server = await setUpFormServer(page);
    server.folders = [{ ...PICKABLE_FOLDER, name: LONG_FOLDER_NAME }];
    await openForm(page);

    if (isWide(page)) {
      await form(page)
        .getByRole("button", { name: /^폴더, / })
        .click();
    } else {
      await form(page).getByRole("button", { name: "변경" }).first().click();
    }
    await page.getByRole("radio", { name: new RegExp(LONG_FOLDER_NAME.slice(0, 8)) }).click();
    const label = form(page).getByText(`☕ ${LONG_FOLDER_NAME}`, { exact: true });
    await expect(label).toBeVisible();
    const fontSize = await label.evaluate((node) => parseFloat(getComputedStyle(node).fontSize));
    expect((await boxOf(label)).height).toBeLessThan(fontSize * 2);
    const buttonHeight = isWide(page) ? 40 : 48;
    await expect
      .poll(async () => {
        const save = await boxOf(saveButton(page));
        const ai = await boxOf(aiButton(page));
        return (
          Math.round(save.height) === buttonHeight &&
          Math.round(ai.height) === buttonHeight &&
          Math.abs(ai.y - save.y) <= 1 &&
          ai.width > save.width
        );
      })
      .toBe(true);
  });

  test("closing with × empties the form for the next open", async ({ page }) => {
    await setUpFormServer(page);
    await openForm(page);
    await urlInput(page).fill("https://example.com/plain");
    await titleInput(page).fill("버릴 제목");

    await closeButton(page).click();
    await expectClosed(page);
    await openForm(page);
    await expect(urlInput(page)).toHaveValue("");
    await expect(titleInput(page)).toHaveValue("");
  });
});

test.describe("wide new link dialog (#46)", () => {
  test.beforeEach(() => {
    test.skip(!isWideProject(), "wide dialog");
  });

  test("Esc closes the dialog", async ({ page }) => {
    await setUpFormServer(page);
    await openForm(page);
    await page.keyboard.press("Escape");
    await expectClosed(page);
  });

  test("the AI 제공자 field next to 폴더 opens the provider list and shows the pick", async ({
    page,
  }) => {
    await setUpFormServer(page);
    await openForm(page);
    const folderField = await boxOf(form(page).getByRole("button", { name: /^폴더, / }));
    const providerTrigger = form(page).getByRole("button", { name: /^AI 제공자, / });
    const providerField = await boxOf(providerTrigger);
    expect(Math.abs(providerField.y - folderField.y)).toBeLessThanOrEqual(1);
    expect(providerField.x).toBeGreaterThan(folderField.x);

    await providerTrigger.click();
    await page.getByRole("button", { name: "OpenAI 선택" }).click();
    await expect(page.getByRole("button", { name: "OpenAI 선택" })).toHaveCount(0);
    await expect(form(page).getByRole("button", { name: "AI 제공자, OpenAI" })).toBeVisible();
  });

  test("the bottom row holds only 저장 and AI 정리, with the provider above it in the form", async ({
    page,
  }) => {
    await setUpFormServer(page);
    await openForm(page);
    const save = await boxOf(saveButton(page));
    const provider = await boxOf(form(page).getByRole("button", { name: /^AI 제공자, / }));
    expect(provider.y + provider.height).toBeLessThan(save.y);
    await expect(form(page).getByRole("button", { name: "취소", exact: true })).toHaveCount(0);
    await expect(form(page).getByRole("button", { name: /기본 제공자 사용/ })).toHaveCount(0);
  });

  for (const [width, kind] of [
    [768, "sheet"],
    [769, "dialog"],
  ] as const) {
    test(`at ${width}px the new link form opens as a ${kind}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await setUpFormServer(page);
      await openForm(page);
      if (kind === "dialog") {
        await expect(page.getByRole("dialog", { name: "새 링크 추가" })).toBeVisible();
      } else {
        await expect(page.getByRole("slider", { name: "Bottom Sheet" })).toBeVisible();
        await expect(page.getByRole("dialog", { name: "새 링크 추가" })).toHaveCount(0);
      }
    });
  }
});

test.describe("mobile new link sheet (#46)", () => {
  test.beforeEach(() => {
    test.skip(isWideProject(), "mobile sheet");
  });

  test("the buttons sit below the option cards at the bottom of the sheet and stay put while the content scrolls", async ({
    page,
  }) => {
    await setUpFormServer(page);
    await openForm(page);
    await settledSheetTop(page);
    await urlInput(page).fill(PAGE_WITH_IMAGE);
    await expect(page.getByTestId("link-create-preview-image")).toBeVisible();
    await expect(titleInput(page)).toHaveValue("미리보기 대표 제목");
    await settledSheetTop(page);

    const viewportHeight = page.viewportSize()?.height ?? 0;
    const save = await boxOf(saveButton(page));
    const ai = await boxOf(aiButton(page));
    expect(viewportHeight - (save.y + save.height)).toBeLessThanOrEqual(40);
    expect(Math.abs(ai.y - save.y)).toBeLessThanOrEqual(1);

    const scrolled = await form(page).evaluate((node) => {
      const scroller = Array.from(node.querySelectorAll<HTMLElement>("*")).find(
        (element) =>
          ["auto", "scroll"].includes(getComputedStyle(element).overflowY) &&
          element.scrollHeight > element.clientHeight + 1,
      );
      if (!scroller) return false;
      scroller.scrollTop = scroller.scrollHeight;
      return true;
    });
    expect(scrolled).toBe(true);

    const lastCard = form(page).getByRole("button", { name: "변경" }).last();
    await expect
      .poll(async () => {
        const card = await boxOf(lastCard);
        return card.y + card.height < save.y;
      })
      .toBe(true);
    expect(Math.round((await boxOf(saveButton(page))).y)).toBe(Math.round(save.y));
  });

  test("typing in the form keeps the same 저장 button instead of rebuilding the footer", async ({
    page,
  }) => {
    await setUpFormServer(page);
    await openForm(page);
    await saveButton(page).evaluate((node) => {
      (node as HTMLElement & { __mark?: number }).__mark = 46;
    });
    await titleInput(page).pressSequentially("제목을 한 글자씩", { delay: 20 });
    await urlInput(page).fill("https://example.com/plain");
    await expect(saveButton(page)).toBeEnabled();
    const mark = await saveButton(page).evaluate(
      (node) => (node as HTMLElement & { __mark?: number }).__mark ?? null,
    );
    expect(mark).toBe(46);
  });

  test("sub-steps hide the buttons and 닫기, and coming back brings them again", async ({
    page,
  }) => {
    await setUpFormServer(page);
    await openForm(page);

    await form(page).getByRole("button", { name: "변경" }).first().click();
    await expect(form(page).getByText("폴더 선택", { exact: true })).toBeVisible();
    await expect(saveButton(page)).toHaveCount(0);
    await expect(aiButton(page)).toHaveCount(0);
    await expect(page.getByRole("button", { name: "닫기", exact: true })).toHaveCount(0);

    await form(page).getByRole("button", { name: "뒤로", exact: true }).click();
    await expect(saveButton(page)).toBeVisible();
    await expect(page.getByRole("button", { name: "닫기", exact: true })).toBeVisible();

    await form(page).getByRole("button", { name: "변경" }).last().click();
    await expect(form(page).getByText("AI 제공자 선택", { exact: true })).toBeVisible();
    await expect(saveButton(page)).toHaveCount(0);
    await page.getByRole("button", { name: "OpenAI 선택" }).click();
    await expect(form(page).getByText("새 링크 추가", { exact: true })).toBeVisible();
    await expect(form(page).getByText("OpenAI", { exact: true })).toBeVisible();
    await expect(saveButton(page)).toBeVisible();
  });
});
