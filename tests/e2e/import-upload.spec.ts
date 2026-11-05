import { type Page, expect, test } from "@playwright/test";

import {
  PROPOSAL_TITLE,
  chooseFile,
  countRequests,
  folderRow,
  htmlFile,
  makeBookmarkExport,
  makeLargeBookmarkExport,
  openFolder,
  openUploadFromHome,
  proposalScope,
  setupImportFlow,
} from "./support/bookmark-fixtures";
import { isWideProject } from "./support/helpers";
import { makeLink } from "./support/mock-api";

// #22 unit 4: home CTA, upload modal, file checks, preview loading and the 3,000 link ranges.

const PREVIEW_LOADING = "가져오기 미리보기를 만들고 있어요";

function previewBodies(api: Awaited<ReturnType<typeof setupImportFlow>>["api"]) {
  return api.requests
    .filter((request) => request.method === "POST" && request.path === "/api/import-previews")
    .map((request) => request.body as { links: { key: string; url: string }[] });
}

async function dropFile(page: Page, file: { name: string; mimeType: string; buffer: Buffer }) {
  const zone = page.getByTestId("import-drop-zone");
  const dataTransfer = await page.evaluateHandle(
    ({ name, mimeType, content }) => {
      const transfer = new DataTransfer();
      transfer.items.add(new File([content], name, { type: mimeType }));
      return transfer;
    },
    { name: file.name, mimeType: file.mimeType, content: file.buffer.toString("utf8") },
  );
  await zone.dispatchEvent("dragenter", { dataTransfer });
  await zone.dispatchEvent("dragover", { dataTransfer });
  return { zone, dataTransfer };
}

test.describe("home entry", () => {
  test("an account without links shows the import button on home, and it opens the upload window on the imports page", async ({
    page,
  }) => {
    await setupImportFlow(page);
    await openUploadFromHome(page);
    await expect(page.getByRole("tab", { name: "Chrome · Whale" })).toBeVisible();
  });

  test("the empty home shows the design copy with 링크 추가 and the import button, and nothing else", async ({
    page,
  }) => {
    await setupImportFlow(page);
    await page.goto("/home");
    const empty = page.getByTestId("home-empty-state");
    await expect(empty.getByText("아직 저장한 링크가 없어요")).toBeVisible();
    await expect(
      empty.getByText(
        "링크를 직접 추가하거나, 브라우저에 모아 둔 북마크를 한 번에 가져올 수 있어요.",
      ),
    ).toBeVisible();
    await expect(empty.getByRole("button", { name: "링크 추가" })).toBeVisible();
    await expect(empty.getByRole("button", { name: "브라우저 북마크 가져오기" })).toBeVisible();
    await expect(empty.getByText("북마크 가져오기는 웹에서 할 수 있어요")).toHaveCount(0);
    await expect(page.getByText("최근 저장 링크가 없어요")).toHaveCount(0);
    await expect(page.getByText("아직 링크가 없어요")).toHaveCount(0);
    await expect(page.getByPlaceholder("웹 검색 또는 내 링크 검색…")).toHaveCount(0);
    await expect(
      page.getByPlaceholder("링크 · 요약 · 태그 검색…").and(page.locator(":visible")),
    ).toHaveCount(isWideProject() ? 1 : 0);

    await empty.getByRole("button", { name: "링크 추가" }).click();
    await expect(page.getByRole("textbox", { name: "URL", exact: true })).toBeVisible();
    await expect(page).toHaveURL(/\/home$/);
  });

  test("an account with links does not show the import button on home", async ({ page }) => {
    await setupImportFlow(page, { links: [makeLink({ id: 1 })] });
    await page.goto("/home");
    await expect(page.getByText("링크 1").first()).toBeVisible();
    await expect(page.getByRole("button", { name: "브라우저 북마크 가져오기" })).toHaveCount(0);
  });
});

