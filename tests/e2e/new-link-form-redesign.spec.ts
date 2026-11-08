import { type Locator, type Page, expect, test } from "@playwright/test";

import { boxOf } from "./support/helpers";
import { type ApiHandler, mockSignedInApi } from "./support/mock-save-flow-api";

// #74 U3: the new link form's 메모·액션 fold, the AI 정리 옵션 provider trigger and
// list, and an action error found on save inside the folded group.

const CAPTION = "AI 정리는 요약·태그·폴더를 AI가 정해요";
const LINK_URL = "https://example.com/plain";

const PROVIDERS = [
  {
    providerId: 1,
    providerType: "GEMINI",
    models: [{ id: 10, model: "gemini-2.5-flash", priority: 1, userProviderId: 5 }],
  },
  {
    providerId: 2,
    providerType: "CLAUDE",
    models: [{ id: 20, model: "claude-sonnet-4-5", priority: 1, userProviderId: 6 }],
  },
  {
    providerId: 3,
    providerType: "OPENAI",
    models: [{ id: 30, model: "gpt-5-mini", priority: 1, userProviderId: 7 }],
  },
];

type Server = {
  linkCreates: Record<string, unknown>[];
  aiRequests: Record<string, unknown>[];
  releaseProviders: () => void;
};

async function setUp(
  page: Page,
  { providers = "ready" }: { providers?: "ready" | "held" | "empty" } = {},
): Promise<Server> {
  let openGate: () => void = () => undefined;
  const gate =
    providers === "held"
      ? new Promise<void>((resolve) => {
          openGate = resolve;
        })
      : null;
  const server: Server = { linkCreates: [], aiRequests: [], releaseProviders: () => openGate() };
  const handler: ApiHandler = async ({ path, request, respond }) => {
    if (path === "/api/users/me/settings") {
      await respond({
        display: { theme: "light", accent: "gray" },
        behavior: { allowsReminderNotification: false },
        ai: {
          defaultProvider: { id: 1, type: "GEMINI" },
          defaultModel: { id: 10, model: "gemini-2.5-flash" },
        },
        providers: [],
      });
      return true;
    }
    if (path === "/api/ai/providers/models") {
      if (gate) await gate;
      await respond(providers === "empty" ? [] : PROVIDERS);
      return true;
    }
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
  await mockSignedInApi(page, [handler]);
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

function saveButton(page: Page) {
  return page.getByRole("button", { name: "저장", exact: true });
}

function aiButton(page: Page) {
  return page.getByRole("button", { name: "AI 정리", exact: true });
}

function memoActionsToggle(page: Page) {
  return form(page).getByRole("button", { name: /^메모·액션/ });
}

function providerTrigger(page: Page) {
  return form(page).getByRole("button", { name: /^AI 제공자, / });
}

// The provider list: a popover above the trigger on wide, the sheet's own step on mobile.
async function openProviderList(page: Page) {
  await providerTrigger(page).click();
  if (!isWide(page)) {
    await expect(page.getByRole("heading", { name: "AI 제공자 선택", exact: true })).toBeVisible();
  }
}

async function addAction(page: Page, title: string) {
  const index = await form(page).getByTestId("todo-editor").count();
  await form(page).getByText("액션 추가", { exact: true }).click();
  const action = form(page).getByTestId("todo-editor").nth(index);
  if (title) await action.getByRole("textbox", { name: "액션 제목" }).fill(title);
  return action;
}

test.beforeEach(async ({ context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
});

test.describe("메모·액션 fold (#74)", () => {
  test("starts folded with 선택, opens right under the toggle and folds again", async ({
    page,
  }) => {
    await setUp(page);
    await openForm(page);

    await expect(memoActionsToggle(page)).toHaveAccessibleName("메모·액션, 선택");
    await expect(memoActionsToggle(page)).toHaveAttribute("aria-expanded", "false");
    await memoActionsToggle(page).click();
    await expect(memoActionsToggle(page)).toHaveAttribute("aria-expanded", "true");
    const memo = form(page).getByRole("textbox", { name: "메모", exact: true });
    await expect(memo).toBeVisible();
    await expect(form(page).getByText("액션 추가", { exact: true })).toBeVisible();
    expect((await boxOf(memo)).y).toBeGreaterThan((await boxOf(memoActionsToggle(page))).y);

    await memoActionsToggle(page).click();
    await expect(memo).toHaveCount(0);
  });

  test("the folded toggle sums up 메모 · 액션 1개, then 메모 alone", async ({ page }) => {
    await setUp(page);
    await openForm(page);

    await memoActionsToggle(page).click();
    await form(page)
      .getByRole("textbox", { name: "메모", exact: true })
      .fill("연말 연휴에 갈 때 참고");
    const action = await addAction(page, "렌터카 예약 확인");
    await memoActionsToggle(page).click();
    await expect(form(page).getByText("메모 · 액션 1개", { exact: true })).toBeVisible();

    await memoActionsToggle(page).click();
    await action.getByRole("button", { name: /삭제|지우기|제거/ }).click();
    await memoActionsToggle(page).click();
    await expect(form(page).getByText("메모", { exact: true })).toBeVisible();
    await expect(memoActionsToggle(page)).toHaveAccessibleName("메모·액션, 메모");
  });

  test("an action error in the folded group opens it, scrolls to the row and shows the count in the caption's place", async ({
    page,
  }) => {
    const server = await setUp(page);
    await openForm(page);
    await page.getByRole("textbox", { name: "URL", exact: true }).fill(LINK_URL);
    await page.getByRole("textbox", { name: "제목", exact: true }).fill("접힌 묶음 오류");

    await memoActionsToggle(page).click();
    for (const title of ["첫 액션", "둘째 액션", "셋째 액션", "넷째 액션", "다섯째 액션"]) {
      await addAction(page, title);
    }
    const broken = await addAction(page, "시간 미정 액션");
    await broken.getByTestId("todo-schedule-chip").click();
    await broken.getByTestId("todo-schedule-panel").getByText("한 번", { exact: true }).click();
    await broken.getByTestId("todo-schedule-chip").click();
    await memoActionsToggle(page).click();
    await expect(broken).toHaveCount(0);

    // Scroll the body back to the top so the error row starts out of view.
    await form(page).evaluate((node) => {
      for (const element of Array.from(node.querySelectorAll<HTMLElement>("*"))) {
        if (["auto", "scroll"].includes(getComputedStyle(element).overflowY)) element.scrollTop = 0;
      }
    });

    await saveButton(page).click();
    await expect(memoActionsToggle(page)).toHaveAttribute("aria-expanded", "true");
    const errorRow = form(page).getByTestId("todo-editor").nth(5);
    await expect(errorRow.getByText("날짜와 시간을 선택해주세요.")).toBeInViewport();
    const scrolled = await form(page).evaluate((node) =>
      Array.from(node.querySelectorAll<HTMLElement>("*")).some(
        (element) =>
          ["auto", "scroll"].includes(getComputedStyle(element).overflowY) && element.scrollTop > 0,
      ),
    );
    expect(scrolled).toBe(true);
    const summary = form(page).getByTestId("todo-error-summary");
    await expect(summary).toHaveText("확인할 액션이 1개 있어요");
    await expect(form(page).getByText(CAPTION, { exact: true })).toHaveCount(0);
    expect(server.linkCreates).toHaveLength(0);

    await errorRow.getByRole("button", { name: /삭제|지우기|제거/ }).click();
    await expect(summary).toHaveCount(0);
    await expect(form(page).getByText(CAPTION, { exact: true })).toBeVisible();
  });
});

test.describe("AI 정리 옵션 provider (#74)", () => {
  test("the trigger shows the default provider's logo, name and 기본; the list marks 기본 and the pick", async ({
    page,
  }) => {
    await setUp(page);
    await openForm(page);

    await expect(providerTrigger(page)).toHaveAccessibleName("AI 제공자, Gemini");
    await expect(providerTrigger(page).getByTestId("ai-provider-logo-gemini")).toBeVisible();
    await expect(providerTrigger(page).getByText("기본", { exact: true })).toBeVisible();

    await openProviderList(page);
    const rows = ["Gemini", "Claude", "OpenAI"].map((name) =>
      page.getByRole("button", { name: `${name} 선택` }),
    );
    for (const [index, kind] of (["gemini", "claude", "openai"] as const).entries()) {
      await expect(rows[index].getByTestId(`ai-provider-logo-${kind}`)).toBeVisible();
    }
    await expect(rows[0].getByText("기본", { exact: true })).toBeVisible();
    await expect(rows[1].getByText("기본", { exact: true })).toHaveCount(0);
    await expect(rows[0].getByTestId("ai-provider-picker-check")).toBeVisible();
    await expect(rows[1].getByTestId("ai-provider-picker-check")).toHaveCount(0);

    await rows[1].click();
    await expect(providerTrigger(page)).toHaveAccessibleName("AI 제공자, Claude");
    await expect(providerTrigger(page).getByTestId("ai-provider-logo-claude")).toBeVisible();
    await expect(providerTrigger(page).getByText("기본", { exact: true })).toHaveCount(0);
  });

  test("the logo shows only beside a provider name, not on AI 정리, the folder hint or the switch", async ({
    page,
  }) => {
    await setUp(page);
    await openForm(page);

    await expect(form(page).getByTestId("ai-provider-logo")).toHaveCount(1);
    await expect(aiButton(page).getByTestId("ai-provider-logo")).toHaveCount(0);
    await expect(form(page).getByRole("switch").getByTestId("ai-provider-logo")).toHaveCount(0);
  });

  test("while the providers load, the trigger and the list spin and the trigger says 불러오는 중", async ({
    page,
  }) => {
    const server = await setUp(page, { providers: "held" });
    await openForm(page);

    await expect(providerTrigger(page)).toHaveAccessibleName("AI 제공자, 불러오는 중");
    await expect(providerTrigger(page).getByRole("progressbar")).toBeVisible();
    await openProviderList(page);
    await expect(page.getByLabel("불러오는 중", { exact: true }).last()).toBeVisible();

    server.releaseProviders();
    await expect(page.getByRole("button", { name: "Gemini 선택" })).toBeVisible();
  });

  test("with no providers, the trigger says 제공자 없음 without a logo, the list says so, and AI 정리 warns without a link", async ({
    page,
  }) => {
    const server = await setUp(page, { providers: "empty" });
    await openForm(page);

    await expect(providerTrigger(page)).toHaveAccessibleName("AI 제공자, 제공자 없음");
    await expect(providerTrigger(page).getByTestId("ai-provider-logo")).toHaveCount(0);
    await openProviderList(page);
    await expect(
      page.getByText("사용할 수 있는 AI 제공자가 없어요", { exact: true }),
    ).toBeVisible();
    await expect(page.getByText("잠시 후 다시 시도해주세요.", { exact: true })).toBeVisible();

    if (isWide(page)) {
      await page.keyboard.press("Escape");
    } else {
      await page.getByRole("button", { name: "뒤로", exact: true }).click();
    }
    await page.getByRole("textbox", { name: "URL", exact: true }).fill(LINK_URL);
    await aiButton(page).click();
    await expect(page.getByText("AI 제공자가 필요해요").first()).toBeVisible();
    expect(server.aiRequests).toHaveLength(0);
    expect(server.linkCreates).toHaveLength(0);
  });
});
