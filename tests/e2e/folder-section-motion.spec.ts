import { type Locator, type Page, expect, test } from "@playwright/test";

import { boxOf, isWideProject } from "./support/helpers";
import { type MockFolder, makeDetail, makeLink, mockApi } from "./support/mock-api";
import {
  type MotionSample,
  type SectionKey,
  headerJump,
  maxOverlap,
  movingFrames,
  sampleSectionMotion,
  settleSections,
  syncError,
} from "./support/section-motion";

type Surface = "sidebar" | "mobileTab" | "picker";

const SIDEBAR = '[data-testid="wide-sidebar-column"]';
const LABEL: Record<SectionKey, string> = { mine: "내 폴더", shared: "공유 폴더" };
const SLIDING_IN_MIN_HEADER_TRAVEL = 16;

function mixedFolders(mine: number, shared: number): MockFolder[] {
  const total = mine + shared;
  return Array.from({ length: total }, (_, index) => {
    const id = total - index;
    const isShared = index >= mine;
    return {
      id,
      ownerId: isShared ? 2 : 1,
      name: `폴더 ${id}`,
      emoji: "📁",
      isShared,
      shareCounts: isShared ? 3 : 0,
      linkCounts: 1,
    };
  });
}

async function prepare(
  page: Page,
  surface: Surface,
  open: SectionKey | null,
  options: Parameters<typeof mockApi>[1] = {},
) {
  await page.addInitScript(
    ({ surface: key, open: value }) => {
      const openSection: Record<string, string | null> = {
        sidebar: "mine",
        mobileTab: "mine",
        picker: "mine",
      };
      openSection[key] = value;
      window.localStorage.setItem(
        "qlink-folder-navigation",
        JSON.stringify({ isSidebarCollapsed: false, openSection }),
      );
    },
    { surface, open },
  );
  const link = makeLink({ id: 1 });
  return mockApi(page, {
    folders: mixedFolders(30, 6),
    links: [link],
    details: { [link.id]: makeDetail(link) },
    ...options,
  });
}

function toggle(page: Page, key: SectionKey, scope = "body") {
  return page
    .locator(scope)
    .last()
    .getByRole("button", { name: new RegExp(`^${LABEL[key]} (접기|펼치기)`) });
}

async function ready(page: Page, open: SectionKey | null, scope = "body") {
  await expect(toggle(page, "mine", scope)).toBeVisible();
  await expect(toggle(page, "shared", scope)).toBeVisible();
  if (open) {
    await expect(
      page.locator(scope).last().getByLabel(`${LABEL[open]} 목록`, { exact: true }),
    ).toBeVisible();
  }
  await settleSections(page, scope);
}

function expectSwitchTogether(sample: MotionSample, opening: SectionKey, closing: SectionKey) {
  expect(movingFrames(sample, opening)).toBeGreaterThanOrEqual(5);
  expect(movingFrames(sample, closing)).toBeGreaterThanOrEqual(5);
  expect(syncError(sample, opening, closing)).toBeLessThanOrEqual(0.2);
  expect(headerJump(sample, "shared")).toBeLessThan(0.35);
  expect(maxOverlap(sample)).toBeLessThanOrEqual(1);
  expect(sample.final.lists[opening]?.height ?? 0).toBeGreaterThan(40);
  expect(sample.final.lists[closing]).toBeNull();
}

function lastMotion(sample: MotionSample) {
  const signature = (frame: MotionSample["frames"][number]) =>
    JSON.stringify(
      (["mine", "shared"] as const).map((key) => [
        Math.round(frame.headers[key]?.top ?? 0),
        Math.round(frame.lists[key]?.height ?? 0),
      ]),
    );
  const finalSignature = signature({ t: 0, ...sample.final });
  const moving = sample.frames.filter((frame) => signature(frame) !== finalSignature);
  return moving.length ? moving[moving.length - 1].t : 0;
}

