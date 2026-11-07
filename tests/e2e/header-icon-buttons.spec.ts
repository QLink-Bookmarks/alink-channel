import { type Locator, type Page, type Route, expect, test } from "@playwright/test";

import { boxOf, cssOf, isWideProject } from "./support/helpers";
import { envelope, makeDetail, makeLink, mockApi } from "./support/mock-api";

// #57 unit A: every header icon button looks like the home `알림`·`설정` reference
// (36px, transparent, soft background on hover/press, foreground icon) and presses on a
// 44×44 area (hitSlop 4) on web too. The folder header is covered by the folder specs.

const TRANSPARENT = "rgba(0, 0, 0, 0)";

function adminProfileHandler() {
  return {
    "GET /api/users/me": (route: Route) =>
      route.fulfill({
        contentType: "application/json",
        body: JSON.stringify(
          envelope({
            id: 1,
            username: "e2e",
            nickname: "테스터",
            role: "ADMIN",
            avatarEmoji: "🌸",
            allowsPrivacy: true,
            allowsAiUsage: true,
          }),
        ),
      }),
  };
}

/** Resolved colour of a theme token such as `--foreground`. */
async function tokenColor(page: Page, token: string): Promise<string> {
  return page.evaluate((name) => {
    const probe = document.createElement("span");
    probe.style.color = `hsl(var(${name}))`;
    document.body.append(probe);
    const value = getComputedStyle(probe).color;
    probe.remove();
    return value;
  }, token);
}

/** Resolved stroke colour of the button's icon. */
async function iconColor(button: Locator): Promise<string> {
  return button
    .locator("svg")
    .first()
    .evaluate((node) => getComputedStyle(node).stroke);
}

/** The reference look: 36px, no border, transparent at rest, rounded 12px. */
async function expectReferenceLook(button: Locator, name: string, referenceIcon: string) {
  await expect(button, name).toBeVisible();
  const box = await boxOf(button);
  expect(Math.round(box.width), `${name} width`).toBe(36);
  expect(Math.round(box.height), `${name} height`).toBe(36);
  await expect.poll(() => cssOf(button, "background-color"), { message: name }).toBe(TRANSPARENT);
  expect(parseFloat(await cssOf(button, "border-top-width")), `${name} border`).toBe(0);
  expect(parseFloat(await cssOf(button, "border-top-left-radius")), `${name} radius`).toBe(12);
  expect(await iconColor(button), `${name} icon colour`).toBe(referenceIcon);
}

async function expectHoverBackground(page: Page, button: Locator, name: string) {
  await button.hover();
  await expect
    .poll(() => cssOf(button, "background-color"), { message: `${name} hover` })
    .not.toBe(TRANSPARENT);
  await page.mouse.move(0, 0);
  await expect.poll(() => cssOf(button, "background-color")).toBe(TRANSPARENT);
}

/** The button under a viewport point (the element hit there, or its button ancestor). */
async function buttonLabelAt(page: Page, x: number, y: number): Promise<string | null> {
  return page.evaluate(
    ([px, py]) => {
      const hit = document.elementFromPoint(px, py);
      const button = hit?.closest('[role="button"]');
      return button?.getAttribute("aria-label") ?? null;
    },
    [x, y],
  );
}

/** A 44×44 press area centred on the 36px button: points 3px past each edge still hit it. */
async function expectPressArea(page: Page, button: Locator, name: string) {
  const box = await boxOf(button);
  const midX = box.x + box.width / 2;
  const midY = box.y + box.height / 2;
  const points: [string, number, number][] = [
    ["left", box.x - 3, midY],
    ["right", box.x + box.width + 3, midY],
    ["top", midX, box.y - 3],
    ["bottom", midX, box.y + box.height + 3],
  ];
  for (const [side, x, y] of points) {
    expect(await buttonLabelAt(page, x, y), `${name} ${side} edge`).toBe(name);
  }
  // Past the 4px slop the press area ends.
  expect(
    await buttonLabelAt(page, box.x + box.width + 5, midY),
    `${name} beyond slop right`,
  ).not.toBe(name);
  expect(
    await buttonLabelAt(page, midX, box.y + box.height + 5),
    `${name} beyond slop bottom`,
  ).not.toBe(name);
}

async function pressAt(page: Page, x: number, y: number) {
  if (isWideProject()) {
    await page.mouse.click(x, y);
  } else {
    await page.touchscreen.tap(x, y);
  }
}

async function openDetailPanel(page: Page, id: number) {
  await page.goto(`/links?linkId=${id}`);
  await expect(page.getByTestId("link-detail-title")).toBeVisible();
  await expect(page.getByTestId("link-detail-close")).toBeInViewport({ ratio: 1 });
}

