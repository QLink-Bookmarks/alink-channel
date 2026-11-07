import { type Locator, type Page, expect, test } from "@playwright/test";

import { type Rgba, contrast, over, parseColor, textContrast } from "./support/color";
import { isWideProject } from "./support/helpers";
import { makeLink, mockApi, settingsHandler } from "./support/mock-api";

// #69: the keyboard focus ring stands out 3:1 from the surface it sits on, and text on the
// accent fill (selected chips, primary buttons) reads 4.5:1, in light/dark × gray/pink/blue.

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

/** Contrast between two theme tokens such as `--primary-foreground` and `--primary`. */
async function tokenContrast(page: Page, foreground: string, background: string) {
  const [fg, bg] = await page.evaluate(
    (names) =>
      names.map((name) => {
        const probe = document.createElement("span");
        probe.style.color = `hsl(var(${name}))`;
        document.body.append(probe);
        const value = getComputedStyle(probe).color;
        probe.remove();
        return value;
      }),
    [foreground, background],
  );
  return contrast(parseColor(fg), parseColor(bg));
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

/** The focusable element that wraps a visible label, e.g. a chip or a row Pressable. */
function focusableWith(page: Page, label: string): Locator {
  return page
    .locator("[tabindex]")
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

test.describe("text on the accent fill", () => {
  for (const [theme, accent] of THEMES) {
    test(`selected chips and accent-fill tokens read 4.5:1 — ${theme} ${accent}`, async ({
      page,
    }) => {
      await setup(page, theme, accent);
      await page.goto("/home");
      await expectTheme(page, theme, accent);

      const chips = isWideProject() ? ["🔀 통합"] : ["전체", "최신순"];
      for (const label of chips) {
        const chip = page.getByText(label, { exact: true }).first();
        await expect(chip).toBeVisible();
        expect(await textContrast(chip), `${label} chip`).toBeGreaterThanOrEqual(4.5);
      }

      expect(
        await tokenContrast(page, "--primary-foreground", "--primary"),
        "primary button text",
      ).toBeGreaterThanOrEqual(4.5);
      expect(
        await tokenContrast(page, "--sidebar-primary-foreground", "--sidebar-primary"),
        "sidebar primary text",
      ).toBeGreaterThanOrEqual(4.5);
    });
  }

  test("changing the selected chip still changes the selection", async ({ page }) => {
    test.skip(isWideProject(), "the order chips sit on the mobile home");
    await setup(page, "light", "blue");
    await page.goto("/home");
    await expectTheme(page, "light", "blue");

    const latest = page.getByText("최신순", { exact: true }).first();
    const earliest = page.getByText("오래된순", { exact: true }).first();
    await expect(earliest).toBeVisible();
    const before = await earliest.evaluate((node) => getComputedStyle(node).color);
    await earliest.click();
    await expect
      .poll(() => earliest.evaluate((node) => getComputedStyle(node).color))
      .not.toBe(before);
    expect(await textContrast(earliest), "newly selected chip").toBeGreaterThanOrEqual(4.5);
    await expect.poll(() => latest.evaluate((node) => getComputedStyle(node).color)).toBe(before);
  });
});

test.describe("keyboard focus ring", () => {
  for (const [theme, accent] of THEMES) {
    test(`button, switch, chip and destructive rings stand out 3:1 — ${theme} ${accent}`, async ({
      page,
    }) => {
      await setup(page, theme, accent);
      await page.goto("/home");
      await expectTheme(page, theme, accent);
      const chip = isWideProject() ? "🔀 통합" : "최신순";
      await expectRingContrast(page, focusableWith(page, chip), `${chip} chip`);

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
});
