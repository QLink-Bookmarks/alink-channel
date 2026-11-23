import { type Page, expect, test } from "@playwright/test";

import { isWideProject } from "./support/helpers";
import { envelope, makeFolders, mockApi, settingsHandler } from "./support/mock-api";

const FOLDER_ID = 12345678;
const PATH = `/folders/${FOLDER_ID}`;
const DETAIL = `GET /api${PATH}`;
const SAVE = `PUT /api${PATH}/privacy`;
const LOADING = "공개 설정을 확인하는 중이에요.";
const SAVING = "공개 설정을 변경하는 중이에요.";
const COPY_SUCCESS = "공개 주소를 복사했어요.";
const COPY_ERROR = "공개 주소를 복사하지 못했어요. 다시 시도해주세요.";
const LONG_NAME = "아주 긴 공유 폴더 이름 ".repeat(10).slice(0, 100);

function deferred() {
  let release!: () => void;
  const ready = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { ready, release };
}

function controls(page: Page) {
  const trigger = page.getByRole("button", { name: /^공개 설정, / });
  const choices = page.getByRole("group", { name: "공개 설정" });
  return {
    trigger,
    choices,
    everyone: choices.getByRole("button", { name: "전체 공개", exact: true }),
    onlyMe: choices.getByRole("button", { name: "나만 보기", exact: true }),
    address: choices.getByText(PATH, { exact: true }),
    copy: choices.getByRole("button", { name: "공개 주소 복사" }),
    confirm: page.getByRole("dialog", { name: "폴더를 전체 공개할까요?" }),
  };
}

function setup(page: Page, isPublic: boolean, overrides: Parameters<typeof mockApi>[1] = {}) {
  const [folder] = makeFolders(1);
  const saved = { ...folder, id: FOLDER_ID, name: LONG_NAME, isShared: true, isPublic };
  const api = mockApi(page, {
    folders: [saved],
    ...overrides,
    handlers: {
      [DETAIL]: (route) => route.fulfill({ json: envelope(saved) }),
      ...overrides.handlers,
    },
  });
  return { saved, api };
}

test("hides the cached public address while a fresh read is pending or failed and retries", async ({
  page,
}) => {
  const read = deferred();
  let opened = false;
  let failedOnce = false;
  const { saved, api } = setup(page, true, {
    handlers: {
      [DETAIL]: async (route) => {
        if (!opened || failedOnce) return route.fulfill({ json: envelope(saved) });
        await read.ready;
        failedOnce = true;
        return route.fulfill({ status: 503, json: { success: false } });
      },
    },
  });
  await api;
  const { trigger, onlyMe, everyone, copy, address } = controls(page);
  try {
    await page.goto(PATH);
    await expect(trigger).toBeVisible();
    opened = true;
    await trigger.click();
    await expect(page.getByText(LOADING)).toBeVisible();
    await expect(everyone).toBeDisabled();
    await expect(onlyMe).toBeDisabled();
    await expect(address).toHaveCount(0);
    await expect(copy).toHaveCount(0);
  } finally {
    read.release();
  }
  await expect(page.getByText("공개 설정을 확인하지 못했어요.")).toBeVisible();
  await expect(everyone).toBeDisabled();
  await expect(onlyMe).toBeDisabled();
  await expect(address).toHaveCount(0);
  await expect(copy).toHaveCount(0);
  await page.getByRole("button", { name: "다시 확인" }).click();
  await expect(everyone).toHaveAttribute("aria-pressed", "true");
  await expect(copy).toBeVisible();
});

test("keeps a previously confirmed address hidden offline and rechecks on reconnect", async ({
  page,
  context,
}) => {
  const { saved, api } = setup(page, true);
  await api;
  const { trigger, onlyMe, everyone, address, copy } = controls(page);
  await page.goto(PATH);
  await trigger.click();
  await expect(copy).toBeVisible();
  await trigger.click();
  await expect(copy).toHaveCount(0);

  saved.isPublic = false;
  await context.setOffline(true);
  try {
    await expect.poll(() => page.evaluate(() => navigator.onLine)).toBe(false);
    await trigger.click();
    await expect(page.getByText(LOADING)).toBeVisible();
    await expect(everyone).toBeDisabled();
    await expect(onlyMe).toBeDisabled();
    await expect(address).toHaveCount(0);
    await expect(copy).toHaveCount(0);
  } finally {
    await context.setOffline(false);
  }

  await expect(onlyMe).toBeEnabled();
  await expect(onlyMe).toHaveAttribute("aria-pressed", "true");
  await expect(address).toHaveCount(0);
  await expect(copy).toHaveCount(0);
});

