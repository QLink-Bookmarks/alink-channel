import { createSharedLink, fetchFolders, requestSharedAiSummary } from "./share-api";

import type { InternalAxiosRequestConfig } from "axios";

const mockSentHeaders: InternalAxiosRequestConfig["headers"][] = [];
const mockSentRequests: InternalAxiosRequestConfig[] = [];

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
        mockSentRequests.push(requestConfig);
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

function lastRequest() {
  const request = mockSentRequests[mockSentRequests.length - 1];
  return {
    method: request.method,
    url: request.url,
    body: JSON.parse(request.data as string) as Record<string, unknown>,
  };
}

describe("share extension API", () => {
  beforeEach(() => {
    mockSentHeaders.length = 0;
    mockSentRequests.length = 0;
  });

  it("sends Alink-Requester: client with requests to the backend", async () => {
    await fetchFolders();

    expect(mockSentHeaders).toHaveLength(1);
    expect(mockSentHeaders[0].get("Alink-Requester")).toBe("client");
  });

  it("saves to 미분류 with a null folder id", async () => {
    await createSharedLink({
      url: "https://jejutrail.kr/a",
      title: "한라산",
      folderId: null,
      thumbnailUrl: null,
    });

    expect(lastRequest()).toEqual({
      method: "post",
      url: "/api/links",
      body: expect.objectContaining({
        url: "https://jejutrail.kr/a",
        title: "한라산",
        folderId: null,
        sourceType: "INPUT",
      }),
    });
  });

  it("saves into the chosen folder", async () => {
    await createSharedLink({
      url: "https://jejutrail.kr/a",
      title: "한라산",
      folderId: 7,
      thumbnailUrl: "https://cdn/t.jpg",
    });

    expect(lastRequest().body).toEqual(
      expect.objectContaining({ folderId: 7, thumbnailUrl: "https://cdn/t.jpg" }),
    );
  });

  it("asks AI to pick the folder when 미분류 and keeps the chosen folder otherwise", async () => {
    await requestSharedAiSummary({
      url: "https://jejutrail.kr/a",
      title: "",
      folderId: null,
      userProviderId: 101,
      modelId: 12,
      generateTodo: true,
      thumbnailUrl: null,
    });
    expect(lastRequest()).toEqual({
      method: "put",
      url: "/api/links/ai",
      body: {
        url: "https://jejutrail.kr/a",
        thumbnailUrl: null,
        title: null,
        folderId: null,
        userProviderId: 101,
        modelId: 12,
        generateTodo: true,
      },
    });

    await requestSharedAiSummary({
      url: "https://jejutrail.kr/a",
      title: "한라산",
      folderId: 7,
      userProviderId: 101,
      modelId: 12,
      generateTodo: false,
      thumbnailUrl: null,
    });
    expect(lastRequest().body).toEqual(
      expect.objectContaining({ folderId: 7, title: "한라산", generateTodo: false }),
    );
  });
});