test.describe("header icon buttons share the home reference look", () => {
  test("home header buttons are the reference: transparent 36px, 8px apart, soft hover", async ({
    page,
  }) => {
    await mockApi(page);
    await page.goto("/home");
    const [first, second] = isWideProject() ? ["알림", "설정"] : ["검색", "알림"];
    const a = page.getByRole("button", { name: first, exact: true });
    const b = page.getByRole("button", { name: second, exact: true });
    const reference = await iconColor(page.getByRole("button", { name: "알림", exact: true }));
    expect(reference, "reference icon is the foreground colour").toBe(
      await tokenColor(page, "--foreground"),
    );
    await expectReferenceLook(a, first, reference);
    await expectReferenceLook(b, second, reference);
    const boxA = await boxOf(a);
    const boxB = await boxOf(b);
    expect(Math.round(boxB.x - (boxA.x + boxA.width)), "gap between header buttons").toBe(8);
    if (isWideProject()) {
      await expectHoverBackground(page, a, first);
      await expectHoverBackground(page, b, second);
    }
  });

  test("announcement compose button is ghost like the reference and opens the editor", async ({
    page,
  }) => {
    await mockApi(page, { handlers: adminProfileHandler() });
    await page.goto("/announcements");
    const compose = page.getByRole("button", { name: "공지사항 작성" });
    const reference = await tokenColor(page, "--foreground");
    await expectReferenceLook(compose, "공지사항 작성", reference);
    await expectPressArea(page, compose, "공지사항 작성");
    if (isWideProject()) {
      await expectHoverBackground(page, compose, "공지사항 작성");
    }
    await compose.click();
    await expect(page.getByText("새 공지사항")).toBeVisible();
  });

  test("link detail panel close is the reference button; refresh is a transparent toolbar command with its name", async ({
    page,
  }) => {
    test.skip(!isWideProject(), "the detail panel is wide only");
    const link = makeLink({ id: 1 });
    await mockApi(page, { links: [link], details: { 1: makeDetail(link) } });
    await openDetailPanel(page, 1);
    const reference = await tokenColor(page, "--foreground");
    const refresh = page.getByTestId("link-detail-refresh");
    const close = page.getByTestId("link-detail-close");
    await expectReferenceLook(close, "닫기", reference);
    await expectHoverBackground(page, close, "닫기");
    await expectPressArea(page, close, "닫기");

    // #74: the commands are 32px ghost buttons with their names, muted at rest.
    await expect(refresh).toHaveText("새로고침");
    const refreshBox = await boxOf(refresh);
    expect(Math.round(refreshBox.height)).toBe(32);
    expect(parseFloat(await cssOf(refresh, "border-top-width"))).toBe(0);
    await expect.poll(() => cssOf(refresh, "background-color")).toBe(TRANSPARENT);
    expect(await iconColor(refresh)).toBe(await tokenColor(page, "--muted-foreground"));
    await expectHoverBackground(page, refresh, "새로고침");
    const closeBox = await boxOf(close);
    expect(closeBox.x).toBeGreaterThan(refreshBox.x + refreshBox.width);
  });

  test("refresh keeps its refreshing and failed icon colours", async ({ page }) => {
    test.setTimeout(60_000);
    test.skip(!isWideProject(), "the detail panel is wide only");
    const link = makeLink({ id: 1 });
    let mode: "ok" | "slow" | "fail" = "ok";
    let release: (() => void) | null = null;
    const state = await mockApi(page, {
      links: [link],
      details: { 1: makeDetail(link) },
      handlers: {
        "GET /api/links/1": async (route) => {
          if (mode === "slow") {
            await new Promise<void>((resolve) => {
              release = resolve;
            });
          }
          if (mode === "fail") {
            return route.fulfill({
              status: 500,
              contentType: "application/json",
              body: JSON.stringify({
                success: false,
                data: null,
                error: { message: "SERVER_ERROR" },
              }),
            });
          }
          return route.fulfill({
            contentType: "application/json",
            body: JSON.stringify(envelope(state.details[1])),
          });
        },
      },
    });
    await openDetailPanel(page, 1);
    const reference = await tokenColor(page, "--muted-foreground");
    const refresh = page.getByTestId("link-detail-refresh");
    expect(await iconColor(refresh)).toBe(reference);

    mode = "slow";
    await refresh.click();
    const refreshing = page.getByRole("button", { name: "새로고침 중" });
    await expect(refreshing).toBeVisible();
    const refreshingColour = await iconColor(refreshing);
    expect(refreshingColour).not.toBe(reference);
    expect(refreshingColour).toBe(await tokenColor(page, "--primary"));
    mode = "fail";
    (release as (() => void) | null)?.();

    const failed = page.getByRole("button", { name: "새로고침 실패, 다시 시도" });
    // The detail query retries before the refresh reports a failure.
    await expect(failed).toBeVisible({ timeout: 30_000 });
    await page.mouse.move(0, 0);
    expect(await iconColor(failed)).toBe(await tokenColor(page, "--destructive-text"));

    mode = "ok";
    await failed.click();
    await expect(page.getByRole("button", { name: "새로고침", exact: true })).toBeVisible();
    await page.mouse.move(0, 0);
    expect(await iconColor(page.getByTestId("link-detail-refresh"))).toBe(reference);
  });

  test("panel close still closes the panel", async ({ page }) => {
    test.skip(!isWideProject(), "the detail panel is wide only");
    const link = makeLink({ id: 1 });
    await mockApi(page, { links: [link], details: { 1: makeDetail(link) } });
    await openDetailPanel(page, 1);
    await page.getByTestId("link-detail-close").click();
    await expect(page.getByTestId("detail-panel")).toHaveCount(0);
    await expect(page).not.toHaveURL(/linkId=/);
  });

  test("a missing link shows a transparent close that closes the panel", async ({ page }) => {
    test.skip(!isWideProject(), "the detail panel is wide only");
    test.setTimeout(60_000);
    await mockApi(page);
    await page.goto("/links?linkId=999");
    // The detail query retries the 404 before the panel shows not-found.
    await expect(page.getByText("찾으시는 링크가 없어요")).toBeVisible({ timeout: 30_000 });
    const close = page.getByTestId("link-detail-not-found-close");
    await expect(close).toBeInViewport({ ratio: 1 });
    const reference = await tokenColor(page, "--foreground");
    await expectReferenceLook(close, "닫기", reference);
    await close.click();
    await expect(page.getByText("찾으시는 링크가 없어요")).toHaveCount(0);
    await expect(page).not.toHaveURL(/linkId=/);
  });
});

