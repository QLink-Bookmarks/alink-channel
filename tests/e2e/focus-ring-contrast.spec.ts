import { type Locator, type Page, expect, test } from "@playwright/test";

import { type Rgba, contrast, over, parseColor } from "./support/color";
import { isWideProject } from "./support/helpers";
import { makeLink, mockApi, settingsHandler } from "./support/mock-api";

// #69: the keyboard focus ring stands out 3:1 from the surface it sits on, in light/dark ×
// gray/pink/blue. Text on the accent fill stays as on main (white in light themes).

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

async function setup(page: Page, theme: Theme, accent: Accent) {
  await mockApi(page, {
    links: [makeLink({ id: 1, url: "https://example.com/a", title: "예시 링크" })],
    handlers: { "GET /api/users/me/settings": settingsHandler(theme, accent) },
  });
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

/** The 3px focus ring drawn as a box-shadow, or null when no ring is visible. */
async function ringColor(target: Locator): Promise<Rgba | null> {
  const shadow = await target.evaluate((node) => getComputedStyle(node).boxShadow);
  if (shadow === "none") return null;
  const layers = shadow.split(/,(?![^(]*\))/).map((layer) => layer.trim());
  for (const layer of layers) {
    const color = layer.match(/rgba?\([^)]*\)/)?.[0];
    const lengths = layer
      .replace(/rgba?\([^)]*\)/, "")
      .match(/-?[\d.]+px/g)
      ?.map(parseFloat);
    if (!color || !lengths || lengths.length < 4 || layer.includes("inset")) continue;
    const [x, y, blur, spread] = lengths;
    const rgba = parseColor(color);
    if (x === 0 && y === 0 && blur === 0 && spread > 0 && rgba.a > 0) return rgba;
  }
  return null;
}

/** The colour of the surface behind the element, composited from its ancestors. */
async function surfaceBehind(target: Locator): Promise<Rgba> {
  const layers = await target.evaluate((node) => {
    const colors: string[] = [];
    for (let element = node.parentElement; element; element = element.parentElement) {
      colors.push(getComputedStyle(element).backgroundColor);
    }
    return colors;
  });
  let surface: Rgba = { r: 255, g: 255, b: 255, a: 1 };
  for (const layer of layers.reverse()) {
    const color = parseColor(layer);
    if (color.a > 0) surface = over(color, surface);
  }
  return surface;
}

async function tabTo(page: Page, target: Locator) {
  for (let i = 0; i < 80; i++) {
    await page.keyboard.press("Tab");
    if (await target.evaluate((node) => node === document.activeElement)) return;
  }
  throw new Error("could not reach the element with Tab");
}

/**
 * The focusable element that wraps a visible label, e.g. a chip or a row Pressable. Chips are
 * native `<button>`s, focusable without a `tabindex` attribute.
 */
function focusableWith(page: Page, label: string): Locator {
  return page
    .locator("[tabindex], button")
    .filter({ has: page.getByText(label, { exact: true }) })
    .last();
}

async function expectRingContrast(page: Page, target: Locator, name: string) {
  await tabTo(page, target);
  const surface = await surfaceBehind(target);
  // The ring fades in with the button's transition, so wait for it to settle.
  await expect
    .poll(
      async () => {
        const ring = await ringColor(target);
        return ring ? contrast(over(ring, surface), surface) : 0;
      },
      { message: `${name} ring vs surface` },
    )
    .toBeGreaterThanOrEqual(3);
}

/** Every scrolling or clipping ancestor leaves room for the 3px ring on all four sides. */
async function expectRingNotClipped(target: Locator, name: string) {
  const clipped = await target.evaluate((node) => {
    const ring = 3;
    const box = node.getBoundingClientRect();
    for (let element = node.parentElement; element; element = element.parentElement) {
      const style = getComputedStyle(element);
      if (style.overflowX === "visible" && style.overflowY === "visible") continue;
      const clip = element.getBoundingClientRect();
      if (
        box.left - ring < clip.left - 0.5 ||
        box.top - ring < clip.top - 0.5 ||
        box.bottom + ring > clip.bottom + 0.5
      ) {
        return true;
      }
    }
    return false;
  });
  expect(clipped, `${name} ring clipped by a scroll container`).toBe(false);
}

