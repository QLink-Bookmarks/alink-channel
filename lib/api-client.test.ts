import { apiClient } from "./api-client";

import type { InternalAxiosRequestConfig } from "axios";

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
});
