import { type Locator, type Page, expect, test } from "@playwright/test";

import {
  backToFolders,
  folderRow,
  htmlFile,
  linkHandle,
  makeBookmarkExport,
  openFolder,
  openProposal,
  setupImportFlow,
  summaryValue,
} from "./support/bookmark-fixtures";
import { isWideProject } from "./support/helpers";

// #22 unit 4: the import 폴더 이동 picker opened from a link handle.

type Scope = Locator | Page;

async function openPicker(page: Page, scope: Scope, folder: string, title: string) {
  await openFolder(scope, folder);
  await linkHandle(scope, title).click();
  const picker = isWideProject() ? page.getByRole("dialog", { name: "폴더 이동" }) : page;
  await expect(picker.getByText("이동할 폴더를 선택해주세요.")).toBeVisible();
  await expect(picker.getByRole("button", { name: "취소", exact: true }).last()).toBeInViewport();
  return picker;
}

async function expectPickerClosed(page: Page) {
  await expect(page.getByText("이동할 폴더를 선택해주세요.")).not.toBeInViewport();
  await expect(page.getByText("가져올 내용을 확인해 주세요")).toHaveCount(1);
}

function radio(picker: Scope, name: string) {
  return picker.getByRole("radio", { name, exact: true });
}

function confirmButton(picker: Scope) {
  return picker.getByRole("button", { name: "확인", exact: true }).last();
}

function cancelButton(picker: Scope) {
  return picker.getByRole("button", { name: "취소", exact: true }).last();
}

