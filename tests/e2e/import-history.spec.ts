import { type Page, expect, test } from "@playwright/test";

import { isWideProject } from "./support/helpers";
import { type MockFolder, mockApi } from "./support/mock-api";
import {
  type MockImportRecord,
  createMockImportApi,
  makeImportRecord,
} from "./support/mock-import-api";

// #22 unit 3: settings entry, history list, thumbnail progress and record detail.

const FOLDERS: MockFolder[] = [
  { id: 20, ownerId: 1, name: "aws", emoji: "☁️", isShared: false, shareCounts: 0, linkCounts: 2 },
];

async function setup(page: Page, records: MockImportRecord[] = []) {
  let api: Awaited<ReturnType<typeof mockApi>> | undefined;
  const imports = createMockImportApi({
    folders: () => api?.folders ?? FOLDERS,
    links: () => api?.links ?? [],
    records,
  });
  api = await mockApi(page, { folders: FOLDERS, handlers: imports.handlers });
  return { api, imports };
}

function minutesAgo(minutes: number) {
  return new Date(Date.now() - minutes * 60_000).toISOString();
}

const PARTIAL = makeImportRecord({
  id: 3,
  fileName: "bookmarks_work.html",
  createdAt: minutesAgo(30),
  folders: [
    {
      kind: "EXISTING",
      state: "ACTIVE",
      folderId: 20,
      name: "aws",
      emoji: "☁️",
      links: [
        {
          linkId: 301,
          title: "VPC 서브넷 설계 체크리스트",
          url: "https://a.test/1",
          state: "IMPORTED",
        },
        {
          linkId: 302,
          title: "ECS 서비스 배포 전략 비교",
          url: "https://a.test/2",
          state: "IMPORTED",
        },
      ],
    },
    {
      kind: "NEW",
      state: "ACTIVE",
      folderId: 7003,
      name: "자바",
      emoji: null,
      links: [
        {
          linkId: 311,
          title: "Java 21 가상 스레드 정리",
          url: "https://j.test/1",
          state: "IMPORTED",
        },
      ],
    },
    {
      kind: "UNFILED",
      state: "ACTIVE",
      folderId: null,
      name: null,
      emoji: null,
      links: [{ linkId: 321, title: "미분류 링크", url: "https://u.test/1", state: "IMPORTED" }],
    },
  ],
  failures: [
    {
      title: "회사 VPN 포털",
      url: "https://vpn.example-corp.internal/login",
      reason: "URL_INVALID",
    },
    { title: "제목이 이상한 링크", url: "https://example.com/bad-title", reason: "TITLE_INVALID" },
  ],
});

const COMPLETED = makeImportRecord({
  id: 2,
  fileName: "bookmarks_26_11_1.html",
  createdAt: minutesAgo(60),
});

const UNDONE = makeImportRecord({
  id: 1,
  fileName: "bookmarks_old.html",
  createdAt: minutesAgo(90),
  wasReversed: true,
  folders: [
    {
      kind: "NEW",
      state: "REVERSED",
      folderId: 7001,
      name: "옛 폴더",
      emoji: null,
      links: [{ linkId: 101, title: "옛 링크", url: "https://o.test/1", state: "REVERSED" }],
    },
  ],
});

function historyRow(page: Page, id: number) {
  return page.getByTestId(`import-row-${id}`);
}