const SHEETS: Record<string, (page: Page) => Promise<void>> = {
  "move sheet": async (page) => {
    await page.goto("/links/1");
    await expect(page.getByTestId("link-detail-title")).toBeVisible();
    await page.getByRole("button", { name: /^폴더 이동, 현재/ }).click();
    await expect(page.getByRole("button", { name: "확인", exact: true })).toBeVisible();
  },
  "new link sheet folder step": async (page) => {
    await page.goto("/home");
    await page.getByLabel("새 링크").click();
    await page.getByRole("button", { name: /^폴더, / }).click();
    await expect(page.getByRole("radio", { name: "없음", exact: true })).toBeVisible();
  },
};

test.describe("wide", () => {
  test.beforeEach(() => {
    test.skip(!isWideProject(), "wide only");
  });

  for (const [from, to] of [
    ["shared", "mine"],
    ["mine", "shared"],
  ] as const) {
    test(`sidebar: switching ${LABEL[from]} → ${LABEL[to]} collapses and expands together within 300 ms`, async ({
      page,
    }) => {
      await prepare(page, "sidebar", from);
      await page.goto("/home");
      await ready(page, from, SIDEBAR);

      const sample = await sampleSectionMotion(page, {
        scope: SIDEBAR,
        clicks: [{ at: 0, section: to }],
      });

      expectSwitchTogether(sample, to, from);
      expect(lastMotion(sample)).toBeLessThanOrEqual(340);
      await expect(toggle(page, to, SIDEBAR)).toHaveAttribute("aria-expanded", "true");
    });
  }

  test("sidebar: opening from all collapsed grows from zero, and tapping again collapses it", async ({
    page,
  }) => {
    await prepare(page, "sidebar", null);
    await page.goto("/home");
    await ready(page, null, SIDEBAR);

    const opening = await sampleSectionMotion(page, {
      scope: SIDEBAR,
      clicks: [{ at: 0, section: "mine" }],
    });
    const firstVisible = opening.frames.find((frame) => frame.lists.mine != null);
    expect(firstVisible?.lists.mine?.height ?? 0).toBeLessThan(5);
    expect(movingFrames(opening, "mine")).toBeGreaterThanOrEqual(5);
    expect(maxOverlap(opening)).toBeLessThanOrEqual(1);
    expect(opening.final.lists.mine?.height ?? 0).toBeGreaterThan(100);

    const closing = await sampleSectionMotion(page, {
      scope: SIDEBAR,
      clicks: [{ at: 0, section: "mine" }],
    });
    expect(movingFrames(closing, "mine")).toBeGreaterThanOrEqual(5);
    expect(closing.final.lists.mine).toBeNull();
    await expect(toggle(page, "mine", SIDEBAR)).toHaveAttribute("aria-expanded", "false");
  });

  test("sidebar: quick taps mid-motion end with the last tapped section and leave no list behind", async ({
    page,
  }) => {
    await prepare(page, "sidebar", "shared");
    await page.goto("/home");
    await ready(page, "shared", SIDEBAR);

    const sample = await sampleSectionMotion(page, {
      scope: SIDEBAR,
      clicks: [
        { at: 0, section: "mine" },
        { at: 70, section: "shared" },
        { at: 140, section: "mine" },
      ],
      durationMs: 800,
    });

    expect(maxOverlap(sample)).toBeLessThanOrEqual(1);
    expect(sample.final.lists.mine?.height ?? 0).toBeGreaterThan(100);
    expect(sample.final.lists.shared).toBeNull();
    await expect(toggle(page, "mine", SIDEBAR)).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByLabel("공유 폴더 목록", { exact: true })).toHaveCount(0);
  });

  test("sidebar: the restored open section shows at full height on the first frame", async ({
    page,
  }) => {
    await prepare(page, "sidebar", "shared");
    await page.addInitScript(() => {
      const heights: number[] = [];
      (window as unknown as { __sharedHeights: number[] }).__sharedHeights = heights;
      const tick = () => {
        const list = document.querySelector<HTMLElement>('[aria-label="공유 폴더 목록"]');
        if (list) heights.push(Math.round(list.getBoundingClientRect().height));
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    await page.goto("/home");
    await ready(page, "shared", SIDEBAR);

    const heights = await page.evaluate(
      () => (window as unknown as { __sharedHeights: number[] }).__sharedHeights,
    );
    const shown = heights.filter((value) => value > 0);
    expect(shown.length).toBeGreaterThan(0);
    const growingFrames = shown.filter((value, index) => index > 0 && value > shown[index - 1]);
    expect(growingFrames.length).toBeLessThanOrEqual(2);
  });

  test("sidebar: reduced motion switches in one frame", async ({ browser }) => {
    const context = await browser.newContext({
      reducedMotion: "reduce",
      viewport: { width: 1280, height: 800 },
    });
    const page = await context.newPage();
    await prepare(page, "sidebar", "shared");
    await page.goto("/home");
    await ready(page, "shared", SIDEBAR);

    const sample = await sampleSectionMotion(page, {
      scope: SIDEBAR,
      clicks: [{ at: 0, section: "mine" }],
    });

    expect(movingFrames(sample, "mine")).toBeLessThanOrEqual(1);
    expect(headerJump(sample, "shared")).toBe(1);
    expect(sample.final.lists.shared).toBeNull();
    await context.close();
  });

  for (const state of [
    {
      name: "still loading",
      options: { folderPages: { delayMs: { 0: 60_000 } } },
      notice: (scope: Locator) => scope.getByRole("progressbar", { name: "폴더를 불러오는 중" }),
    },
    {
      name: "without folders",
      options: { folders: mixedFolders(30, 0) },
      notice: (scope: Locator) => scope.getByText("아직 공유 폴더가 없어요", { exact: true }),
    },
  ] as const) {
    test(`sidebar: a section ${state.name} opens and closes with the same motion and keeps its notice`, async ({
      page,
    }) => {
      await prepare(page, "sidebar", "mine", state.options);
      await page.goto("/home");
      const sidebar = page.locator(SIDEBAR);
      await ready(page, "mine", SIDEBAR);

      const switched = await sampleSectionMotion(page, {
        scope: SIDEBAR,
        clicks: [{ at: 0, section: "shared" }],
      });
      expectSwitchTogether(switched, "shared", "mine");
      expect(lastMotion(switched)).toBeLessThanOrEqual(340);
      await expect(
        state.notice(sidebar.getByLabel("공유 폴더 목록", { exact: true })).first(),
      ).toBeVisible();

      const closed = await sampleSectionMotion(page, {
        scope: SIDEBAR,
        clicks: [{ at: 0, section: "shared" }],
      });
      expect(movingFrames(closed, "shared")).toBeGreaterThanOrEqual(5);
      expect(headerJump(closed, "shared")).toBeLessThan(0.35);
      expect(closed.final.lists.shared).toBeNull();
    });
  }

  test("sidebar: sections that failed to load switch with the same motion", async ({ page }) => {
    await prepare(page, "sidebar", "mine", { folderPages: { failAll: true } });
    await page.goto("/home");
    const sidebar = page.locator(SIDEBAR);
    await expect(sidebar.getByText("폴더를 불러오지 못했어요")).toBeVisible({ timeout: 30_000 });
    await ready(page, "mine", SIDEBAR);

    const switched = await sampleSectionMotion(page, {
      scope: SIDEBAR,
      clicks: [{ at: 0, section: "shared" }],
    });
    expectSwitchTogether(switched, "shared", "mine");
    await expect(sidebar.getByText("폴더를 불러오지 못했어요")).toBeVisible();

    const closed = await sampleSectionMotion(page, {
      scope: SIDEBAR,
      clicks: [{ at: 0, section: "shared" }],
    });
    expect(movingFrames(closed, "shared")).toBeGreaterThanOrEqual(5);
    expect(closed.final.lists.shared).toBeNull();
  });

  test("sidebar: the chevrons turn with the lists, and at once with reduced motion", async ({
    browser,
  }) => {
    for (const reducedMotion of ["no-preference", "reduce"] as const) {
      const context = await browser.newContext({
        reducedMotion,
        viewport: { width: 1280, height: 800 },
      });
      const page = await context.newPage();
      await prepare(page, "sidebar", "shared");
      await page.goto("/home");
      await ready(page, "shared", SIDEBAR);

      const angles = await page.evaluate(
        (scope) =>
          new Promise<{ mine: number; shared: number }[]>((resolve) => {
            const root = document.querySelector(scope) ?? document.body;
            const chevron = (label: string) => {
              const slot = root.querySelector<HTMLElement>(
                `[role="button"][aria-label^="${label}"]`,
              )?.firstElementChild;
              if (!slot) return null;
              return ([slot, ...Array.from(slot.querySelectorAll("*"))].find(
                (node) => getComputedStyle(node).transform !== "none",
              ) ?? null) as HTMLElement | null;
            };
            const angle = (element: HTMLElement | null) => {
              const transform = element ? getComputedStyle(element).transform : "none";
              if (!transform || transform === "none") return 0;
              const [a, b] = transform
                .slice(transform.indexOf("(") + 1, -1)
                .split(",")
                .map(Number);
              return Math.round((Math.atan2(b, a) * 180) / Math.PI);
            };
            const read = () => ({
              mine: angle(chevron("내 폴더")),
              shared: angle(chevron("공유 폴더")),
            });
            const frames = [read()];
            root
              .querySelector<HTMLElement>('[role="button"][aria-label^="내 폴더 펼치기"]')
              ?.click();
            const start = performance.now();
            const tick = (time: number) => {
              frames.push(read());
              if (time - start < 450) requestAnimationFrame(tick);
              else resolve(frames);
            };
            requestAnimationFrame(tick);
          }),
        SIDEBAR,
      );

      expect(angles[0]).toEqual({ mine: -90, shared: 0 });
      expect(angles[angles.length - 1]).toEqual({ mine: 0, shared: -90 });
      const turning = angles.filter((frame) => frame.mine > -89 && frame.mine < -1);
      if (reducedMotion === "reduce") {
        expect(turning).toHaveLength(0);
      } else {
        expect(turning.length).toBeGreaterThanOrEqual(5);
        for (const frame of turning) {
          expect(Math.abs(frame.mine + frame.shared + 90)).toBeLessThanOrEqual(3);
        }
      }
      await context.close();
    }
  });

  test("move dialog: switching sections moves the lists together and keeps the dialog size and 확인 in place", async ({
    page,
  }) => {
    await prepare(page, "picker", "shared");
    await page.goto("/links?linkId=1");
    await expect(page.getByTestId("link-detail-title")).toBeVisible();
    await page.getByRole("button", { name: /^폴더 이동, 현재/ }).click();
    const dialog = page.getByRole("dialog", { name: "폴더 이동" });
    const confirm = dialog.getByRole("button", { name: "확인", exact: true });
    await expect(confirm).toBeVisible();
    await ready(page, "shared", '[role="dialog"]');
    const dialogBefore = await boxOf(dialog);
    const confirmBefore = await boxOf(confirm);

    const sample = await sampleSectionMotion(page, {
      scope: '[role="dialog"]',
      clicks: [{ at: 0, section: "mine" }],
    });

    expectSwitchTogether(sample, "mine", "shared");
    expect(await boxOf(dialog)).toEqual(dialogBefore);
    expect(await boxOf(confirm)).toEqual(confirmBefore);
  });

  test("new link folder popover: switching sections moves the lists together", async ({ page }) => {
    await prepare(page, "picker", "shared");
    await page.goto("/home");
    await page.getByText("새 링크", { exact: true }).first().click();
    await page.getByRole("button", { name: /^폴더, / }).click();
    await expect(
      page.getByRole("dialog").last().getByRole("radio", { name: "없음", exact: true }),
    ).toBeVisible();
    await ready(page, "shared", '[role="dialog"]');

    const sample = await sampleSectionMotion(page, {
      scope: '[role="dialog"]',
      clicks: [{ at: 0, section: "mine" }],
    });

    expectSwitchTogether(sample, "mine", "shared");
  });
});

test.describe("mobile", () => {
  test.beforeEach(() => {
    test.skip(isWideProject(), "mobile only");
  });

  test("folders tab: switching sections collapses and expands together", async ({ page }) => {
    await prepare(page, "mobileTab", "shared");
    await page.goto("/folders");
    await ready(page, "shared");

    const sample = await sampleSectionMotion(page, { clicks: [{ at: 0, section: "mine" }] });

    expectSwitchTogether(sample, "mine", "shared");
    expect(lastMotion(sample)).toBeLessThanOrEqual(340);
  });

  test("folders tab: opening from all collapsed grows from zero", async ({ page }) => {
    await prepare(page, "mobileTab", null);
    await page.goto("/folders");
    await ready(page, null);

    const sample = await sampleSectionMotion(page, { clicks: [{ at: 0, section: "shared" }] });

    const firstVisible = sample.frames.find((frame) => frame.lists.shared != null);
    expect(firstVisible?.lists.shared?.height ?? 0).toBeLessThan(5);
    expect(movingFrames(sample, "shared")).toBeGreaterThanOrEqual(5);
    expect(maxOverlap(sample)).toBeLessThanOrEqual(1);
  });

  test.describe("reduced motion", () => {
    test.use({ contextOptions: { reducedMotion: "reduce" } });

    test("move sheet: reduced motion switches the lists in one frame", async ({ page }) => {
      await prepare(page, "picker", "shared", { folders: mixedFolders(30, 10) });
      await SHEETS["move sheet"](page);
      await ready(page, "shared");

      const sample = await sampleSectionMotion(page, { clicks: [{ at: 0, section: "mine" }] });

      expect(movingFrames(sample, "mine")).toBeLessThanOrEqual(1);
      expect(movingFrames(sample, "shared")).toBeLessThanOrEqual(1);
      expect(sample.final.lists.mine?.height ?? 0).toBeGreaterThan(40);
      expect(sample.final.lists.shared).toBeNull();
      await expect(toggle(page, "mine")).toHaveAttribute("aria-expanded", "true");
    });
  });

  for (const [sheet, openSheet] of Object.entries(SHEETS)) {
    for (const [from, to] of [
      ["shared", "mine"],
      ["mine", "shared"],
    ] as const) {
      test(`${sheet}: switching ${LABEL[from]} → ${LABEL[to]} with many folders moves the lists together within 300 ms`, async ({
        page,
      }) => {
        await prepare(page, "picker", from, { folders: mixedFolders(30, 10) });
        await openSheet(page);
        await ready(page, from);

        const sample = await sampleSectionMotion(page, { clicks: [{ at: 0, section: to }] });

        expectSwitchTogether(sample, to, from);
        expect(lastMotion(sample)).toBeLessThanOrEqual(340);
        await expect(toggle(page, to)).toHaveAttribute("aria-expanded", "true");
      });
    }
  }

  for (const [sheet, openSheet] of Object.entries(SHEETS)) {
    for (const [from, tap] of [
      ["shared", "mine"],
      ["mine", "mine"],
      [null, "mine"],
    ] as const) {
      const action =
        from === tap
          ? `closing ${LABEL[tap]}`
          : from == null
            ? `opening ${LABEL[tap]} from all collapsed`
            : `switching ${LABEL[from]} → ${LABEL[tap]}`;
      test(`${sheet}: ${action} while the sheet is still sliding in finishes within 300 ms`, async ({
        page,
      }) => {
        await prepare(page, "picker", from, { folders: mixedFolders(30, 10) });
        await openSheet(page);
        await expect(toggle(page, tap)).toBeVisible();

        const sample = await sampleSectionMotion(page, { clicks: [{ at: 0, section: tap }] });

        expect(lastMotion(sample)).toBeLessThanOrEqual(340);
        expect(headerJump(sample, "shared", SLIDING_IN_MIN_HEADER_TRAVEL)).toBeLessThan(0.35);
        expect(maxOverlap(sample)).toBeLessThanOrEqual(1);
        await expect(toggle(page, tap)).toHaveAttribute(
          "aria-expanded",
          from === tap ? "false" : "true",
        );
      });
    }
  }
});
