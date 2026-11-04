import type { StartImportRequest } from "@/features/imports/types";
import { type Locator, type Page, expect, test } from "@playwright/test";

import {
  PROPOSAL_TITLE,
  backToFolders,
  countRequests,
  htmlFile,
  linkHandle,
  linkRemove,
  makeBookmarkExport,
  openFolder,
  openProposal,
  setupImportFlow,
  summaryValue,
} from "./support/bookmark-fixtures";
import { isWideProject } from "./support/helpers";
import { makeLink } from "./support/mock-api";

// #22 unit 4: the confirm window and the synchronous start.

function startBodies(api: Awaited<ReturnType<typeof setupImportFlow>>["api"]) {
  return api.requests
    .filter((request) => request.method === "POST" && request.path === "/api/imports")
    .map((request) => request.body as StartImportRequest);
}

const CONFIRM_TITLE = "가져오기를 시작할까요?";

function confirmScope(page: Page): Locator {
  return isWideProject() ? page.getByRole("dialog", { name: CONFIRM_TITLE }) : page.locator("body");
}

async function openConfirm(page: Page) {
  await page
    .getByRole("button", { name: /^(가져오기|링크 [\d,]+개 가져오기)$/ })
    .last()
    .click();
  await expect(page.getByText(CONFIRM_TITLE)).toBeVisible();
  return confirmScope(page);
}

async function expectConfirmClosed(page: Page, options?: { timeout: number }) {
  await expect(page.getByText(CONFIRM_TITLE)).toHaveCount(0, options);
}

test.describe("confirm window", () => {
  test("가져오기 opens the confirm window with the numbers after edits", async ({ page }) => {
    await setupImportFlow(page);
    const scope = await openProposal(page);
    await openFolder(scope, "새 폴더 여행");
    await linkRemove(scope, "교토 숙소 후보").click();
    await expect(summaryValue(scope, "추가할 링크")).toContainText("+10");
    const dialog = await openConfirm(page);
    await expect(dialog.getByText("링크 10개와 새 폴더 2개를 추가할게요.")).toBeVisible();
  });

  test("취소 in the confirm window goes back to the proposal with the edits kept", async ({
    page,
  }) => {
    const { api } = await setupImportFlow(page);
    const scope = await openProposal(page);
    await openFolder(scope, "미분류");
    await linkRemove(scope, "오늘의 뉴스").click();
    const dialog = await openConfirm(page);
    await dialog.getByRole("button", { name: "취소", exact: true }).last().click();
    await expectConfirmClosed(page);
    await expect(page.getByText(PROPOSAL_TITLE)).toBeVisible();
    await expect(linkHandle(scope, "오늘의 뉴스")).toHaveCount(0);
    await expect(summaryValue(scope, "추가할 링크")).toContainText("+10");
    expect(countRequests(api, "POST", "/api/imports")).toBe(0);
  });
});

