import { type Page, expect, test } from "@playwright/test";

import { envelope, mockApi } from "./support/mock-api";

const title = "Save it, Find it.";
const description = "한 곳에서 쉽게 찾는 북마크 아카이브";
const scene = /sakanaction의 怪獣 공식 뮤직비디오.*YouTube.*ALink 공유 확장이 열린 화면.*Archived/;
const shareCapture = /kaiju-alink-share-extension(?:\.[\da-f]+)?\.webp/;
const subjects = ["Archive", "AI", "Ask & Access", "Action", "Amigo"];
const sectionIds = ["organize", "share", "ask", "task", "shared"];
const startLink = (page: Page) =>
  page.locator("#landing-intro").getByRole("link", { name: "웹으로 시작하기" });

async function openGuestLanding(page: Page) {
  await mockApi(page, { seedSession: false });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(startLink(page)).toBeVisible();
}

async function expectFirstScreen(page: Page) {
  await expect(page.getByRole("heading", { name: title })).toBeInViewport({ ratio: 1 });
  await expect(page.getByText(description)).toBeInViewport({ ratio: 1 });
  await expect(startLink(page)).toBeInViewport({ ratio: 1 });
  await expect(page.getByRole("img", { name: scene })).toBeInViewport({ ratio: 1 });
}

test("renders the public landing on direct entry and refresh", async ({ page }) => {
  await openGuestLanding(page);
  await expect(page.getByRole("banner").getByText("ALINK")).toBeVisible();
  await expect(page.getByRole("link", { name: "로그인" })).toBeVisible();
  await expectFirstScreen(page);
  await page.reload({ waitUntil: "domcontentloaded" });
  await expectFirstScreen(page);

  const accessibleTree = await page.locator("#landing-intro").ariaSnapshot();
  const accessibleContent = [title, description, "웹으로 시작하기", "ALink 공유 확장이 열린 화면"];
  const offsets = accessibleContent.map((label) => accessibleTree.indexOf(label));
  expect(offsets[0]).toBeGreaterThanOrEqual(0);
  expect(offsets).toEqual([...offsets].sort((left, right) => left - right));
});

test("fits both layouts at the breakpoint and shares the page margins", async ({ page }) => {
  await openGuestLanding(page);
  const frames = page.getByTestId("landing-frame");
  await expect(frames).toHaveCount(9);

  for (const width of [390, 768, 769, 1280, 1326, 1328, 1330, 1600, 1920]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 800 });
    const button = (await startLink(page).boundingBox())!;
    const graphic = (await page.getByRole("img", { name: scene }).boundingBox())!;
    if (width <= 768) {
      expect(graphic.y).toBeGreaterThan(button.y + button.height);
    } else {
      expect(graphic.x).toBeGreaterThan(button.x + button.width);
    }
    expect(
      await page.locator("#landing-scroll").evaluate((node) => node.scrollWidth),
    ).toBeLessThanOrEqual(width);

    for (const [index, frame] of (await frames.all()).entries()) {
      const bounds = (await frame.boundingBox())!;
      const gutter = width <= 768 && index < 2 ? 22 : 24;
      const margin = Math.max(gutter, (width - 1280) / 2);
      expect(bounds.x).toBeCloseTo(margin, 0);
      expect(bounds.width).toBeCloseTo(width - margin * 2, 0);
    }
  }
});

test("keeps the header in place and takes keyboard focus to each section", async ({ page }) => {
  await openGuestLanding(page);
  const header = page.getByRole("banner");
  const links = page.getByRole("navigation", { name: "온보딩 섹션" }).getByRole("link");
  await expect(links).toHaveText(subjects);

  for (const [index, link] of (await links.all()).entries()) {
    await link.focus();
    await page.keyboard.press("Enter");
    const section = page.getByRole("region", { name: subjects[index], exact: true });
    await expect(page).toHaveURL(new RegExp(`/#landing-${sectionIds[index]}$`));
    await expect(section).toBeFocused();
    await expect
      .poll(async () => {
        const headerBounds = (await header.boundingBox())!;
        const sectionBounds = (await section.boundingBox())!;
        expect(headerBounds.y).toBe(0);
        return Math.abs(sectionBounds.y - headerBounds.height);
      })
      .toBeLessThanOrEqual(1);
  }

  await page.locator("#landing-scroll").evaluate((node) => {
    node.scrollTop = node.scrollHeight;
  });
  await expect(page.getByText("개인정보처리방침")).toBeInViewport({ ratio: 1 });
  expect((await header.boundingBox())!.y).toBe(0);

  const finalLink = page.locator("#landing-final").getByRole("link", { name: "웹으로 시작하기" });
  await expect(finalLink).toHaveAttribute("href", "/home");
  await finalLink.click();
  await expect(page).toHaveURL(/\/login$/);
});

