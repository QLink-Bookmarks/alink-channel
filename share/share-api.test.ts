import { fetchFolders } from "./share-api";

import type { InternalAxiosRequestConfig } from "axios";

const mockSentHeaders: InternalAxiosRequestConfig["headers"][] = [];

jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(async () => JSON.stringify({ accessToken: "token", refreshToken: null })),
  setItemAsync: jest.fn(async () => undefined),
}));

jest.mock("axios", () => {
  const actual = jest.requireActual("axios");
  const create = (config: Record<string, unknown>) =>
    actual.create({
      ...config,
      adapter: async (requestConfig: InternalAxiosRequestConfig) => {
        mockSentHeaders.push(requestConfig.headers);
        return {
          data: { success: true, data: { contents: [], hasNext: false, nextCursor: null } },
          status: 200,
          statusText: "OK",
          headers: {},
          config: requestConfig,
        };
      },
    });
  return { ...actual, __esModule: true, create, default: { ...actual.default, create } };
});

describe("share extension API", () => {
  it("sends Alink-Requester: client with requests to the backend", async () => {
    await fetchFolders();

    expect(mockSentHeaders).toHaveLength(1);
    expect(mockSentHeaders[0].get("Alink-Requester")).toBe("client");
  });
});
