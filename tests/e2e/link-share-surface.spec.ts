import { type Page, expect, test } from "@playwright/test";

import { isWideProject } from "./support/helpers";
import {
  envelope,
  makeDetail,
  makeFolders,
  makeLink,
  mockApi,
  settingsHandler,
} from "./support/mock-api";

const LINK_ID = 13701234;
const PATH = `/links/${LINK_ID}`;
const ORIGINAL = "https://example.org/articles/jeju";
const TITLE = "내 링크 페이지 공유";
const CHECKING = "폴더 공개 상태를 확인하는 중이에요.";
const SAVING = "공개 설정을 변경하는 중이에요.";
const FAILED = "공개 설정을 저장하지 못했어요.";
const RESTRICTED = "폴더를 먼저 전체 공개해 주세요.";
const COPY_FAILED = "공개 주소를 복사하지 못했어요. 다시 시도해주세요.";

function deferred() {
  let release!: () => void;
  const ready = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { ready, release };
}

function controls(page: Page) {
  const group = page.getByRole("group", { name: "공개 설정" });
  return {
    trigger: page.getByTestId("link-detail-share"),
    group,
    everyone: group.getByRole("button", { name: "전체 공개", exact: true }),
    onlyMe: group.getByRole("button", { name: "나만 보기", exact: true }),
    copy: page.getByRole("button", { name: "공개 주소 복사" }),
    original: page.getByRole("button", { name: "원본 링크 공유" }),
  };
}

async function setup(
  page: Page,
  {
    folderPublic = true,
    uncategorized = false,
    isOwner = true,
    isPublic = true,
    unknownLink = false,
    theme = "light",
  }: {
    folderPublic?: boolean;
    uncategorized?: boolean;
    isOwner?: boolean;
    isPublic?: boolean;
    unknownLink?: boolean;
    theme?: "light" | "dark";
  } = {},
) {
  const [folder] = makeFolders(1);
  const savedFolder = { ...folder, isPublic: folderPublic, isShared: !isOwner };
  const link = makeLink({
    id: LINK_ID,
    folderId: uncategorized ? null : savedFolder.id,
    title: "제주 산책 코스",
    url: ORIGINAL,
    ownerId: isOwner ? 1 : 2,
  });
  const detail = makeDetail(link, { isOwner, isPublic: unknownLink ? undefined : isPublic });
  const api = await mockApi(page, {
    folders: [savedFolder],
    links: [link],
    details: { [link.id]: detail },
    handlers: { "GET /api/users/me/settings": settingsHandler(theme, "gray") },
  });
  return { api, savedFolder, link };
}

for (const initial of [false, true]) {
  test(`keeps the confirmed selection and address through a failed save from ${initial} and retries`, async ({
    page,
  }) => {
    const { api } = await setup(page, { isPublic: initial });
    const write = deferred();
    let reject = true;
    await page.route(`**/api${PATH}/privacy`, async (route) => {
      const { isPublic } = route.request().postDataJSON();
      if (reject) {
        await write.ready;
        return route.fulfill({ status: 503, json: { success: false } });
      }
      api.details[LINK_ID].isPublic = isPublic;
      return route.fulfill({ json: envelope({ isPublic }) });
    });
    await page.goto(PATH);
    const { trigger, everyone, onlyMe, copy } = controls(page);
    const [previous, next] = initial ? [everyone, onlyMe] : [onlyMe, everyone];
    await trigger.click();
    await expect(page.getByText(TITLE, { exact: true })).toBeVisible();
    await expect(previous).toHaveAttribute("aria-pressed", "true");
    await expect(copy).toHaveCount(initial ? 1 : 0);
    try {
      await next.click();
      await expect(page.getByText(SAVING)).toBeVisible();
      await expect(previous).toHaveAttribute("aria-pressed", "true");
      await expect(previous).toBeDisabled();
      await expect(next).toBeDisabled();
      await expect(copy).toHaveCount(initial ? 1 : 0);
    } finally {
      write.release();
    }
    await expect(page.getByText(FAILED)).toBeVisible();
    await expect(previous).toHaveAttribute("aria-pressed", "true");
    await expect(copy).toHaveCount(initial ? 1 : 0);
    reject = false;
    await next.click();
    await expect(next).toHaveAttribute("aria-pressed", "true");
    await expect(copy).toHaveCount(initial ? 0 : 1);
    if (isWideProject()) {
      await page.keyboard.press("Escape");
      await expect(trigger).toBeFocused();
    } else {
      await page.getByLabel("닫기", { exact: true }).click();
    }
    await expect(page.getByText(TITLE, { exact: true })).toHaveCount(0);
    await trigger.click();
    await expect(copy).toHaveCount(initial ? 0 : 1);
    await page.reload();
    await trigger.click();
    await expect(next).toHaveAttribute("aria-pressed", "true");
    await expect(copy).toHaveCount(initial ? 0 : 1);
  });
}

