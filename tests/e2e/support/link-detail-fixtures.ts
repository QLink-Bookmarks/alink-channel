// #74 link detail fixtures: a full link (image, summary with its model, excerpt, folder, tags,
// memo, a one-time, a repeating and a done action), a bare one, one being summarized, one
// with an overdue action and one with the AI summary only.
import { type Page, expect } from "@playwright/test";

import {
  GOOD_IMAGE,
  HOUR_MS,
  type MockDetail,
  type MockLink,
  type MockTodo,
  countTodos,
  iso,
  makeDetail,
  makeLink,
  mockApi,
  settingsHandler,
} from "./mock-api";
import { type TodoWriteControl, mockTodoWrites } from "./mock-todo-writes";

export type Theme = "light" | "dark";
export type Accent = "gray" | "pink" | "blue";

const DAY_MS = 24 * HOUR_MS;

export const FULL_TODOS = [
  { id: 21, title: "렌터카 예약 확인", reminderAt: iso(13 * DAY_MS), completedAt: null },
  {
    id: 22,
    title: "항공권 가격 확인",
    reminderAt: null,
    repeatDays: ["MON", "THU"],
    repeatTime: "08:00",
    repeatUntil: iso(54 * DAY_MS),
    completedAt: null,
  },
  { id: 23, title: "숙소 2박 결제", reminderAt: null, completedAt: iso(-DAY_MS) },
];

const EXCERPT =
  "제주에 도착해 렌터카를 받기까지 걸리는 시간은 보통 40분 안팎이다. 공항 1층 렌터카 셔틀 정류장에서 업체별 버스를 타면 10분 거리의 하우스까지 데려다 준다. 성수기에는 대기…";

export function buildDetailFixtures() {
  const full = makeLink({
    id: 1,
    url: "https://brunch.co.kr/@jejutrip/142",
    title: "제주 2박 3일 동쪽 일주 코스와 비용 정리",
    thumbnailUrl: GOOD_IMAGE,
    folderId: 2,
    folderName: "가볼 곳",
    folderEmoji: "☕",
    tags: ["제주", "여행코스", "렌터카"],
    workModel: "gemini-2.5-flash",
    todoCounts: countTodos(FULL_TODOS),
  });
  const bare = makeLink({
    id: 2,
    url: "https://www.notion.so/team/onboarding",
    title: "2026 하반기 팀 온보딩 문서",
    thumbnailUrl: null,
    tags: [],
    workModel: null,
    status: "C",
  });
  const progress = makeLink({
    id: 3,
    url: "https://visitjeju.net/kr/detail/view",
    title: "성산일출봉 일출 시간표와 입장 마감 안내",
    thumbnailUrl: null,
    tags: [],
    status: "G",
    workModel: null,
  });
  const overdueTodos = [
    { id: 41, title: "물때 확인", reminderAt: iso(-3 * HOUR_MS), completedAt: null },
    { id: 42, title: "주차장 위치 저장", reminderAt: iso(2 * DAY_MS), completedAt: null },
  ];
  const overdue = makeLink({
    id: 4,
    url: "https://brunch.co.kr/@jejutrip/143",
    title: "협재 해수욕장 주차·물때 정보",
    tags: ["제주"],
    workModel: "claude-sonnet-4",
    todoCounts: countTodos(overdueTodos),
  });
  const aiOnly = makeLink({
    id: 5,
    url: "https://tanstack.com/query/latest/docs",
    title: "React Query v5 마이그레이션 체크리스트",
    tags: ["react", "마이그레이션"],
    workModel: "gpt-4o-mini",
    folderId: 1,
    folderName: "공부",
    folderEmoji: "📚",
  });
  const links: MockLink[] = [full, bare, progress, overdue, aiOnly];
  const details: Record<number, MockDetail> = {
    1: makeDetail(full, {
      summary:
        "제주 동쪽에서 서쪽으로 돌며 성산일출봉·쇠소깍·협재를 묶은 2박 3일 코스와 실제 비용.",
      memo: "연말 연휴에 갈 때 참고.\n둘째 날 숙소는 성산 쪽으로.",
      todos: FULL_TODOS,
      content: { excerpt: EXCERPT, isPending: false },
    } as Partial<MockDetail>),
    2: makeDetail(bare, {
      summary: null,
      content: { excerpt: EXCERPT, isPending: false },
    } as Partial<MockDetail>),
    3: makeDetail(progress, { summary: null }),
    4: makeDetail(overdue, { summary: "물때표 보는 법과 주차장 세 곳.", todos: overdueTodos }),
    5: makeDetail(aiOnly, {
      summary: "v4에서 v5로 옮길 때 바뀌는 이름과 옵션을 한 장으로 정리했다.",
    }),
  };
  // The actions tab lists the full link's actions too.
  const todos: MockTodo[] = FULL_TODOS.map((todo) => ({
    ...todo,
    linkId: full.id,
    linkUrl: full.url,
    linkTitle: full.title,
    linkThumbnailUrl: full.thumbnailUrl,
    linkFaviconUrl: full.faviconUrl,
  }));
  return { links, details, todos };
}

export async function setUpDetail(
  page: Page,
  {
    theme = "light",
    accent = "gray",
    todoWrites,
  }: { theme?: Theme; accent?: Accent; todoWrites?: Partial<TodoWriteControl> } = {},
) {
  const state = await mockApi(page, {
    ...buildDetailFixtures(),
    handlers: { "GET /api/users/me/settings": settingsHandler(theme, accent) },
  });
  const writes = await mockTodoWrites(page, state, todoWrites);
  return { state, writes };
}

export async function openDetailAt(page: Page, id: number, wide: boolean) {
  await page.goto(wide ? `/links?linkId=${id}` : `/links/${id}`);
  await expect(page.getByTestId("link-detail-title")).toBeVisible();
  if (wide) await expect(page.getByTestId("link-detail-close")).toBeInViewport({ ratio: 1 });
}
