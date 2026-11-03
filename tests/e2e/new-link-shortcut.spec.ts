import { type Page, expect, test } from "@playwright/test";

import { isWideProject } from "./support/helpers";
import { makeFolders, mockApi } from "./support/mock-api";

const HELPER_LABEL = "와이드뷰 키보드 단축키 안내";

test.beforeEach(() => {
  test.skip(!isWideProject(), "wide shortcuts only");
});

async function emulatePlatform(page: Page, platform: "MacIntel" | "Win32") {
  await page.addInitScript((value) => {
    Object.defineProperty(Navigator.prototype, "platform", { get: () => value });
    Object.defineProperty(Navigator.prototype, "userAgentData", { get: () => undefined });
  }, platform);
}

function newLinkDialogTitle(page: Page) {
  return page.getByText("새 링크 추가", { exact: true });
}

async function openReady(page: Page) {
  await mockApi(page, { folders: makeFolders(3, 0) });
  await page.goto("/folders/3");
  await expect(page.getByRole("main").getByText("📁 폴더 3", { exact: true })).toBeVisible();
}

test.describe("new link shortcut", () => {
  test("Alt/Option+N opens the new link dialog, and pressing it again keeps a single dialog", async ({
    page,
  }) => {
    await openReady(page);

    await page.keyboard.press("Alt+KeyN");
    await expect(newLinkDialogTitle(page)).toBeVisible();

    await page.keyboard.press("Alt+KeyN");
    await expect(newLinkDialogTitle(page)).toHaveCount(1);
    await expect(page.getByRole("dialog")).toHaveCount(1);
  });

  test("Alt/Option+N while typing in the open search box closes search and opens the new link dialog", async ({
    page,
  }) => {
    await openReady(page);
    await page.keyboard.press("ControlOrMeta+KeyK");
    const searchInput = page.getByRole("dialog").getByRole("textbox").first();
    await expect(searchInput).toBeVisible();
    await searchInput.pressSequentially("링크");
    const searchPlaceholder = await searchInput.getAttribute("placeholder");

    await page.keyboard.press("Alt+KeyN");

    await expect(newLinkDialogTitle(page)).toBeVisible();
    await expect(page.getByPlaceholder(searchPlaceholder ?? "")).toHaveCount(0);
    await expect(page.getByRole("dialog")).toHaveCount(1);
  });

  test("the dead-key composition events right after the shortcut are cancelled, ordinary typing is not", async ({
    page,
  }) => {
    await openReady(page);

    await page.keyboard.press("Alt+KeyN");
    const cancelled = await page.evaluate(() => {
      const target = document.activeElement ?? document.body;
      const typed = new InputEvent("beforeinput", {
        data: "h",
        inputType: "insertText",
        bubbles: true,
        cancelable: true,
      });
      target.dispatchEvent(typed);
      const composition = new CompositionEvent("compositionstart", {
        data: "˜",
        bubbles: true,
        cancelable: true,
      });
      target.dispatchEvent(composition);
      const composed = new InputEvent("beforeinput", {
        data: "˜",
        inputType: "insertCompositionText",
        bubbles: true,
        cancelable: true,
      });
      target.dispatchEvent(composed);
      return {
        typed: typed.defaultPrevented,
        composition: composition.defaultPrevented,
        composed: composed.defaultPrevented,
      };
    });

    expect(cancelled).toEqual({ typed: false, composition: true, composed: true });
    await expect(newLinkDialogTitle(page)).toBeVisible();
  });

  test("a composing (IME) Alt+N key event still opens the dialog", async ({ page }) => {
    await openReady(page);
    await page.keyboard.press("ControlOrMeta+KeyK");
    const input = page.getByRole("dialog").getByRole("textbox").first();
    await input.focus();

    await input.evaluate((node) => {
      node.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Process",
          code: "KeyN",
          altKey: true,
          bubbles: true,
          cancelable: true,
          composed: true,
        }),
      );
    });
    await expect(newLinkDialogTitle(page)).toBeVisible();
  });

  test("N alone outside an input does not open the dialog", async ({ page }) => {
    await openReady(page);
    await page.locator("body").click({ position: { x: 700, y: 500 } });
    await page.keyboard.press("KeyN");
    await page.keyboard.press("Alt+KeyM");
    await expect(page.getByRole("main").getByText("📁 폴더 3", { exact: true })).toBeVisible();
    await expect(newLinkDialogTitle(page)).toHaveCount(0);
  });

  test("Cmd/Ctrl+K still opens search", async ({ page }) => {
    await openReady(page);
    await page.keyboard.press("ControlOrMeta+KeyK");
    await expect(page.getByRole("dialog").getByRole("textbox").first()).toBeVisible();
    await expect(newLinkDialogTitle(page)).toHaveCount(0);
  });

  test("the shortcut keydown is cancelled so the browser does not handle it", async ({ page }) => {
    await openReady(page);
    const prevented = await page.evaluate(() => {
      const event = new KeyboardEvent("keydown", {
        key: "n",
        code: "KeyN",
        altKey: true,
        bubbles: true,
        cancelable: true,
      });
      document.body.dispatchEvent(event);
      return event.defaultPrevented;
    });
    expect(prevented).toBe(true);
    await expect(newLinkDialogTitle(page)).toBeVisible();
  });

  for (const [platform, label] of [
    ["MacIntel", "⌥N"],
    ["Win32", "Alt+N"],
  ] as const) {
    test(`the sidebar button shows ${label} on ${platform}, the search badge stays, the shortcut helper is gone, with no bare N`, async ({
      page,
    }) => {
      await emulatePlatform(page, platform);
      await openReady(page);

      const sidebarButton = page.getByRole("button", { name: /새 링크/ }).first();
      await expect(sidebarButton).toContainText(label);
      await expect(page.getByText("⌘/Ctrl + K", { exact: true }).first()).toBeVisible();
      await expect(page.getByText(HELPER_LABEL)).toHaveCount(0);

      expect(await countBareN(page)).toBe(0);

      await page.getByRole("button", { name: "홈", exact: true }).click();
      await expect(page).toHaveURL(/\/home$/);
      await expect(page.getByRole("main").getByText(label, { exact: true })).toHaveCount(1);
      await expect(page.getByText(HELPER_LABEL)).toHaveCount(0);
      expect(await countBareN(page)).toBe(0);
    });
  }

  test("the 새 링크 pill on the wide home opens the new link dialog", async ({ page }) => {
    await mockApi(page, { folders: makeFolders(3, 0) });
    await page.goto("/home");
    await page.getByRole("main").getByText("새 링크", { exact: true }).first().click();
    await expect(newLinkDialogTitle(page)).toBeVisible();
  });
});

function countBareN(page: Page) {
  return page.evaluate(
    () =>
      [...document.querySelectorAll("body *")].filter(
        (node) => node.childElementCount === 0 && node.textContent?.trim() === "N",
      ).length,
  );
}
