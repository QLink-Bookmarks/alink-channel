import { apiClient } from "@/lib/api-client";

import { signOut } from "./api";

import type { AxiosAdapter } from "axios";

const originalAdapter = apiClient.defaults.adapter;
let sentBody: unknown;

beforeEach(() => {
  sentBody = undefined;
  const adapter: AxiosAdapter = async (config) => {
    sentBody = config.data === undefined ? undefined : JSON.parse(String(config.data));
    return {
      data: { success: true, data: null },
      status: 200,
      statusText: "OK",
      headers: {},
      config,
    };
  };
  apiClient.defaults.adapter = adapter;
});

afterEach(() => {
  apiClient.defaults.adapter = originalAdapter;
});

describe("signOut", () => {
  it("sends no refresh token when there is none (web)", async () => {
    await signOut({ refreshToken: null });

    expect(sentBody).toEqual({});
  });

  it("sends the stored refresh token when there is one (native)", async () => {
    await signOut({ refreshToken: "keychain-refresh" });

    expect(sentBody).toEqual({ refreshToken: "keychain-refresh" });
  });
});
