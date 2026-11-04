import { type Locator, type Page, expect, test } from "@playwright/test";

import {
  PROPOSAL_TITLE,
  backToFolders,
  chooseFile,
  countRequests,
  folderRow,
  htmlFile,
  linkHandle,
  linkRemove,
  makeBookmarkExport,
  openFolder,
  openProposal,
  proposalScope,
  setupImportFlow,
  summaryValue,
} from "./support/bookmark-fixtures";
import { isWideProject } from "./support/helpers";

// #22 unit 4: the proposal window (summary, folder list, links, removing, renaming, closing).

type Scope = Locator | Page;

async function expectSummary(
  scope: Scope,
  values: { add: string; folders: string; skip: string; bad: string },
) {
  await expect(summaryValue(scope, "추가할 링크")).toContainText(values.add);
  await expect(summaryValue(scope, "새 폴더")).toContainText(values.folders);
  await expect(summaryValue(scope, "건너뛸 링크")).toContainText(values.skip);
  await expect(summaryValue(scope, "가져오기 불가 링크")).toContainText(values.bad);
}

async function rowNames(scope: Scope, expected: string[]) {
  const buttons = scope.getByRole("button");
  const names: string[] = [];
  for (const button of await buttons.all()) {
    const name = (await button.getAttribute("aria-label")) ?? "";
    if (expected.some((item) => name === item || name.startsWith(`${item},`))) {
      names.push(expected.find((item) => name === item || name.startsWith(`${item},`)) ?? name);
    }
  }
  return names;
}

async function pressButton(button: Locator) {
  if (isWideProject()) {
    await button.click();
  } else {
    await button.tap();
  }
}

async function startRename(scope: Scope, name: string) {
  await openFolder(scope, `새 폴더 ${name}`);
  await scope.getByRole("button", { name: `새 폴더 ${name} 이름 바꾸기` }).click();
  const input = scope.getByLabel("새 폴더 이름");
  await expect(input).toBeFocused();
  return input;
}

test.describe("proposal contents", () => {
  test("the summary shows links to add, new folders, skipped and unsupported links", async ({
    page,
  }) => {
    await setupImportFlow(page);
    const scope = await openProposal(page);
    await expectSummary(scope, { add: "+11", folders: "+3", skip: "1", bad: "0" });
  });

  test("the folder list goes 미분류, my folders, shared folders, new folders, then skipped links, with +N on folders that receive links", async ({
    page,
  }) => {
    await setupImportFlow(page);
    const scope = await openProposal(page);
    const order = [
      "미분류",
      "aws",
      "읽을거리",
      "취업",
      "팀 위키",
      "새 폴더 자바",
      "새 폴더 취업 2",
      "새 폴더 여행",
      "건너뛸 링크 1개",
    ];
    expect(await rowNames(scope, order)).toEqual(order);
    await expect(folderRow(scope, "미분류")).toContainText("+3");
    await expect(folderRow(scope, "aws")).toContainText("+2");
    await expect(folderRow(scope, "읽을거리")).not.toContainText("+");
    await expect(folderRow(scope, "새 폴더 자바")).toContainText("+3");
  });

  test("every new folder and link is listed without being cut to 외 N개", async ({ page }) => {
    await setupImportFlow(page);
    const folders = Array.from({ length: 25 }, (_, index) => ({
      name: `주제 ${index + 1}`,
      count: 6,
    }));
    const scope = await openProposal(page, htmlFile("many.html", makeBookmarkExport({ folders })));
    await expectSummary(scope, { add: "+150", folders: "+25", skip: "0", bad: "0" });
    await expect(folderRow(scope, "새 폴더 주제 25")).toBeAttached();
    await expect(scope.getByText(/외 \d+개/)).toHaveCount(0);
    await openFolder(scope, "새 폴더 주제 25");
    await expect(scope.getByTestId("import-link-row")).toHaveCount(6);
  });

  test("links right under the bookmark bar and at the top level are + links under 미분류", async ({
    page,
  }) => {
    await setupImportFlow(page);
    const scope = await openProposal(page);
    await openFolder(scope, "미분류");
    for (const title of ["오늘의 뉴스", "팀 캘린더", "최상위 링크"]) {
      await expect(linkHandle(scope, title)).toBeVisible();
    }
    await expect(scope.getByTestId("import-link-row")).toHaveCount(3);
  });

  test("a folder named like my folder, spaces aside, adds + links to that folder instead of a new one", async ({
    page,
  }) => {
    await setupImportFlow(page);
    const scope = await openProposal(page);
    await expect(folderRow(scope, "새 폴더 aws")).toHaveCount(0);
    await openFolder(scope, "aws");
    await expect(scope.getByText("기존 폴더", { exact: true })).toBeVisible();
    await expect(linkHandle(scope, "VPC 서브넷 설계 체크리스트")).toBeVisible();
    await expect(linkHandle(scope, "ECS 배포 전략 비교")).toBeVisible();
  });

  test("a folder named like my shared folder becomes a numbered new folder, and the shared folder is marked and not a target", async ({
    page,
  }) => {
    await setupImportFlow(page);
    const scope = await openProposal(page);
    await expect(folderRow(scope, /^취업, 공유 중인 폴더라/)).toContainText("공유 중");
    await openFolder(scope, "새 폴더 취업 2");
    await expect(
      scope.getByText("공유 중인 내 폴더 ‘취업’과 이름이 같아서 ‘취업 2’로 따로 만들어요."),
    ).toBeVisible();
    await expect(linkHandle(scope, "백엔드 채용 공고")).toBeVisible();
    await backToFolders(page);
    await openFolder(scope, /^취업, 공유 중인 폴더라/);
    await expect(scope.getByText("이 폴더에는 넣지 않아요")).toBeVisible();
  });

  test("links already saved are not + links, and 건너뛸 링크 lists them with the reason", async ({
    page,
  }) => {
    await setupImportFlow(page);
    const scope = await openProposal(page);
    await openFolder(scope, "새 폴더 여행");
    await expect(linkHandle(scope, "이미 저장한 글")).toHaveCount(0);
    await backToFolders(page);
    await openFolder(scope, "건너뛸 링크 1개");
    await expect(scope.getByText("같은 주소가 이미 저장되어 있어요.")).toBeVisible();
    await expect(scope.getByText("이미 저장한 글")).toBeVisible();
  });

  test("an address that appears twice in the file shows up once", async ({ page }) => {
    await setupImportFlow(page);
    const scope = await openProposal(page);
    await openFolder(scope, "미분류");
    await expect(linkHandle(scope, "오늘의 뉴스")).toBeVisible();
    await backToFolders(page);
    await openFolder(scope, "새 폴더 여행");
    await expect(linkHandle(scope, "뉴스 다시 보기")).toHaveCount(0);
    await expect(scope.getByTestId("import-link-row")).toHaveCount(1);
  });

  test("unsupported links show the address, original path and reason, without a handle or remove button", async ({
    page,
  }) => {
    await setupImportFlow(page);
    const scope = await openProposal(page, "titles-and-schemes.html");
    await expectSummary(scope, { add: "+4", folders: "+1", skip: "0", bad: "3" });
    await openFolder(scope, "가져오기 불가 링크 3개");
    const rows = scope.getByTestId("import-unsupported-row");
    await expect(rows).toHaveCount(3);
    await expect(rows.nth(0)).toContainText("크롬 설정");
    await expect(rows.nth(0)).toContainText("chrome://settings/");
    await expect(rows.nth(0)).toContainText("북마크바");
    await expect(rows.nth(0)).toContainText("웹 주소(http·https)가 아니에요");
    await expect(rows.nth(2)).toContainText("file:///Users/me/notes.html");
    await expect(rows.nth(2)).toContainText("이름 없는 폴더");
    await expect(rows.getByRole("button")).toHaveCount(0);
  });

  test("the skipped and unsupported numbers in the summary open their lists", async ({ page }) => {
    await setupImportFlow(page);
    const scope = await openProposal(
      page,
      htmlFile(
        "mixed.html",
        [
          "<!DOCTYPE NETSCAPE-Bookmark-file-1>",
          "<DL><p>",
          '    <DT><A HREF="https://fresh.example.com/">새 글</A>',
          '    <DT><A HREF="https://saved.example.com/already">이미 저장한 글</A>',
          '    <DT><A HREF="edge://newtab/">새 탭</A>',
          "</DL><p>",
        ].join("\n"),
      ),
    );
    await scope.getByRole("button", { name: "가져오기 불가 링크 1개 보기" }).click();
    await expect(scope.getByText("웹 주소가 아닌 링크는 가져올 수 없어요.")).toBeVisible();
    await scope.getByRole("button", { name: "건너뛸 링크 1개 보기" }).click();
    await expect(scope.getByText("같은 주소가 이미 저장되어 있어요.")).toBeVisible();
  });

  test("a blank title shows the address, and a very long title is cut inside the row", async ({
    page,
  }) => {
    await setupImportFlow(page);
    const scope = await openProposal(page, "titles-and-schemes.html");
    await openFolder(scope, "미분류");
    await expect(linkHandle(scope, "blank.example.com/guide/start")).toBeVisible();
    const longRow = scope
      .getByTestId("import-link-row")
      .filter({ hasText: "아주 긴 제목의 북마크" });
    const title = longRow.getByText(/^아주 긴 제목의 북마크/);
    const sizes = await title.evaluate((node) => ({
      scroll: node.scrollWidth,
      client: node.clientWidth,
    }));
    expect(sizes.scroll).toBeGreaterThan(sizes.client);
    const rowBox = await longRow.boundingBox();
    const viewport = page.viewportSize();
    expect((rowBox?.x ?? 0) + (rowBox?.width ?? 0)).toBeLessThanOrEqual(viewport?.width ?? 0);
    await expect(linkRemove(scope, (await title.textContent()) ?? "")).toBeInViewport();
  });
});