for (const initiallyPublic of [false, true]) {
  test(`holds the previous selection and address through a failed write and retries (public: ${initiallyPublic})`, async ({
    page,
  }) => {
    const write = deferred();
    let fail = true;
    const { saved, api } = setup(page, initiallyPublic, {
      handlers: {
        [SAVE]: async (route, request) => {
          await write.ready;
          if (fail) {
            fail = false;
            return route.fulfill({ status: 503, json: { success: false } });
          }
          const { isPublic } = request.postDataJSON() as { isPublic: boolean };
          saved.isPublic = isPublic;
          return route.fulfill({ json: envelope({ isPublic }) });
        },
      },
    });
    await api;
    const { trigger, onlyMe, everyone, copy, confirm } = controls(page);
    const previous = initiallyPublic ? everyone : onlyMe;
    const next = initiallyPublic ? onlyMe : everyone;
    const chooseNext = async () => {
      await next.click();
      if (!initiallyPublic) await confirm.getByRole("button", { name: "전체 공개" }).click();
    };

    try {
      await page.goto(PATH);
      await trigger.click();
      await expect(previous).toHaveAttribute("aria-pressed", "true");
      await expect(copy).toHaveCount(initiallyPublic ? 1 : 0);
      await chooseNext();
      await expect(page.getByText(SAVING)).toBeVisible();
      await expect(previous).toHaveAttribute("aria-pressed", "true");
      await expect(everyone).toBeDisabled();
      await expect(onlyMe).toBeDisabled();
      await expect(copy).toHaveCount(initiallyPublic ? 1 : 0);
    } finally {
      write.release();
    }
    await expect(page.getByText("공개 설정을 저장하지 못했어요.")).toBeVisible();
    await expect(previous).toHaveAttribute("aria-pressed", "true");
    await expect(copy).toHaveCount(initiallyPublic ? 1 : 0);
    await chooseNext();
    await expect(next).toHaveAttribute("aria-pressed", "true");
    await expect(copy).toHaveCount(initiallyPublic ? 0 : 1);

    await trigger.click();
    await trigger.click();
    await expect(next).toBeEnabled();
    await expect(next).toHaveAttribute("aria-pressed", "true");
    await expect(copy).toHaveCount(initiallyPublic ? 0 : 1);
    await page.reload();
    await trigger.click();
    await expect(next).toBeEnabled();
    await expect(next).toHaveAttribute("aria-pressed", "true");
    await expect(copy).toHaveCount(initiallyPublic ? 0 : 1);
  });
}

test("copies the full address even when the origin truncates and opens a logged-out public folder", async ({
  page,
  context,
  browser,
}, testInfo) => {
  const { saved, api } = setup(page, true, {
    handlers: { "GET /api/users/me/settings": settingsHandler("dark", "gray") },
  });
  await api;
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  const longOrigin = new URL(PATH, testInfo.project.use.baseURL);
  longOrigin.hostname = "folder-address-for-a-long-web-origin-fixture.localhost";
  await page.goto(longOrigin.href);
  const { trigger, choices, copy, address } = controls(page);
  await trigger.click();
  await expect(address).toBeVisible();
  await expect(copy).toBeInViewport();
  const origin = new URL(page.url()).origin;
  const displayedOrigin = choices.getByText(origin, { exact: true });
  await expect(displayedOrigin).toHaveCSS("text-overflow", "ellipsis");
  expect(
    await displayedOrigin.evaluate((node) => parseFloat(getComputedStyle(node).fontSize)),
  ).toBeGreaterThan(11);
  expect(await displayedOrigin.evaluate((node) => node.scrollWidth > node.clientWidth)).toBe(true);
  await expect(address).toHaveText(PATH);
  expect(await address.evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true);
  if (!isWideProject()) {
    const popover = page.getByTestId("folder-visibility-popover");
    await expect.poll(async () => (await popover.boundingBox())?.x ?? 0).toBeGreaterThanOrEqual(12);
    const box = (await popover.boundingBox())!;
    expect(box.x + box.width).toBeLessThanOrEqual(390 - 12);
  }
  await copy.click();
  await expect(page.getByText(COPY_SUCCESS)).toBeVisible();
  await expect(choices).toBeVisible();
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied).toBe(`${origin}${PATH}`);

  const guest = await browser.newPage();
  try {
    await mockApi(guest, {
      seedSession: false,
      handlers: {
        [DETAIL]: (route, request) => {
          expect(request.headers().authorization).toBeUndefined();
          return route.fulfill({
            json: envelope({ id: saved.id, name: saved.name, myLinkCounts: 0 }),
          });
        },
      },
    });
    await guest.goto(copied);
    await expect(guest.getByRole("heading", { name: LONG_NAME })).toBeVisible();
    await expect(controls(guest).trigger).toHaveCount(0);
    await expect(controls(guest).copy).toHaveCount(0);
  } finally {
    await guest.close();
  }

  if (isWideProject()) {
    await page.keyboard.press("Escape");
    await expect(choices).toHaveCount(0);
    await expect(trigger).toBeFocused();
  }
});