test.describe("folder move picker", () => {
  test("pressing a handle opens the picker with 🗂️ 미분류 on top and the 내 폴더 and 새 폴더 sections", async ({
    page,
  }) => {
    await setupImportFlow(page);
    const scope = await openProposal(page);
    const picker = await openPicker(page, scope, "미분류", "오늘의 뉴스");
    await expect(radio(picker, "미분류")).toBeVisible();
    await expect(picker.getByText("🗂️")).toBeVisible();
    await expect(picker.getByRole("button", { name: /^내 폴더 (접기|펼치기)$/ })).toBeVisible();
    await expect(picker.getByRole("button", { name: /^새 폴더 (접기|펼치기)$/ })).toBeVisible();
    const top = await radio(picker, "미분류").boundingBox();
    const mine = await picker
      .getByRole("button", { name: /^내 폴더 (접기|펼치기)$/ })
      .boundingBox();
    expect(top?.y ?? 0).toBeLessThan(mine?.y ?? 0);
  });

  test("it opens with the link's section expanded, its folder checked and 확인 off", async ({
    page,
  }) => {
    await setupImportFlow(page);
    const scope = await openProposal(page);
    let picker = await openPicker(page, scope, "새 폴더 자바", "Java 21 가상 스레드 정리");
    await expect(picker.getByRole("button", { name: "새 폴더 접기" })).toBeVisible();
    await expect(picker.getByRole("button", { name: "내 폴더 펼치기" })).toBeVisible();
    await expect(radio(picker, "자바")).toHaveAttribute("aria-checked", "true");
    await expect(confirmButton(picker)).toBeDisabled();
    await cancelButton(picker).click();
    await expectPickerClosed(page);

    await backToFolders(page);
    picker = await openPicker(page, scope, "aws", "VPC 서브넷 설계 체크리스트");
    await expect(picker.getByRole("button", { name: "내 폴더 접기" })).toBeVisible();
    await expect(radio(picker, "☁️ aws")).toHaveAttribute("aria-checked", "true");
    await expect(confirmButton(picker)).toBeDisabled();
  });

  test("내 폴더 lists no shared folders and has no + button", async ({ page }) => {
    await setupImportFlow(page);
    const scope = await openProposal(page);
    const picker = await openPicker(page, scope, "미분류", "오늘의 뉴스");
    await expect(radio(picker, "☁️ aws")).toBeVisible();
    await expect(radio(picker, "📚 읽을거리")).toBeVisible();
    await expect(picker.getByRole("radio", { name: /취업$|팀 위키/ })).toHaveCount(0);
    await expect(picker.getByRole("button", { name: "내 폴더에 폴더 추가" })).toHaveCount(0);
    await expect(picker.getByRole("button", { name: "새 폴더에 폴더 추가" })).toBeVisible();
  });

  test("opening one section closes the other without an empty or blinking list", async ({
    page,
  }) => {
    await setupImportFlow(page);
    const scope = await openProposal(page);
    const picker = await openPicker(page, scope, "미분류", "오늘의 뉴스");
    await expect(picker.getByLabel("내 폴더 목록")).toBeVisible();

    await page.evaluate(() => {
      const frames: { mine: number | null; added: number | null }[] = [];
      const anchor = [...document.querySelectorAll("div")].find(
        (node) => node.textContent === "이동할 폴더를 선택해주세요.",
      );
      const root = anchor?.closest('[role="dialog"], [role="slider"]') ?? document;
      const read = (label: string) => {
        const list = root.querySelector(`[aria-label="${label}"]`);
        return list ? list.querySelectorAll('[role="radio"]').length : null;
      };
      const tick = () => {
        frames.push({ mine: read("내 폴더 목록"), added: read("새 폴더 목록") });
        if (frames.length < 60) {
          requestAnimationFrame(tick);
        }
      };
      (window as unknown as { __pickerFrames: typeof frames }).__pickerFrames = frames;
      requestAnimationFrame(tick);
    });
    await picker.getByRole("button", { name: "새 폴더 펼치기" }).click();
    await expect(picker.getByRole("button", { name: "새 폴더 접기" })).toBeVisible();
    await expect(picker.getByRole("button", { name: "내 폴더 펼치기" })).toBeVisible();
    await expect(picker.getByLabel("내 폴더 목록")).toHaveCount(0);
    await expect(radio(picker, "자바")).toBeVisible();

    await expect
      .poll(() =>
        page.evaluate(
          () => (window as unknown as { __pickerFrames: unknown[] }).__pickerFrames.length,
        ),
      )
      .toBe(60);
    const frames = await page.evaluate(
      () =>
        (window as unknown as { __pickerFrames: { mine: number | null; added: number | null }[] })
          .__pickerFrames,
    );
    for (const frame of frames) {
      if (frame.mine !== null) {
        expect(frame.mine).toBeGreaterThan(0);
      }
      if (frame.added !== null) {
        expect(frame.added).toBe(3);
      }
    }
    expect(frames.some((frame) => frame.added === 3)).toBe(true);
  });

  test("choosing a row keeps the list rows mounted", async ({ page }) => {
    await setupImportFlow(page);
    const scope = await openProposal(page);
    const picker = await openPicker(page, scope, "미분류", "오늘의 뉴스");
    const aws = radio(picker, "☁️ aws");
    await aws.evaluate((node) => {
      (node as unknown as { __mark: boolean }).__mark = true;
    });
    await radio(picker, "📚 읽을거리").click();
    await expect(radio(picker, "📚 읽을거리")).toHaveAttribute("aria-checked", "true");
    await aws.click();
    await expect(aws).toHaveAttribute("aria-checked", "true");
    expect(await aws.evaluate((node) => (node as unknown as { __mark?: boolean }).__mark)).toBe(
      true,
    );
  });

  test("choosing another folder turns 확인 on, and 확인 moves the link and closes the picker", async ({
    page,
  }) => {
    await setupImportFlow(page);
    const scope = await openProposal(page);
    const picker = await openPicker(page, scope, "미분류", "오늘의 뉴스");
    await radio(picker, "☁️ aws").click();
    await expect(confirmButton(picker)).toBeEnabled();
    await confirmButton(picker).click();
    await expectPickerClosed(page);
    await expect(linkHandle(scope, "오늘의 뉴스")).toHaveCount(0);
    await backToFolders(page);
    await expect(folderRow(scope, "aws")).toContainText("+3");
    await expect(folderRow(scope, "미분류")).toContainText("+2");
  });

  for (const how of ["취소", "Esc"] as const) {
    test(`choosing another folder and pressing ${how} leaves the link where it was`, async ({
      page,
    }) => {
      test.skip(
        how === "Esc" && !isWideProject(),
        "Esc closes the keyboard dialog on wide screens",
      );
      await setupImportFlow(page);
      const scope = await openProposal(page);
      const picker = await openPicker(page, scope, "미분류", "오늘의 뉴스");
      await radio(picker, "☁️ aws").click();
      if (how === "Esc") {
        await page.keyboard.press("Escape");
      } else {
        await cancelButton(picker).click();
      }
      await expectPickerClosed(page);
      await expect(linkHandle(scope, "오늘의 뉴스")).toBeVisible();
      await backToFolders(page);
      await expect(folderRow(scope, "aws")).toContainText("+2");
    });
  }

  test("+ in 새 폴더 adds a name field; saving and 확인 moves the link into the new folder and adds one new folder", async ({
    page,
  }) => {
    await setupImportFlow(page);
    const scope = await openProposal(page);
    const picker = await openPicker(page, scope, "미분류", "오늘의 뉴스");
    await picker.getByRole("button", { name: "새 폴더에 폴더 추가" }).click();
    const input = picker.getByLabel("새 폴더 이름");
    await expect(input).toBeFocused();
    await expect(picker.getByText("Enter로 저장, Esc로 취소")).toBeVisible();
    await input.fill("인프라");
    await expect(picker.getByText("3/100")).toBeVisible();
    await input.press("Enter");
    await expect(radio(picker, "인프라")).toHaveAttribute("aria-checked", "true");
    await expect(page.getByText("이동할 폴더를 선택해주세요.")).toBeVisible();
    await confirmButton(picker).click();
    await expectPickerClosed(page);
    await expect(summaryValue(scope, "새 폴더")).toContainText("+4");
    await backToFolders(page);
    await expect(folderRow(scope, "새 폴더 인프라")).toContainText("+1");
    await openFolder(scope, "새 폴더 인프라");
    await expect(scope.getByText("폴더 이동에서 새로 만든 폴더예요.")).toBeVisible();
  });

  test("a folder added with + but not used is not created when the picker closes", async ({
    page,
  }) => {
    await setupImportFlow(page);
    const scope = await openProposal(page);
    const picker = await openPicker(page, scope, "미분류", "오늘의 뉴스");
    await picker.getByRole("button", { name: "새 폴더에 폴더 추가" }).click();
    const input = picker.getByLabel("새 폴더 이름");
    await input.fill("안 쓸 폴더");
    await input.press("Enter");
    await expect(radio(picker, "안 쓸 폴더")).toBeVisible();
    await cancelButton(picker).click();
    await expectPickerClosed(page);
    await backToFolders(page);
    await expect(folderRow(scope, "새 폴더 안 쓸 폴더")).toHaveCount(0);
    await expect(summaryValue(scope, "새 폴더")).toContainText("+3");
  });

  test("Esc in the name field cancels only the name, not the picker", async ({ page }) => {
    await setupImportFlow(page);
    const scope = await openProposal(page);
    const picker = await openPicker(page, scope, "미분류", "오늘의 뉴스");
    await picker.getByRole("button", { name: "새 폴더에 폴더 추가" }).click();
    const input = picker.getByLabel("새 폴더 이름");
    await input.fill("취소할 이름");
    await input.press("Escape");
    await expect(input).toHaveCount(0);
    await expect(page.getByText("이동할 폴더를 선택해주세요.")).toBeVisible();
    await expect(radio(picker, "취소할 이름")).toHaveCount(0);
  });

  test("Enter on a shared folder's name keeps the name row open with the text and the reason", async ({
    page,
  }) => {
    await setupImportFlow(page);
    const scope = await openProposal(page);
    const picker = await openPicker(page, scope, "미분류", "오늘의 뉴스");
    await picker.getByRole("button", { name: "새 폴더에 폴더 추가" }).click();
    const input = picker.getByLabel("새 폴더 이름");
    await input.fill("취업");
    await input.press("Enter");
    await expect(input).toBeVisible();
    await expect(input).toHaveValue("취업");
    await expect(input).toBeFocused();
    await expect(picker.getByText("공유 폴더와 같은 이름은 쓸 수 없어요")).toBeVisible();
    await expect(radio(picker, "취업")).toHaveCount(0);

    await input.fill("인프라");
    await input.press("Enter");
    await expect(radio(picker, "인프라")).toHaveAttribute("aria-checked", "true");
  });

  test("pasting past 100 units does not leave half of an emoji in the name", async ({ page }) => {
    await setupImportFlow(page);
    const scope = await openProposal(page);
    const picker = await openPicker(page, scope, "미분류", "오늘의 뉴스");
    await picker.getByRole("button", { name: "새 폴더에 폴더 추가" }).click();
    const input = picker.getByLabel("새 폴더 이름");
    await input.fill(`${"a".repeat(99)}😀b`);
    await expect(input).toHaveValue("a".repeat(99));
    await expect(picker.getByText("99/100")).toBeVisible();
    await input.fill(`${"a".repeat(98)}😀b`);
    await expect(input).toHaveValue(`${"a".repeat(98)}😀`);
    await expect(picker.getByText("100/100")).toBeVisible();
  });

  test("on mobile the proposal keeps its scroll position after the picker opens and closes", async ({
    page,
  }) => {
    test.skip(isWideProject(), "the stacked sheets are a mobile layout");
    await setupImportFlow(page);
    const scope = await openProposal(
      page,
      htmlFile("many.html", makeBookmarkExport({ folders: [{ name: "많은 폴더", count: 60 }] })),
    );
    await openFolder(scope, "새 폴더 많은 폴더");
    const target = linkHandle(scope, "많은 폴더 링크 30");
    await target.scrollIntoViewIfNeeded();
    await expect(target).toBeInViewport();
    const readScroll = () =>
      page.evaluate(() => {
        const nodes = [...document.querySelectorAll("div")].filter(
          (node) => node.scrollHeight > node.clientHeight + 4 && node.scrollTop > 0,
        );
        return nodes.map((node) => Math.round(node.scrollTop));
      });
    const before = await readScroll();
    expect(before.length).toBeGreaterThan(0);
    const boxBefore = await target.boundingBox();

    await target.click();
    await expect(page.getByText("이동할 폴더를 선택해주세요.")).toBeVisible();
    await cancelButton(page).click();
    await expectPickerClosed(page);

    await expect(target).toBeInViewport();
    expect(await readScroll()).toEqual(before);
    const boxAfter = await target.boundingBox();
    expect(Math.abs((boxAfter?.y ?? 0) - (boxBefore?.y ?? 0))).toBeLessThan(2);
  });
});