test.describe("editing the proposal", () => {
  test("removing a + link takes it out and lowers the count, and 다시 넣기 brings it back", async ({
    page,
  }) => {
    await setupImportFlow(page);
    const scope = await openProposal(page);
    await openFolder(scope, "미분류");
    await linkRemove(scope, "오늘의 뉴스").click();
    await expect(linkHandle(scope, "오늘의 뉴스")).toHaveCount(0);
    await expectSummary(scope, { add: "+10", folders: "+3", skip: "1", bad: "0" });
    await expect(scope.getByText("‘오늘의 뉴스’를 가져오지 않아요.")).toBeVisible();

    await scope.getByRole("button", { name: /^다시 넣기, 되돌릴 수 있는 변경/ }).click();
    await expect(linkHandle(scope, "오늘의 뉴스")).toBeVisible();
    await expectSummary(scope, { add: "+11", folders: "+3", skip: "1", bad: "0" });
  });

  test("a file dropped on the page while the proposal is open keeps the page and the edits", async ({
    page,
  }) => {
    const { api } = await setupImportFlow(page);
    const scope = await openProposal(page);
    await openFolder(scope, "미분류");
    await linkRemove(scope, "오늘의 뉴스").click();
    await expectSummary(scope, { add: "+10", folders: "+3", skip: "1", bad: "0" });
    const urlBefore = page.url();
    const prevented = await page.evaluate(() => {
      const transfer = new DataTransfer();
      transfer.items.add(new File(["<html></html>"], "other.html", { type: "text/html" }));
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
    expect(page.url()).toBe(urlBefore);
    await expect(page.getByText(PROPOSAL_TITLE)).toBeVisible();
    await expectSummary(scope, { add: "+10", folders: "+3", skip: "1", bad: "0" });
    expect(countRequests(api, "POST", "/api/import-previews")).toBe(1);
  });

  test("new folders have no button that deletes the folder", async ({ page }) => {
    await setupImportFlow(page);
    const scope = await openProposal(page);
    await openFolder(scope, "새 폴더 자바");
    await expect(scope.getByRole("button", { name: /자바.*(지우기|삭제)/ })).toHaveCount(0);
    await expect(scope.getByRole("button", { name: /폴더.*(지우기|삭제|빼기)/ })).toHaveCount(0);
  });

  test("a new folder left without links says it is excluded and the new folder count drops, and moving a link back includes it again", async ({
    page,
  }) => {
    await setupImportFlow(page);
    const scope = await openProposal(page);
    await openFolder(scope, "새 폴더 여행");
    await linkRemove(scope, "교토 숙소 후보").click();
    await expect(scope.getByText("옮겨지는 링크가 없어요.")).toBeVisible();
    await expect(scope.getByText("이 폴더는 가져오기에서 제외돼요.")).toBeVisible();
    await expectSummary(scope, { add: "+10", folders: "+2", skip: "1", bad: "0" });
    await backToFolders(page);
    await expect(folderRow(scope, /^새 폴더 여행, 옮겨지는 링크가 없어/)).toContainText("제외돼요");

    await openFolder(scope, "미분류");
    await linkHandle(scope, "팀 캘린더").click();
    const picker = isWideProject() ? page.getByRole("dialog", { name: "폴더 이동" }) : page;
    await picker.getByRole("button", { name: "새 폴더 펼치기" }).click();
    await picker.getByRole("radio", { name: "여행", exact: true }).click();
    await picker.getByRole("button", { name: "확인", exact: true }).click();
    await expectSummary(scope, { add: "+10", folders: "+3", skip: "1", bad: "0" });
    await backToFolders(page);
    await expect(folderRow(scope, "새 폴더 여행")).toContainText("+1");
  });

  test("a new folder name changes in place: Enter and clicking elsewhere save, Esc goes back", async ({
    page,
  }) => {
    await setupImportFlow(page);
    const scope = await openProposal(page);
    let input = await startRename(scope, "자바");
    await expect(input).toHaveValue("자바");
    await input.fill("자바 정리");
    await input.press("Enter");
    await backToFolders(page);
    await expect(folderRow(scope, "새 폴더 자바 정리")).toBeAttached();

    input = await startRename(scope, "자바 정리");
    await input.fill("자바 노트");
    await page.getByText(PROPOSAL_TITLE).click();
    await backToFolders(page);
    await expect(folderRow(scope, "새 폴더 자바 노트")).toBeAttached();

    input = await startRename(scope, "자바 노트");
    await input.fill("다른 이름");
    await input.press("Escape");
    await expect(scope.getByLabel("새 폴더 이름")).toHaveCount(0);
    await backToFolders(page);
    await expect(folderRow(scope, "새 폴더 자바 노트")).toBeAttached();
    await expect(page.getByText(PROPOSAL_TITLE)).toBeVisible();
  });

  test("renaming to my folder's name warns about the merge and saving moves the links into that folder", async ({
    page,
  }) => {
    await setupImportFlow(page);
    const scope = await openProposal(page);
    const input = await startRename(scope, "자바");
    await input.fill("aws");
    await expect(scope.getByText("기존 폴더 ‘aws’로 합쳐져요")).toBeVisible();
    await input.press("Enter");
    await expect(folderRow(scope, "새 폴더 자바")).toHaveCount(0);
    await expect(scope.getByText("‘자바’의 링크 3개를 기존 폴더 ‘aws’로 합쳤어요.")).toBeVisible();
    await expectSummary(scope, { add: "+11", folders: "+2", skip: "1", bad: "0" });
    await expect(linkHandle(scope, "Java 21 가상 스레드 정리")).toBeVisible();
    await backToFolders(page);
    await expect(folderRow(scope, "aws")).toContainText("+5");

    await scope.getByRole("button", { name: "합치기 취소" }).click();
    await expect(folderRow(scope, "새 폴더 자바")).toContainText("+3");
  });

  test("renaming to another new folder's name warns about the merge and saving joins the two", async ({
    page,
  }) => {
    await setupImportFlow(page);
    const scope = await openProposal(page);
    const input = await startRename(scope, "자바");
    await input.fill("여행");
    await expect(scope.getByText("새 폴더 ‘여행’과 합쳐져요")).toBeVisible();
    await input.press("Enter");
    await expect(folderRow(scope, "새 폴더 자바")).toHaveCount(0);
    await backToFolders(page);
    await expect(folderRow(scope, "새 폴더 여행")).toContainText("+4");
    await expectSummary(scope, { add: "+11", folders: "+2", skip: "1", bad: "0" });
  });

  test("a shared folder's name cannot be used, and a blank name goes back to the old one", async ({
    page,
  }) => {
    await setupImportFlow(page);
    const scope = await openProposal(page);
    let input = await startRename(scope, "자바");
    await input.fill("취업");
    await expect(scope.getByText("공유 폴더와 같은 이름은 쓸 수 없어요")).toBeVisible();
    await input.press("Enter");
    await backToFolders(page);
    await expect(folderRow(scope, "새 폴더 자바")).toBeAttached();
    await expect(folderRow(scope, "새 폴더 취업")).toHaveCount(0);

    input = await startRename(scope, "자바");
    await input.fill("   ");
    await expect(scope.getByText("비워 두면 원래 이름 ‘자바’로 돌아가요")).toBeVisible();
    await input.press("Enter");
    await backToFolders(page);
    await expect(folderRow(scope, "새 폴더 자바")).toBeAttached();
  });

  test("✓ next to the name saves the rename and ✕ discards it", async ({ page }) => {
    await setupImportFlow(page);
    const scope = await openProposal(page);
    let input = await startRename(scope, "자바");
    const actions = scope.getByTestId("import-name-input");
    for (const label of ["이름 확정", "취소"]) {
      await expect(actions.getByText(label, { exact: true })).toHaveCount(0);
    }
    await input.fill("버릴 이름");
    await pressButton(actions.getByRole("button", { name: "취소", exact: true }));
    await expect(input).toHaveCount(0);
    await expect(scope.getByRole("button", { name: "새 폴더 자바 이름 바꾸기" })).toBeVisible();
    await backToFolders(page);

    input = await startRename(scope, "자바");
    await input.fill("백엔드");
    await pressButton(actions.getByRole("button", { name: "이름 확정" }));
    await expect(input).toHaveCount(0);
    await expect(scope.getByRole("button", { name: "새 폴더 백엔드 이름 바꾸기" })).toBeVisible();
    await backToFolders(page);
    await expect(folderRow(scope, "새 폴더 백엔드")).toContainText("+3");
    await expect(folderRow(scope, "새 폴더 자바")).toHaveCount(0);
    await expect(folderRow(scope, "새 폴더 버릴 이름")).toHaveCount(0);
  });

  test("a new folder name stops at 100 characters and shows the count", async ({ page }) => {
    await setupImportFlow(page);
    const scope = await openProposal(page);
    const input = await startRename(scope, "자바");
    await input.fill("가".repeat(120));
    await expect(input).toHaveValue("가".repeat(100));
    await expect(scope.getByText("100/100")).toBeVisible();
  });

  test("fast Korean typing keeps every syllable of the name", async ({ page, browserName }) => {
    test.skip(browserName !== "chromium", "uses Chromium IME input");
    await setupImportFlow(page);
    const scope = await openProposal(page);
    const input = await startRename(scope, "자바");
    await input.fill("");
    const cdp = await page.context().newCDPSession(page);
    for (const [composing, syllable] of [
      ["ㅇ", "인"],
      ["ㅍ", "프"],
      ["ㄹ", "라"],
    ]) {
      await cdp.send("Input.imeSetComposition", {
        text: composing,
        selectionStart: 1,
        selectionEnd: 1,
      });
      await cdp.send("Input.imeSetComposition", {
        text: syllable,
        selectionStart: 1,
        selectionEnd: 1,
      });
      await cdp.send("Input.insertText", { text: syllable });
    }
    await input.press("Enter");
    await backToFolders(page);
    await expect(folderRow(scope, "새 폴더 인프라")).toBeAttached();
  });

  test("a file with only saved or unsupported links shows 새로 추가할 링크가 없어요 with import off", async ({
    page,
  }) => {
    const { api } = await setupImportFlow(page);
    const scope = await openProposal(page, "only-unsupported.html");
    await expect(scope.getByText("새로 추가할 링크가 없어요")).toBeVisible();
    await expect(page.getByRole("button", { name: "다른 파일 선택" })).toBeEnabled();
    await expect(
      scope.getByRole("button", { name: /^(가져오기|링크 [\d,]+개 가져오기)$/ }),
    ).toHaveCount(0);
    await expect(scope.getByText("이미 저장된 링크 1개는 건너뛰어요")).toBeVisible();
    expect(countRequests(api, "POST", "/api/import-previews")).toBe(1);
  });
});

async function center(locator: Locator) {
  let previous = "";
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const box = await locator.boundingBox();
    if (!box) {
      throw new Error("element has no box");
    }
    const point = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    const key = `${Math.round(point.x)},${Math.round(point.y)}`;
    if (key === previous) {
      return point;
    }
    previous = key;
    await locator.page().waitForTimeout(80);
  }
  throw new Error("element kept moving");
}

async function startMouseDrag(page: Page, handle: Locator) {
  const from = await center(handle);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + 12, from.y + 12, { steps: 4 });
  await expect(page.getByTestId("import-drag-card")).toBeVisible();
}

