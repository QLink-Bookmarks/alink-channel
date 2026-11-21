import type { Page } from "@playwright/test";

import {
  iso,
  makeDetail,
  makeFolders,
  makeLink,
  mockApi,
  readListSort,
  scroll,
  settingsHandler,
} from "./mock-api";
import { searchLinks } from "./mock-content-search";

const PAGINATION_FOLDER_ID = 1;
const MANY_LINKS_QUERY = "여행 기록";
const OTHER_LINKS_QUERY = "독서 기록";
const BODY_MATCH_TEXT = "본문에서만 여행 기록을 찾았습니다.";

function makePaginationLinks(count = 65) {
  return Array.from({ length: count }, (_, index) => {
    const id = index + 1;
    return makeLink({
      id,
      title: `${id === 1 ? OTHER_LINKS_QUERY : MANY_LINKS_QUERY} ${String(id).padStart(2, "0")}`,
      folderId: PAGINATION_FOLDER_ID,
      folderName: "폴더 1",
      isFavorite: id % 3 === 0,
      createdAt: iso(-id * 60_000),
    });
  });
}

type LinkPageResponse = { fail?: boolean; maxSize?: number };

async function mockLinkPagination(
  page: Page,
  {
    links = makePaginationLinks(),
    respond = () => ({}),
    theme = "light",
  }: {
    links?: ReturnType<typeof makePaginationLinks>;
    respond?: (params: URLSearchParams) => LinkPageResponse | Promise<LinkPageResponse>;
    theme?: "light" | "dark";
  } = {},
) {
  const requests: URLSearchParams[] = [];
  const details = Object.fromEntries(links.map((item) => [item.id, makeDetail(item)]));
  const folders = makeFolders(1).map((folder) => ({ ...folder, linkCounts: links.length }));
  await mockApi(page, {
    links,
    details,
    folders,
    handlers: {
      "GET /api/users/me/settings": settingsHandler(theme, "gray"),
      "GET /api/links": async (route) => {
        const { searchParams: params } = new URL(route.request().url());
        requests.push(params);
        const { fail, maxSize } = await respond(params);
        if (fail) {
          await route.fulfill({
            status: 503,
            json: { success: false, data: null, error: { code: "SERVER_ERROR" } },
          });
          return;
        }

        const sort = readListSort(new URL(route.request().url()), {
          key: "created_at",
          directions: { created_at: "desc", title: "asc", similarity: "desc" },
        }) ?? { key: "created_at", direction: "desc" };
        const filtered = links.filter(
          (item) =>
            (!params.has("folderId") || String(item.folderId) === params.get("folderId")) &&
            (params.get("isFavorite") !== "true" || item.isFavorite),
        );
        const query = params.get("query");
        const ordered = query
          ? searchLinks({ links: filtered, details }, query, {
              sort,
              bodies: { 1: BODY_MATCH_TEXT },
            })
          : [...filtered].sort((a, b) => {
              const direction = sort.direction === "asc" ? 1 : -1;
              return (
                direction *
                (sort.key === "title"
                  ? a.title.localeCompare(b.title, "ko")
                  : a.createdAt.localeCompare(b.createdAt))
              );
            });
        const offset = Number(params.get("cursor")?.replace("page:", "") ?? 0);
        const size = Math.min(maxSize ?? Infinity, Number(params.get("size") ?? 30));
        const end = offset + size;
        await route.fulfill({
          json: scroll(ordered.slice(offset, end), end < ordered.length ? `page:${end}` : null),
        });
      },
    },
  });

  return requests;
}

export {
  BODY_MATCH_TEXT,
  MANY_LINKS_QUERY,
  OTHER_LINKS_QUERY,
  PAGINATION_FOLDER_ID,
  makePaginationLinks,
  mockLinkPagination,
};
