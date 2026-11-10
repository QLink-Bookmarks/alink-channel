import { registerStartupRefresh, useAuthStore } from "@/stores/auth";
import { useToastStore } from "@/stores/toast-store";

import { apiClient } from "./api-client";

import type { AxiosAdapter, InternalAxiosRequestConfig } from "axios";

jest.mock("@/stores/auth", () => ({
  ...jest.requireActual("@/stores/auth"),
  registerStartupRefresh: jest.fn(),
}));

const startupRefresh = (registerStartupRefresh as jest.Mock).mock.calls[0][0] as () => Promise<
  string | null
>;

type Reply = { status: number; data: unknown };

function respond(config: InternalAxiosRequestConfig, reply: Reply) {
  const response = { data: reply.data, status: reply.status, statusText: "", headers: {}, config };
  if (reply.status >= 400) {
    return Promise.reject(
      Object.assign(new Error(`status ${reply.status}`), {
        isAxiosError: true,
        config,
        response,
      }),
    );
  }
  return Promise.resolve(response);
}

const expired: Reply = {
  status: 401,
  data: { success: false, data: null, error: { code: "AUTH_401_0001", message: "expired" } },
};

function envelope(data: unknown): Reply {
  return { status: 201, data: { success: true, data, error: null } };
}

let calls: { url: string; data: unknown; authorization: unknown }[] = [];

function useServer(
  handler: (url: string, config: InternalAxiosRequestConfig) => Reply | Promise<Reply>,
) {
  const adapter: AxiosAdapter = async (config) => {
    const url = config.url ?? "";
    calls.push({
      url,
      data: config.data === undefined ? undefined : JSON.parse(String(config.data)),
      authorization: config.headers?.Authorization,
    });
    return respond(config, await handler(url, config));
  };
  apiClient.defaults.adapter = adapter;
}

const originalAdapter = apiClient.defaults.adapter;

beforeEach(() => {
  calls = [];
  useAuthStore.setState({ accessToken: "old-access", refreshToken: "old-refresh" });
  useToastStore.setState({ items: [] });
});

afterEach(() => {
  apiClient.defaults.adapter = originalAdapter;
});

describe("apiClient", () => {
  it("sends Alink-Requester: client with every backend request", async () => {
    let sentHeaders: InternalAxiosRequestConfig["headers"] | undefined;

    await apiClient.get("/api/folders", {
      authToken: null,
      adapter: async (config) => {
        sentHeaders = config.headers;
        return { data: {}, status: 200, statusText: "OK", headers: {}, config };
      },
    } as Parameters<typeof apiClient.get>[1]);

    expect(sentHeaders?.get("Alink-Requester")).toBe("client");
  });

  it("on native, applies both rotated tokens after a 401 and retries", async () => {
    useServer((url, config) => {
      if (url.endsWith("/refresh/native")) {
        return envelope({ accessToken: "new-access", refreshToken: "new-refresh" });
      }
      return config.headers?.Authorization === "Bearer new-access"
        ? { status: 200, data: { ok: true } }
        : expired;
    });

    const response = await apiClient.get("/api/folders");

    expect(response.data).toEqual({ ok: true });
    expect(calls.find((call) => call.url.endsWith("/refresh/native"))?.data).toEqual({
      refreshToken: "old-refresh",
    });
    expect(useAuthStore.getState()).toMatchObject({
      accessToken: "new-access",
      refreshToken: "new-refresh",
    });
  });

  it("signs out with a toast when the refresh after a 401 fails", async () => {
    useServer((url) =>
      url.endsWith("/refresh/native")
        ? { status: 401, data: { success: false, data: null, error: { code: "AUTH_REFRESH" } } }
        : expired,
    );

    await expect(apiClient.get("/api/folders")).rejects.toBeTruthy();

    expect(useAuthStore.getState()).toMatchObject({ accessToken: null, refreshToken: null });
    expect(useToastStore.getState().items.map((toast) => toast.title)).toContain(
      "다시 로그인해주세요",
    );
  });
});

describe("startup refresh", () => {
  it("returns the access token without writing it to the store", async () => {
    useAuthStore.setState({ accessToken: null, refreshToken: "old-refresh" });
    useServer(() => envelope({ accessToken: "fresh", refreshToken: "rotated" }));

    await expect(startupRefresh()).resolves.toBe("fresh");

    expect(useAuthStore.getState().accessToken).toBeNull();
  });

  it("resolves to null without a toast or sign-out when the refresh fails", async () => {
    useAuthStore.setState({ accessToken: null, refreshToken: null });
    const signOut = jest.spyOn(useAuthStore.getState(), "signOut");
    useServer(() => ({
      status: 401,
      data: { success: false, data: null, error: { code: "AUTH_REFRESH_TOKEN_MISSING" } },
    }));

    await expect(startupRefresh()).resolves.toBeNull();

    expect(signOut).not.toHaveBeenCalled();
    expect(useToastStore.getState().items).toHaveLength(0);
  });

  it("shares one refresh request with a concurrent 401 caller, which still applies it", async () => {
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    useServer(async (url, config) => {
      if (url.endsWith("/refresh/native")) {
        await gate;
        return envelope({ accessToken: "new-access", refreshToken: "new-refresh" });
      }
      return config.headers?.Authorization === "Bearer new-access"
        ? { status: 200, data: { ok: true } }
        : expired;
    });

    const startup = startupRefresh();
    const request = apiClient.get("/api/folders");
    await new Promise((resolve) => setTimeout(resolve, 0));
    release();

    await expect(startup).resolves.toBe("new-access");
    await expect(request).resolves.toMatchObject({ data: { ok: true } });
    expect(calls.filter((call) => call.url.endsWith("/refresh/native"))).toHaveLength(1);
    expect(useAuthStore.getState()).toMatchObject({
      accessToken: "new-access",
      refreshToken: "new-refresh",
    });
  });
});