test("hides the address while checking the folder, and locks both choices on read failure", async ({
  page,
}) => {
  const { savedFolder } = await setup(page);
  const read = deferred();
  let failed = false;
  await page.route("**/api/folders/1", async (route) => {
    if (!failed) {
      await read.ready;
      failed = true;
      return route.fulfill({ status: 503, json: { success: false } });
    }
    return route.fulfill({ json: envelope(savedFolder) });
  });
  await page.goto(PATH);
  const { trigger, copy, everyone, onlyMe, original } = controls(page);
  try {
    await trigger.click();
    await expect(page.getByText(CHECKING)).toBeVisible();
    await expect(everyone).toBeDisabled();
    await expect(onlyMe).toBeDisabled();
    await expect(copy).toHaveCount(0);
  } finally {
    read.release();
  }
  await expect(page.getByText("폴더 공개 상태를 확인할 수 없어요.")).toBeVisible();
  await expect(everyone).toBeDisabled();
  await expect(onlyMe).toBeDisabled();
  await expect(copy).toHaveCount(0);
  await expect(original).toBeEnabled();
});

for (const uncategorized of [false, true]) {
  test(`restricts publishing in ${uncategorized ? "uncategorized" : "private folder"} links`, async ({
    page,
  }) => {
    await setup(page, { folderPublic: false, uncategorized, isPublic: false });
    await page.goto(PATH);
    const { trigger, everyone, onlyMe, copy } = controls(page);
    await trigger.click();
    await expect(page.getByText(RESTRICTED)).toBeVisible();
    await expect(everyone).toBeDisabled();
    await expect(onlyMe).toHaveAttribute("aria-pressed", "true");
    await expect(copy).toHaveCount(0);
  });
}

for (const unknownLink of [false, true]) {
  test(`shows only original sharing when ${unknownLink ? "visibility is unknown" : "another member owns the link"}`, async ({
    page,
  }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "share", {
        value: async (payload: ShareData) => {
          sessionStorage.setItem("link-share-payload", JSON.stringify(payload));
        },
      });
    });
    const { link } = await setup(page, { isOwner: unknownLink, unknownLink });
    await page.goto(unknownLink ? PATH : "/folders/1");
    if (!unknownLink) {
      await page.getByTestId("link-card-title").filter({ hasText: link.title }).click();
    }
    const { trigger, copy, group, original } = controls(page);
    await expect(
      page.getByTestId("link-detail-toolbar").getByRole("button", { name: /^공개 설정, / }),
    ).toHaveCount(0);
    await trigger.click();
    await expect(page.getByText(ORIGINAL, { exact: true })).toBeVisible();
    await expect(copy).toHaveCount(0);
    await expect(group).toHaveCount(0);
    await original.click();
    const payload = await page.evaluate(() =>
      JSON.parse(sessionStorage.getItem("link-share-payload") ?? "{}"),
    );
    expect(payload.url).toBe(ORIGINAL);
  });
}