async function mouseMoveTo(page: Page, target: Locator) {
  const to = await center(target);
  await page.mouse.move(to.x, to.y, { steps: 8 });
}

test.describe("dragging links", () => {
  test("dragging a link by its handle onto another folder moves it and updates +N on both", async ({
    page,
  }) => {
    test.skip(!isWideProject(), "the wide screen drags onto the folder list");
    await setupImportFlow(page);
    const scope = await openProposal(page);
    await startMouseDrag(page, linkHandle(scope, "오늘의 뉴스"));
    await mouseMoveTo(page, folderRow(scope, "새 폴더 자바"));
    await expect(page.getByTestId("import-drag-card")).toContainText("자바로 옮겨요");
    await page.mouse.up();

    await expect(linkHandle(scope, "오늘의 뉴스")).toHaveCount(0);
    await expect(folderRow(scope, "미분류")).toContainText("+2");
    await expect(folderRow(scope, "새 폴더 자바")).toContainText("+4");
    await expect(scope.getByText("‘오늘의 뉴스’를 ‘자바’로 옮겼어요.")).toBeVisible();
    await expectSummary(scope, { add: "+11", folders: "+3", skip: "1", bad: "0" });
  });

  test("a folder with hundreds of links shows rows as it scrolls, and a row deep in the list can be removed and dragged", async ({
    page,
  }) => {
    await setupImportFlow(page);
    const scope = await openProposal(
      page,
      htmlFile(
        "many.html",
        makeBookmarkExport({ unfiled: 1, folders: [{ name: "큰 폴더", count: 400 }] }),
      ),
    );
    await openFolder(scope, "새 폴더 큰 폴더");
    const rows = page.getByTestId("import-link-row");
    await expect(rows.first()).toBeVisible();
    expect(await rows.count()).toBeLessThan(120);
    await expect(linkHandle(scope, "큰 폴더 링크 401")).toHaveCount(0);

    await expect
      .poll(async () => {
        await rows.first().evaluate((node) => {
          let scroller = node.parentElement;
          while (scroller && !/(auto|scroll)/.test(getComputedStyle(scroller).overflowY)) {
            scroller = scroller.parentElement;
          }
          if (scroller) {
            scroller.scrollTop = scroller.scrollHeight;
          }
        });
        return linkHandle(scope, "큰 폴더 링크 401").count();
      })
      .toBe(1);
    await expect(linkHandle(scope, "큰 폴더 링크 401")).toBeInViewport();
    expect(await rows.count()).toBeLessThan(120);
    await linkRemove(scope, "큰 폴더 링크 401").click();
    await expect(linkHandle(scope, "큰 폴더 링크 401")).toHaveCount(0);
    await expect(summaryValue(scope, "추가할 링크")).toContainText("+400");

    if (isWideProject()) {
      await startMouseDrag(page, linkHandle(scope, "큰 폴더 링크 399"));
      await mouseMoveTo(page, folderRow(scope, "미분류"));
      await expect(page.getByTestId("import-drag-card")).toContainText("미분류로 옮겨요");
      await page.mouse.up();
      await expect(linkHandle(scope, "큰 폴더 링크 399")).toHaveCount(0);
      await expect(folderRow(scope, "미분류")).toContainText("+2");
    }
  });

  test("a shared folder refuses the drop and says why", async ({ page }) => {
    test.skip(!isWideProject(), "the wide screen drags onto the folder list");
    await setupImportFlow(page);
    const scope = await openProposal(page);
    await startMouseDrag(page, linkHandle(scope, "오늘의 뉴스"));
    await mouseMoveTo(page, folderRow(scope, /^취업, 공유 중인 폴더라/));
    await expect(page.getByTestId("import-drag-card")).toContainText(
      "공유 폴더에는 넣을 수 없어요",
    );
    await page.mouse.up();
    await expect(linkHandle(scope, "오늘의 뉴스")).toBeVisible();
    await expect(folderRow(scope, "미분류")).toContainText("+3");
  });

  test("dragging near the end of the folder list scrolls it so lower folders can be reached", async ({
    page,
  }) => {
    test.skip(!isWideProject(), "the wide screen drags onto the folder list");
    await setupImportFlow(page);
    const folders = Array.from({ length: 30 }, (_, index) => ({
      name: `주제 ${index + 1}`,
      count: 1,
    }));
    const scope = await openProposal(
      page,
      htmlFile("many.html", makeBookmarkExport({ unfiled: 2, folders })),
    );
    const list = scope.getByLabel("폴더", { exact: true });
    const last = folderRow(scope, "새 폴더 주제 30");
    await expect(last).not.toBeInViewport();
    const listBox = await list.boundingBox();
    if (!listBox) {
      throw new Error("folder list has no box");
    }
    await startMouseDrag(page, linkHandle(scope, "미분류 링크 1"));
    await page.mouse.move(listBox.x + listBox.width / 2, listBox.y + listBox.height - 8, {
      steps: 8,
    });
    await expect
      .poll(() => list.evaluate((node) => node.scrollTop), { timeout: 8000 })
      .toBeGreaterThan(200);
    await expect(last).toBeInViewport();
    await mouseMoveTo(page, last);
    await page.mouse.up();
    await expect(last).toContainText("+2");
  });

  test("scrolling the folder list with the wheel during a drag drops on the folder now under the pointer", async ({
    page,
  }) => {
    test.skip(!isWideProject(), "the wide screen drags onto the folder list");
    await setupImportFlow(page);
    const folders = Array.from({ length: 30 }, (_, index) => ({
      name: `주제 ${index + 1}`,
      count: 1,
    }));
    const scope = await openProposal(
      page,
      htmlFile("many.html", makeBookmarkExport({ unfiled: 2, folders })),
    );
    const list = scope.getByLabel("폴더", { exact: true });
    await startMouseDrag(page, linkHandle(scope, "미분류 링크 1"));
    await mouseMoveTo(page, folderRow(scope, "새 폴더 주제 1"));
    await expect(page.getByTestId("import-drag-card")).toContainText("주제 1");
    const first = await folderRow(scope, "새 폴더 주제 1").boundingBox();
    const second = await folderRow(scope, "새 폴더 주제 2").boundingBox();
    if (!first || !second) {
      throw new Error("folder rows have no box");
    }
    const pitch = second.y - first.y;
    await page.mouse.wheel(0, pitch * 3);
    await expect.poll(() => list.evaluate((node) => node.scrollTop)).toBeGreaterThan(pitch * 2);
    await expect(page.getByTestId("import-drag-card")).toContainText("주제 4");
    await page.mouse.up();
    await expect(folderRow(scope, "새 폴더 주제 4")).toContainText("+2");
    await expect(folderRow(scope, "새 폴더 주제 1")).toContainText("+1");
  });

  test("on mobile, dragging a handle raises the folder tray and dropping on a folder moves the link", async ({
    page,
  }) => {
    test.skip(isWideProject(), "the tray is the mobile drop target");
    await setupImportFlow(page);
    const scope = await openProposal(page);
    await openFolder(scope, "미분류");
    const from = await center(linkHandle(scope, "오늘의 뉴스"));
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x: from.x, y: from.y }],
    });
    for (let step = 1; step <= 4; step += 1) {
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{ x: from.x + step * 4, y: from.y + step * 4 }],
      });
    }
    const tray = page.getByTestId("import-drop-tray");
    await expect(tray).toBeVisible();
    await expect(tray.getByTestId("import-drop-tray-title")).toHaveText("‘오늘의 뉴스’ 옮기기");
    await expect(tray.getByText("옮길 폴더 위에서 손을 떼요")).toHaveCount(0);
    const to = await center(tray.getByLabel("자바", { exact: true }));
    for (let step = 1; step <= 8; step += 1) {
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [
          {
            x: from.x + ((to.x - from.x) * step) / 8,
            y: from.y + ((to.y - from.y) * step) / 8,
          },
        ],
      });
    }
    await expect(page.getByTestId("import-drag-card")).toContainText("자바로 옮겨요");
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await expect(tray).toHaveCount(0);
    await expect(linkHandle(scope, "오늘의 뉴스")).toHaveCount(0);
    await backToFolders(page);
    await expect(folderRow(scope, "새 폴더 자바")).toContainText("+4");
  });
});

