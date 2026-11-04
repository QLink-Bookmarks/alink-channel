import { type Page, expect, test } from "@playwright/test";

import { boxOf, isWideProject } from "./support/helpers";
import { type MockFolder, mockApi } from "./support/mock-api";
import {
  type MockImportRecord,
  createMockImportApi,
  makeImportRecord,
} from "./support/mock-import-api";

// #22 unit 3: the reversal modal (wide dialog / mobile sheet) and running a reversal.

const FOLDERS: MockFolder[] = [
  { id: 20, ownerId: 1, name: "aws", emoji: "☁️", isShared: false, shareCounts: 0, linkCounts: 2 },
];

const TITLE = "가져오기를 되돌릴까요?";

function makeRecord(): MockImportRecord {
  return makeImportRecord({
    id: 5,
    fileName: "bookmarks_26_11_1.html",
    createdAt: new Date(Date.now() - 60 * 60_000).toISOString(),
    folders: [
      {
        kind: "EXISTING",
        state: "ACTIVE",
        folderId: 20,
        name: "aws",
        emoji: "☁️",
        links: [
          { linkId: 501, title: "VPC 서브넷 설계", url: "https://aws.test/vpc", state: "IMPORTED" },
          { linkId: 502, title: "ECS 배포 전략", url: "https://aws.test/ecs", state: "IMPORTED" },
        ],
      },
      {
        kind: "NEW",
        state: "ACTIVE",
        folderId: 7005,
        name: "자바",
        emoji: null,
        links: [
          {
            linkId: 511,
            title: "Java 21 가상 스레드 정리",
            url: "https://velog.io/java21",
            state: "IMPORTED",
          },
          {
            linkId: 512,
            title: "Effective Java 아이템 요약",
            url: "https://github.com/ej",
            state: "EDITED",
          },
          { linkId: 513, title: "직접 지운 링크", url: "https://j.test/gone", state: "DELETED" },
          {
            linkId: 514,
            title: "가져온 뒤 직접 저장한 링크",
            url: "https://j.test/mine",
            state: "ADDED_LATER",
          },
        ],
      },
      {
        kind: "NEW",
        state: "SHARED",
        folderId: 7006,
        name: "취업 2",
        emoji: null,
        links: [
          { linkId: 521, title: "면접 질문 모음", url: "https://job.test/q", state: "IMPORTED" },
        ],
      },
      {
        kind: "UNFILED",
        state: "ACTIVE",
        folderId: null,
        name: null,
        emoji: null,
        links: [
          { linkId: 531, title: "미분류에 넣은 링크", url: "https://u.test/1", state: "IMPORTED" },
        ],
      },
    ],
  });
}

const UNDONE = makeImportRecord({
  id: 4,
  fileName: "bookmarks_old.html",
  createdAt: new Date(Date.now() - 2 * 60 * 60_000).toISOString(),
  wasReversed: true,
  folders: [
    {
      kind: "NEW",
      state: "REVERSED",
      folderId: 7004,
      name: "옛 폴더",
      emoji: null,
      links: [{ linkId: 401, title: "옛 링크", url: "https://o.test/1", state: "REVERSED" }],
    },
  ],
});

async function setup(page: Page, records: MockImportRecord[] = [makeRecord(), UNDONE]) {
  let api: Awaited<ReturnType<typeof mockApi>> | undefined;
  const imports = createMockImportApi({
    folders: () => api?.folders ?? FOLDERS,
    links: () => api?.links ?? [],
    records,
  });
  api = await mockApi(page, { folders: FOLDERS, handlers: imports.handlers });
  return { api, imports };
}

function reversalPosts(api: Awaited<ReturnType<typeof mockApi>>) {
  return api.requests.filter(
    (request) => request.method === "POST" && request.path === "/api/imports/5/reversals",
  );
}

async function openFromRow(page: Page) {
  await page.goto("/settings/imports");
  await page.getByRole("button", { name: "bookmarks_26_11_1.html 되돌리기" }).click();
  await expect(page.getByText(TITLE)).toBeVisible();
  await expect(page.getByRole("checkbox", { name: "aws의 가져온 항목 모두 지우기" })).toBeVisible();
}

async function openFolder(page: Page, name: string) {
  await page.getByRole("button", { name: `${name} 폴더 보기` }).click();
}

