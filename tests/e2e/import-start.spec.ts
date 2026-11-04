import type { StartImportRequest } from "@/features/imports/types";
import { type Page, expect, test } from "@playwright/test";

import {
  PROPOSAL_TITLE,
  countRequests,
  linkHandle,
  linkRemove,
  openFolder,
  openProposal,
  setupImportFlow,
  summaryValue,
} from "./support/bookmark-fixtures";

// #22 unit 4: the confirm window and the synchronous start.

function startBodies(api: Awaited<ReturnType<typeof setupImportFlow>>["api"]) {
  return api.requests
    .filter((request) => request.method === "POST" && request.path === "/api/imports")
    .map((request) => request.body as StartImportRequest);
}

function confirmDialog(page: Page) {
  return page.getByRole("dialog", { name: "가져오기를 시작할까요?" });
}

async function openConfirm(page: Page) {
  await page.getByRole("button", { name: "가져오기", exact: true }).last().click();
  const dialog = confirmDialog(page);
  await expect(dialog).toBeVisible();
  return dialog;
}

test.describe("confirm window", () => {
  test("가져오기 opens the confirm window with the numbers after edits", async ({ page }) => {
    await setupImportFlow(page);
    const scope = await openProposal(page);
    await openFolder(scope, "새 폴더 여행");
    await linkRemove(scope, "교토 숙소 후보").click();
    await expect(summaryValue(scope, "추가할 링크")).toContainText("+10");
    const dialog = await openConfirm(page);
    await expect(dialog).toContainText("링크 10개와 새 폴더 2개를 추가할게요.");
    await expect(
      dialog.getByText(
        "가져오는 동안 잠시 기다려 주세요. 결과는 ‘가져오기 기록’에서 볼 수 있어요.",
      ),
    ).toBeVisible();
  });

  test("취소 in the confirm window goes back to the proposal with the edits kept", async ({
    page,
  }) => {
    const { api } = await setupImportFlow(page);
    const scope = await openProposal(page);
    await openFolder(scope, "미분류");
    await linkRemove(scope, "오늘의 뉴스").click();
    const dialog = await openConfirm(page);
    await dialog.getByRole("button", { name: "취소", exact: true }).click();
    await expect(dialog).toHaveCount(0);
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
    await dialog.getByRole("button", { name: "시작", exact: true }).click();

    const saving = dialog.getByRole("button", { name: "가져오는 중…" });
    await expect(saving).toBeVisible();
    await expect(saving).toBeDisabled();
    await expect(dialog.getByRole("button", { name: "취소", exact: true })).toBeDisabled();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeVisible();
    await expect(page.getByText(PROPOSAL_TITLE)).toBeVisible();

    await expect(dialog).toHaveCount(0, { timeout: 10_000 });
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
    const start = dialog.getByRole("button", { name: "시작", exact: true });
    await start.evaluate((node) => {
      for (let index = 0; index < 4; index += 1) {
        (node as HTMLElement).click();
      }
    });
    await expect(dialog).toHaveCount(0, { timeout: 10_000 });
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
    await dialog.getByRole("button", { name: "시작", exact: true }).click();
    await expect(dialog.getByText("가져오기를 시작하지 못했어요")).toBeVisible();
    await expect(dialog.getByText("잠시 후 다시 시도해 주세요.")).toBeVisible();
    expect(imports.state.records).toHaveLength(0);

    await dialog.getByRole("button", { name: "다시 시도" }).click();
    await expect(dialog).toHaveCount(0);
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
    await dialog.getByRole("button", { name: "시작", exact: true }).click();
    await expect(dialog.getByText("가져오기를 시작하지 못했어요")).toBeVisible();
    expect(imports.state.records).toHaveLength(1);

    await dialog.getByRole("button", { name: "다시 시도" }).click();
    await expect(dialog).toHaveCount(0);
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
    await dialog.getByRole("button", { name: "시작", exact: true }).click();
    await expect(dialog.getByText("가져오기를 시작하지 못했어요")).toBeVisible();
    await dialog.getByRole("button", { name: "취소", exact: true }).click();
    await expect(dialog).toHaveCount(0);

    dialog = await openConfirm(page);
    await expect(dialog.getByText("가져오기를 시작하지 못했어요")).toHaveCount(0);
    await dialog.getByRole("button", { name: "시작", exact: true }).click();
    await expect(dialog).toHaveCount(0);
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
    await dialog.getByRole("button", { name: "시작", exact: true }).click();
    await expect(dialog.getByText("가져오기를 시작하지 못했어요")).toBeVisible();
    await dialog.getByRole("button", { name: "취소", exact: true }).click();
    await expect(dialog).toHaveCount(0);

    await openFolder(scope, "미분류");
    await linkRemove(scope, "오늘의 뉴스").click();
    dialog = await openConfirm(page);
    await dialog.getByRole("button", { name: "시작", exact: true }).click();
    await expect(dialog).toHaveCount(0);
    const bodies = startBodies(api);
    expect(bodies).toHaveLength(2);
    expect(bodies[1].clientRequestId).not.toBe(bodies[0].clientRequestId);
    expect(bodies[1].links).toHaveLength(bodies[0].links.length - 1);
  });
});