test.describe("closing the proposal", () => {
  test("after an edit, X and 취소 ask before discarding; keeping edits leaves them in place", async ({
    page,
  }) => {
    await setupImportFlow(page);
    const scope = await openProposal(page);
    await openFolder(scope, "미분류");
    await linkRemove(scope, "오늘의 뉴스").click();

    await scope.getByRole("button", { name: "취소", exact: true }).click();
    const confirm = isWideProject()
      ? page.getByRole("dialog", { name: "수정한 내용이 사라져요" })
      : page;
    await expect(confirm.getByText("수정한 내용이 사라져요")).toBeVisible();
    await confirm.getByRole("button", { name: "계속 수정하기" }).click();
    await expect(page.getByText("수정한 내용이 사라져요")).toHaveCount(0);
    await expect(page.getByText(PROPOSAL_TITLE)).toBeVisible();
    await expectSummary(scope, { add: "+10", folders: "+3", skip: "1", bad: "0" });

    await page.getByTestId("import-proposal-close").click();
    await expect(confirm.getByText("수정한 내용이 사라져요")).toBeVisible();
    await confirm.getByRole("button", { name: "닫기", exact: true }).last().click();
    await expect(page.getByText(PROPOSAL_TITLE)).toHaveCount(0);
    await expect(page).toHaveURL(/\/settings\/imports$/);
  });

  test("an untouched proposal closes from X and 취소 without asking", async ({ page }) => {
    await setupImportFlow(page);
    let scope = await openProposal(page);
    await scope.getByRole("button", { name: "취소", exact: true }).click();
    await expect(page.getByText(PROPOSAL_TITLE)).toHaveCount(0);
    await expect(page.getByText("수정한 내용이 사라져요")).toHaveCount(0);

    scope = await openProposal(page);
    await page.getByTestId("import-proposal-close").click();
    await expect(page.getByText(PROPOSAL_TITLE)).toHaveCount(0);
  });

  test("reloading or leaving and coming back shows the imports page without the proposal and starts nothing", async ({
    page,
  }) => {
    const { api } = await setupImportFlow(page);
    await openProposal(page);
    await page.reload();
    await expect(page).toHaveURL(/\/settings\/imports$/);
    await expect(page.getByText(PROPOSAL_TITLE)).toHaveCount(0);

    await openProposal(page);
    await page.goto("/home");
    await page.goto("/settings/imports");
    await expect(page.getByText(PROPOSAL_TITLE)).toHaveCount(0);
    expect(countRequests(api, "POST", "/api/imports")).toBe(0);
  });
});

