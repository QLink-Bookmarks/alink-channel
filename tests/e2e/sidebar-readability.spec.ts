import { type Locator, type Page, expect, test } from "@playwright/test";

import { contrast, parseColor } from "./support/color";
import { isWideProject } from "./support/helpers";
import { makeFolders, mockApi, settingsHandler } from "./support/mock-api";

const ERROR_NOTE = "연결 상태를 확인하고 다시 시도해 주세요.";

async function textContrast(text: Locator) {
  const [color, background] = await text.evaluate((node) => {
    let element: Element | null = node;
    let background = "rgba(0, 0, 0, 0)";
    while (element) {
      const value = getComputedStyle(element).backgroundColor;
      if (!/rgba\(.*,\s*0\)$/.test(value) && value !== "transparent") {
        background = value;
        break;
      }
      element = element.parentElement;
    }
    return [getComputedStyle(node).color, background];
  });
  return contrast(parseColor(color), parseColor(background));
}

function sidebarButton(page: Page, name: string | RegExp) {
  return page.getByRole("button", { name, exact: typeof name === "string" }).first();
}

test.describe("light sidebar text contrast (#27)", () => {
  test.beforeEach(() => {
    test.skip(!isWideProject(), "wide sidebar");
  });

  for (const accent of ["gray", "pink", "blue"] as const) {
    test(`${accent}: secondary sidebar text reaches 4.5:1`, async ({ page }) => {
      await mockApi(page, {
        folders: makeFolders(5, 0),
        handlers: { "GET /api/users/me/settings": settingsHandler("light", accent) },
      });
      await page.goto("/home");
      await expect(page.locator("html")).toHaveAttribute("data-accent", accent);
      const folderRow = sidebarButton(page, /^폴더 5, 링크/);
      await expect(folderRow).toBeVisible();

      const samples = [
        sidebarButton(page, "전체").getByText("전체", { exact: true }),
        sidebarButton(page, "할일").getByText("할일", { exact: true }),
        folderRow.getByText("폴더 5", { exact: true }),
        page.getByRole("button", { name: /^내 폴더 (접기|펼치기)$/ }).getByText("내 폴더"),
      ];
      for (const sample of samples) {
        expect(await textContrast(sample)).toBeGreaterThanOrEqual(4.5);
      }
    });
  }

  for (const theme of ["light", "dark"] as const) {
    for (const accent of ["gray", "pink", "blue"] as const) {
      test(`${theme} ${accent}: the active row label reaches 4.5:1 and its icon keeps the accent`, async ({
        page,
      }) => {
        await mockApi(page, {
          folders: makeFolders(5, 0),
          handlers: { "GET /api/users/me/settings": settingsHandler(theme, accent) },
        });
        await page.goto("/home");
        await expect(page.locator("html")).toHaveAttribute("data-accent", accent);
        const home = sidebarButton(page, "홈");
        await expect(home).toHaveAttribute("aria-current", "page");
        expect(await textContrast(home.getByText("홈", { exact: true }))).toBeGreaterThanOrEqual(
          4.5,
        );

        const [iconColor, barColor] = await home.evaluate((node) => {
          const icon = node.querySelector("svg");
          const bar = Array.from(node.querySelectorAll<HTMLElement>("div")).find(
            (element) => getComputedStyle(element).position === "absolute",
          );
          return [
            icon ? getComputedStyle(icon).color : "",
            bar ? getComputedStyle(bar).backgroundColor : "",
          ];
        });
        expect(iconColor).not.toBe("");
        expect(iconColor).toBe(barColor);
      });
    }
  }
});

test("the sidebar load error note wraps only between words (#27)", async ({ page }) => {
  test.skip(!isWideProject(), "wide sidebar");
  await mockApi(page, { folders: makeFolders(5, 0), folderPages: { failAll: true } });
  await page.goto("/home");
  const note = page.getByText(ERROR_NOTE, { exact: true }).first();
  await expect(note).toBeVisible({ timeout: 30_000 });

  const breaks = await note.evaluate((node) => {
    const textNode = Array.from(node.childNodes).find((child) => child.nodeType === Node.TEXT_NODE);
    if (!textNode?.textContent) return null;
    const text = textNode.textContent;
    const tops: number[] = [];
    for (let index = 0; index < text.length; index += 1) {
      const range = document.createRange();
      range.setStart(textNode, index);
      range.setEnd(textNode, index + 1);
      tops.push(Math.round(range.getBoundingClientRect().top));
    }
    const result: string[] = [];
    for (let index = 1; index < text.length; index += 1) {
      if (tops[index] > tops[index - 1] + 2) result.push(`${text[index - 1]}|${text[index]}`);
    }
    return result;
  });
  expect(breaks).not.toBeNull();
  expect(breaks?.length ?? 0).toBeGreaterThan(0);
  for (const pair of breaks ?? []) {
    expect(pair.startsWith(" ")).toBe(true);
  }
});
