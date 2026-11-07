import type { Page, Route } from "@playwright/test";

import { FOLDER_API_ERROR_CODES } from "../../../features/folders/lib/folder-api-errors";

/**
 * Controlled API responses for web e2e tests. Every request to an `/api/` path on the API
 * host is answered here, so loading, empty, error and broken-image cases are repeatable
 * without a server or an account.
 */

type TodoCounts = { open: number; dueSoon: number; overdue: number; completed: number };

type MockLink = {
  id: number;
  url: string;
  title: string;
  thumbnailUrl: string | null;
  faviconUrl: string | null;
  isVideo: boolean;
  tags: string[];
  status: "G" | "A" | "F" | "C";
  workModel: string | null;
  isFavorite: boolean;
  folderId: number | null;
  folderName: string | null;
  folderEmoji: string | null;
  createdAt: string;
  todoCounts: TodoCounts;
  /** Who put the link in; the signed-in user (1) when omitted. */
  ownerId?: number;
};

type MockDetailTodo = {
  id: number;
  title: string;
  reminderAt: string | null;
  completedAt: string | null;
};

type MockDetail = Omit<MockLink, "todoCounts"> & {
  summary: string | null;
  memo: string | null;
  sourceType: "INPUT" | "QR";
  todos: MockDetailTodo[];
};

type MockTodo = {
  id: number;
  title: string;
  reminderAt: string | null;
  repeatDays?: string[] | null;
  repeatTime?: string | null;
  repeatUntil?: string | null;
  completedAt: string | null;
  /** Answered as `2026-10-29T10:00:00.000Z` when omitted. */
  createdAt?: string;
  linkId: number;
  linkUrl: string;
  linkTitle: string;
  linkThumbnailUrl: string | null;
  linkFaviconUrl: string | null;
};

type MockTodoStatus = "ACTIVE" | "OVERDUE" | "COMPLETED";

/** `GET /api/todos/counts` (#197). */
type TodoStatusCounts = { all: number; active: number; overdue: number; completed: number };

/** A `GET /api/notifications` item. */
type MockNotification = {
  id: number;
  title: string;
  message: string;
  firedAt: string;
  readAt: string | null;
  context: "TODO" | "ANNOUNCE";
  contextId: number;
};

type Handler = (route: Route, request: ReturnType<Route["request"]>) => Promise<unknown> | unknown;

type MockFolder = {
  id: number;
  ownerId: number;
  name: string;
  emoji: string | null;
  isShared: boolean;
  shareCounts: number;
  linkCounts: number;
  /** The signed-in user's links in it. `GET /api/folders` answers `linkCounts` when omitted. */
  myLinkCounts?: number;
};

type MockFolderMember = {
  userId: number;
  role: "OWNER" | "MEMBER";
  userNickname: string;
  avatarEmoji?: string | null;
};

/** `GET /api/folders/{id}/members` data per folder id. */
type MockFolderMembers = {
  ownerId: number;
  ownerNickname: string;
  members: MockFolderMember[];
};

const DEFAULT_FOLDERS: MockFolder[] = [
  { id: 1, ownerId: 1, name: "공부", emoji: "📚", isShared: false, shareCounts: 0, linkCounts: 0 },
  {
    id: 2,
    ownerId: 1,
    name: "가볼 곳",
    emoji: "☕",
    isShared: false,
    shareCounts: 0,
    linkCounts: 0,
  },
  {
    id: 9,
    ownerId: 2,
    name: "캠핑 모임",
    emoji: "🏕️",
    isShared: true,
    shareCounts: 3,
    linkCounts: 0,
  },
];

/** Per-page control of `GET /api/folders`. Page 0 is the first batch (no cursor). */
type FolderPageControl = {
  /** Pages answered with a 500. Mutable through the returned state to recover later. */
  failPages: Set<number>;
  /** Fails every page, as when the network is down. */
  failAll: boolean;
  /** Delay in ms per page before answering. */
  delayMs: Record<number, number>;
};

/** Controls for moving a link (PATCH folderId) and copying it to a personal folder. */
type LinkMutationControl = {
  failMove: boolean;
  failCopy: boolean;
  delayMs: number;
};

type MockApiOptions = {
  links?: MockLink[];
  linkMutations?: Partial<LinkMutationControl>;
  folders?: MockFolder[];
  folderPages?: Partial<FolderPageControl>;
  details?: Record<number, MockDetail>;
  todos?: MockTodo[];
  notifications?: MockNotification[];
  folderMembers?: Record<number, MockFolderMembers>;
  /** Custom handlers checked first, keyed by `METHOD /api/path` (path without query). */
  handlers?: Record<string, Handler>;
};

