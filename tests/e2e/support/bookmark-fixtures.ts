import { type Locator, type Page, expect } from "@playwright/test";

import { isWideProject } from "./helpers";
import { type MockFolder, type MockLink, mockApi } from "./mock-api";
import { type MockImportApiOptions, createMockImportApi } from "./mock-import-api";

import path from "node:path";

const FIXTURE_DIR = path.resolve("tests/e2e/fixtures/bookmarks");
const BASE_ADD_DATE = 1_600_000_000;

type GeneratedFolder = {
  name: string;
  count: number;
};

type GeneratedExport = {
  unfiled?: number;
  folders?: GeneratedFolder[];
  host?: string;
};

function escapeHtml(text: string) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function linkLine(index: number, host: string, indent: string, title: string) {
  return `${indent}<DT><A HREF="https://${host}/${index}" ADD_DATE="${BASE_ADD_DATE + index}">${escapeHtml(title)}</A>`;
}

function makeBookmarkExport({
  unfiled = 0,
  folders = [],
  host = "bulk.example.com",
}: GeneratedExport) {
  const lines = [
    "<!DOCTYPE NETSCAPE-Bookmark-file-1>",
    '<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">',
    "<TITLE>Bookmarks</TITLE>",
    "<H1>Bookmarks</H1>",
    "<DL><p>",
    `    <DT><H3 ADD_DATE="${BASE_ADD_DATE}" LAST_MODIFIED="0" PERSONAL_TOOLBAR_FOLDER="true">북마크바</H3>`,
    "    <DL><p>",
  ];
  let index = 0;
  for (let i = 0; i < unfiled; i += 1) {
    index += 1;
    lines.push(linkLine(index, host, "        ", `미분류 링크 ${index}`));
  }
  for (const folder of folders) {
    lines.push(
      `        <DT><H3 ADD_DATE="${BASE_ADD_DATE + index}" LAST_MODIFIED="0">${escapeHtml(folder.name)}</H3>`,
      "        <DL><p>",
    );
    for (let i = 0; i < folder.count; i += 1) {
      index += 1;
      lines.push(linkLine(index, host, "            ", `${folder.name} 링크 ${index}`));
    }
    lines.push("        </DL><p>");
  }
  lines.push("    </DL><p>", "</DL><p>");
  return lines.join("\n");
}

function makeLargeBookmarkExport(total: number, perFolder = 1000) {
  const folders: GeneratedFolder[] = [];
  let remaining = total;
  while (remaining > 0) {
    const count = Math.min(perFolder, remaining);
    folders.push({ name: `묶음 ${folders.length + 1}`, count });
    remaining -= count;
  }
  return makeBookmarkExport({ folders });
}

function htmlFile(name: string, html: string) {
  return { name, mimeType: "text/html", buffer: Buffer.from(html, "utf8") };
}

function bookmarkFixture(name: string) {
  return path.join(FIXTURE_DIR, name);
}

const IMPORT_FOLDERS: MockFolder[] = [
  { id: 10, ownerId: 1, name: "aws", emoji: "☁️", isShared: false, shareCounts: 0, linkCounts: 8 },
  {
    id: 11,
    ownerId: 1,
    name: "읽을거리",
    emoji: "📚",
    isShared: false,
    shareCounts: 0,
    linkCounts: 24,
  },
  { id: 12, ownerId: 1, name: "취업", emoji: "💼", isShared: true, shareCounts: 2, linkCounts: 3 },
  {
    id: 13,
    ownerId: 2,
    name: "팀 위키",
    emoji: "📒",
    isShared: true,
    shareCounts: 4,
    linkCounts: 5,
  },
];

const SAVED_URL = "https://saved.example.com/already";
const PROPOSAL_TITLE = "가져올 내용을 확인해 주세요";

type ImportFlowSetup = {
  links?: MockLink[];
  folders?: MockFolder[];
  savedUrls?: string[];
  endpoints?: MockImportApiOptions["endpoints"];
  handlers?: MockImportApiOptions["handlers"];
};

async function setupImportFlow(page: Page, options: ImportFlowSetup = {}) {
  const folders = options.folders ?? IMPORT_FOLDERS;
  const savedUrls = options.savedUrls ?? [SAVED_URL];
  let api: Awaited<ReturnType<typeof mockApi>> | undefined;
  const imports = createMockImportApi({
    folders: () => api?.folders ?? folders,
    links: () => [...(api?.links ?? []), ...savedUrls.map((url) => ({ url }))],
    endpoints: options.endpoints,
    handlers: options.handlers,
  });
  api = await mockApi(page, {
    folders,
    links: options.links ?? [],
    handlers: imports.handlers,
  });
  return { api, imports };
}

function countRequests(api: Awaited<ReturnType<typeof mockApi>>, method: string, pathname: string) {
  return api.requests.filter((request) => request.method === method && request.path === pathname)
    .length;
}

async function openUploadFromHome(page: Page) {
  await page.goto("/home");
  await page.getByRole("button", { name: "브라우저 북마크 가져오기" }).click();
  await expect(page).toHaveURL(/\/settings\/imports$/);
  await expect(
    page.getByText("브라우저에서 북마크를 HTML 파일로 내보낸 다음 올려 주세요."),
  ).toBeVisible();
}

async function chooseFile(
  page: Page,
  file: string | { name: string; mimeType: string; buffer: Buffer },
) {
  await page
    .locator('input[type="file"]')
    .setInputFiles(typeof file === "string" ? bookmarkFixture(file) : file);
}

function proposalScope(page: Page): Locator | Page {
  return isWideProject() ? page.getByRole("dialog", { name: PROPOSAL_TITLE }) : page;
}

async function openProposal(
  page: Page,
  file: string | { name: string; mimeType: string; buffer: Buffer } = "chrome-export.html",
) {
  await openUploadFromHome(page);
  await chooseFile(page, file);
  await expect(page.getByText(PROPOSAL_TITLE)).toBeVisible();
  return proposalScope(page);
}

function folderRow(scope: Locator | Page, name: string | RegExp) {
  return scope.getByRole("button", { name, exact: typeof name === "string" });
}

async function openFolder(scope: Locator | Page, name: string | RegExp) {
  await folderRow(scope, name).click();
}

async function backToFolders(page: Page) {
  if (!isWideProject()) {
    await page.getByRole("button", { name: "폴더 목록으로" }).click();
  }
}

function linkHandle(scope: Locator | Page, title: string) {
  return scope.getByRole("button", { name: `${title} 폴더 옮기기`, exact: true });
}

function linkRemove(scope: Locator | Page, title: string) {
  return scope.getByRole("button", { name: `${title} 가져오지 않기`, exact: true });
}

function summaryValue(scope: Locator | Page, label: string) {
  return scope.getByLabel("가져오기 요약").getByText(label, { exact: true }).locator("xpath=..");
}

export {
  IMPORT_FOLDERS,
  PROPOSAL_TITLE,
  SAVED_URL,
  backToFolders,
  bookmarkFixture,
  chooseFile,
  countRequests,
  folderRow,
  htmlFile,
  linkHandle,
  linkRemove,
  makeBookmarkExport,
  makeLargeBookmarkExport,
  openFolder,
  openProposal,
  openUploadFromHome,
  proposalScope,
  setupImportFlow,
  summaryValue,
};
export type { GeneratedExport, GeneratedFolder, ImportFlowSetup };