test.describe("upload window", () => {
  test("the Chrome · Whale and Edge tabs show each browser's export steps", async ({ page }) => {
    await setupImportFlow(page);
    await openUploadFromHome(page);
    await expect(page.getByText("북마크 관리자 오른쪽 위")).toBeVisible();
    await page.getByRole("tab", { name: "Edge" }).click();
    await expect(page.getByText("즐겨찾기 내보내기")).toBeVisible();
    await expect(page.getByText("북마크 관리자 오른쪽 위")).toHaveCount(0);
    await page.getByRole("tab", { name: "Chrome · Whale" }).click();
    await expect(page.getByText("북마크 관리자 오른쪽 위")).toBeVisible();
  });

  test("the desktop-only warning shows on mobile and not on a wide screen", async ({ page }) => {
    await setupImportFlow(page);
    await openUploadFromHome(page);
    const warning = page.getByText("북마크 내보내기는 데스크탑 환경의 웹 브라우저만 가능해요.");
    if (isWideProject()) {
      await expect(warning).toHaveCount(0);
    } else {
      await expect(warning).toBeVisible();
    }
  });

  test("mobile shows a plain file card, wide a dashed drop area; both pick a file", async ({
    page,
  }) => {
    await setupImportFlow(page);
    await openUploadFromHome(page);
    const zone = page.getByTestId("import-drop-zone");
    const borderStyle = await zone.evaluate((node) => getComputedStyle(node).borderTopStyle);
    const hint = zone.getByText(".html · .htm · 10MB 이하");
    await expect(hint).toBeVisible();
    expect(
      Number.parseFloat(await hint.evaluate((node) => getComputedStyle(node).fontSize)),
    ).toBeGreaterThanOrEqual(12);
    if (isWideProject()) {
      expect(borderStyle).toBe("dashed");
      await expect(zone.getByText("파일을 끌어다 놓거나 북마크 파일을 골라 주세요")).toBeVisible();
    } else {
      expect(borderStyle).toBe("solid");
      await expect(zone.getByText("북마크 파일", { exact: true })).toBeVisible();
      const pick = await zone.getByRole("button", { name: "파일 선택" }).boundingBox();
      expect(pick?.height ?? 0).toBeGreaterThanOrEqual(44);
    }
    await chooseFile(page, "chrome-export.html");
    await expect(page.getByText(PROPOSAL_TITLE)).toBeVisible();
  });

  test("dragging a file over the drop area highlights it, and dropping it starts the preview", async ({
    page,
  }) => {
    test.skip(!isWideProject(), "drag and drop is a wide screen feature");
    const { api } = await setupImportFlow(page);
    await openUploadFromHome(page);
    const file = htmlFile("drop.html", makeBookmarkExport({ unfiled: 2 }));
    const { zone, dataTransfer } = await dropFile(page, file);
    await expect(zone.getByText("여기에 놓으면 미리보기를 만들어요")).toBeVisible();
    await zone.dispatchEvent("drop", { dataTransfer });
    await expect(page.getByText(PROPOSAL_TITLE)).toBeVisible();
    expect(countRequests(api, "POST", "/api/import-previews")).toBe(1);
  });

  test("a Chrome export shows the preview loading and then the proposal", async ({ page }) => {
    await setupImportFlow(page, { endpoints: { preview: { delayMs: 1200 } } });
    await openUploadFromHome(page);
    await chooseFile(page, "chrome-export.html");
    await expect(page.getByText(PREVIEW_LOADING)).toBeVisible();
    await expect(page.getByText("chrome-export.html · 링크 12개를 정리하고 있어요.")).toBeVisible();
    await expect(page.getByText(PROPOSAL_TITLE)).toBeVisible();
    await expect(page.getByText(PREVIEW_LOADING)).toHaveCount(0);
  });

  test("an Edge export opens the proposal the same way", async ({ page }) => {
    await setupImportFlow(page);
    await openUploadFromHome(page);
    await chooseFile(page, "edge-export.html");
    const scope = proposalScope(page);
    await expect(page.getByText(PROPOSAL_TITLE)).toBeVisible();
    await openFolder(scope, "새 폴더 개발");
    await expect(scope.getByText("React 문서")).toBeVisible();
  });

  test("a file that is not HTML shows the HTML-only error and another file can be chosen", async ({
    page,
  }) => {
    const { api } = await setupImportFlow(page);
    await openUploadFromHome(page);
    await chooseFile(page, {
      name: "notes.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("메모"),
    });
    await expect(page.getByText("HTML 파일이 아니에요")).toBeVisible();
    await expect(
      page.getByText("‘notes.txt’ 파일은 가져올 수 없어요. HTML 파일만 가져올 수 있어요."),
    ).toBeVisible();
    expect(countRequests(api, "POST", "/api/import-previews")).toBe(0);

    await chooseFile(page, "chrome-export.html");
    await expect(page.getByText(PROPOSAL_TITLE)).toBeVisible();
  });

  test("a file over 10MB shows the size error", async ({ page }) => {
    await setupImportFlow(page);
    await openUploadFromHome(page);
    await chooseFile(page, {
      name: "huge.html",
      mimeType: "text/html",
      buffer: Buffer.alloc(10 * 1024 * 1024 + 1, 0x61),
    });
    await expect(page.getByText("10MB 이하 파일만 가져올 수 있어요.")).toBeVisible();
  });

  test("an HTML page that is not a bookmark export shows the format error", async ({ page }) => {
    await setupImportFlow(page);
    await openUploadFromHome(page);
    await chooseFile(page, "not-bookmark.html");
    await expect(page.getByText("북마크를 읽을 수 없어요")).toBeVisible();
    await expect(
      page.getByText(/‘not-bookmark\.html’에는 브라우저 북마크 형식이 없어요/),
    ).toBeVisible();
  });

  test("an export without bookmarks says so without asking for a preview", async ({ page }) => {
    const { api } = await setupImportFlow(page);
    await openUploadFromHome(page);
    await chooseFile(page, "empty-export.html");
    await expect(page.getByText("가져올 북마크가 없어요")).toBeVisible();
    expect(countRequests(api, "POST", "/api/import-previews")).toBe(0);
    await expect(page.getByRole("button", { name: "닫기", exact: true }).last()).toBeVisible();
    await page.getByRole("button", { name: "다른 파일 선택" }).click();
    await expect(page.getByTestId("import-drop-zone")).toBeVisible();
  });

  test("닫기 in the no-links window closes the upload window", async ({ page }) => {
    await setupImportFlow(page);
    await openUploadFromHome(page);
    await chooseFile(page, "empty-export.html");
    await expect(page.getByText("가져올 북마크가 없어요")).toBeVisible();
    await page.getByRole("button", { name: "닫기", exact: true }).last().click();
    await expect(page.getByText("가져올 북마크가 없어요")).not.toBeInViewport();
  });

  test("a file dropped outside the drop area while the window is open does not leave the page", async ({
    page,
  }) => {
    test.skip(!isWideProject(), "drag and drop is a wide screen feature");
    const { api } = await setupImportFlow(page);
    await openUploadFromHome(page);
    const prevented = await page.evaluate(() => {
      const transfer = new DataTransfer();
      transfer.items.add(new File(["<html></html>"], "outside.html", { type: "text/html" }));
      const fire = (type: string) => {
        const event = new DragEvent(type, {
          bubbles: true,
          cancelable: true,
          dataTransfer: transfer,
        });
        document.body.dispatchEvent(event);
        return event.defaultPrevented;
      };
      return { over: fire("dragover"), drop: fire("drop") };
    });
    expect(prevented).toEqual({ over: true, drop: true });
    await expect(page).toHaveURL(/\/settings\/imports$/);
    await expect(page.getByTestId("import-drop-zone")).toBeVisible();
    expect(countRequests(api, "POST", "/api/import-previews")).toBe(0);

    await page.keyboard.press("Escape");
    await expect(page.getByTestId("import-drop-zone")).toHaveCount(0);
    const afterClose = await page.evaluate(() => {
      const transfer = new DataTransfer();
      transfer.items.add(new File(["x"], "x.html", { type: "text/html" }));
      const event = new DragEvent("dragover", {
        bubbles: true,
        cancelable: true,
        dataTransfer: transfer,
      });
      document.body.dispatchEvent(event);
      return event.defaultPrevented;
    });
    expect(afterClose).toBe(false);
  });

  test("a failed preview shows an error with retry, and retry opens the proposal without choosing the file again", async ({
    page,
  }) => {
    const { api } = await setupImportFlow(page, {
      endpoints: { preview: { fail: "abort", failTimes: 1 } },
    });
    await openUploadFromHome(page);
    await chooseFile(page, "chrome-export.html");
    await expect(page.getByText("미리보기를 만들지 못했어요")).toBeVisible();
    await expect(
      page.getByText("서버에 연결하지 못했어요. 네트워크를 확인하고 다시 시도해 주세요."),
    ).toBeVisible();

    await page.getByRole("button", { name: "다시 시도" }).click();
    await expect(page.getByText(PROPOSAL_TITLE)).toBeVisible();
    expect(previewBodies(api).length).toBeGreaterThanOrEqual(1);
  });
});