test("tabs through the header in visual order", async ({ page }, testInfo) => {
  await openGuestLanding(page);
  const header = page.getByRole("banner");
  const account = ["로그인", "시작하기"];
  const order = testInfo.project.use.hasTouch
    ? [...account, ...subjects]
    : [...subjects, ...account];
  await expect(header.getByRole("link").first()).toHaveText(order[0]);
  for (const name of order) {
    await page.keyboard.press("Tab");
    await expect(header.getByRole("link", { name, exact: true })).toBeFocused();
  }
});

test("opens a section anchor without moving keyboard focus", async ({ page }) => {
  await mockApi(page, { seedSession: false });
  await page.goto("/#landing-organize", { waitUntil: "domcontentloaded" });
  const header = page.getByRole("banner");
  const archive = page.getByRole("region", { name: "Archive", exact: true });
  await expect
    .poll(async () => (await archive.boundingBox())!.y)
    .toBeCloseTo((await header.boundingBox())!.height, 0);
  await expect(archive).not.toBeFocused();
  await expect(header.locator('[aria-current="location"]')).toHaveText("Archive");
});

test("marks the section reached by scrolling and clears it when returning to the intro", async ({
  page,
}) => {
  await openGuestLanding(page);
  const nav = page.getByRole("navigation", { name: "온보딩 섹션" });
  const current = nav.locator('[aria-current="location"]');
  await expect(current).toHaveCount(0);
  for (const [index, id] of sectionIds.entries()) {
    await page
      .locator(`#landing-${id}`)
      .evaluate((node) => node.scrollIntoView({ block: "start" }));
    await expect(current).toHaveText(subjects[index]);
    await expect(current.getByText(subjects[index])).toHaveCSS("text-decoration-line", "underline");
    await expect(page).toHaveURL(/\/$/);
  }
  await page.locator("#landing-final").evaluate((node) => node.scrollIntoView({ block: "start" }));
  await expect(current).toHaveCount(0);
  await page.locator("#landing-scroll").evaluate((node) => {
    node.scrollTop = 0;
  });
  await expect(current).toHaveCount(0);
});