/** The signed-in user (`GET /api/users/me`). */
const ME_ID = 1;

/** Image hosts used by fixtures. Routed to a real PNG or to a 404. */
const IMAGE_HOST = "https://img.alink.test";
const GOOD_IMAGE = `${IMAGE_HOST}/dev-preview-landscape.png`;
const TALL_IMAGE = `${IMAGE_HOST}/dev-preview-tall.png`;
const GOOD_FAVICON = `${IMAGE_HOST}/dev-favicon-site.png`;
const BROKEN_IMAGE = `${IMAGE_HOST}/dev-preview-broken.png`;
const SLOW_IMAGE = `${IMAGE_HOST}/dev-preview-slow.png`;

const HOUR_MS = 60 * 60 * 1000;

function iso(offsetMs: number) {
  return new Date(Date.now() + offsetMs).toISOString();
}

function envelope(data: unknown) {
  return { success: true, data, error: null };
}

/** Serves the settings endpoint with the given theme and accent. */
function settingsHandler(theme: "light" | "dark", accent: "gray" | "pink" | "blue"): Handler {
  return (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(
        envelope({
          display: { theme, accent },
          behavior: { allowsReminderNotification: false },
          ai: { defaultProvider: null, defaultModel: null },
          providers: [],
        }),
      ),
    });
}

function scroll(contents: unknown[], nextCursor: string | null = null) {
  return envelope({
    isEmpty: contents.length === 0,
    contents,
    nextCursor,
    hasNext: nextCursor != null,
  });
}

/** Slices `items` by the request's offset `cursor` and `size`, as the server's cursor paging. */
function paginate<T>(items: T[], url: URL) {
  const size = Number(url.searchParams.get("size") ?? "0");
  const offset = Number(url.searchParams.get("cursor") ?? "0") || 0;
  if (!(size > 0)) {
    return { contents: items.slice(offset), nextCursor: null, pageIndex: 0 };
  }
  const end = offset + size;
  return {
    contents: items.slice(offset, end),
    nextCursor: end < items.length ? String(end) : null,
    pageIndex: Math.floor(offset / size),
  };
}

/** `count` folders, newest first: ids count..1, every `sharedEvery`-th one shared. */
function makeFolders(count: number, sharedEvery = 0): MockFolder[] {
  return Array.from({ length: count }, (_, index) => {
    const id = count - index;
    const isShared = sharedEvery > 0 && id % sharedEvery === 0;
    return {
      id,
      ownerId: isShared ? 2 : 1,
      name: `폴더 ${id}`,
      emoji: "📁",
      isShared,
      shareCounts: isShared ? 2 : 0,
      linkCounts: id % 5,
    };
  });
}

function makeLink(overrides: Partial<MockLink> & Pick<MockLink, "id">): MockLink {
  return {
    url: `https://example.com/posts/${overrides.id}`,
    title: `링크 ${overrides.id}`,
    thumbnailUrl: GOOD_IMAGE,
    faviconUrl: null,
    isVideo: false,
    tags: ["태그"],
    status: "A",
    workModel: "gpt-4o-mini",
    isFavorite: false,
    folderId: null,
    folderName: null,
    folderEmoji: null,
    createdAt: "2026-10-29T10:00:00.000Z",
    todoCounts: { open: 0, dueSoon: 0, overdue: 0, completed: 0 },
    ...overrides,
  };
}

function makeDetail(link: MockLink, overrides: Partial<MockDetail> = {}): MockDetail {
  const { todoCounts: _todoCounts, ...rest } = link;
  return {
    ...rest,
    summary: "요약 문장",
    memo: null,
    sourceType: "INPUT",
    todos: [],
    ...overrides,
  };
}

// Tiny solid PNGs: a 16:9 landscape, a 9:16 portrait and a square favicon.
const PNG_LANDSCAPE = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAABAAAAAJCAIAAAC0SDtlAAAAFElEQVR4nGNwa9pCEmIY1TAoNAAA6nLVwY418uoAAAAASUVORK5CYII=",
  "base64",
);
const PNG_TALL = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAkAAAAQCAIAAABLKsIUAAAAE0lEQVR4nGM4EVWBCzGMyg16OQAGluahKo5+VwAAAABJRU5ErkJggg==",
  "base64",
);
const PNG_SQUARE = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAEUlEQVR4nGP4sEADK2IYWhIALU1uAezSWmMAAAAASUVORK5CYII=",
  "base64",
);