test.describe("3,000 link ranges", () => {
  test("more than 3,000 links shows the count warning and ranges with 1~3,000 chosen", async ({
    page,
  }) => {
    const { api } = await setupImportFlow(page);
    await openUploadFromHome(page);
    await chooseFile(page, htmlFile("bookmarks_all.html", makeLargeBookmarkExport(5200)));
    await expect(page.getByText("가져올 구간을 골라 주세요")).toBeVisible();
    await expect(page.getByText("북마크가 5,200개예요")).toBeVisible();
    await expect(page.getByRole("radio", { name: "1~3,000번째" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    await expect(page.getByRole("radio", { name: "3,001~5,200번째" })).toHaveAttribute(
      "aria-checked",
      "false",
    );
    expect(countRequests(api, "POST", "/api/import-previews")).toBe(0);
  });

  test("exactly 3,000 links opens the proposal without a range choice", async ({ page }) => {
    await setupImportFlow(page);
    await openUploadFromHome(page);
    await chooseFile(page, htmlFile("bookmarks_3000.html", makeLargeBookmarkExport(3000)));
    await expect(page.getByText(PROPOSAL_TITLE)).toBeVisible();
    await expect(page.getByText("가져올 구간을 골라 주세요")).toHaveCount(0);
  });

  test("previewing the second range sends and shows only the links of that range", async ({
    page,
  }) => {
    const { api } = await setupImportFlow(page);
    await openUploadFromHome(page);
    await chooseFile(page, htmlFile("bookmarks_all.html", makeLargeBookmarkExport(5200)));
    await page.getByRole("radio", { name: "3,001~5,200번째" }).click();
    await page.getByRole("button", { name: "이 구간으로 미리보기" }).click();
    await expect(page.getByText(PROPOSAL_TITLE)).toBeVisible();

    const [body] = previewBodies(api);
    expect(body.links).toHaveLength(2200);
    expect(body.links[0].url).toBe("https://bulk.example.com/3001");
    expect(body.links.at(-1)?.url).toBe("https://bulk.example.com/5200");

    const scope = proposalScope(page);
    await expect(folderRow(scope, "새 폴더 묶음 1")).toHaveCount(0);
    await expect(folderRow(scope, "새 폴더 묶음 4")).toBeVisible();
    await openFolder(scope, "새 폴더 묶음 4");
    await expect(scope.getByText("묶음 4 링크 3001", { exact: true })).toBeVisible();
  });
});