test("shows a selectable full address after clipboard failure and supports keyboard copy", async ({
  page,
  context,
}) => {
  const { api } = setup(page, true);
  await api;
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.addInitScript(() => {
    Object.defineProperty(navigator.clipboard, "writeText", {
      value: async () => {
        throw new DOMException("Clipboard is unavailable", "NotAllowedError");
      },
    });
  });
  await page.goto(PATH);
  const { trigger, everyone, copy, choices } = controls(page);
  await trigger.click();
  await copy.click();
  await expect(page.getByText(COPY_ERROR)).toBeVisible();
  const fullAddress = new URL(PATH, page.url()).href;
  const expanded = choices.getByText(fullAddress, { exact: true });
  await expect(expanded).toBeVisible();
  await expect(expanded).toHaveCSS("user-select", "text");
  await everyone.focus();
  await page.keyboard.press("Tab");
  await expect(expanded).toBeFocused();
  await expect.poll(() => page.evaluate(() => window.getSelection()?.toString())).toBe(fullAddress);
  await page.keyboard.press("ControlOrMeta+c");
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe(fullAddress);
});

test("a 100-character folder name leaves all four owner actions usable", async ({ page }) => {
  const { api } = setup(page, true, {
    folderMembers: {
      [FOLDER_ID]: { ownerId: 1, ownerNickname: "테스트 소유자", members: [] },
    },
  });
  await api;
  await page.goto(PATH);
  const { trigger, copy } = controls(page);
  const edit = page.getByRole("button", { name: "폴더 수정", exact: true });
  const share = page.getByRole("button", { name: "폴더 공유", exact: true });
  const remove = page.getByRole("button", { name: "공유 폴더 삭제", exact: true });
  const title = page.getByRole("heading", { name: new RegExp(LONG_NAME.trim()) });
  await expect(title).toHaveCSS("white-space", "nowrap");
  await expect(title).toHaveCSS("text-overflow", "ellipsis");
  expect(await title.evaluate((node) => node.scrollWidth > node.clientWidth)).toBe(true);
  for (const action of [edit, trigger, share, remove]) await expect(action).toBeInViewport();

  await edit.click();
  await expect(page.getByPlaceholder("예: 디자인 레퍼런스")).toHaveValue(LONG_NAME);
  await expect(page.getByText("공개 열람 주소")).toHaveCount(0);
  const oldLink = page.getByRole("link", { name: "공개 페이지 열기" });
  await expect(oldLink).toHaveCount(0);
  await page.getByRole("button", { name: "취소", exact: true }).click();
  await trigger.click();
  await expect(copy).toBeVisible();
  await expect(oldLink).toHaveCount(0);
  await trigger.click();
  await share.click();
  await expect(page.getByText("테스트 소유자")).toBeVisible();
  await page.getByRole("button", { name: "공유하기" }).click();
  await expect(page.getByRole("button", { name: "초대 링크 생성" })).toBeVisible();
  await page.getByRole("button", { name: "공유 안내로 돌아가기" }).click();
  await page.getByRole("button", { name: "닫기", exact: true }).filter({ hasText: "닫기" }).click();
  await remove.click();
  await expect(page.getByRole("button", { name: "폴더 삭제", exact: true })).toBeVisible();
});

test("members can leave a public shared folder without access to owner visibility controls", async ({
  page,
}) => {
  const [folder] = makeFolders(1);
  await mockApi(page, {
    folders: [{ ...folder, id: FOLDER_ID, isShared: true, isPublic: true, ownerId: 2 }],
  });
  await page.goto(PATH);
  await expect(page.getByRole("button", { name: "공유 폴더 나가기" })).toBeVisible();
  const { trigger, copy } = controls(page);
  await expect(trigger).toHaveCount(0);
  await expect(copy).toHaveCount(0);
});