test.describe("starting", () => {
  test("시작 shows 가져오는 중… and blocks closing, then closes on the imports page after one request", async ({
    page,
  }) => {
    const { api, imports } = await setupImportFlow(page, {
      endpoints: { start: { delayMs: 1500 } },
    });
    await openProposal(page);
    const dialog = await openConfirm(page);
    await dialog.getByRole("button", { name: "시작", exact: true }).last().click();

    const saving = dialog.getByRole("button", { name: "가져오는 중…" }).last();
    await expect(saving).toBeVisible();
    await expect(saving).toBeDisabled();
    await expect(dialog.getByRole("button", { name: "취소", exact: true }).last()).toBeDisabled();
    await page.keyboard.press("Escape");
    await expect(page.getByText(CONFIRM_TITLE)).toBeVisible();
    await expect(page.getByText(PROPOSAL_TITLE)).toBeVisible();

    await expectConfirmClosed(page, { timeout: 10_000 });
    await expect(page.getByText(PROPOSAL_TITLE)).toHaveCount(0);
    await expect(page).toHaveURL(/\/settings\/imports$/);
    expect(countRequests(api, "POST", "/api/imports")).toBe(1);
    expect(imports.state.records).toHaveLength(1);
    expect(imports.state.records[0]).toMatchObject({
      fileName: "chrome-export.html",
      linkCount: 11,
      folderCount: 3,
    });

    const [body] = startBodies(api);
    expect(body.clientRequestId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(body.folders).toEqual(
      expect.arrayContaining([
        { key: "existing:10", folderId: 10, name: "aws" },
        expect.objectContaining({ name: "자바", createdAt: "2023-01-02T00:00:00.000Z" }),
        expect.objectContaining({ name: "취업 2" }),
        expect.objectContaining({ name: "여행" }),
      ]),
    );
    expect(body.links).toHaveLength(11);
    expect(body.links.find((link) => link.title === "오늘의 뉴스")).toEqual({
      key: expect.any(String),
      url: "https://news.example.com/",
      title: "오늘의 뉴스",
      folderKey: null,
      createdAt: "2024-01-01T00:00:00.000Z",
    });
  });

  test("pressing 시작 several times quickly starts one import", async ({ page }) => {
    const { api, imports } = await setupImportFlow(page, {
      endpoints: { start: { delayMs: 800 } },
    });
    await openProposal(page);
    const dialog = await openConfirm(page);
    const start = dialog.getByRole("button", { name: "시작", exact: true }).last();
    await start.evaluate((node) => {
      for (let index = 0; index < 4; index += 1) {
        (node as HTMLElement).click();
      }
    });
    await expectConfirmClosed(page, { timeout: 10_000 });
    expect(countRequests(api, "POST", "/api/imports")).toBe(1);
    expect(imports.state.records).toHaveLength(1);
  });

  test("a failed start shows the error and 다시 시도, and retrying starts it once with the same request id", async ({
    page,
  }) => {
    const { api, imports } = await setupImportFlow(page, {
      endpoints: { start: { fail: { status: 500 }, failTimes: 1 } },
    });
    await openProposal(page);
    const dialog = await openConfirm(page);
    await dialog.getByRole("button", { name: "시작", exact: true }).last().click();
    await expect(dialog.getByText("가져오기를 시작하지 못했어요")).toBeVisible();
    await expect(dialog.getByText("잠시 후 다시 시도해 주세요.")).toBeVisible();
    expect(imports.state.records).toHaveLength(0);

    await dialog.getByRole("button", { name: "다시 시도" }).last().click();
    await expectConfirmClosed(page);
    await expect(page).toHaveURL(/\/settings\/imports$/);
    const bodies = startBodies(api);
    expect(bodies).toHaveLength(2);
    expect(bodies[1].clientRequestId).toBe(bodies[0].clientRequestId);
    expect(imports.state.records).toHaveLength(1);
  });

  test("a lost response retried with the same request id still leaves a single import", async ({
    page,
  }) => {
    const { api, imports } = await setupImportFlow(page, {
      endpoints: { start: { fail: "save-then-abort", failTimes: 1 } },
    });
    await openProposal(page);
    const dialog = await openConfirm(page);
    await dialog.getByRole("button", { name: "시작", exact: true }).last().click();
    await expect(dialog.getByText("가져오기를 시작하지 못했어요")).toBeVisible();
    expect(imports.state.records).toHaveLength(1);

    await dialog.getByRole("button", { name: "다시 시도" }).last().click();
    await expectConfirmClosed(page);
    const bodies = startBodies(api);
    expect(bodies).toHaveLength(2);
    expect(bodies[1].clientRequestId).toBe(bodies[0].clientRequestId);
    expect(imports.state.records).toHaveLength(1);
  });

  test("after a lost response, 취소 and starting again with the same edits keeps the request id and one import", async ({
    page,
  }) => {
    const { api, imports } = await setupImportFlow(page, {
      endpoints: { start: { fail: "save-then-abort", failTimes: 1 } },
    });
    await openProposal(page);
    let dialog = await openConfirm(page);
    await dialog.getByRole("button", { name: "시작", exact: true }).last().click();
    await expect(dialog.getByText("가져오기를 시작하지 못했어요")).toBeVisible();
    await dialog.getByRole("button", { name: "취소", exact: true }).last().click();
    await expectConfirmClosed(page);

    dialog = await openConfirm(page);
    await expect(dialog.getByText("가져오기를 시작하지 못했어요")).toHaveCount(0);
    await dialog.getByRole("button", { name: "시작", exact: true }).last().click();
    await expectConfirmClosed(page);
    await expect(page).toHaveURL(/\/settings\/imports$/);
    const bodies = startBodies(api);
    expect(bodies).toHaveLength(2);
    expect(bodies[1].clientRequestId).toBe(bodies[0].clientRequestId);
    expect(imports.state.records).toHaveLength(1);
  });

  test("changing the proposal after a failed start sends a new request id", async ({ page }) => {
    const { api } = await setupImportFlow(page, {
      endpoints: { start: { fail: { status: 500 }, failTimes: 1 } },
    });
    const scope = await openProposal(page);
    let dialog = await openConfirm(page);
    await dialog.getByRole("button", { name: "시작", exact: true }).last().click();
    await expect(dialog.getByText("가져오기를 시작하지 못했어요")).toBeVisible();
    await dialog.getByRole("button", { name: "취소", exact: true }).last().click();
    await expectConfirmClosed(page);

    await openFolder(scope, "미분류");
    await linkRemove(scope, "오늘의 뉴스").click();
    dialog = await openConfirm(page);
    await dialog.getByRole("button", { name: "시작", exact: true }).last().click();
    await expectConfirmClosed(page);
    const bodies = startBodies(api);
    expect(bodies).toHaveLength(2);
    expect(bodies[1].clientRequestId).not.toBe(bodies[0].clientRequestId);
    expect(bodies[1].links).toHaveLength(bodies[0].links.length - 1);
  });

  test("when every link was saved after the proposal opened, 시작 says there is nothing to import, stays blocked and leaves no record", async ({
    page,
  }) => {
    const { api, imports } = await setupImportFlow(page);
    const scope = await openProposal(
      page,
      htmlFile("all-saved.html", makeBookmarkExport({ unfiled: 2 })),
    );
    await expect(summaryValue(scope, "추가할 링크")).toContainText("+2");
    api.links.push(
      makeLink({ id: 9001, url: "https://bulk.example.com/1" }),
      makeLink({ id: 9002, url: "https://bulk.example.com/2" }),
    );

    const dialog = await openConfirm(page);
    const start = dialog.getByRole("button", { name: "시작", exact: true }).last();
    await start.click();
    await expect(dialog.getByText("가져오기를 시작하지 못했어요")).toBeVisible();
    await expect(
      dialog.getByText("이미 모두 저장된 링크라 새로 가져올 링크가 없어요"),
    ).toBeVisible();
    await expect(dialog.getByText("잠시 후 다시 시도해 주세요.")).toHaveCount(0);
    await expect(dialog.getByRole("button", { name: "다시 시도" }).last()).toHaveCount(0);
    await expect(start).toBeDisabled();
    await start.click({ force: true });
    await page.waitForTimeout(500);
    expect(countRequests(api, "POST", "/api/imports")).toBe(1);
    expect(imports.state.records).toHaveLength(0);

    await dialog.getByRole("button", { name: "취소", exact: true }).last().click();
    await expectConfirmClosed(page);
    await expect(page.getByText(PROPOSAL_TITLE)).toBeVisible();
    await scope.getByRole("button", { name: "취소", exact: true }).click();
    await expect(page.getByText(PROPOSAL_TITLE)).toHaveCount(0);
    await expect(page.getByText("아직 가져온 기록이 없어요")).toBeVisible();
    await expect(page.getByTestId(/^import-row-/)).toHaveCount(0);
    expect(countRequests(api, "POST", "/api/imports")).toBe(1);
  });
});

test.describe("confirm window copy and shape (#49)", () => {
  test("it says skipped links are skipped and the import can be undone later", async ({ page }) => {
    await setupImportFlow(page);
    await openProposal(page);
    const dialog = await openConfirm(page);
    await expect(dialog.getByText("링크 11개와 새 폴더 3개를 추가할게요.")).toBeVisible();
    await expect(dialog.getByText("이미 저장된 링크 1개는 건너뛰어요.")).toBeVisible();
    await expect(dialog.getByText("나중에 ‘가져오기 기록’에서 되돌릴 수 있어요.")).toBeVisible();
    await expect(dialog.getByText(/잠시 기다려/)).toHaveCount(0);
  });

  test("with nothing to skip and no new folder the extra line and the zero count are gone", async ({
    page,
  }) => {
    await setupImportFlow(page, { savedUrls: [] });
    await openProposal(page, htmlFile("plain.html", makeBookmarkExport({ unfiled: 2 })));
    await openConfirm(page);
    const content = page.getByTestId("import-confirm");
    await expect(content.getByText("링크 2개를 추가할게요.")).toBeVisible();
    await expect(content.getByText(/건너뛰어요/)).toHaveCount(0);
    await expect(content.getByText(/새 폴더/)).toHaveCount(0);
  });

  test("links taken out with 모두 빼기 are not sent, and links put back are", async ({ page }) => {
    const { api } = await setupImportFlow(page);
    const scope = await openProposal(page);
    await openFolder(scope, "새 폴더 자바");
    await scope.getByRole("button", { name: "‘자바’의 링크 모두 빼기" }).click();
    await backToFolders(page);
    await openFolder(scope, "미분류");
    await linkRemove(scope, "팀 캘린더").click();
    await scope.getByRole("button", { name: "‘미분류’에서 뺀 링크 1개 다시 넣기" }).click();
    const dialog = await openConfirm(page);
    await expect(dialog.getByText("링크 8개와 새 폴더 2개를 추가할게요.")).toBeVisible();
    await dialog.getByRole("button", { name: "시작", exact: true }).last().click();
    await expect(page.getByText(PROPOSAL_TITLE)).toHaveCount(0);
    const [body] = startBodies(api);
    expect(body.links).toHaveLength(8);
    expect(body.links.map((link) => link.title)).toContain("팀 캘린더");
    expect(body.links.map((link) => link.title)).not.toContain("Java 21 가상 스레드 정리");
    expect(body.folders.map((folder) => folder.name)).not.toContain("자바");
  });

  for (const width of [768, 769]) {
    const isSheet = width <= 768;
    test(`at ${width}px the confirm and discard prompts are ${isSheet ? "bottom sheets" : "dialogs"}`, async ({
      page,
    }) => {
      test.skip(!isWideProject(), "one project checks both widths");
      await page.setViewportSize({ width, height: 900 });
      await setupImportFlow(page);
      await openProposal(page);
      await page
        .getByRole("button", { name: /^(가져오기|링크 11개 가져오기)$/ })
        .last()
        .click();
      await expect(page.getByText("가져오기를 시작할까요?")).toBeVisible();
      await expect(page.getByRole("dialog", { name: "가져오기를 시작할까요?" })).toHaveCount(
        isSheet ? 0 : 1,
      );
      const cancel = page.getByRole("button", { name: "취소", exact: true }).last();
      const start = page.getByRole("button", { name: "시작", exact: true });
      if (isSheet) {
        await expect(start).toBeInViewport({ ratio: 1 });
        await expect(cancel).toBeInViewport({ ratio: 1 });
        const cancelBox = await cancel.boundingBox();
        const startBox = await start.boundingBox();
        expect((cancelBox?.width ?? 0) + (startBox?.width ?? 0)).toBeGreaterThan(width * 0.8);
        expect(startBox?.height ?? 0).toBeGreaterThanOrEqual(44);
      }
      await cancel.click();
      await expect(page.getByText("가져오기를 시작할까요?")).toHaveCount(0);

      if (isSheet) {
        await openFolder(page, "미분류");
      }
      await linkRemove(page, "오늘의 뉴스").click();
      await page.getByTestId("import-proposal-close").click();
      await expect(page.getByText("수정한 내용이 사라져요")).toBeVisible();
      await expect(page.getByRole("dialog", { name: "수정한 내용이 사라져요" })).toHaveCount(
        isSheet ? 0 : 1,
      );
      await page.getByRole("button", { name: "계속 수정하기" }).click();
      await expect(page.getByText("수정한 내용이 사라져요")).toHaveCount(0);
      await expect(page.getByText(PROPOSAL_TITLE)).toBeVisible();
    });
  }
});