test.describe("layout", () => {
  test("wide screens show two panes; mobile shows the folder list, then a folder's links, then back", async ({
    page,
  }) => {
    await setupImportFlow(page);
    const scope = await openProposal(page);
    if (isWideProject()) {
      await expect(page.getByRole("dialog", { name: PROPOSAL_TITLE })).toBeVisible();
      await expect(folderRow(scope, "미분류")).toBeVisible();
      await expect(linkHandle(scope, "오늘의 뉴스")).toBeVisible();
      return;
    }
    await expect(folderRow(scope, "미분류")).toBeVisible();
    await expect(linkHandle(scope, "오늘의 뉴스")).toHaveCount(0);
    await openFolder(scope, "미분류");
    await expect(linkHandle(scope, "오늘의 뉴스")).toBeVisible();
    await expect(folderRow(scope, "aws")).toHaveCount(0);
    await backToFolders(page);
    await expect(folderRow(scope, "aws")).toBeVisible();
  });

  for (const [width, isSheet] of [
    [768, true],
    [769, false],
  ] as const) {
    test(`at ${width}px the proposal is ${isSheet ? "the mobile sheet" : "the wide dialog"}`, async ({
      page,
    }) => {
      test.skip(!isWideProject(), "checked once with the desktop project");
      await page.setViewportSize({ width, height: 900 });
      await setupImportFlow(page);
      await openProposal(page);
      const dialog = page.getByRole("dialog", { name: PROPOSAL_TITLE });
      if (isSheet) {
        await expect(dialog).toHaveCount(0);
        await expect(page.getByRole("button", { name: "미분류", exact: true })).toBeVisible();
        await expect(page.getByRole("button", { name: "오늘의 뉴스 폴더 옮기기" })).toHaveCount(0);
      } else {
        await expect(dialog).toBeVisible();
        await expect(
          proposalScope(page).getByRole("button", { name: "오늘의 뉴스 폴더 옮기기" }),
        ).toBeVisible();
      }
    });
  }

  for (const [width, isHintShown] of [
    [768, false],
    [769, true],
  ] as const) {
    test(`at ${width}px the name field ${isHintShown ? "shows" : "hides"} the Enter and Esc hint and keeps the count`, async ({
      page,
    }) => {
      test.skip(!isWideProject(), "checked once with the desktop project");
      await page.setViewportSize({ width, height: 900 });
      await setupImportFlow(page);
      await openProposal(page);
      const scope = isHintShown ? page.getByRole("dialog", { name: PROPOSAL_TITLE }) : page;
      await startRename(scope, "자바");
      await expect(scope.getByText("2/100")).toBeVisible();
      if (isHintShown) {
        await expect(scope.getByText("Enter로 저장, Esc로 취소")).toBeVisible();
      } else {
        await expect(scope.getByText("Enter로 저장, Esc로 취소")).toHaveCount(0);
      }
      await scope.getByLabel("새 폴더 이름").fill("취업");
      await expect(scope.getByText("공유 폴더와 같은 이름은 쓸 수 없어요")).toBeVisible();
    });
  }

  test("on mobile the handle, remove, folder rows and footer buttons are finger sized and clear the bottom edge", async ({
    page,
  }) => {
    test.skip(isWideProject(), "touch sizes are checked on mobile");
    await setupImportFlow(page);
    const scope = await openProposal(page);
    const viewport = page.viewportSize();
    for (const name of ["링크 11개 가져오기", "취소"]) {
      const button = scope.getByRole("button", { name, exact: true }).last();
      await expect(button).toBeInViewport({ ratio: 1 });
      await expect
        .poll(async () => {
          const box = await button.boundingBox();
          return (box?.y ?? 0) + (box?.height ?? 0);
        })
        .toBeLessThanOrEqual((viewport?.height ?? 0) - 8);
      expect((await button.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
    }
    const row = await folderRow(scope, "aws").boundingBox();
    expect(row?.height ?? 0).toBeGreaterThanOrEqual(44);

    await openFolder(scope, "미분류");
    for (const target of [linkHandle(scope, "오늘의 뉴스"), linkRemove(scope, "오늘의 뉴스")]) {
      const box = await target.boundingBox();
      expect(box?.width ?? 0).toBeGreaterThanOrEqual(44);
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
    }

    await linkHandle(scope, "오늘의 뉴스").click();
    const toggle = page.getByRole("button", { name: /^새 폴더 (접기|펼치기)$/ });
    await expect(toggle).toBeVisible();
    expect((await toggle.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
    for (const name of ["취소", "확인"]) {
      const button = page.getByRole("button", { name, exact: true }).last();
      await expect(button).toBeInViewport({ ratio: 1 });
      await expect
        .poll(async () => {
          const box = await button.boundingBox();
          return (box?.y ?? 0) + (box?.height ?? 0);
        })
        .toBeLessThanOrEqual((viewport?.height ?? 0) - 8);
    }
  });

  test("on mobile, renaming a new folder keeps the name field on screen", async ({ page }) => {
    test.skip(isWideProject(), "the mobile sheet");
    await setupImportFlow(page);
    const scope = await openProposal(page);
    const input = await startRename(scope, "자바");
    await expect(input).toBeInViewport({ ratio: 1 });
  });
});

test.describe("bulk remove, removed links and undo steps (#49)", () => {
  async function expectListClosedOnMobile(page: Page) {
    if (!isWideProject()) {
      await expect(page.getByRole("button", { name: "폴더 목록으로" })).toHaveCount(0);
    }
  }

  function undoButton(scope: Scope, label: string) {
    return scope.getByRole("button", {
      name: new RegExp(`^${label}, 되돌릴 수 있는 변경 \\d+개$`),
    });
  }

  test("모두 빼기 is on 미분류, my folders and new folders, not on shared folders", async ({
    page,
  }) => {
    await setupImportFlow(page);
    const scope = await openProposal(page);
    for (const folder of ["미분류", "aws", "새 폴더 자바"]) {
      await openFolder(scope, folder);
      await expect(scope.getByRole("button", { name: /의 링크 모두 빼기$/ })).toBeVisible();
      await backToFolders(page);
    }
    await openFolder(scope, /^취업, 공유 중인 폴더라/);
    await expect(scope.getByRole("button", { name: /모두 빼기/ })).toHaveCount(0);
  });

  test("모두 빼기 on a new folder excludes it at once, and 모두 넣기 brings every link back", async ({
    page,
  }) => {
    await setupImportFlow(page);
    const scope = await openProposal(page);
    await openFolder(scope, "새 폴더 자바");
    await pressButton(scope.getByRole("button", { name: "‘자바’의 링크 모두 빼기" }));

    await expect(scope.getByText("옮겨지는 링크가 없어요.")).toBeVisible();
    await expect(scope.getByText("이 폴더는 가져오기에서 제외돼요.")).toBeVisible();
    await expectSummary(scope, { add: "+8", folders: "+2", skip: "1", bad: "0" });
    await expect(
      scope.getByText(
        "‘자바’의 링크 3개를 가져오지 않아요. 새 폴더 ‘자바’를 가져오기에서 제외해요.",
      ),
    ).toBeVisible();
    await expect(undoButton(scope, "모두 빼기 취소")).toBeVisible();
    await expect(
      scope.getByText("이 폴더에서 뺀 링크 3개는 ‘뺀 링크’에 모여 있어요."),
    ).toBeVisible();
    if (isWideProject()) {
      await expect(scope.getByText("링크 8개와 새 폴더 2개를 추가해요")).toBeVisible();
    } else {
      await expect(page.getByRole("button", { name: "링크 8개 가져오기" })).toBeVisible();
    }

    await pressButton(scope.getByRole("button", { name: "‘자바’에서 뺀 링크 3개 모두 넣기" }));
    await expectSummary(scope, { add: "+11", folders: "+3", skip: "1", bad: "0" });
    await expect(linkHandle(scope, "레코드 클래스 살펴보기")).toBeVisible();
    await expect(
      scope.getByText("‘자바’에 링크 3개를 다시 넣었어요. 새 폴더 ‘자바’를 다시 가져와요."),
    ).toBeVisible();
    await expect(undoButton(scope, "넣기 취소")).toBeVisible();
  });

  test("모두 빼기 on 미분류 leaves the row with its count only", async ({ page }) => {
    await setupImportFlow(page);
    const scope = await openProposal(page);
    await openFolder(scope, "미분류");
    await pressButton(scope.getByRole("button", { name: "‘미분류’의 링크 모두 빼기" }));
    await expectSummary(scope, { add: "+8", folders: "+3", skip: "1", bad: "0" });
    await expect(scope.getByText("‘미분류’의 링크 3개를 가져오지 않아요.")).toBeVisible();
    await backToFolders(page);
    await expect(folderRow(scope, "미분류")).toContainText("0개");
    await expect(folderRow(scope, "미분류")).not.toContainText("+");
  });

  test("folder rows show what is there now and what is added, like '8개 +2' and '0개 +3'", async ({
    page,
  }) => {
    await setupImportFlow(page);
    const scope = await openProposal(page);
    await expect(folderRow(scope, "aws")).toContainText("8개");
    await expect(folderRow(scope, "aws")).toContainText("+2");
    await expect(folderRow(scope, "미분류")).toContainText("0개");
    await expect(folderRow(scope, "미분류")).toContainText("+3");
    await expect(folderRow(scope, "미분류")).toContainText("🗂️");
  });

  test("a removed link waits in 뺀 링크 under its folder and 다시 넣기 puts it back", async ({
    page,
  }) => {
    await setupImportFlow(page);
    const scope = await openProposal(page);
    await openFolder(scope, "미분류");
    await pressButton(linkRemove(scope, "팀 캘린더"));
    await backToFolders(page);
    await openFolder(scope, "aws");
    await pressButton(linkRemove(scope, "ECS 배포 전략 비교"));
    await backToFolders(page);

    const removedRow = folderRow(scope, "뺀 링크 2개");
    await expect(removedRow).toBeVisible();
    const removedBox = await removedRow.boundingBox();
    const skippedBox = await folderRow(scope, "건너뛸 링크 1개").boundingBox();
    expect(removedBox?.y ?? 0).toBeLessThan(skippedBox?.y ?? 0);

    await pressButton(removedRow);
    await expect(scope.getByText("다시 넣으면 원래 폴더로 돌아가요.")).toBeVisible();
    const groups = scope.getByTestId("import-removed-group");
    await expect(groups).toHaveCount(2);
    await expect(groups.nth(0)).toContainText("미분류");
    await expect(groups.nth(0)).toContainText("🗂️");
    await expect(groups.nth(1)).toContainText("aws");
    await expect(scope.getByTestId("import-removed-row")).toHaveCount(2);

    await pressButton(scope.getByRole("button", { name: "팀 캘린더 다시 넣기" }));
    await expect(scope.getByTestId("import-removed-row")).toHaveCount(1);
    await expect(scope.getByText("‘팀 캘린더’를 ‘미분류’에 다시 넣었어요.")).toBeVisible();
    await expectSummary(scope, { add: "+10", folders: "+3", skip: "1", bad: "0" });

    await pressButton(scope.getByRole("button", { name: "ECS 배포 전략 비교 다시 넣기" }));
    await expectListClosedOnMobile(page);
    await expectSummary(scope, { add: "+11", folders: "+3", skip: "1", bad: "0" });
    await expect(folderRow(scope, /^뺀 링크/)).toHaveCount(0);
    await openFolder(scope, "미분류");
    await expect(linkHandle(scope, "팀 캘린더")).toBeVisible();
  });

  test("the note under a folder opens 뺀 링크, and a group's 모두 넣기 puts the whole group back", async ({
    page,
  }) => {
    await setupImportFlow(page);
    const scope = await openProposal(page);
    await openFolder(scope, "새 폴더 자바");
    await pressButton(linkRemove(scope, "Java 21 가상 스레드 정리"));
    await pressButton(linkRemove(scope, "레코드 클래스 살펴보기"));
    await expect(
      scope.getByRole("button", { name: "‘자바’에서 뺀 링크 2개 모두 넣기" }),
    ).toBeVisible();
    await pressButton(scope.getByRole("button", { name: "뺀 링크 보기" }));
    await expect(scope.getByTestId("import-removed-group")).toContainText("자바");
    if (isWideProject()) {
      await expect(folderRow(scope, "뺀 링크 2개")).toHaveAttribute("aria-selected", "true");
      await expect(folderRow(scope, "뺀 링크 2개")).toBeInViewport();
    }
    await pressButton(scope.getByRole("button", { name: "‘자바’에서 뺀 링크 2개 모두 넣기" }));
    await expectSummary(scope, { add: "+11", folders: "+3", skip: "1", bad: "0" });
  });

  test("a removed link follows its folder when the folder is merged into another", async ({
    page,
  }) => {
    await setupImportFlow(page);
    const scope = await openProposal(page);
    await openFolder(scope, "새 폴더 자바");
    await pressButton(linkRemove(scope, "Java 21 가상 스레드 정리"));
    await backToFolders(page);
    const input = await startRename(scope, "자바");
    await input.fill("aws");
    await input.press("Enter");
    await expect(scope.getByText(/기존 폴더 ‘aws’로 합쳤어요/)).toBeVisible();
    await backToFolders(page);
    await pressButton(folderRow(scope, "뺀 링크 1개"));
    await expect(scope.getByTestId("import-removed-group")).toContainText("aws");
    await pressButton(scope.getByRole("button", { name: "Java 21 가상 스레드 정리 다시 넣기" }));
    await expectListClosedOnMobile(page);
    await expect(folderRow(scope, "aws")).toContainText("+5");
  });

  test("a link whose picker folder is gone goes back to 미분류", async ({ page }) => {
    await setupImportFlow(page);
    const scope = await openProposal(page);
    await openFolder(scope, "미분류");
    await linkHandle(scope, "팀 캘린더").click();
    const picker = isWideProject() ? page.getByRole("dialog", { name: "폴더 이동" }) : page;
    await picker.getByRole("button", { name: "새 폴더에 폴더 추가" }).click();
    await picker.getByLabel("새 폴더 이름").fill("참고 자료");
    await picker.getByLabel("새 폴더 이름").press("Enter");
    await picker.getByRole("button", { name: "확인", exact: true }).last().click();
    await backToFolders(page);
    await openFolder(scope, "새 폴더 참고 자료");
    await pressButton(linkRemove(scope, "팀 캘린더"));
    await backToFolders(page);
    await openFolder(scope, "미분류");
    await linkHandle(scope, "오늘의 뉴스").click();
    await picker.getByRole("button", { name: "취소", exact: true }).last().click();
    await backToFolders(page);
    await expect(folderRow(scope, /^새 폴더 참고 자료/)).toHaveCount(0);

    await pressButton(folderRow(scope, "뺀 링크 1개"));
    await expect(scope.getByTestId("import-removed-group")).toContainText("비어서 없어진 새 폴더");
    await expect(scope.getByTestId("import-removed-row")).toContainText("미분류로 넣어요");
    await pressButton(scope.getByRole("button", { name: "팀 캘린더 다시 넣기" }));
    await expectListClosedOnMobile(page);
    await expect(folderRow(scope, "미분류")).toContainText("+3");
  });

  test("undo walks back one change at a time and shows the previous one", async ({ page }) => {
    await setupImportFlow(page);
    const scope = await openProposal(page);
    await openFolder(scope, "미분류");
    await pressButton(linkRemove(scope, "오늘의 뉴스"));
    await pressButton(linkRemove(scope, "팀 캘린더"));
    await pressButton(scope.getByRole("button", { name: "‘미분류’의 링크 모두 빼기" }));
    const bar = scope.getByTestId("import-status-bar");
    await expect(bar).toHaveAttribute("aria-live", "polite");
    await expect(bar).not.toHaveAttribute("role", "alert");
    await expect(
      scope.getByRole("button", { name: "모두 빼기 취소, 되돌릴 수 있는 변경 3개" }),
    ).toBeVisible();

    await pressButton(undoButton(scope, "모두 빼기 취소"));
    await expect(bar).toContainText("되돌렸어요. 이전 변경: ‘팀 캘린더’를 가져오지 않아요.");
    await expect(
      scope.getByRole("button", { name: "다시 넣기, 되돌릴 수 있는 변경 2개" }),
    ).toBeVisible();
    await expectSummary(scope, { add: "+9", folders: "+3", skip: "1", bad: "0" });

    await pressButton(undoButton(scope, "다시 넣기"));
    await pressButton(undoButton(scope, "다시 넣기"));
    await expect(bar).toHaveCount(0);
    await expectSummary(scope, { add: "+11", folders: "+3", skip: "1", bad: "0" });

    await pressButton(page.getByTestId("import-proposal-close"));
    await expect(page.getByText(PROPOSAL_TITLE)).toHaveCount(0);
  });

  test("undo keeps the last ten changes", async ({ page }) => {
    await setupImportFlow(page);
    const scope = await openProposal(
      page,
      htmlFile("twelve.html", makeBookmarkExport({ unfiled: 12 })),
    );
    await openFolder(scope, "미분류");
    for (let index = 1; index <= 12; index += 1) {
      await pressButton(linkRemove(scope, `미분류 링크 ${index}`));
    }
    await expect(
      scope.getByRole("button", { name: "다시 넣기, 되돌릴 수 있는 변경 10개" }),
    ).toBeVisible();
    for (let index = 0; index < 10; index += 1) {
      await pressButton(undoButton(scope, "다시 넣기"));
    }
    await expect(scope.getByTestId("import-status-bar")).toHaveCount(0);
    await expect(summaryValue(scope, "추가할 링크")).toContainText("+10");
  });

  test("renaming adds no undo step, and undoing an earlier change keeps the new name", async ({
    page,
  }) => {
    await setupImportFlow(page);
    const scope = await openProposal(page);
    await openFolder(scope, "새 폴더 자바");
    await pressButton(linkRemove(scope, "Java 21 가상 스레드 정리"));
    await backToFolders(page);
    const input = await startRename(scope, "자바");
    await input.fill("자바 정리");
    await input.press("Enter");
    await expect(
      scope.getByRole("button", { name: "다시 넣기, 되돌릴 수 있는 변경 1개" }),
    ).toBeVisible();
    await pressButton(undoButton(scope, "다시 넣기"));
    await backToFolders(page);
    await expect(folderRow(scope, "새 폴더 자바 정리")).toContainText("+3");
  });

  test("closing the status bar keeps the steps for the next change", async ({ page }) => {
    await setupImportFlow(page);
    const scope = await openProposal(page);
    await openFolder(scope, "미분류");
    await pressButton(linkRemove(scope, "오늘의 뉴스"));
    await pressButton(scope.getByRole("button", { name: "알림 닫기" }));
    await expect(scope.getByTestId("import-status-bar")).toHaveCount(0);
    await pressButton(linkRemove(scope, "팀 캘린더"));
    await expect(
      scope.getByRole("button", { name: "다시 넣기, 되돌릴 수 있는 변경 2개" }),
    ).toBeVisible();
    await pressButton(undoButton(scope, "다시 넣기"));
    await pressButton(undoButton(scope, "다시 넣기"));
    await expect(linkHandle(scope, "오늘의 뉴스")).toBeVisible();
    await expect(linkHandle(scope, "팀 캘린더")).toBeVisible();
  });

  test("removing every link turns import off, and undo turns it back on", async ({ page }) => {
    await setupImportFlow(page);
    const scope = await openProposal(
      page,
      htmlFile("two.html", makeBookmarkExport({ unfiled: 2 })),
    );
    await openFolder(scope, "미분류");
    await pressButton(scope.getByRole("button", { name: "‘미분류’의 링크 모두 빼기" }));
    const importButton = isWideProject()
      ? scope.getByRole("button", { name: "가져오기", exact: true })
      : page.getByRole("button", { name: "가져오기", exact: true });
    await expect(importButton).toBeDisabled();
    if (isWideProject()) {
      await expect(scope.getByText("가져올 링크가 없어요", { exact: true })).toBeVisible();
    }
    await pressButton(undoButton(scope, "모두 빼기 취소"));
    if (isWideProject()) {
      await expect(importButton).toBeEnabled();
      await expect(scope.getByText("링크 2개를 추가해요")).toBeVisible();
    } else {
      await expect(page.getByRole("button", { name: "링크 2개 가져오기" })).toBeEnabled();
    }
  });

  test("on mobile the footer is one row '취소 | 링크 N개 가져오기' and the status bar stays one line", async ({
    page,
  }) => {
    test.skip(isWideProject(), "mobile footer");
    await setupImportFlow(page);
    await openProposal(page);
    const cancel = page.getByRole("button", { name: "취소", exact: true });
    const start = page.getByRole("button", { name: "링크 11개 가져오기" });
    await expect(start).toBeVisible();
    const cancelBox = await cancel.boundingBox();
    const startBox = await start.boundingBox();
    expect(Math.abs((cancelBox?.y ?? 0) - (startBox?.y ?? 1))).toBeLessThan(2);
    expect(startBox?.width ?? 0).toBeGreaterThan(cancelBox?.width ?? 0);
    expect(cancelBox?.height ?? 0).toBeGreaterThanOrEqual(44);
    await expect(page.getByText("링크 11개와 새 폴더 3개를 추가해요")).toHaveCount(0);

    await openFolder(page, "새 폴더 자바");
    await pressButton(page.getByRole("button", { name: "‘자바’의 링크 모두 빼기" }));
    await expect(page.getByRole("button", { name: "링크 8개 가져오기" })).toBeVisible();
    const bar = page.getByTestId("import-status-bar");
    const barBox = await bar.boundingBox();
    expect(barBox?.height ?? 0).toBeLessThanOrEqual(48);
    for (const name of [/^모두 빼기 취소, 되돌릴/, /^알림 닫기$/]) {
      const box = await page.getByRole("button", { name }).boundingBox();
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
    }
    const summaryBox = await page.getByLabel("가져오기 요약").boundingBox();
    expect(summaryBox?.height ?? 0).toBeGreaterThan(80);
  });

  test("the wide footer caption leaves out a zero count", async ({ page }) => {
    test.skip(!isWideProject(), "wide footer caption");
    await setupImportFlow(page);
    const scope = await openProposal(
      page,
      htmlFile("three.html", makeBookmarkExport({ unfiled: 3 })),
    );
    await expect(scope.getByText("링크 3개를 추가해요")).toBeVisible();
    await expect(scope.getByText(/새 폴더 0개/)).toHaveCount(0);
  });

  test("with nothing new to add, 다른 파일 선택 goes back to choosing a file", async ({ page }) => {
    await setupImportFlow(page);
    const scope = await openProposal(page, "only-unsupported.html");
    await expect(scope.getByText("새로 추가할 링크가 없어요")).toBeVisible();
    await pressButton(page.getByRole("button", { name: "다른 파일 선택" }));
    await expect(page.getByText(PROPOSAL_TITLE)).toHaveCount(0);
    await expect(
      page.getByText("브라우저에서 북마크를 HTML 파일로 내보낸 다음 올려 주세요."),
    ).toBeVisible();
    await chooseFile(page, "chrome-export.html");
    await expect(page.getByText(PROPOSAL_TITLE)).toBeVisible();
  });

  async function touchDrag(page: Page, handle: Locator) {
    const from = await center(handle);
    const cdp = await page.context().newCDPSession(page);
    let at = from;
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x: from.x, y: from.y }],
    });
    for (let step = 1; step <= 4; step += 1) {
      at = { x: from.x + step * 4, y: from.y + step * 4 };
      await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [at] });
    }
    const moveToPoint = async (to: { x: number; y: number }) => {
      const start = at;
      for (let step = 1; step <= 8; step += 1) {
        at = {
          x: start.x + ((to.x - start.x) * step) / 8,
          y: start.y + ((to.y - start.y) * step) / 8,
        };
        await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [at] });
      }
    };
    return {
      moveToPoint,
      moveTo: async (target: Locator) => moveToPoint(await center(target)),
      end: () => cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] }),
    };
  }

  test("dragging over a shared folder marks its row with a dashed red border and 넣을 수 없어요", async ({
    page,
  }) => {
    test.skip(!isWideProject(), "the wide screen drags onto the folder list");
    await setupImportFlow(page);
    const scope = await openProposal(page);
    await expect(scope.getByTestId("import-folder-row-refused")).toHaveCount(0);
    await startMouseDrag(page, linkHandle(scope, "오늘의 뉴스"));
    await mouseMoveTo(page, folderRow(scope, /^취업, 공유 중인 폴더라/));
    const refused = scope.getByTestId("import-folder-row-refused");
    await expect(refused).toBeVisible();
    await expect(refused).toContainText("넣을 수 없어요");
    expect(await refused.evaluate((node) => getComputedStyle(node).borderTopStyle)).toBe("dashed");
    await page.mouse.up();
    await expect(scope.getByTestId("import-folder-row-refused")).toHaveCount(0);
    await expect(folderRow(scope, "미분류")).toContainText("+3");
  });

  test("the mobile tray splits folders into sections and puts the last folder moved to on top", async ({
    page,
  }) => {
    test.skip(isWideProject(), "the tray is the mobile drop target");
    await setupImportFlow(page);
    const scope = await openProposal(page);
    await openFolder(scope, "미분류");

    const first = await touchDrag(page, linkHandle(scope, "오늘의 뉴스"));
    const tray = page.getByTestId("import-drop-tray");
    await expect(tray).toBeVisible();
    await expect(tray.getByRole("heading", { name: "미분류 · 내 폴더" })).toBeVisible();
    await expect(tray.getByRole("heading", { name: "새 폴더" })).toBeVisible();
    await expect(tray.getByText("3개", { exact: true })).toBeVisible();
    await expect(tray.getByText("최근 옮긴 곳")).toHaveCount(0);
    await first.moveTo(tray.getByLabel("자바", { exact: true }));
    await first.end();
    await expect(tray).toHaveCount(0);

    const second = await touchDrag(page, linkHandle(scope, "팀 캘린더"));
    await expect(tray.getByRole("heading", { name: "최근 옮긴 곳" })).toBeVisible();
    const tiles = tray.getByTestId("import-drop-tray-tile");
    await expect(tiles.first()).toHaveAccessibleName("자바");
    await second.moveTo(tiles.first());
    await expect(page.getByTestId("import-drag-card")).toContainText("자바로 옮겨요");
    await second.end();
    await expect(linkHandle(scope, "팀 캘린더")).toHaveCount(0);
    await backToFolders(page);
    await expect(folderRow(scope, "새 폴더 자바")).toContainText("+5");
  });

  test("with many new folders the mobile tray scrolls during a drag, and long names stay on one line", async ({
    page,
  }) => {
    test.skip(isWideProject(), "the tray is the mobile drop target");
    await setupImportFlow(page);
    const longName = "아주 긴 이름을 가진 폴더 하나로 트레이 칸을 넘치게 만들어 보기";
    const folders = [
      { name: longName, count: 1 },
      ...Array.from({ length: 23 }, (_, index) => ({ name: `주제 ${index + 1}`, count: 1 })),
    ];
    const scope = await openProposal(
      page,
      htmlFile("many.html", makeBookmarkExport({ unfiled: 2, folders })),
    );
    await openFolder(scope, "미분류");
    const drag = await touchDrag(page, linkHandle(scope, "미분류 링크 1"));
    const tray = page.getByTestId("import-drop-tray");
    await expect(tray.getByText("24개", { exact: true })).toBeVisible();

    const longTile = tray.getByLabel(longName, { exact: true });
    const longBox = await longTile.boundingBox();
    const trayBox = await tray.boundingBox();
    expect(longBox?.height ?? 0).toBeLessThanOrEqual(41);
    expect((longBox?.x ?? 0) + (longBox?.width ?? 0)).toBeLessThanOrEqual(
      (trayBox?.x ?? 0) + (trayBox?.width ?? 0),
    );

    const last = tray.getByLabel("주제 23", { exact: true });
    await expect(last).not.toBeInViewport();
    const viewport = page.viewportSize();
    await drag.moveToPoint({ x: (viewport?.width ?? 390) / 2, y: (viewport?.height ?? 844) - 6 });
    await expect(last).toBeInViewport({ timeout: 8000 });
    await drag.moveTo(last);
    await expect(page.getByTestId("import-drag-card")).toContainText("주제 23");
    await drag.end();
    await backToFolders(page);
    await expect(folderRow(scope, "새 폴더 주제 23")).toContainText("+2");
  });

  test("on a wide screen, opening 뺀 링크 scrolls the long folder list to its selected row", async ({
    page,
  }) => {
    test.skip(!isWideProject(), "the wide screen keeps the folder list beside the links");
    await setupImportFlow(page);
    const folders = Array.from({ length: 30 }, (_, index) => ({
      name: `주제 ${index + 1}`,
      count: 1,
    }));
    const scope = await openProposal(
      page,
      htmlFile("many.html", makeBookmarkExport({ unfiled: 2, folders })),
    );
    await openFolder(scope, "미분류");
    await linkRemove(scope, "미분류 링크 1").click();
    const removedRow = folderRow(scope, "뺀 링크 1개");
    await expect(removedRow).not.toBeInViewport();
    await scope.getByRole("button", { name: "뺀 링크 보기" }).click();
    await expect(scope.getByText("다시 넣으면 원래 폴더로 돌아가요.")).toBeVisible();
    await expect(removedRow).toBeInViewport();
    await expect(removedRow).toHaveAttribute("aria-selected", "true");
  });

  test("a long folder name is cut to one line in its 뺀 링크 group and keeps 모두 넣기 in place", async ({
    page,
  }) => {
    await setupImportFlow(page);
    const longName =
      "아주 긴 이름을 가진 폴더라서 한 줄에 다 들어가지 않는 새 폴더 이름입니다 넓은 화면에서도 끝까지 보이지 않도록 조금 더 길게 적어 둔 이름이에요";
    const scope = await openProposal(
      page,
      htmlFile(
        "long.html",
        makeBookmarkExport({ unfiled: 1, folders: [{ name: longName, count: 2 }] }),
      ),
    );
    await openFolder(scope, `새 폴더 ${longName}`);
    await pressButton(scope.getByRole("button", { name: `‘${longName}’의 링크 모두 빼기` }));
    await pressButton(scope.getByRole("button", { name: "뺀 링크 보기" }));
    const group = scope.getByTestId("import-removed-group");
    await expect(group).toBeVisible();
    const groupBox = await group.boundingBox();
    expect(groupBox?.height ?? 0).toBeLessThanOrEqual(57);
    const heading = group.getByRole("heading", { name: longName });
    expect(await heading.evaluate((node) => node.scrollWidth > node.clientWidth)).toBe(true);
    const restore = group.getByRole("button", { name: `‘${longName}’에서 뺀 링크 2개 모두 넣기` });
    await expect(restore).toBeInViewport({ ratio: 1 });
    const restoreBox = await restore.boundingBox();
    expect((restoreBox?.x ?? 0) + (restoreBox?.width ?? 0)).toBeLessThanOrEqual(
      (groupBox?.x ?? 0) + (groupBox?.width ?? 0) + 1,
    );
  });

  test("the wide handle is 40px and the handle hint is at least 12px", async ({ page }) => {
    await setupImportFlow(page);
    const scope = await openProposal(page);
    await openFolder(scope, "미분류");
    if (isWideProject()) {
      const box = await linkHandle(scope, "오늘의 뉴스").boundingBox();
      expect(box?.width ?? 0).toBeGreaterThanOrEqual(40);
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(40);
    }
    const hint = scope.getByText("손잡이를 누르거나 끌어서 폴더를 옮길 수 있어요.");
    await expect(hint).toBeVisible();
    const size = await hint.evaluate((node) => parseFloat(getComputedStyle(node).fontSize));
    expect(size).toBeGreaterThanOrEqual(12);
  });
});