test.describe("header icon buttons press on a 44×44 area", () => {
  test("wide top bar 알림·설정: just outside each icon presses it, not its neighbour", async ({
    page,
  }) => {
    test.skip(!isWideProject(), "wide top bar");
    await mockApi(page);
    await page.goto("/home");
    const bell = page.getByRole("button", { name: "알림", exact: true });
    const settings = page.getByRole("button", { name: "설정", exact: true });
    await expectPressArea(page, bell, "알림");
    await expectPressArea(page, settings, "설정");

    // 3px right of the bell, inside the 8px gap, is still the bell.
    const bellBox = await boxOf(bell);
    await pressAt(page, bellBox.x + bellBox.width + 3, bellBox.y + bellBox.height / 2);
    await expect(page).toHaveURL(/\/notifications/);

    await page.goto("/home");
    const settingsBox = await boxOf(settings);
    await pressAt(page, settingsBox.x - 3, settingsBox.y + settingsBox.height / 2);
    await expect(page).toHaveURL(/\/settings/);
  });

  test("mobile home 검색·알림: just outside each icon presses it, not its neighbour", async ({
    page,
  }) => {
    test.skip(isWideProject(), "mobile header");
    await mockApi(page);
    await page.goto("/home");
    const search = page.getByRole("button", { name: "검색", exact: true });
    const bell = page.getByRole("button", { name: "알림", exact: true });
    await expectPressArea(page, search, "검색");
    await expectPressArea(page, bell, "알림");

    // 3px right of 검색 sits in the gap toward 알림 and must press 검색 only.
    const searchBox = await boxOf(search);
    await pressAt(page, searchBox.x + searchBox.width + 3, searchBox.y + searchBox.height / 2);
    // 알림 must not be pressed: the page stays on home (the area check above shows it is 검색's).
    await page.waitForTimeout(300);
    await expect(page).toHaveURL(/\/home$/);

    // 3px left of 알림, from the other side of the gap, presses 알림.
    const bellBox = await boxOf(bell);
    await pressAt(page, bellBox.x - 3, bellBox.y + bellBox.height / 2);
    await expect(page).toHaveURL(/\/notifications/);
  });

  test("mobile back presses on its 44×44 area and goes back", async ({ page }) => {
    test.skip(isWideProject(), "mobile header");
    const link = makeLink({ id: 1 });
    await mockApi(page, { links: [link], details: { 1: makeDetail(link) } });
    await page.goto("/home");
    await page.goto("/notifications");
    const back = page.getByRole("button", { name: "뒤로" });
    const reference = await tokenColor(page, "--foreground");
    await expectReferenceLook(back, "뒤로", reference);
    await expectPressArea(page, back, "뒤로");
    const box = await boxOf(back);
    await pressAt(page, box.x + box.width / 2, box.y + box.height + 3);
    await expect(page).toHaveURL(/\/home$/);
  });
});
