import { type Page, expect, test } from "@playwright/test";

import { textContrast } from "./support/color";
import { boxOf } from "./support/helpers";
import { envelope, mockApi, settingsHandler } from "./support/mock-api";

// #86 the onboarding 알림 설정 box shows the granted state in place instead of an empty box.

const OFF_TITLE = "이 기기에서 알림이 꺼져 있어요";
const ENABLE_BUTTON = "기기 알림 켜기";
const ENABLED_MESSAGE = "알림이 허용됐어요! 다음으로 진행해주세요.";

type Permission = "default" | "granted" | "denied";

/**
 * Replaces the browser Notification API: `initial` is the permission on load, and the
 * permission prompt answers `answer`. Service-worker registration is refused so the FCM
 * setup that follows a grant stays offline.
 */
async function mockNotifications(page: Page, initial: Permission, answer: Permission) {
  await page.addInitScript(
    ({ initial, answer }) => {
      const control = { permission: initial, requests: 0 };
      (window as unknown as { __notifications: typeof control }).__notifications = control;
      class FakeNotification {
        static get permission() {
          return control.permission;
        }
        static requestPermission() {
          control.requests += 1;
          return new Promise<Permission>((resolve) => {
            setTimeout(() => {
              if (control.permission === "default") control.permission = answer;
              resolve(control.permission);
            }, 50);
          });
        }
      }
      Object.defineProperty(window, "Notification", {
        value: FakeNotification,
        configurable: true,
        writable: true,
      });
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker.register = () =>
          Promise.reject(new Error("e2e: no service worker"));
      }
    },
    { initial, answer },
  );
}

/** Signs in a user who has not agreed yet; `PUT /api/users/me/agreements` records the consent. */
async function mockUserNeedingAgreement(page: Page, theme: "light" | "dark" = "light") {
  const profile = { allowsPrivacy: false, allowsAiUsage: false };
  const state = await mockApi(page, {
    handlers: {
      "GET /api/users/me": (route) =>
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(
            envelope({
              id: 1,
              username: "e2e",
              nickname: "테스터",
              role: "USER",
              avatarEmoji: "🌸",
              ...profile,
            }),
          ),
        }),
      "PUT /api/users/me/agreements": (route, request) => {
        Object.assign(profile, request.postDataJSON());
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(envelope(null)),
        });
      },
      "GET /api/users/me/settings": settingsHandler(theme, "gray"),
    },
  });
  return { state, profile };
}

/** The bordered box on the 알림 설정 step that holds the device-notification notice. */
function noticeBox(page: Page) {
  return page
    .getByText("알림 설정", { exact: true })
    .locator("xpath=following::div[contains(@class, 'rounded-2xl')][1]");
}