async function routeImages(page: Page) {
  await page.route(`${IMAGE_HOST}/**`, async (route) => {
    const url = route.request().url();
    if (url === BROKEN_IMAGE) {
      await route.fulfill({ status: 404, body: "not found" });
      return;
    }
    if (url === SLOW_IMAGE) {
      // Never answers within the test: the image stays loading.
      await new Promise((resolve) => setTimeout(resolve, 30_000));
      await route
        .fulfill({ status: 200, contentType: "image/png", body: PNG_LANDSCAPE })
        .catch(() => {});
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "image/png",
      body: url === TALL_IMAGE ? PNG_TALL : url === GOOD_FAVICON ? PNG_SQUARE : PNG_LANDSCAPE,
    });
  });
}

/** Same rule as the server (#134): open includes due-soon (within 24 hours) and overdue. */
function countTodos(
  todos: { reminderAt: string | null; completedAt: string | null }[],
): TodoCounts {
  const now = Date.now();
  const counts: TodoCounts = { open: 0, dueSoon: 0, overdue: 0, completed: 0 };
  for (const todo of todos) {
    if (todo.completedAt) {
      counts.completed += 1;
      continue;
    }
    counts.open += 1;
    if (!todo.reminderAt) continue;
    const at = new Date(todo.reminderAt).getTime();
    if (at < now) counts.overdue += 1;
    else if (at < now + 24 * HOUR_MS) counts.dueSoon += 1;
  }
  return counts;
}

function filterLinks(links: MockLink[], url: URL) {
  let result = links;
  const folderId = url.searchParams.get("folderId");
  if (folderId != null) {
    result = result.filter((link) => String(link.folderId ?? 0) === folderId);
  }
  if (url.searchParams.get("isFavorite") === "true") {
    result = result.filter((link) => link.isFavorite);
  }
  return result;
}

const LEGACY_ORDERS: Record<string, { key: string; direction: "asc" | "desc" }> = {
  latest: { key: "created_at", direction: "desc" },
  earliest: { key: "created_at", direction: "asc" },
  laxico: { key: "title", direction: "asc" },
  similar: { key: "similarity", direction: "desc" },
};

/**
 * The sort a list request asks for, as #197: `orderKey` + `order` (`asc`·`desc`), the old single
 * `order` value only without `orderKey`, and per-criterion default directions. Null when the
 * request is a `COMMON_INVALID_SORT_ORDER` (400).
 */
function readListSort(
  url: URL,
  defaults: {
    key: string;
    directions: Record<string, "asc" | "desc">;
    /** The old single values this list still takes; the link ones when omitted. */
    legacy?: Record<string, { key: string; direction: "asc" | "desc" }>;
  },
): { key: string; direction: "asc" | "desc" } | null {
  const orderKey = url.searchParams.get("orderKey")?.toLowerCase() ?? null;
  const order = url.searchParams.get("order")?.toLowerCase() ?? null;
  const isDirection = (value: string | null): value is "asc" | "desc" =>
    value === "asc" || value === "desc";
  if (orderKey == null) {
    if (order == null) return { key: defaults.key, direction: defaults.directions[defaults.key] };
    if (isDirection(order)) return { key: defaults.key, direction: order };
    return (defaults.legacy ?? LEGACY_ORDERS)[order] ?? null;
  }
  if (!(orderKey in defaults.directions)) return null;
  if (order == null) return { key: orderKey, direction: defaults.directions[orderKey] };
  return isDirection(order) ? { key: orderKey, direction: order } : null;
}

const LINK_SORT_DEFAULTS = {
  key: "created_at",
  directions: { created_at: "desc", title: "asc", similarity: "desc" } as Record<
    string,
    "asc" | "desc"
  >,
};

/** Sorts links as the server; equal values keep the fixture order. */
function compareLinks(sort: { key: string; direction: "asc" | "desc" }) {
  const sign = sort.direction === "asc" ? 1 : -1;
  return (a: MockLink, b: MockLink) => {
    if (sort.key === "title") return sign * a.title.localeCompare(b.title, "ko");
    if (sort.key === "created_at") return sign * a.createdAt.localeCompare(b.createdAt);
    return 0;
  };
}

/** #201: folders keep fixture order (newest first), so only the request is checked. */
const FOLDER_SORT_DEFAULTS = {
  key: "created_at",
  directions: { created_at: "desc", name: "asc", similarity: "desc" } as Record<
    string,
    "asc" | "desc"
  >,
  legacy: {
    latest: { key: "created_at", direction: "desc" },
    earliest: { key: "created_at", direction: "asc" },
    laxico: { key: "name", direction: "asc" },
    similar: { key: "similarity", direction: "desc" },
  } as Record<string, { key: string; direction: "asc" | "desc" }>,
};