test.describe("bookmark import history", () => {
  test("settings > 데이터 > 북마크 가져오기 shows the new import button and the history", async ({
    page,
  }) => {
    await setup(page, [PARTIAL, COMPLETED, UNDONE]);
    await page.goto("/settings");

    await expect(page.getByText("데이터", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "북마크 가져오기" }).click();

    await expect(page).toHaveURL(/\/settings\/imports$/);
    await expect(page.getByRole("button", { name: "새로 가져오기" })).toBeVisible();
    await expect(page.getByText("가져오기 기록", { exact: true })).toBeVisible();

    const rows = page.locator('[data-testid^="import-row-"]');
    await expect(rows).toHaveCount(3);
    await expect(rows.nth(0)).toContainText("bookmarks_work.html");
    await expect(rows.nth(1)).toContainText("bookmarks_26_11_1.html");
    await expect(rows.nth(2)).toContainText("bookmarks_old.html");

    await expect(historyRow(page, 3)).toContainText("일부 실패");
    await expect(historyRow(page, 3)).toContainText("링크 4개 · 새 폴더 1개 · 실패 2개");
    await expect(historyRow(page, 2)).toContainText("완료");
    await expect(historyRow(page, 1)).toContainText("되돌림");
  });

  test("shows the empty state without records", async ({ page }) => {
    await setup(page, []);
    await page.goto("/settings/imports");

    await expect(page.getByText("아직 가져온 기록이 없어요")).toBeVisible();
    await expect(page.getByRole("button", { name: "새로 가져오기" })).toBeVisible();
  });

  test("direct entry and reload keep the screen and the history", async ({ page }) => {
    await setup(page, [COMPLETED]);
    await page.goto("/settings/imports");
    await expect(historyRow(page, 2)).toBeVisible();

    await page.reload();
    await expect(page).toHaveURL(/\/settings\/imports$/);
    await expect(page.getByRole("button", { name: "새로 가져오기" })).toBeVisible();
    await expect(historyRow(page, 2)).toContainText("bookmarks_26_11_1.html");
  });

  test("a partly failed record shows failures and reasons in its detail", async ({ page }) => {
    await setup(page, [PARTIAL]);
    await page.goto("/settings/imports");

    await page.getByRole("button", { name: "bookmarks_work.html 기록 상세" }).click();
    await expect(page).toHaveURL(/\/settings\/imports\/3$/);

    const detail = isWideProject()
      ? page.getByRole("dialog", { name: "가져오기 기록 상세" })
      : page;
    await expect(detail.getByText("실패한 항목 2개")).toBeVisible();
    await expect(detail.getByText("회사 VPN 포털")).toBeVisible();
    await expect(detail.getByText("주소 형식을 처리하지 못했어요")).toBeVisible();
    await expect(detail.getByText("제목을 처리하지 못했어요")).toBeVisible();
    await expect(detail.getByRole("group", { name: "추가된 링크", exact: true })).toHaveText(
      `추가된 링크+4`,
    );
    await expect(detail.getByRole("group", { name: "새 폴더", exact: true })).toHaveText(
      `새 폴더+1`,
    );
    await expect(detail.getByRole("group", { name: "실패", exact: true })).toHaveText(`실패2`);

    await expect(detail.getByText("추가된 폴더와 링크")).toBeVisible();
    await expect(detail.getByText("VPC 서브넷 설계 체크리스트")).toBeVisible();
    await expect(detail.getByText("기존 폴더")).toBeVisible();

    const unfiled = detail.getByRole("button", { name: /^미분류 링크 1개 펼치기$/ });
    await expect(unfiled).toBeVisible();
    await unfiled.click();
    await expect(detail.getByText("미분류 링크", { exact: true })).toBeVisible();
  });

  test("direct entry to a detail shows it, and an unknown id shows not found", async ({ page }) => {
    await setup(page, [PARTIAL]);
    await page.goto("/settings/imports/3");
    await expect(page.getByText("실패한 항목 2개")).toBeVisible();

    await page.goto("/settings/imports/999");
    await expect(page.getByText("가져오기 기록을 찾을 수 없어요")).toBeVisible();
  });

  test("closing the wide detail goes back to the history", async ({ page }) => {
    test.skip(!isWideProject(), "wide overlay only");
    await setup(page, [PARTIAL]);
    await page.goto("/settings/imports/3");
    const detail = page.getByRole("dialog", { name: "가져오기 기록 상세" });
    await expect(detail).toBeVisible();
    await expect(historyRow(page, 3)).toBeAttached();

    await detail.getByRole("button", { name: "가져오기 기록으로" }).click();
    await expect(page).toHaveURL(/\/settings\/imports$/);
    await expect(detail).toHaveCount(0);

    await page.goto("/settings/imports/3");
    await expect(detail).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page).toHaveURL(/\/settings\/imports$/);

    await page.goto("/settings");
    await page.getByRole("button", { name: "북마크 가져오기" }).click();
    await page.getByRole("button", { name: "bookmarks_work.html 기록 상세" }).click();
    await expect(detail).toBeVisible();
    await expect(detail).toBeFocused();
    await detail.getByRole("button", { name: "가져오기 기록으로" }).click();
    await expect(page).toHaveURL(/\/settings\/imports$/);
    await expect(detail).toHaveCount(0);
    await page.goBack();
    await expect(page).toHaveURL(/\/settings$/);
  });

  test("shows the thumbnail progress bar until thumbnails are filled", async ({ page }) => {
    test.setTimeout(60_000);
    const filling = makeImportRecord({
      id: 9,
      fileName: "즐겨찾기_26_11_2.html",
      progress: 0,
      createdAt: minutesAgo(1),
    });
    const { imports, api } = await setup(page, [filling, COMPLETED]);
    imports.state.progressStep = 1;
    await page.goto("/settings/imports");

    const row = historyRow(page, 9);
    await expect(row.getByText("썸네일 채우는 중")).toBeVisible();
    await expect(page.getByTestId("import-progress-9")).toBeVisible();
    await expect(historyRow(page, 2).getByText("썸네일 채우는 중")).toHaveCount(0);

    await expect(row.getByText("썸네일 채우는 중")).toHaveCount(0, { timeout: 20_000 });
    await expect(page.getByTestId("import-progress-9")).toHaveCount(0);

    const listCalls = () =>
      api.requests.filter((request) => request.method === "GET" && request.path === "/api/imports")
        .length;
    const settled = listCalls();
    await page.waitForTimeout(11_000);
    expect(listCalls()).toBe(settled);
  });

  test("stops polling after leaving the history screen", async ({ page }) => {
    test.setTimeout(90_000);
    const filling = makeImportRecord({ id: 9, progress: 0, createdAt: minutesAgo(1) });
    const { imports, api } = await setup(page, [filling]);
    imports.state.progressStep = 0;
    const listCalls = () =>
      api.requests.filter((request) => request.method === "GET" && request.path === "/api/imports")
        .length;

    await page.goto("/settings");
    await page.getByRole("button", { name: "북마크 가져오기" }).click();
    await expect(page).toHaveURL(/\/settings\/imports$/);
    await expect(historyRow(page, 9).getByText("썸네일 채우는 중")).toBeVisible();

    const onScreen = listCalls();
    await expect.poll(listCalls, { timeout: 15_000 }).toBeGreaterThan(onScreen);

    if (isWideProject()) {
      await page.getByRole("button", { name: "설정", exact: true }).click();
    } else {
      await page.getByRole("button", { name: "뒤로" }).click();
    }
    await expect(page).toHaveURL(/\/settings$/);
    await expect(page.getByRole("button", { name: "북마크 가져오기" })).toBeVisible();

    const afterLeaving = listCalls();
    await page.waitForTimeout(11_000);
    expect(listCalls()).toBe(afterLeaving);
  });
});