test.describe("onboarding notification step", () => {
  test("shows the off state, then the granted state in the same box after allowing", async ({
    page,
  }) => {
    await mockNotifications(page, "default", "granted");
    await mockUserNeedingAgreement(page);
    await page.goto("/agreements");

    const box = noticeBox(page);
    await expect(box.getByText(OFF_TITLE)).toBeVisible();
    const enable = box.getByRole("button", { name: ENABLE_BUTTON });
    await expect(enable).toBeVisible();
    const offHeight = (await boxOf(box)).height;

    await enable.click();

    await expect(box.getByText(ENABLED_MESSAGE)).toBeVisible();
    await expect(box.getByText(OFF_TITLE)).toHaveCount(0);
    await expect(box.getByRole("button", { name: ENABLE_BUTTON })).toHaveCount(0);
    // The granted state carries an icon like the off row, so the box is never just text or empty.
    await expect(box.locator("svg")).toHaveCount(1);
    await expect(box.locator("svg")).toBeVisible();
    // The box keeps its height instead of collapsing into a gap.
    expect((await boxOf(box)).height).toBeGreaterThanOrEqual(offHeight - 1);
  });

  test("keeps the off state when the prompt is denied, and the button can be pressed again", async ({
    page,
  }) => {
    await mockNotifications(page, "default", "denied");
    await mockUserNeedingAgreement(page);
    await page.goto("/agreements");

    const box = noticeBox(page);
    const enable = box.getByRole("button", { name: ENABLE_BUTTON });
    await enable.click();
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            (window as unknown as { __notifications: { requests: number } }).__notifications
              .requests,
        ),
      )
      .toBe(1);

    await expect(box.getByText(OFF_TITLE)).toBeVisible();
    await expect(box.getByText(ENABLED_MESSAGE)).toHaveCount(0);
    await expect(enable).toBeEnabled();
    await enable.click();
    await expect(box.getByText(OFF_TITLE)).toBeVisible();
  });

  test("goes from the granted state to consent and then home", async ({ page }) => {
    await mockNotifications(page, "default", "granted");
    const { state } = await mockUserNeedingAgreement(page);
    await page.goto("/agreements");

    await noticeBox(page).getByRole("button", { name: ENABLE_BUTTON }).click();
    await expect(noticeBox(page).getByText(ENABLED_MESSAGE)).toBeVisible();
    await page.getByRole("button", { name: "다음으로" }).click();

    await expect(page.getByText("서비스 이용 동의", { exact: true })).toBeVisible();
    const consents = page.getByRole("checkbox");
    await expect(consents).toHaveCount(2);
    await consents.nth(0).click();
    await consents.nth(1).click();
    await page.getByRole("button", { name: "계속하기" }).click();

    await expect(page).toHaveURL(/\/home$/);
    expect(
      state.requests.filter((r) => r.method === "PUT" && r.path === "/api/users/me/agreements"),
    ).toEqual([expect.objectContaining({ body: { allowsPrivacy: true, allowsAiUsage: true } })]);
  });

  test("moves on to consent without turning notifications on", async ({ page }) => {
    await mockNotifications(page, "default", "granted");
    await mockUserNeedingAgreement(page);
    await page.goto("/agreements");

    await expect(noticeBox(page).getByText(OFF_TITLE)).toBeVisible();
    await page.getByRole("button", { name: "다음으로" }).click();

    await expect(page.getByText("서비스 이용 동의", { exact: true })).toBeVisible();
  });

  test("skips the step when notifications are already on", async ({ page }) => {
    await mockNotifications(page, "granted", "granted");
    await mockUserNeedingAgreement(page);
    await page.goto("/agreements");

    await expect(page.getByText("서비스 이용 동의", { exact: true })).toBeVisible();
    await expect(page.getByText("알림 설정", { exact: true })).toHaveCount(0);
  });

  test("keeps the granted state readable in dark mode", async ({ page }) => {
    await mockNotifications(page, "default", "granted");
    await mockUserNeedingAgreement(page, "dark");
    await page.goto("/agreements");

    const box = noticeBox(page);
    await box.getByRole("button", { name: ENABLE_BUTTON }).click();
    const message = box.getByText(ENABLED_MESSAGE);
    await expect(message).toBeVisible();
    expect(await textContrast(message)).toBeGreaterThanOrEqual(4.5);
  });
});

test.describe("settings 알림 section", () => {
  test("shows the notice and button while device notifications are off", async ({ page }) => {
    await mockNotifications(page, "default", "granted");
    await mockApi(page);
    await page.goto("/settings");

    await expect(page.getByText("리마인더 알림", { exact: true })).toBeVisible();
    await expect(page.getByText(OFF_TITLE)).toBeVisible();
    await expect(page.getByRole("button", { name: ENABLE_BUTTON })).toBeVisible();
  });

  test("shows only the reminder switch once device notifications are on", async ({ page }) => {
    await mockNotifications(page, "default", "granted");
    await mockApi(page);
    await page.goto("/settings");

    await page.getByRole("button", { name: ENABLE_BUTTON }).click();

    await expect(page.getByText(OFF_TITLE)).toHaveCount(0);
    await expect(page.getByRole("button", { name: ENABLE_BUTTON })).toHaveCount(0);
    await expect(page.getByText(ENABLED_MESSAGE)).toHaveCount(0);
    await expect(page.getByText("리마인더 알림", { exact: true })).toBeVisible();
  });
});
