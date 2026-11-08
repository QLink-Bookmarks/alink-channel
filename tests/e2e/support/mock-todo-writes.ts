import type { Page } from "@playwright/test";

import { type MockTodo, countTodos, envelope, type mockApi } from "./mock-api";

type MockState = Awaited<ReturnType<typeof mockApi>>;
type DetailTodo = MockState["details"][number]["todos"][number];

type TodoWriteControl = {
  /** Answers the next writes with a 500 while it returns true. */
  shouldFail: (method: string, path: string) => boolean;
  /** Waits this long before answering each write. */
  delayMs: number;
};

const TODO_PATH = /^\/api\/todos(?:\/(\d+))?$/;

/**
 * `POST /api/todos`, `PUT /api/todos/{id}` and `DELETE /api/todos/{id}` on top of `mockApi`:
 * the link detail's todos and the actions tab follow, and every write is recorded in
 * `state.requests`. Register after `mockApi` so these win.
 */
async function mockTodoWrites(
  page: Page,
  state: MockState,
  control: Partial<TodoWriteControl> = {},
) {
  let nextId = 900;
  const settings: TodoWriteControl = {
    shouldFail: control.shouldFail ?? (() => false),
    delayMs: control.delayMs ?? 0,
  };

  const syncLinkCounts = (linkId: number) => {
    const detail = state.details[linkId];
    if (!detail) return;
    state.links = state.links.map((link) =>
      link.id === linkId ? { ...link, todoCounts: countTodos(detail.todos) } : link,
    );
  };

  await page.route(
    (url) => TODO_PATH.test(url.pathname) && !url.host.startsWith("localhost:80"),
    async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      const method = request.method();
      if (method === "GET" || url.pathname.endsWith("/completed")) {
        await route.fallback();
        return;
      }
      const body = (request.postDataJSON?.() ?? null) as Record<string, unknown> | null;
      state.requests.push({ method, path: url.pathname, search: url.search, body });
      if (settings.delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, settings.delayMs));
      }
      const json = (data: unknown, status = 200) =>
        route.fulfill({ status, contentType: "application/json", body: JSON.stringify(data) });
      if (settings.shouldFail(method, url.pathname)) {
        return json({ success: false, data: null, error: { message: "SERVER_ERROR" } }, 500);
      }

      // Like the server, a one-time reminder that is not ahead is refused on create and update.
      const reminderAt = typeof body?.reminderAt === "string" ? Date.parse(body.reminderAt) : null;
      if (method !== "DELETE" && reminderAt != null && reminderAt <= Date.now()) {
        return json(
          {
            success: false,
            data: null,
            error: { code: "TODO_400_0003", message: "TODO_REMINDER_AT_INVALID" },
          },
          400,
        );
      }
      const id = Number(TODO_PATH.exec(url.pathname)?.[1]);
      if (method === "POST") {
        const payload = body as { linkId: number; title: string } & Partial<DetailTodo>;
        const created = { id: nextId++, completedAt: null, reminderAt: null, ...payload };
        const detail = state.details[payload.linkId];
        if (detail) detail.todos = [...detail.todos, created as DetailTodo];
        const link = state.links.find((item) => item.id === payload.linkId);
        state.todos = [
          ...state.todos,
          {
            ...created,
            linkId: payload.linkId,
            linkUrl: link?.url ?? "",
            linkTitle: link?.title ?? "",
            linkThumbnailUrl: link?.thumbnailUrl ?? null,
            linkFaviconUrl: link?.faviconUrl ?? null,
          } as MockTodo,
        ];
        syncLinkCounts(payload.linkId);
        return json(envelope({ id: created.id }), 201);
      }
      for (const detail of Object.values(state.details)) {
        if (!detail.todos.some((todo) => todo.id === id)) continue;
        detail.todos =
          method === "DELETE"
            ? detail.todos.filter((todo) => todo.id !== id)
            : detail.todos.map((todo) =>
                todo.id === id ? ({ ...todo, ...body } as DetailTodo) : todo,
              );
        syncLinkCounts(detail.id);
      }
      state.todos =
        method === "DELETE"
          ? state.todos.filter((todo) => todo.id !== id)
          : state.todos.map((todo) => (todo.id === id ? ({ ...todo, ...body } as MockTodo) : todo));
      return json(envelope(method === "DELETE" ? null : { id }));
    },
  );

  return settings;
}

export { mockTodoWrites };
export type { TodoWriteControl };
