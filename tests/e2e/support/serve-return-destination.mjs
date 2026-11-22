import { DEV_AUTH_TOKEN } from "../../../constants/auth.ts";

import { file, serve } from "bun";
import { resolve, sep } from "node:path";

const origin = "http://localhost:8117";
const exportDir = resolve("output/return-destination-web");
const fixturePath = "/__e2e__/return-destination.html";
const fixture = file("tests/e2e/fixtures/return-destination.html");
const emptyList = { isEmpty: true, contents: [], nextCursor: null, hasNext: false };
const pages = new Map([
  ["/", "/index.html"],
  ["/login", "/login.html"],
  ["/home", "/home.html"],
]);

const responses = new Map([
  [
    "/api/users/me",
    {
      id: 1,
      username: "return-check",
      nickname: "복귀 검증",
      role: "USER",
      avatarEmoji: "🌸",
      allowsPrivacy: true,
      allowsAiUsage: true,
    },
  ],
  [
    "/api/users/me/settings",
    {
      display: { theme: "light", accent: "gray" },
      behavior: { allowsReminderNotification: false },
      ai: { defaultProvider: null, defaultModel: null },
      providers: [],
    },
  ],
  ["/api/notifications/unread", { unreadCount: 0 }],
  ["/api/folders", emptyList],
  ["/api/links", emptyList],
  ["/api/todos", emptyList],
]);

function apiResponse(request, pathname) {
  if (request.headers.get("authorization") !== `Bearer ${DEV_AUTH_TOKEN}`) {
    return Response.json(
      { success: false, data: null, error: { code: "AUTH_REFRESH_TOKEN_MISSING" } },
      { status: 401 },
    );
  }
  if (request.method !== "GET" || !responses.has(pathname)) {
    return new Response(null, { status: 404 });
  }
  return Response.json({ success: true, data: responses.get(pathname), error: null });
}

if (!(await file(resolve(exportDir, "login.html")).exists())) {
  throw new Error("Export the verification app to output/return-destination-web first.");
}

serve({
  port: 8117,
  hostname: "localhost",
  async fetch(request) {
    const { pathname } = new URL(request.url);
    if (pathname.startsWith("/api/")) return apiResponse(request, pathname);
    if (pathname === fixturePath) return new Response(fixture);

    const cleanPath = pages.get(pathname) ?? pathname;
    const filePath = resolve(exportDir, "." + cleanPath);
    if (!filePath.startsWith(exportDir + sep)) return new Response(null, { status: 404 });

    const asset = file(filePath);
    return (await asset.exists()) ? new Response(asset) : new Response(null, { status: 404 });
  },
});

console.log(`Return-destination verification server: ${origin}${fixturePath}`);
