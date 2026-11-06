import type { Page, Route } from "@playwright/test";

import { type MockDetail, type MockLink, envelope } from "./mock-api";
import {
  type ContentSnippet,
  type MatchedField,
  contentEntryOf,
  listFieldsOf,
} from "./mock-content";

/**
 * #58 search responses for the controlled API, built like the server (#167) from the current
 * `mockApi` state, so deletes, favorites and folder moves are reflected:
 * - metadata fields (title, URL, tags, summary, memo) and the collected body are matched as
 *   plain, case-insensitive substrings: `%`, `_` and `\` are literal characters;
 * - a one-character query never searches the body;
 * - links with a metadata match come first, then links whose body alone matched, each group in
 *   the requested order (`latest` | `earliest` | `laxico`), cut to `size`;
 * - every body match carries a context of at most 100 UTF-16 units around the first match
 *   (≤15 before it, "…" on a cut side) with that match highlighted.
 *
 * Register it after `mockApi`: only `GET /api/links` with a `query` is answered here; every
 * other request falls through to `mockApi`.
 */

type SearchState = { links: MockLink[]; details: Record<number, MockDetail> };

type ContentSearchOptions = {
  /** Body overrides by link id; otherwise the body from `mock-content.ts`. */
  bodies?: Record<number, string>;
  /** Contexts the server could not build: the body still matches, the snippet is null. */
  withoutSnippet?: number[];
};

const SNIPPET_MAX = 100;
const SNIPPET_BEFORE_MAX = 15;
const ELLIPSIS = "…";

function snippetAround(body: string, index: number, length: number): ContentSnippet {
  const from = Math.max(0, index - SNIPPET_BEFORE_MAX);
  const head = from > 0 ? ELLIPSIS : "";
  // Room for the window and a trailing "…" when the body goes on.
  let window = body.slice(from, from + SNIPPET_MAX - head.length);
  let tail = "";
  if (from + window.length < body.length) {
    window = window.slice(0, SNIPPET_MAX - head.length - ELLIPSIS.length);
    tail = ELLIPSIS;
  }
  const start = head.length + (index - from);
  return {
    text: `${head}${window}${tail}`,
    highlights: [{ start, end: start + length }],
  };
}

function matchedFieldsOf(
  link: MockLink,
  detail: MockDetail | undefined,
  body: string | undefined,
  query: string,
): MatchedField[] {
  const target = query.toLowerCase();
  const has = (value: string | null | undefined) =>
    value != null && value.toLowerCase().includes(target);
  const fields: MatchedField[] = [];
  if (has(link.title)) fields.push("TITLE");
  if (has(link.url)) fields.push("URL");
  if (link.tags.some(has)) fields.push("TAGS");
  if (has(detail?.summary)) fields.push("SUMMARY");
  if (has(detail?.memo)) fields.push("MEMO");
  if (query.length >= 2 && has(body)) fields.push("CONTENT");
  return fields;
}

/** The search result list for `query`, as the server would send it. */
function searchLinks(
  state: SearchState,
  query: string,
  {
    order = "latest",
    size,
    ...options
  }: ContentSearchOptions & {
    order?: string;
    size?: number;
  } = {},
) {
  const byOrder = (a: MockLink, b: MockLink) =>
    order === "earliest"
      ? a.createdAt.localeCompare(b.createdAt)
      : order === "laxico"
        ? a.title.localeCompare(b.title, "ko")
        : b.createdAt.localeCompare(a.createdAt);
  const meta: unknown[] = [];
  const bodyOnly: unknown[] = [];
  for (const link of [...state.links].sort(byOrder)) {
    const body = options.bodies?.[link.id] ?? contentEntryOf(link.id).body;
    const matchedFields = matchedFieldsOf(link, state.details[link.id], body, query);
    if (matchedFields.length === 0) continue;
    const bodyIndex = body?.toLowerCase().indexOf(query.toLowerCase()) ?? -1;
    const contentSnippet =
      matchedFields.includes("CONTENT") &&
      body &&
      bodyIndex >= 0 &&
      !options.withoutSnippet?.includes(link.id)
        ? snippetAround(body, bodyIndex, query.length)
        : null;
    const item = { ...link, ...listFieldsOf(link.id), matchedFields, contentSnippet };
    if (matchedFields.some((field) => field !== "CONTENT")) {
      meta.push(item);
    } else {
      bodyOnly.push(item);
    }
  }
  const all = [...meta, ...bodyOnly];
  return size != null && size > 0 ? all.slice(0, size) : all;
}

/** Answers `GET /api/links?query=…` from `getState()`; other requests fall through. */
async function mockContentSearch(
  page: Page,
  getState: () => SearchState,
  options: ContentSearchOptions = {},
) {
  const queries: string[] = [];
  await page.route(
    (url) => url.pathname === "/api/links" && url.searchParams.has("query"),
    async (route: Route) => {
      if (route.request().method() !== "GET") {
        await route.fallback();
        return;
      }
      const url = new URL(route.request().url());
      const query = (url.searchParams.get("query") ?? "").trim();
      if (!query) {
        await route.fallback();
        return;
      }
      queries.push(query);
      const contents = searchLinks(getState(), query, {
        ...options,
        order: url.searchParams.get("order") ?? "latest",
        size: Number(url.searchParams.get("size") ?? "0"),
      });
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(
          envelope({ isEmpty: contents.length === 0, contents, nextCursor: null, hasNext: false }),
        ),
      });
    },
  );
  return { queries };
}

export { mockContentSearch, searchLinks, snippetAround };
export type { ContentSearchOptions, SearchState };