const POST_SORT_DEFAULTS = {
  key: "created_at",
  directions: { created_at: "desc" } as Record<string, "asc" | "desc">,
  legacy: { latest: { key: "created_at", direction: "desc" } } as Record<
    string,
    { key: string; direction: "asc" | "desc" }
  >,
};

const NOTIFICATION_SORT_DEFAULTS = {
  key: "created_at",
  directions: { created_at: "desc", fired_at: "desc" } as Record<string, "asc" | "desc">,
  legacy: POST_SORT_DEFAULTS.legacy,
};

/** Sorts notifications as the server: `created_at` is id order, `fired_at` ties go by id. */
function compareNotifications(sort: { key: string; direction: "asc" | "desc" }) {
  const sign = sort.direction === "asc" ? 1 : -1;
  return (a: MockNotification, b: MockNotification) =>
    (sort.key === "fired_at"
      ? sign * (new Date(a.firedAt).getTime() - new Date(b.firedAt).getTime())
      : 0) || sign * (a.id - b.id);
}

const DEFAULT_TODO_CREATED_AT = "2026-10-29T10:00:00.000Z";

/** #197: done → COMPLETED, not done with a reminder already past → OVERDUE, else ACTIVE. */
function todoStatusOf(todo: { reminderAt: string | null; completedAt: string | null }) {
  if (todo.completedAt) return "COMPLETED" as MockTodoStatus;
  if (todo.reminderAt && new Date(todo.reminderAt).getTime() < Date.now()) {
    return "OVERDUE" as MockTodoStatus;
  }
  return "ACTIVE" as MockTodoStatus;
}

function countTodoStatuses(todos: MockTodo[]): TodoStatusCounts {
  const counts: TodoStatusCounts = { all: todos.length, active: 0, overdue: 0, completed: 0 };
  for (const todo of todos) {
    const status = todoStatusOf(todo);
    if (status === "COMPLETED") counts.completed += 1;
    else if (status === "OVERDUE") counts.overdue += 1;
    else counts.active += 1;
  }
  return counts;
}

const TODO_SORT_DEFAULTS = {
  key: "created_at",
  directions: { reminder_at: "asc", created_at: "desc", completed_at: "desc" } as Record<
    string,
    "asc" | "desc"
  >,
};

/**
 * Sorts todos as the server: `created_at` is id order, and a missing reminder / completion goes
 * last either way.
 */
function compareTodos(sort: { key: string; direction: "asc" | "desc" }) {
  const sign = sort.direction === "asc" ? 1 : -1;
  if (sort.key === "created_at") {
    return (a: MockTodo, b: MockTodo) => sign * (a.id - b.id);
  }
  const valueOf = (todo: MockTodo) =>
    sort.key === "reminder_at" ? todo.reminderAt : todo.completedAt;
  return (a: MockTodo, b: MockTodo) => {
    const left = valueOf(a);
    const right = valueOf(b);
    if (left == null || right == null) return left == null ? (right == null ? 0 : 1) : -1;
    return sign * (new Date(left).getTime() - new Date(right).getTime());
  };
}

/**
 * Signs the page in with a fake token and answers the API. Returns the mutable state, so a
 * test can change server data between requests (e.g. after a todo is completed).
 */