test("changing the selected chip still changes the selection", async ({ page }) => {
  test.skip(isWideProject(), "the folder chips sit on the mobile home");
  await setup(page, "light", "blue");
  await page.goto("/home");
  await expectTheme(page, "light", "blue");

  const all = page.getByText("전체", { exact: true }).first();
  const folder = page.getByText("📚 공부", { exact: true }).first();
  await expect(folder).toBeVisible();
  const before = await folder.evaluate((node) => getComputedStyle(node).color);
  await folder.click();
  await expect.poll(() => folder.evaluate((node) => getComputedStyle(node).color)).not.toBe(before);
  await expect.poll(() => all.evaluate((node) => getComputedStyle(node).color)).toBe(before);
});

test.describe("text on the accent fill", () => {
  for (const accent of ["gray", "pink", "blue"] as const) {
    test(`stays white as on main — light ${accent}`, async ({ page }) => {
      await setup(page, "light", accent);
      await page.goto("/home");
      await expectTheme(page, "light", accent);
      const colors = await page.evaluate(() =>
        ["--primary-foreground", "--sidebar-primary-foreground"].map((name) => {
          const probe = document.createElement("span");
          probe.style.color = `hsl(var(${name}))`;
          document.body.append(probe);
          const value = getComputedStyle(probe).color;
          probe.remove();
          return value;
        }),
      );
      expect(colors).toEqual(["rgb(255, 255, 255)", "rgb(255, 255, 255)"]);
    });
  }
});

test.describe("keyboard focus ring", () => {
  for (const [theme, accent] of THEMES) {
    test(`button, switch, chip and destructive rings stand out 3:1 — ${theme} ${accent}`, async ({
      page,
    }) => {
      await setup(page, theme, accent);
      await page.goto("/home");
      await expectTheme(page, theme, accent);
      const chip = isWideProject() ? "🔀 통합" : "📚 공부";
      await expectRingContrast(page, focusableWith(page, chip), `${chip} chip`);
      if (!isWideProject()) {
        // The folder chips sit in a horizontal scroll row that clips overflow.
        const folderChip = focusableWith(page, "전체");
        await expectRingContrast(page, folderChip, "전체 chip");
        await expectRingNotClipped(folderChip, "전체 chip");
      }

      await page.goto("/settings");
      await expectTheme(page, theme, accent);
      await expectRingContrast(page, page.getByRole("button", { name: "로그아웃" }), "로그아웃");
      await expectRingContrast(page, page.getByRole("switch").first(), "리마인더 알림 switch");

      await tabTo(page, focusableWith(page, "회원 탈퇴"));
      await page.keyboard.press("Enter");
      const withdraw = page.getByRole("dialog").getByRole("button", { name: "탈퇴", exact: true });
      await expect(withdraw).toBeVisible();
      await expectRingContrast(page, withdraw, "탈퇴 (destructive)");
    });
  }

  test("pressing with the mouse shows no ring", async ({ page }) => {
    await setup(page, "light", "blue");
    await page.goto("/settings");
    await expectTheme(page, "light", "blue");

    const button = page.getByRole("button", { name: "로그아웃" });
    await expect(button).toBeVisible();
    const box = await button.boundingBox();
    expect(box).not.toBeNull();
    if (!box) return;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await expect.poll(() => button.evaluate((node) => node === document.activeElement)).toBe(true);
    expect(await button.evaluate((node) => node.matches(":focus-visible"))).toBe(false);
    await expect.poll(() => button.evaluate((node) => node.getAnimations().length)).toBe(0);
    expect(await ringColor(button)).toBeNull();
    await page.mouse.up();
  });

  test("pressing a chip with the mouse shows no ring", async ({ page }) => {
    await setup(page, "light", "blue");
    await page.goto("/home");
    await expectTheme(page, "light", "blue");

    const chip = focusableWith(page, isWideProject() ? "🔀 통합" : "📚 공부");
    await expect(chip).toBeVisible();
    const box = await chip.boundingBox();
    expect(box).not.toBeNull();
    if (!box) return;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    expect(await chip.evaluate((node) => node.matches(":focus-visible"))).toBe(false);
    await expect.poll(() => chip.evaluate((node) => node.getAnimations().length)).toBe(0);
    expect(await ringColor(chip)).toBeNull();
    await page.mouse.up();
  });
});