test("restores sections when moving backward, forward, or returning from app entry", async ({
  page,
}) => {
  await openGuestLanding(page);
  const header = page.getByRole("banner");
  const nav = header.getByRole("navigation", { name: "온보딩 섹션" });
  const archive = nav.getByRole("link", { name: "Archive", exact: true });
  const ai = nav.getByRole("link", { name: "AI", exact: true });

  async function expectSection(id: string, name: string) {
    await expect(page).toHaveURL(new RegExp(`/#landing-${id}$`));
    const headerBottom = (await header.boundingBox())!.height;
    await expect
      .poll(async () => (await page.locator(`#landing-${id}`).boundingBox())!.y)
      .toBeCloseTo(headerBottom, 0);
    await expect(nav.locator('[aria-current="location"]')).toHaveText(name);
  }

  await archive.click();
  await expectSection("organize", "Archive");
  await ai.click();
  await expectSection("share", "AI");
  await page.goBack();
  await expectSection("organize", "Archive");
  await page.goBack();
  await expect(page).toHaveURL(/\/$/);
  await expect(nav.locator('[aria-current="location"]')).toHaveCount(0);
  await expect(page.getByRole("heading", { name: title })).toBeInViewport({ ratio: 1 });
  await page.goForward();
  await expectSection("organize", "Archive");
  await page.goForward();
  await expectSection("share", "AI");
  await header.getByRole("link", { name: "시작하기", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goBack();
  await expectSection("share", "AI");
});

test("back restores the exact position and visible focus after reading a section without a fragment", async ({
  page,
}) => {
  await openGuestLanding(page);
  const nav = page.getByRole("navigation", { name: "온보딩 섹션" });
  const action = page.getByRole("region", { name: "Action", exact: true });
  const viewport = page.locator("#landing-scroll");
  const previousScroll = await viewport.evaluate((node) => {
    document.getElementById("landing-task")!.scrollIntoView({ block: "start" });
    node.scrollTop += 56;
    return node.scrollTop;
  });
  await expect(nav.locator('[aria-current="location"]')).toHaveText("Action");
  await expect(page).toHaveURL(/\/$/);

  await nav.getByRole("link", { name: "AI", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("region", { name: "AI", exact: true })).toBeFocused();
  await page.goBack();

  await expect(page).toHaveURL(/\/$/);
  await expect.poll(() => viewport.evaluate((node) => node.scrollTop)).toBe(previousScroll);
  await expect(nav.locator('[aria-current="location"]')).toHaveText("Action");
  await expect(action).toBeFocused();
  await expect(action).toBeInViewport();
  await page.goForward();
  await expect(nav.locator('[aria-current="location"]')).toHaveText("AI");
  await page.goBack();
  await expect.poll(() => viewport.evaluate((node) => node.scrollTop)).toBe(previousScroll);
  await expect(nav.locator('[aria-current="location"]')).toHaveText("Action");
  await expect(action).toBeFocused();
});

test("keeps the complete ALink extension capture beside the Archived badge across screen widths", async ({
  page,
}) => {
  await openGuestLanding(page);
  const graphic = page.getByRole("img", { name: scene });
  const image = graphic.locator("img");
  const badge = graphic.getByTestId("landing-archived-badge");
  await expect(image).toHaveAttribute("src", shareCapture);
  await expect(badge.getByText("Archived")).toBeVisible();
  await expect
    .poll(() => image.evaluate((node: HTMLImageElement) => node.naturalWidth))
    .toBeGreaterThan(0);
  for (const width of [320, 360, 390, 768, 769, 960, 1179, 1180, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    await expect(image).toBeInViewport({ ratio: 1 });
    await expect(badge).toBeInViewport({ ratio: 1 });
    await expect(image).toHaveCSS("object-fit", "contain");
    const imageBounds = (await image.boundingBox())!;
    const badgeBounds = (await badge.boundingBox())!;
    const sceneBounds = (await graphic.boundingBox())!;
    expect(badgeBounds.x).toBeGreaterThanOrEqual(sceneBounds.x);
    expect(imageBounds.y).toBeGreaterThanOrEqual(sceneBounds.y);
    expect(badgeBounds.x + badgeBounds.width).toBeLessThan(imageBounds.x);
    expect(imageBounds.x + imageBounds.width).toBeLessThanOrEqual(
      sceneBounds.x + sceneBounds.width,
    );
    expect(imageBounds.y + imageBounds.height).toBeLessThanOrEqual(
      sceneBounds.y + sceneBounds.height,
    );
  }
});

test("gives the smaller header gradient a full touch target and keeps the large CTA style", async ({
  page,
}, testInfo) => {
  await openGuestLanding(page);
  const header = page.getByRole("banner");
  const compact = header.getByRole("link", { name: "시작하기", exact: true });
  const hero = startLink(page);
  const gradient = (link: typeof compact) => link.locator(":scope > :first-child");
  await expect(compact).toHaveCSS("height", testInfo.project.use.hasTouch ? "44px" : "48px");
  await expect(gradient(compact)).toHaveCSS("height", "32px");
  await expect(gradient(hero)).toHaveCSS("height", "48px");
  const background = await gradient(hero).evaluate(
    (node) => getComputedStyle(node).backgroundImage,
  );
  expect(background).toMatch(/^linear-gradient/);
  await expect(gradient(compact)).toHaveCSS("background-image", background);
  await expect(compact.getByText("시작하기", { exact: true })).toHaveCSS(
    "color",
    "rgb(255, 255, 255)",
  );
  await expect(hero.getByText("웹으로 시작하기", { exact: true })).toHaveCSS(
    "color",
    "rgb(255, 255, 255)",
  );
  const target = (await compact.boundingBox())!;
  expect(target.width).toBeGreaterThanOrEqual(44);
  if (testInfo.project.use.hasTouch) await compact.tap({ position: { x: target.width / 2, y: 2 } });
  else await compact.click({ position: { x: target.width / 2, y: 2 } });
  await expect(page).toHaveURL(/\/login$/);
});

test("opens the Archive from the scroll hint and switches its sample folder", async ({
  page,
}, testInfo) => {
  await openGuestLanding(page);
  const hint = page.getByRole("link", { name: "Archive 섹션으로" });
  if (testInfo.project.use.hasTouch) await hint.tap();
  else await hint.click();
  const archive = page.getByRole("region", { name: "Archive", exact: true });
  await expect(archive).toBeFocused();
  const travel = archive.getByText("✈️ 여행", { exact: true });
  await expect(travel.locator("xpath=../../..")).toHaveCSS("transform", "matrix(1, 0, 0, 1, 0, 0)");
  await travel.click();
  await expect(archive.getByText("제주 3박4일 여행 코스")).toBeInViewport();
});

test("activates progress dots when each section crosses the viewport center in either direction", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.use.hasTouch === true);
  await page.setViewportSize({ width: 1280, height: 600 });
  await openGuestLanding(page);
  const scroll = page.locator("#landing-scroll");
  const active = page.getByTestId("landing-progress-current");

  async function placeSectionAtCenter(id: string, offset: number) {
    await scroll.evaluate(
      (node, { id, offset }) => {
        const section = document.getElementById(`landing-${id}`)!;
        const center = node.getBoundingClientRect().top + node.clientHeight / 2;
        node.scrollTop += section.getBoundingClientRect().top - center + offset;
      },
      { id, offset },
    );
  }

  for (const [index, id] of sectionIds.entries()) {
    await placeSectionAtCenter(id, 4);
    await expect(active).toHaveAttribute("id", `landing-progress-${index + 1}`);
  }
  for (const [index, id] of [...sectionIds].reverse().entries()) {
    await placeSectionAtCenter(id, -4);
    await expect(active).toHaveAttribute("id", `landing-progress-${sectionIds.length - index - 1}`);
  }
});

test("starts in the same tab by keyboard or touch and allows another entry after going back", async ({
  page,
}, testInfo) => {
  await openGuestLanding(page);
  const start = startLink(page);
  await expect(start).toHaveAttribute("href", "/home");
  if (testInfo.project.use.hasTouch) {
    await start.tap();
  } else {
    for (let index = 0; index < 10; index++) {
      await page.keyboard.press("Tab");
      if (await start.evaluate((node) => node === document.activeElement)) break;
    }
    await expect(start).toBeFocused();
    await expect(start).toHaveCSS("outline-style", "solid");
    await page.keyboard.press("Enter");
  }
  await expect(page).toHaveURL(/\/login$/);
  expect(page.context().pages()).toHaveLength(1);
  await page.goBack();
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
  const headerStart = page.getByRole("banner").getByRole("link", { name: "시작하기", exact: true });
  await expect(headerStart).toHaveAttribute("href", "/home");
  await headerStart.click();
  await expect(page).toHaveURL(/\/login$/);
  expect(page.context().pages()).toHaveLength(1);
});

for (const image of ["loading", "failed"] as const) {
  test(`entry works while the product image is ${image}`, async ({ page }) => {
    await mockApi(page, { seedSession: false });
    let releaseImage!: () => void;
    const pending = new Promise<void>((resolve) => {
      releaseImage = resolve;
    });
    await page.route(shareCapture, async (route) => {
      if (image === "loading") await pending;
      await route.abort();
    });
    try {
      const imageRequested = page.waitForRequest(shareCapture);
      await page.goto("/", { waitUntil: "domcontentloaded" });
      await imageRequested;
      await expectFirstScreen(page);
      await startLink(page).click();
      await expect(page).toHaveURL(/\/login$/);
      expect(page.context().pages()).toHaveLength(1);
    } finally {
      releaseImage();
    }
  });
}

test("entry works before session restoration finishes", async ({ page }) => {
  let releaseRefresh!: () => void;
  const pending = new Promise<void>((resolve) => {
    releaseRefresh = resolve;
  });
  await mockApi(page, {
    seedSession: false,
    handlers: {
      "POST /api/auth/token/refresh/web": async (route) => {
        await pending;
        await route.fulfill({ status: 401, json: envelope(null) });
      },
    },
  });
  try {
    const refresh = page.waitForRequest((request) =>
      request.url().endsWith("/api/auth/token/refresh/web"),
    );
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await refresh;
    await expectFirstScreen(page);
    const start = startLink(page);
    await expect(start).toHaveAttribute("href", "/home");
    await start.click();
    await expect(page).toHaveURL(/\/(home|login)$/);
    expect(page.context().pages()).toHaveLength(1);
  } finally {
    releaseRefresh();
  }
  await expect(page).toHaveURL(/\/login$/);
});

test("an empty account shows its profile and the same static example", async ({ page }) => {
  await mockApi(page);
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const header = page.getByRole("banner");
  await expect(header.getByText("테스터", { exact: true })).toBeVisible();
  await expect(header.getByText("e2e", { exact: true })).toBeVisible();
  await expect(header.getByRole("link", { name: "로그인" })).toHaveCount(0);
  await expectFirstScreen(page);

  const graphic = page.getByRole("img", { name: scene });
  await page.emulateMedia({ reducedMotion: "reduce" });
  const image = graphic.locator("img");
  await expect(image).toBeVisible();
  await expect(image).toHaveAttribute("src", shareCapture);
  const bounds = (await image.boundingBox())!;
  if (await page.evaluate(() => navigator.maxTouchPoints > 0)) await graphic.tap();
  else await page.mouse.move(bounds.x, bounds.y);
  expect(await image.boundingBox()).toEqual(bounds);
  await expect(graphic.locator("a, button, [tabindex='0']")).toHaveCount(0);
  await startLink(page).click();
  await expect(page).toHaveURL(/\/home$/);
  expect(page.context().pages()).toHaveLength(1);
});