async function mockApi(page: Page, options: MockApiOptions = {}) {
  const state = {
    links: options.links ?? [],
    details: options.details ?? {},
    todos: options.todos ?? [],
    notifications: options.notifications ?? [],
    folders: options.folders ?? DEFAULT_FOLDERS,
    folderMembers: options.folderMembers ?? {},
    folderPages: {
      failPages: new Set<number>(),
      failAll: false,
      delayMs: {},
      ...options.folderPages,
    } as FolderPageControl,
    linkMutations: {
      failMove: false,
      failCopy: false,
      delayMs: 0,
      ...options.linkMutations,
    } as LinkMutationControl,
    requests: [] as { method: string; path: string; search: string; body: unknown }[],
  };

  const shiftFolderCount = (folderId: number | null | undefined, delta: number) => {
    if (folderId == null) return;
    state.folders = state.folders.map((folder) =>
      folder.id === folderId
        ? { ...folder, linkCounts: Math.max(0, folder.linkCounts + delta) }
        : folder,
    );
  };
  const waitForLinkMutation = async () => {
    if (state.linkMutations.delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, state.linkMutations.delayMs));
    }
  };

  const placeLink = (link: MockLink, folderId: number | null): MockLink => {
    const folder = state.folders.find((item) => item.id === folderId);
    return {
      ...link,
      folderId: folder ? folder.id : null,
      folderName: folder?.name ?? null,
      folderEmoji: folder?.emoji ?? null,
    };
  };
  const removeLinks = (ids: Set<number>) => {
    state.links = state.links.filter((link) => !ids.has(link.id));
    for (const id of ids) delete state.details[id];
    state.todos = state.todos.filter((todo) => !ids.has(todo.linkId));
  };
  /** `DELETE /api/folders/{id}` as #165: detach, `move` (own links) or `cascade`. */
  const deleteFolder = (id: number, onDelete: string | null, targetId: number | null) => {
    const folder = state.folders.find((item) => item.id === id);
    if (!folder) return;
    const inFolder = state.links.filter((link) => link.folderId === id);
    const isMine = (link: MockLink) => (link.ownerId ?? ME_ID) === ME_ID;
    const deleted = new Set<number>();
    if (onDelete === "cascade") {
      for (const link of inFolder) {
        if (folder.isShared || isMine(link)) deleted.add(link.id);
      }
    }
    let movedCount = 0;
    state.links = state.links.map((link) => {
      if (link.folderId !== id || deleted.has(link.id)) return link;
      const isMoved = onDelete === "move" && isMine(link);
      if (isMoved) movedCount += 1;
      return placeLink(link, isMoved ? targetId : null);
    });
    for (const [linkId, detail] of Object.entries(state.details)) {
      const link = state.links.find((item) => item.id === Number(linkId));
      if (link && detail.folderId === id) {
        state.details[Number(linkId)] = {
          ...detail,
          folderId: link.folderId,
          folderName: link.folderName,
          folderEmoji: link.folderEmoji,
        };
      }
    }
    removeLinks(deleted);
    state.folders = state.folders.filter((item) => item.id !== id);
    delete state.folderMembers[id];
    state.folders = state.folders.map((item) =>
      item.id === targetId
        ? {
            ...item,
            linkCounts: item.linkCounts + movedCount,
            myLinkCounts: (item.myLinkCounts ?? item.linkCounts) + movedCount,
          }
        : item,
    );
  };
  const errorJson = (code: string, status: number) => ({
    status,
    body: { success: false, data: null, error: { code, message: code } },
  });

  await page.addInitScript(() => {
    window.sessionStorage.setItem(
      "qlink-auth",
      JSON.stringify({ accessToken: "e2e-access-token", refreshToken: "e2e-refresh-token" }),
    );
  });
  await routeImages(page);

  await page.route(
    (url) => url.pathname.startsWith("/api/") && !url.host.startsWith("localhost:80"),
    async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      const method = request.method();
      const path = url.pathname;
      let body: unknown = null;
      try {
        body = request.postDataJSON();
      } catch {
        body = request.postData();
      }
      state.requests.push({ method, path, search: url.search, body });

      const custom = options.handlers?.[`${method} ${path}`];
      if (custom) {
        await custom(route, request);
        return;
      }

      const json = (data: unknown, status = 200) =>
        route.fulfill({ status, contentType: "application/json", body: JSON.stringify(data) });

      if (method === "GET" && path === "/api/users/me") {
        return json(
          envelope({
            id: 1,
            username: "e2e",
            nickname: "테스터",
            role: "USER",
            avatarEmoji: "🌸",
            allowsPrivacy: true,
            allowsAiUsage: true,
          }),
        );
      }
      if (method === "GET" && path === "/api/users/me/settings") {
        return json(
          envelope({
            display: { theme: "light", accent: "gray" },
            behavior: { allowsReminderNotification: false },
            ai: { defaultProvider: null, defaultModel: null },
            providers: [],
          }),
        );
      }
      if (method === "GET" && path === "/api/folders") {
        if (!readListSort(url, FOLDER_SORT_DEFAULTS)) {
          const error = errorJson("COMMON_INVALID_SORT_ORDER", 400);
          return json(error.body, error.status);
        }
        const page = paginate(state.folders, url);
        const delay = state.folderPages.delayMs[page.pageIndex];
        if (delay) {
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
        if (state.folderPages.failAll || state.folderPages.failPages.has(page.pageIndex)) {
          return json({ success: false, data: null, error: { message: "SERVER_ERROR" } }, 500);
        }
        return json(
          scroll(
            page.contents.map((folder) => ({
              ...folder,
              myLinkCounts: folder.myLinkCounts ?? folder.linkCounts,
            })),
            page.nextCursor,
          ),
        );
      }
      const folderMatch = path.match(/^\/api\/folders\/(\d+)$/);
      if (folderMatch && method === "DELETE") {
        const id = Number(folderMatch[1]);
        const folder = state.folders.find((item) => item.id === id);
        // A missing source folder succeeds without option checks (#165 M2).
        if (!folder) return json(envelope(null));
        if (folder.ownerId !== ME_ID) {
          const error = errorJson(FOLDER_API_ERROR_CODES.differentOwner, 403);
          return json(error.body, error.status);
        }
        const onDelete = url.searchParams.get("onDelete")?.toLowerCase() ?? null;
        const targetParam = url.searchParams.get("targetFolderId");
        const targetId = targetParam == null ? null : Number(targetParam);
        if (onDelete === "move") {
          const target = state.folders.find((item) => item.id === targetId);
          if (!target) {
            const error = errorJson(FOLDER_API_ERROR_CODES.deleteTargetNotFound, 404);
            return json(error.body, error.status);
          }
          const targetMembers = state.folderMembers[target.id];
          const canWrite =
            target.ownerId === ME_ID ||
            (target.isShared &&
              (!targetMembers || targetMembers.members.some((member) => member.userId === ME_ID)));
          if (!canWrite) {
            const error = errorJson(FOLDER_API_ERROR_CODES.deleteTargetAccessDenied, 403);
            return json(error.body, error.status);
          }
        }
        deleteFolder(id, onDelete, targetId);
        return json(envelope(null));
      }
      const membersMatch = path.match(/^\/api\/folders\/(\d+)\/members$/);
      if (membersMatch && method === "GET") {
        const id = Number(membersMatch[1]);
        const members = state.folderMembers[id];
        if (!members) {
          const error = errorJson(FOLDER_API_ERROR_CODES.folderNotFound, 404);
          return json(error.body, error.status);
        }
        return json(envelope(members));
      }
      const memberMatch = path.match(/^\/api\/folders\/(\d+)\/members\/(\d+)$/);
      if (memberMatch && method === "DELETE") {
        const id = Number(memberMatch[1]);
        const memberId = Number(memberMatch[2]);
        const folder = state.folders.find((item) => item.id === id);
        if (!folder) {
          const error = errorJson(FOLDER_API_ERROR_CODES.folderNotFound, 404);
          return json(error.body, error.status);
        }
        if (memberId === ME_ID && folder.ownerId === ME_ID) {
          const error = errorJson(FOLDER_API_ERROR_CODES.ownerCannotLeave, 422);
          return json(error.body, error.status);
        }
        const members = state.folderMembers[id];
        if (members) {
          members.members = members.members.filter((member) => member.userId !== memberId);
        }
        if (memberId === ME_ID) {
          state.folders = state.folders.filter((item) => item.id !== id);
        }
        return json(envelope(null));
      }
      const ownerMatch = path.match(/^\/api\/folders\/(\d+)\/owner$/);
      if (ownerMatch && method === "PUT") {
        const id = Number(ownerMatch[1]);
        const nextOwnerId = (body as { ownerId?: number } | null)?.ownerId;
        const folder = state.folders.find((item) => item.id === id);
        if (!folder) {
          const error = errorJson(FOLDER_API_ERROR_CODES.transferFolderNotFound, 404);
          return json(error.body, error.status);
        }
        if (folder.ownerId !== ME_ID) {
          const error = errorJson(FOLDER_API_ERROR_CODES.differentOwner, 403);
          return json(error.body, error.status);
        }
        const members = state.folderMembers[id];
        const nextOwner = members?.members.find((member) => member.userId === nextOwnerId);
        if (!members || !nextOwner) {
          const error = errorJson(FOLDER_API_ERROR_CODES.transferMemberNotFound, 404);
          return json(error.body, error.status);
        }
        state.folderMembers[id] = {
          ownerId: nextOwner.userId,
          ownerNickname: nextOwner.userNickname,
          members: members.members
            .filter((member) => member.userId !== ME_ID)
            .map((member) =>
              member.userId === nextOwner.userId ? { ...member, role: "OWNER" } : member,
            ),
        };
        state.folders = state.folders.filter((item) => item.id !== id);
        return json(envelope(null));
      }
      if (method === "POST" && path === "/api/folders") {
        const payload = (body ?? {}) as {
          name?: string;
          emoji?: string | null;
          isShared?: boolean;
        };
        const id = Math.max(0, ...state.folders.map((folder) => folder.id)) + 1;
        state.folders = [
          {
            id,
            ownerId: 1,
            name: payload.name ?? `폴더 ${id}`,
            emoji: payload.emoji ?? null,
            isShared: Boolean(payload.isShared),
            shareCounts: payload.isShared ? 1 : 0,
            linkCounts: 0,
          },
          ...state.folders,
        ];
        return json(envelope({ id }), 201);
      }
      if (method === "GET" && path === "/api/notifications/unread") {
        return json(envelope({ unreadCount: 0 }));
      }
      if (method === "GET" && path === "/api/notifications") {
        const sort = readListSort(url, NOTIFICATION_SORT_DEFAULTS);
        if (!sort) {
          const error = errorJson("COMMON_INVALID_SORT_ORDER", 400);
          return json(error.body, error.status);
        }
        const type = url.searchParams.get("type");
        const items = type
          ? state.notifications.filter((item) => item.context === type)
          : state.notifications;
        const page = paginate([...items].sort(compareNotifications(sort)), url);
        return json(scroll(page.contents, page.nextCursor));
      }
      if (method === "GET" && path === "/api/posts") {
        if (!readListSort(url, POST_SORT_DEFAULTS)) {
          const error = errorJson("COMMON_INVALID_SORT_ORDER", 400);
          return json(error.body, error.status);
        }
        return json(scroll([]));
      }
      if (method === "GET" && path === "/api/links") {
        const sort = readListSort(url, LINK_SORT_DEFAULTS);
        if (!sort) {
          const error = errorJson("COMMON_INVALID_SORT_ORDER", 400);
          return json(error.body, error.status);
        }
        const sorted = [...filterLinks(state.links, url)].sort(compareLinks(sort));
        const page = paginate(sorted, url);
        return json(scroll(page.contents, page.nextCursor));
      }
      if (method === "POST" && path === "/api/links") {
        const payload = (body ?? {}) as { url?: string; title?: string; folderId?: number | null };
        const id = Math.max(0, ...state.links.map((link) => link.id)) + 1;
        const link = placeLink(
          makeLink({
            id,
            url: payload.url ?? `https://example.com/posts/${id}`,
            title: payload.title ?? `링크 ${id}`,
            createdAt: new Date().toISOString(),
          }),
          payload.folderId ?? null,
        );
        state.links = [link, ...state.links];
        state.details[id] = makeDetail(link);
        shiftFolderCount(link.folderId, 1);
        return json(envelope({ id }), 201);
      }
      const detailMatch = path.match(/^\/api\/links\/(\d+)$/);
      if (detailMatch) {
        const id = Number(detailMatch[1]);
        const detail = state.details[id];
        if (method === "GET") {
          if (!detail) {
            return json(
              {
                success: false,
                data: null,
                error: { code: "LINK_404_0001", message: "LINK_NOT_FOUND" },
              },
              404,
            );
          }
          return json(envelope(detail));
        }
        if (method === "DELETE") {
          delete state.details[id];
          state.links = state.links.filter((link) => link.id !== id);
          return json(envelope(null));
        }
        if (method === "PATCH") {
          const payload = body as { folderId?: number | null };
          const current = detail ?? state.links.find((link) => link.id === id);
          if (payload && payload.folderId != null) {
            await waitForLinkMutation();
            if (state.linkMutations.failMove) {
              return json({ success: false, data: null, error: { message: "SERVER_ERROR" } }, 500);
            }
            const targetId = payload.folderId === 0 ? null : payload.folderId;
            const folder = state.folders.find((item) => item.id === targetId);
            const moved = {
              folderId: targetId,
              folderName: folder?.name ?? null,
              folderEmoji: folder?.emoji ?? null,
            };
            if (current && current.folderId !== moved.folderId) {
              shiftFolderCount(current.folderId, -1);
              shiftFolderCount(moved.folderId, 1);
            }
            if (detail) {
              state.details[id] = { ...detail, ...moved };
            }
            state.links = state.links.map((link) =>
              link.id === id ? { ...link, ...moved } : link,
            );
          }
          return json(envelope(state.details[id] ?? null));
        }
        if (method === "PUT" && detail) {
          const payload = body as Partial<MockDetail>;
          // PUT is a full replace (#134): omitted preview fields are cleared.
          const next: MockDetail = {
            ...detail,
            ...payload,
            thumbnailUrl: payload.thumbnailUrl ?? null,
            faviconUrl: payload.faviconUrl ?? null,
            isVideo: payload.isVideo ?? false,
          };
          state.details[id] = next;
          state.links = state.links.map((link) =>
            link.id === id
              ? {
                  ...link,
                  title: next.title,
                  tags: next.tags,
                  thumbnailUrl: next.thumbnailUrl,
                  faviconUrl: next.faviconUrl,
                  isVideo: next.isVideo,
                }
              : link,
          );
          // The PUT response does not echo the preview fields (#134).
          const { thumbnailUrl: _t, faviconUrl: _f, isVideo: _v, ...echo } = next;
          return json(envelope(echo));
        }
      }
      const copyMatch = path.match(/^\/api\/links\/(\d+)\/copy$/);
      if (copyMatch && method === "POST") {
        await waitForLinkMutation();
        if (state.linkMutations.failCopy) {
          return json({ success: false, data: null, error: { message: "SERVER_ERROR" } }, 500);
        }
        const sourceId = Number(copyMatch[1]);
        const source = state.links.find((link) => link.id === sourceId);
        const toFolderId = (body as { toFolderId?: number | null })?.toFolderId ?? null;
        const folder = state.folders.find((item) => item.id === toFolderId);
        const newId = Math.max(0, ...state.links.map((link) => link.id)) + 1;
        if (source) {
          state.links = [
            {
              ...source,
              id: newId,
              folderId: toFolderId,
              folderName: folder?.name ?? null,
              folderEmoji: folder?.emoji ?? null,
            },
            ...state.links,
          ];
        }
        shiftFolderCount(toFolderId, 1);
        return json(envelope({ id: newId }), 201);
      }
      const favoriteMatch = path.match(/^\/api\/links\/(\d+)\/favorite$/);
      if (favoriteMatch && method === "PUT") {
        const id = Number(favoriteMatch[1]);
        const next = Boolean((body as { isFavorite?: boolean })?.isFavorite);
        state.links = state.links.map((link) =>
          link.id === id ? { ...link, isFavorite: next } : link,
        );
        if (state.details[id]) {
          state.details[id] = { ...state.details[id], isFavorite: next };
        }
        return json(envelope(null));
      }
      if (method === "GET" && path === "/api/todos/counts") {
        return json(envelope(countTodoStatuses(state.todos)));
      }
      if (method === "GET" && path === "/api/todos") {
        const isCompleted = url.searchParams.get("isCompleted");
        const status = url.searchParams.get("status")?.toUpperCase() ?? null;
        const isKnownStatus = status === "ACTIVE" || status === "OVERDUE" || status === "COMPLETED";
        if (
          (status != null && !isKnownStatus) ||
          (status != null && (isCompleted != null || url.searchParams.has("reminderAt")))
        ) {
          const error = errorJson("COMMON_INVALID_FILTER", 400);
          return json(error.body, error.status);
        }
        const sort = readListSort(url, TODO_SORT_DEFAULTS);
        if (!sort) {
          const error = errorJson("COMMON_INVALID_SORT_ORDER", 400);
          return json(error.body, error.status);
        }
        const todos = state.todos
          .filter(
            (todo) => isCompleted == null || Boolean(todo.completedAt) === (isCompleted === "true"),
          )
          .filter((todo) => status == null || todoStatusOf(todo) === status)
          .sort(compareTodos(sort))
          .map((todo) => ({
            ...todo,
            createdAt: todo.createdAt ?? DEFAULT_TODO_CREATED_AT,
            status: todoStatusOf(todo),
          }));
        return json(scroll(todos));
      }
      const completeMatch = path.match(/^\/api\/todos\/(\d+)\/completed$/);
      if (completeMatch && method === "PUT") {
        const id = Number(completeMatch[1]);
        const done = Boolean((body as { isCompleted?: boolean })?.isCompleted);
        const completedAt = done ? new Date().toISOString() : null;
        state.todos = state.todos.map((todo) => (todo.id === id ? { ...todo, completedAt } : todo));
        for (const detail of Object.values(state.details)) {
          if (!detail.todos.some((todo) => todo.id === id)) continue;
          detail.todos = detail.todos.map((todo) =>
            todo.id === id ? { ...todo, completedAt } : todo,
          );
          state.links = state.links.map((link) =>
            link.id === detail.id ? { ...link, todoCounts: countTodos(detail.todos) } : link,
          );
        }
        return json(envelope({ completeAt: completedAt }));
      }
      return json(envelope(null));
    },
  );

  return state;
}

export {
  BROKEN_IMAGE,
  GOOD_FAVICON,
  ME_ID,
  GOOD_IMAGE,
  HOUR_MS,
  SLOW_IMAGE,
  TALL_IMAGE,
  countTodoStatuses,
  countTodos,
  envelope,
  iso,
  makeDetail,
  makeFolders,
  makeLink,
  mockApi,
  readListSort,
  scroll,
  settingsHandler,
  todoStatusOf,
};
export type {
  FolderPageControl,
  LinkMutationControl,
  MockDetail,
  MockFolder,
  MockFolderMember,
  MockFolderMembers,
  MockLink,
  MockNotification,
  MockTodo,
  MockTodoStatus,
  TodoCounts,
  TodoStatusCounts,
};