test("copies the full address, exposes it to keyboard selection on failure, and shows the original share error", async ({
  page,
  context,
  baseURL,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await setup(page, { theme: "dark" });
  const longAddress = new URL(PATH, baseURL);
  longAddress.hostname = "a-long-channel-address.for-checking-public-address-truncation.localhost";
  await page.goto(longAddress.href);
  const { trigger, everyone, copy, original } = controls(page);
  await expect(
    page.getByTestId("link-detail-toolbar").getByRole("button", { name: /^공개 설정, / }),
  ).toHaveCount(0);
  await trigger.click();
  await expect(everyone).toHaveAttribute("aria-pressed", "true");
  const path = page.getByText(PATH, { exact: true });
  await expect(path).toBeVisible();
  expect(await path.evaluate((node) => node.scrollWidth - node.clientWidth)).toBe(0);
  const origin = page.getByText(longAddress.origin, { exact: true });
  expect(await origin.evaluate((node) => node.scrollWidth > node.clientWidth)).toBe(true);
  const originalUrl = page.getByText(ORIGINAL, { exact: true });
  await expect(originalUrl).toBeVisible();
  const originalBox = (await original.boundingBox())!;
  expect(originalBox.y).toBeGreaterThan((await originalUrl.boundingBox())!.y);
  expect(originalBox.width).toBeLessThan((await originalUrl.boundingBox())!.width);
  expect(await original.evaluate((node) => getComputedStyle(node).borderTopWidth)).toBe("0px");
  await copy.click();
  await expect(page.getByText("공개 주소를 복사했어요.")).toBeVisible();
  await expect(copy).toBeVisible();
  const address = new URL(PATH, page.url()).href;
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(address);
  await page.evaluate(() => {
    return navigator.clipboard.writeText("clipboard before manual copy");
  });
  await page.evaluate(() => {
    Object.defineProperty(navigator.clipboard, "writeText", {
      value: async () => {
        throw new Error("Copy failed");
      },
    });
    Object.defineProperty(navigator, "share", { value: undefined });
  });
  await copy.click();
  await expect(page.getByText(COPY_FAILED)).toBeVisible();
  const expanded = page.getByText(address, { exact: true });
  await copy.focus();
  await page.keyboard.press("Shift+Tab");
  await expect(expanded).toBeFocused();
  expect(await page.evaluate(() => window.getSelection()?.toString())).toBe(address);
  await page.keyboard.press("ControlOrMeta+c");
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(address);
  await original.click();
  await expect(page.getByText("공유 실패", { exact: true })).toBeVisible();
});

test("anchors the 769px popover and reaches the copy button at 768px", async ({ page }) => {
  test.skip(!isWideProject(), "both boundary widths are checked in the desktop project");
  await setup(page);
  for (const width of [768, 769]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto(PATH);
    const { trigger, copy, everyone } = controls(page);
    await trigger.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByText(TITLE, { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Bottom sheet backdrop" })).toHaveCount(
      width === 768 ? 1 : 0,
    );
    await expect(copy).toBeInViewport();
    await expect
      .poll(async () => (await copy.boundingBox())?.width ?? 0)
      .toBeGreaterThanOrEqual(44);
    const box = (await copy.boundingBox())!;
    expect(box.x + box.width).toBeLessThanOrEqual(width);
    await expect(page.getByText(PATH, { exact: true })).toBeInViewport();
    if (width === 769) {
      const triggerBox = (await trigger.boundingBox())!;
      expect((await everyone.boundingBox())!.x).toBeCloseTo(triggerBox.x + 12, -1);
      await page.keyboard.press("Tab");
      await expect(everyone).toBeFocused();
      await page.keyboard.press("Tab");
      await expect(copy).toBeFocused();
      await page.keyboard.press("Escape");
      await expect(trigger).toBeFocused();
    }
  }
});

test("moves focus into the wide popover while checking and reaches visibility and copy from the trigger", async ({
  page,
  context,
}) => {
  test.skip(!isWideProject(), "keyboard navigation of the wide detail popover");
  const { savedFolder } = await setup(page);
  const read = deferred();
  await page.route("**/api/folders/1", async (route) => {
    await read.ready;
    await route.fulfill({ json: envelope(savedFolder) });
  });
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto(PATH);
  const { trigger, everyone, copy } = controls(page);
  const heading = page.getByRole("heading", { name: TITLE });
  try {
    await trigger.focus();
    await page.keyboard.press("Enter");
    await expect(heading).toBeFocused();
    await expect(page.getByText(CHECKING)).toBeVisible();
  } finally {
    read.release();
  }
  await expect(everyone).toBeEnabled();
  await expect(heading).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(everyone).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(copy).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByText("공개 주소를 복사했어요.")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
  await expect(heading).toHaveCount(0);
});

test("keeps keyboard focus in the 390px share sheet and restores it after Escape and Close", async ({
  page,
}) => {
  test.skip(isWideProject(), "keyboard navigation of the mobile share sheet");
  await setup(page);
  await page.goto(PATH);
  const { trigger, everyone, copy, onlyMe, original } = controls(page);
  const dialog = page.getByRole("dialog", { name: TITLE });
  const close = dialog.getByRole("button", { name: "닫기" });
  await trigger.focus();
  await page.keyboard.press("Enter");
  await expect(dialog).toBeVisible();
  await expect(everyone).toBeEnabled();
  await page.keyboard.press("Tab");
  await expect(everyone).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(copy).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(onlyMe).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(original).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(close).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(everyone).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(close).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
  await expect(dialog).toHaveCount(0);
  await page.keyboard.press("Enter");
  await expect(dialog).toBeVisible();
  await expect(everyone).toBeEnabled();
  await page.keyboard.press("Shift+Tab");
  await expect(close).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(trigger).toBeFocused();
  await expect(dialog).toHaveCount(0);
});
