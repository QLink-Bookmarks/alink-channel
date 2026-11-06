import type { MockDetail, MockLink } from "./mock-api";

/**
 * #58 page-body fields for the controlled API, as plain data. `mockApi` serializes the link
 * and detail objects it is given as they are, so attaching these fields to its input data is
 * enough to put them in the list and detail responses. Search responses (`query`) are
 * answered by `mock-content-search.ts`.
 */

type MatchedField = "TITLE" | "URL" | "TAGS" | "SUMMARY" | "MEMO" | "CONTENT";

type ContentSnippet = { text: string; highlights: { start: number; end: number }[] };

type LinkDetailContent = { excerpt: string | null; isPending: boolean };

type MockContentListFields = {
  contentExcerpt: string | null;
  matchedFields: MatchedField[];
  contentSnippet: ContentSnippet | null;
};

type MockContentLink = MockLink & MockContentListFields;

type MockContentDetail = MockDetail & { content: LinkDetailContent | null };

type MockContentEntry = {
  /** Detail `content`; null = no record (a link saved before the feature). */
  content: LinkDetailContent | null;
  /** The collected body, for the search mock only; never sent to the app. */
  body?: string;
};

/** A 100+ character body: the excerpt is its first 100 UTF-16 units + "…". */
const LONG_BODY =
  "제주 동쪽은 공항에서 출발해 해안도로를 따라 짰다. 첫날은 함덕해수욕장과 김녕 해변을 지나 성산일출봉 근처에서 묵고, 둘째 날 새벽에 일출을 본 뒤 섭지코지와 광치기해변을 걷는다. 마지막 날은 종달리 카페 골목을 들렀다가 공항으로 돌아온다.";

/** A body shorter than 100 characters: the excerpt is its first 30% (rounded down) + "…". */
const SHORT_BODY =
  "협재 해수욕장은 주차장이 넓고 물이 얕다. 썰물 때는 비양도까지 모래톱이 드러난다.";

/** Body of a page that also mentions the search word, for body-only search matches. */
const CAFE_BODY =
  "광치기해변 바로 앞 카페. 성산일출봉이 통유리로 보이는 2층 창가 자리는 오픈 직후가 아니면 앉기 어렵다. 주차는 길 건너 공영주차장을 쓰면 된다. 영업시간은 오전 9시부터 오후 6시까지다.";

/** Body of a page whose title also has the search word. */
const SUNRISE_BODY =
  "성산일출봉은 유네스코 세계자연유산으로 지정된 수성화산체로, 해 뜨는 시각 30분 전부터 입장할 수 있다. 정상까지는 보통 20분이 걸리고 계단이 가파르다. 매표소는 일출 1시간 전에 연다.";

/** The server's excerpt rule (#167): ≥100 chars → first 100 + "…"; shorter → first n*3/10 + "…". */
function excerptOf(body: string): string | null {
  const head =
    body.length >= 100 ? body.slice(0, 100) : body.slice(0, Math.floor((body.length * 3) / 10));
  return head ? `${head}…` : null;
}

const collected = (body: string): MockContentEntry => ({
  content: { excerpt: excerptOf(body), isPending: false },
  body,
});

/** Content states by link id. Ids not listed have no record (`content: null`). */
const CONTENT_BY_LINK_ID: Record<number, MockContentEntry> = {
  /** Long body: 100 chars + "…". */
  1: collected(LONG_BODY),
  /** Short body: 30% + "…". */
  2: collected(SHORT_BODY),
  /** Still collecting. */
  3: { content: { excerpt: null, isPending: true } },
  /** Failed or blocked (login page, missing address, soft 404): no excerpt, not pending. */
  4: { content: { excerpt: null, isPending: false } },
  /** Another collected page, matched by body only in searches. */
  6: collected(CAFE_BODY),
  /** Collected while its AI summary is still being generated. */
  7: collected(LONG_BODY),
  /** Collected, and its title has the search word too. */
  8: collected(SUNRISE_BODY),
};

function contentEntryOf(id: number): MockContentEntry {
  return CONTENT_BY_LINK_ID[id] ?? { content: null };
}

/** List-item fields of a link outside a search: the excerpt, no match information. */
function listFieldsOf(id: number): MockContentListFields {
  const { content } = contentEntryOf(id);
  return {
    contentExcerpt: content && !content.isPending ? content.excerpt : null,
    matchedFields: [],
    contentSnippet: null,
  };
}

/**
 * Attaches the #58 fields to `mockApi` input data: `contentExcerpt`, `matchedFields` and
 * `contentSnippet` to each link, `content` to each detail. Use as
 * `mockApi(page, { ...withContent(links, details) })`.
 */
function withContent(
  links: MockLink[],
  details: Record<number, MockDetail> = {},
): { links: MockContentLink[]; details: Record<number, MockContentDetail> } {
  return {
    links: links.map((link) => ({ ...link, ...listFieldsOf(link.id) })),
    details: Object.fromEntries(
      Object.entries(details).map(([id, detail]) => [
        Number(id),
        { ...detail, content: contentEntryOf(Number(id)).content },
      ]),
    ),
  };
}

export {
  CAFE_BODY,
  CONTENT_BY_LINK_ID,
  LONG_BODY,
  SHORT_BODY,
  SUNRISE_BODY,
  contentEntryOf,
  excerptOf,
  listFieldsOf,
  withContent,
};
export type {
  ContentSnippet,
  LinkDetailContent,
  MatchedField,
  MockContentDetail,
  MockContentEntry,
  MockContentLink,
  MockContentListFields,
};
