import type { Page, Request, Route } from "@playwright/test";

// Controlled API responses for signed-in web flows. Every `/api/...` request on any
// host is answered here, so the tests never reach a real server. A test can answer
// specific requests itself by passing `handlers`; the first handler that returns
// true wins, the rest fall back to the defaults below.

type ApiCall = {
  route: Route;
  request: Request;
  path: string;
  // Answers with `{ success, data, error }`, or with an error envelope when `status`
  // is 400 or above.
  respond: (data: unknown, status?: number) => Promise<void>;
};

type ApiHandler = (call: ApiCall) => Promise<boolean> | boolean;

const emptyScroll = { isEmpty: true, contents: [], nextCursor: null, hasNext: false };

const aiProviders = [
  {
    providerId: 1,
    providerType: "OPENAI",
    models: [{ id: 10, model: "gpt-test", priority: 1, userProviderId: 5 }],
  },
];

type ApiResponse = { data: unknown; status: number };

function ok(data: unknown, status = 200): ApiResponse {
  return { data, status };
}

// The API runs on another origin, so fulfilled responses need CORS headers that
// allow credentials.
function corsHeaders(request: Request) {
  return {
    "access-control-allow-origin": request.headers()["origin"] ?? "*",
    "access-control-allow-credentials": "true",
    "access-control-allow-headers": "authorization, content-type, csrf_token",
    "access-control-allow-methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  };
}

function fulfill(route: Route, request: Request, { data, status }: ApiResponse) {
  const body =
    status >= 400
      ? { success: false, data: null, error: { code: "TEST_ERROR", message: "test error" } }
      : { success: true, data, error: null };
  return route.fulfill({
    status,
    contentType: "application/json",
    headers: corsHeaders(request),
    body: JSON.stringify(body),
  });
}

function defaultResponse(method: string, path: string): ApiResponse {
  if (path === "/api/users/me") {
    return ok({
      id: 1,
      username: "tester",
      nickname: "테스터",
      role: "NORMAL",
      avatarUrl: null,
      avatarEmoji: "🌸",
      allowsPrivacy: true,
      allowsAiUsage: true,
    });
  }
  if (path === "/api/users/me/settings") {
    return ok({
      display: { theme: "light", accent: "gray" },
      behavior: { allowsReminderNotification: false },
      ai: {
        defaultProvider: { id: 1, type: "OPENAI" },
        defaultModel: { id: 10, model: "gpt-test" },
      },
      providers: [],
    });
  }
  if (path === "/api/notifications/unread") {
    return ok({ unreadCount: 0 });
  }
  if (path === "/api/ai/providers/models") {
    return ok(aiProviders);
  }
  if (method === "GET" && /^\/api\/(links|folders|todos|notifications|posts)$/.test(path)) {
    return ok(emptyScroll);
  }
  if (method === "POST" && path === "/api/links") {
    return ok({ id: 101 }, 201);
  }
  if (method === "PUT" && path === "/api/links/ai") {
    return ok({ id: 102 });
  }
  return ok(null);
}

async function mockSignedInApi(page: Page, handlers: ApiHandler[] = []) {
  await page.addInitScript(() => {
    window.sessionStorage.setItem(
      "qlink-auth",
      JSON.stringify({ accessToken: "test-access-token", refreshToken: "test-refresh-token" }),
    );
  });

  await page.route(
    (url) => url.pathname.startsWith("/api/"),
    async (route, request) => {
      if (request.method() === "OPTIONS") {
        await route.fulfill({ status: 204, headers: corsHeaders(request) });
        return;
      }
      const path = new URL(request.url()).pathname;
      const respond = (data: unknown, status = 200) => fulfill(route, request, { data, status });
      for (const handler of handlers) {
        if (await handler({ route, request, path, respond })) {
          return;
        }
      }
      await fulfill(route, request, defaultResponse(request.method(), path));
    },
  );
}

export { mockSignedInApi };
export type { ApiCall, ApiHandler };