async function backToFolders(page: Page) {
  if (!isWideProject()) {
    await page.getByRole("button", { name: "폴더 목록으로" }).click();
  }
}

function linkRow(page: Page, linkId: number) {
  return page.getByTestId(`reversal-link-${linkId}`);
}

function submitButton(page: Page) {
  return page.getByRole("button", { name: /^(되돌리기|남은 항목 다시 시도|되돌리는 중…)$/ });
}

test.describe("bookmark import reversal", () => {
  test("opens from the history row and the detail; no button without removable items", async ({
    page,
  }) => {
    await setup(page);
    await page.goto("/settings/imports");

    await expect(page.getByTestId("import-row-4")).toContainText("되돌림");
    await expect(page.getByRole("button", { name: "bookmarks_old.html 되돌리기" })).toHaveCount(0);

    await page.getByRole("button", { name: "bookmarks_26_11_1.html 되돌리기" }).click();
    await expect(page.getByText(TITLE)).toBeVisible();
    await page.getByRole("button", { name: "취소" }).click();
    await expect(page.getByText(TITLE)).toHaveCount(0);

    await page.goto("/settings/imports/5");
    await page.getByRole("button", { name: "이 가져오기 되돌리기" }).click();
    await expect(page.getByText(TITLE)).toBeVisible();
    await expect(
      page.getByText(/bookmarks_26_11_1\.html · .* · 남길 항목은 체크를 풀어 주세요\./),
    ).toBeVisible();

    await page.goto("/settings/imports/4");
    await expect(page.getByText("옛 링크")).toBeVisible();
    await expect(page.getByRole("button", { name: "이 가져오기 되돌리기" })).toHaveCount(0);
  });

  test("lists every folder and link with its state and the totals", async ({ page }) => {
    await setup(page);
    await openFromRow(page);

    for (const name of ["미분류", "aws", "취업 2", "자바"]) {
      await expect(page.getByRole("button", { name: `${name} 폴더 보기` })).toBeVisible();
    }
    await expect(
      page.getByText("링크 6개 · 폴더 1개를 지우고, 링크 1개는 미분류로 옮겨요"),
    ).toBeVisible();
    await expect(page.getByTestId("reversal-hint")).toContainText("수정한 링크 1개 포함");
    await expect(page.getByTestId("reversal-folder-folder-7005")).toContainText("수정 1");
    await expect(page.getByTestId("reversal-folder-folder-20")).not.toContainText("수정");

    await openFolder(page, "자바");
    await expect(page.getByText("폴더를 지워요")).toBeVisible();
    await expect(linkRow(page, 511)).toContainText("지워요");
    await expect(
      page.getByRole("checkbox", { name: "Java 21 가상 스레드 정리 지우기" }),
    ).toBeChecked();

    await expect(linkRow(page, 512).getByText("가져온 뒤 수정됨", { exact: true })).toBeVisible();
    await expect(linkRow(page, 512).getByText("github.com", { exact: true })).toBeVisible();
    await expect(linkRow(page, 512)).toContainText("지워요");
    await expect(
      page.getByRole("checkbox", { name: "Effective Java 아이템 요약 지우기" }),
    ).toBeChecked();

    await expect(linkRow(page, 513)).toContainText("이미 삭제됨");
    const deleted = page.getByRole("checkbox", { name: "직접 지운 링크 지우기" });
    await expect(deleted).not.toBeChecked();
    await expect(deleted).toBeDisabled();

    await expect(linkRow(page, 514)).toContainText("미분류");
    await expect(
      page.getByRole("checkbox", { name: "가져온 뒤 직접 저장한 링크 지우기" }),
    ).toBeDisabled();

    await backToFolders(page);
    await openFolder(page, "aws");
    await expect(page.getByText("기존 폴더")).toBeVisible();
    await expect(page.getByText(/폴더는 그대로 두고, 이번에 넣은 링크만 지워요/)).toBeVisible();
    await expect(linkRow(page, 501)).toContainText("지워요");

    await backToFolders(page);
    await openFolder(page, "취업 2");
    await expect(page.getByText("공유 중", { exact: true })).toBeVisible();
    await expect(page.getByText(/폴더는 남기고, 가져온 링크만 지워요/)).toBeVisible();
    await expect(linkRow(page, 521)).toContainText("지워요");
  });

  test("unchecking a link or a folder updates the outcome and the totals", async ({ page }) => {
    await setup(page);
    await openFromRow(page);
    await openFolder(page, "자바");

    await page.getByRole("checkbox", { name: "Java 21 가상 스레드 정리 지우기" }).click();
    await expect(linkRow(page, 511)).toContainText("미분류");
    await expect(
      page.getByText("링크 5개 · 폴더 1개를 지우고, 링크 2개는 미분류로 옮겨요"),
    ).toBeVisible();

    await page.getByRole("checkbox", { name: "가져온 링크 2개 모두 지우기" }).click();
    await expect(page.getByRole("checkbox", { name: "가져온 링크 2개 모두 지우기" })).toBeChecked();
    await expect(
      page.getByText("링크 6개 · 폴더 1개를 지우고, 링크 1개는 미분류로 옮겨요"),
    ).toBeVisible();

    await page.getByRole("checkbox", { name: "가져온 링크 2개 모두 지우기" }).click();
    await expect(page.getByText("폴더를 남겨요")).toBeVisible();
    for (const id of [511, 512, 514]) {
      await expect(linkRow(page, id)).toContainText("남겨요");
    }
    await expect(page.getByText("링크 4개 · 폴더 0개를 지워요")).toBeVisible();
  });

  test("edited links show a warning badge, a 수정 N chip and the caption note", async ({
    page,
  }) => {
    const record = makeRecord();
    record.folders[0].links[1].state = "EDITED";
    await setup(page, [record]);
    await openFromRow(page);

    const hint = page.getByTestId("reversal-hint");
    await expect(hint).toContainText("수정한 링크 2개 포함");
    await expect(page.getByTestId("reversal-folder-folder-20")).toContainText("수정 1");
    await expect(page.getByTestId("reversal-folder-folder-7005")).toContainText("수정 1");

    await openFolder(page, "자바");
    await page.getByRole("checkbox", { name: "Effective Java 아이템 요약 지우기" }).click();
    await expect(linkRow(page, 512).getByText("가져온 뒤 수정됨")).toBeVisible();
    await expect(hint).toContainText("수정한 링크 1개 포함");
    await backToFolders(page);
    await expect(page.getByTestId("reversal-folder-folder-7005")).not.toContainText("수정");

    await page.getByRole("checkbox", { name: "aws의 가져온 항목 모두 지우기" }).click();
    await expect(page.getByTestId("reversal-folder-folder-20")).not.toContainText("수정");
    await expect(hint).not.toContainText("수정한 링크");

    for (const text of ["github.com", "가져온 뒤 수정됨"]) {
      await openFolder(page, "자바");
      const size = await linkRow(page, 512)
        .getByText(text, { exact: true })
        .evaluate((node) => parseFloat(getComputedStyle(node).fontSize));
      expect(size).toBeGreaterThanOrEqual(12);
      await backToFolders(page);
    }
  });

  test("after a failed reversal the edited note counts only what is left", async ({ page }) => {
    const record = makeRecord();
    record.folders[0].links[1].state = "EDITED";
    const { imports } = await setup(page, [record]);
    let aborted = 0;
    await page.route("**/api/imports/5/reversals", async (route) => {
      if (aborted > 0) {
        await route.fallback();
        return;
      }
      aborted += 1;
      const stored = imports.state.records.find((item) => item.id === 5);
      for (const link of stored?.folders[0].links ?? []) link.state = "REVERSED";
      if (stored) stored.wasReversed = true;
      await route.abort("failed");
    });
    await openFromRow(page);
    await expect(page.getByTestId("reversal-hint")).toContainText("수정한 링크 2개 포함");

    await submitButton(page).click();
    await expect(page.getByText("되돌리기를 끝내지 못했어요")).toBeVisible();
    await expect(page.getByTestId("reversal-hint")).toContainText("남은 링크 4개");
    await expect(page.getByTestId("reversal-hint")).toContainText("수정한 링크 1개 포함");
  });

  test("the mobile sheet puts the caption above side-by-side 취소 and 되돌리기", async ({
    page,
  }) => {
    test.skip(isWideProject(), "mobile sheet only");
    await setup(page);
    await openFromRow(page);
    const cancel = await boxOf(page.getByRole("button", { name: "취소", exact: true }));
    const submit = await boxOf(submitButton(page));
    const hint = await boxOf(page.getByTestId("reversal-hint"));
    expect(Math.abs(cancel.y - submit.y)).toBeLessThan(2);
    expect(cancel.x).toBeLessThan(submit.x);
    expect(hint.y + hint.height).toBeLessThanOrEqual(cancel.y + 1);
  });

  test("runs the reversal and the record becomes 되돌림", async ({ page }) => {
    const { api } = await setup(page);
    await openFromRow(page);

    await submitButton(page).click();
    await expect(page.getByText(TITLE)).toHaveCount(0);

    const posts = reversalPosts(api);
    expect(posts).toHaveLength(1);
    const body = posts[0].body as { linkIds: number[]; folderIds: number[] };
    expect([...body.linkIds].sort()).toEqual([501, 502, 511, 512, 521, 531]);
    expect(body.folderIds).toEqual([7005]);

    await expect(page.getByTestId("import-row-5")).toContainText("되돌림");
    await expect(page.getByTestId("import-row-5")).not.toContainText("일부 되돌림");
    await expect(page.getByRole("button", { name: "bookmarks_26_11_1.html 되돌리기" })).toHaveCount(
      0,
    );
  });

  test("keeping a folder gives 일부 되돌림 and the next reversal shows only what is left", async ({
    page,
  }) => {
    const { api } = await setup(page);
    await openFromRow(page);
    await page.getByRole("checkbox", { name: "자바의 가져온 항목 모두 지우기" }).click();
    await submitButton(page).click();
    await expect(page.getByText(TITLE)).toHaveCount(0);

    const body = reversalPosts(api)[0].body as { linkIds: number[]; folderIds: number[] };
    expect([...body.linkIds].sort()).toEqual([501, 502, 521, 531]);
    expect(body.folderIds).toEqual([]);
    await expect(page.getByTestId("import-row-5")).toContainText("일부 되돌림");

    await page.getByRole("button", { name: "bookmarks_26_11_1.html 되돌리기" }).click();
    await expect(page.getByRole("button", { name: "자바 폴더 보기" })).toBeVisible();
    for (const name of ["미분류", "aws", "취업 2"]) {
      await expect(page.getByRole("button", { name: `${name} 폴더 보기` })).toHaveCount(0);
    }
    await expect(
      page.getByText("링크 2개 · 폴더 1개를 지우고, 링크 1개는 미분류로 옮겨요"),
    ).toBeVisible();
  });

  test("a failed reversal shows the error and retries only what is left", async ({ page }) => {
    const { api, imports } = await setup(page);
    let aborted = 0;
    await page.route("**/api/imports/5/reversals", async (route) => {
      if (aborted > 0) {
        await route.fallback();
        return;
      }
      aborted += 1;
      const record = imports.state.records.find((item) => item.id === 5);
      for (const link of record?.folders[0].links ?? []) link.state = "REVERSED";
      if (record) record.wasReversed = true;
      await route.abort("failed");
    });
    await openFromRow(page);

    await submitButton(page).click();
    await expect(page.getByText("되돌리기를 끝내지 못했어요")).toBeVisible();
    await expect(page.getByText(/링크 2개는 지웠지만, 나머지는 그대로 있어요/)).toBeVisible();
    await expect(page.getByRole("button", { name: "남은 항목 다시 시도" })).toBeVisible();
    await expect(
      page.getByText("남은 링크 4개 · 폴더 1개를 지우고, 링크 1개는 미분류로 옮겨요"),
    ).toBeVisible();

    await openFolder(page, "aws");
    await expect(linkRow(page, 501)).toContainText("지웠어요");
    await expect(page.getByRole("checkbox", { name: "VPC 서브넷 설계 지우기" })).toBeDisabled();
    await backToFolders(page);

    await page.getByRole("button", { name: "남은 항목 다시 시도" }).click();
    await expect(page.getByText(TITLE)).toHaveCount(0);
    const posts = reversalPosts(api);
    expect(posts).toHaveLength(1);
    const body = posts[0].body as { linkIds: number[]; folderIds: number[] };
    expect([...body.linkIds].sort()).toEqual([511, 512, 521, 531]);
    expect(body.folderIds).toEqual([7005]);
    await expect(page.getByTestId("import-row-5")).toContainText("되돌림");
  });

  test("a folder shared in the meantime is explained and kept", async ({ page }) => {
    const { api, imports } = await setup(page);
    await openFromRow(page);
    const record = imports.state.records.find((item) => item.id === 5);
    if (record) record.folders[1].state = "SHARED";

    await submitButton(page).click();
    await expect(page.getByText("공유 중인 폴더는 되돌릴 수 없어요")).toBeVisible();
    await openFolder(page, "자바");
    await expect(page.getByText("공유 중", { exact: true })).toBeVisible();
    await backToFolders(page);

    await submitButton(page).click();
    await expect(page.getByText(TITLE)).toHaveCount(0);
    const last = reversalPosts(api).at(-1)?.body as { linkIds: number[]; folderIds: number[] };
    expect(last.folderIds).toEqual([]);
  });

  test("pressing 되돌리기 repeatedly sends one request and blocks closing meanwhile", async ({
    page,
  }) => {
    const { api, imports } = await setup(page);
    imports.state.endpoints.reverse.delayMs = 1500;
    await openFromRow(page);

    await submitButton(page).evaluate((element: HTMLElement) => {
      element.click();
      element.click();
    });
    await expect(page.getByRole("button", { name: "되돌리는 중…" })).toBeVisible();
    await expect(page.getByRole("button", { name: "취소" })).toBeDisabled();
    if (isWideProject()) {
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog", { name: TITLE })).toBeVisible();
    }

    await expect(page.getByText(TITLE)).toHaveCount(0, { timeout: 10_000 });
    expect(reversalPosts(api)).toHaveLength(1);
  });

  test("768px shows the sheet and 769px shows the dialog", async ({ page }) => {
    test.skip(!isWideProject(), "resizes from the desktop project");
    await setup(page);

    await page.setViewportSize({ width: 769, height: 900 });
    await openFromRow(page);
    await expect(page.getByRole("dialog", { name: TITLE })).toBeVisible();
    await expect(page.getByRole("button", { name: "자바 폴더 보기" })).toBeVisible();
    await expect(linkRow(page, 511)).toBeVisible();

    await page.setViewportSize({ width: 768, height: 900 });
    await page.goto("/settings/imports");
    await page.getByRole("button", { name: "bookmarks_26_11_1.html 되돌리기" }).click();
    await expect(page.getByText(TITLE)).toBeVisible();
    await expect(page.getByRole("dialog", { name: TITLE })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "자바 폴더 보기" })).toBeVisible();
    await expect(linkRow(page, 511)).toHaveCount(0);
    await page.getByRole("button", { name: "자바 폴더 보기" }).click();
    await expect(linkRow(page, 511)).toBeVisible();
    await expect(page.getByRole("button", { name: "폴더 목록으로" })).toBeVisible();
  });

  test("checkboxes and folder rows are large enough to tap on mobile", async ({ page }) => {
    test.skip(isWideProject(), "mobile only");
    await setup(page);
    await openFromRow(page);

    const folderBox = await boxOf(
      page.getByRole("checkbox", { name: "자바의 가져온 항목 모두 지우기" }),
    );
    expect(folderBox.width).toBeGreaterThanOrEqual(44);
    expect(folderBox.height).toBeGreaterThanOrEqual(44);
    const rowBox = await boxOf(page.getByRole("button", { name: "자바 폴더 보기" }));
    expect(rowBox.height).toBeGreaterThanOrEqual(44);

    await openFolder(page, "자바");
    const linkBox = await boxOf(
      page.getByRole("checkbox", { name: "Java 21 가상 스레드 정리 지우기" }),
    );
    expect(linkBox.width).toBeGreaterThanOrEqual(44);
    expect(linkBox.height).toBeGreaterThanOrEqual(44);

    const submit = await boxOf(submitButton(page));
    const viewport = page.viewportSize();
    expect(submit.y + submit.height).toBeLessThanOrEqual((viewport?.height ?? 844) - 16);
  });

  test("the modal is not reachable via 되돌리기 on another user's missing record", async ({
    page,
  }) => {
    await setup(page);
    await page.goto("/settings/imports/77");
    await expect(page.getByText("가져오기 기록을 찾을 수 없어요")).toBeVisible();
    await expect(page.getByRole("button", { name: "이 가져오기 되돌리기" })).toHaveCount(0);
  });
});
