import type { Page, Route } from "@playwright/test";

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
  completedAt: string | null;
  linkId: number;
  linkUrl: string;
  linkTitle: string;
  linkThumbnailUrl: string | null;
  linkFaviconUrl: string | null;
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
  /** Custom handlers checked first, keyed by `METHOD /api/path` (path without query). */
  handlers?: Record<string, Handler>;
};

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

/**
 * Signs the page in with a fake token and answers the API. Returns the mutable state, so a
 * test can change server data between requests (e.g. after a todo is completed).
 */
async function mockApi(page: Page, options: MockApiOptions = {}) {
  const state = {
    links: options.links ?? [],
    details: options.details ?? {},
    todos: options.todos ?? [],
    folders: options.folders ?? DEFAULT_FOLDERS,
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
        const page = paginate(state.folders, url);
        const delay = state.folderPages.delayMs[page.pageIndex];
        if (delay) {
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
        if (state.folderPages.failAll || state.folderPages.failPages.has(page.pageIndex)) {
          return json({ success: false, data: null, error: { message: "SERVER_ERROR" } }, 500);
        }
        return json(scroll(page.contents, page.nextCursor));
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
      if (method === "GET" && (path === "/api/notifications" || path === "/api/posts")) {
        return json(scroll([]));
      }
      if (method === "GET" && path === "/api/links") {
        const page = paginate(filterLinks(state.links, url), url);
        return json(scroll(page.contents, page.nextCursor));
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
      if (method === "GET" && path === "/api/todos") {
        const isCompleted = url.searchParams.get("isCompleted");
        const todos =
          isCompleted == null
            ? state.todos
            : state.todos.filter((todo) => Boolean(todo.completedAt) === (isCompleted === "true"));
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
  GOOD_IMAGE,
  HOUR_MS,
  SLOW_IMAGE,
  TALL_IMAGE,
  countTodos,
  envelope,
  iso,
  makeDetail,
  makeFolders,
  makeLink,
  mockApi,
  scroll,
  settingsHandler,
};
export type {
  FolderPageControl,
  LinkMutationControl,
  MockDetail,
  MockFolder,
  MockLink,
  MockTodo,
  TodoCounts,
};
