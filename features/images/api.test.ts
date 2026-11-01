import { api } from "@/lib/api-client";

import { storeFavicon, uploadImage } from "./api";

jest.mock("@/lib/api-client", () => ({
  api: {
    post: jest.fn(async () => ({ success: true, data: { url: "https://cdn/x" }, error: null })),
  },
}));

const post = api.post as jest.Mock;

beforeEach(() => {
  post.mockClear();
});

describe("uploadImage", () => {
  it.each(["PROFILE", "POST", "LINK_PREVIEW"] as const)(
    "sends purpose=%s as a query and the file as the multipart `image` part",
    async (purpose) => {
      const file = { uri: "file:///cache/a.jpg", name: "a.jpg", type: "image/jpeg" };
      await uploadImage(file, purpose);

      expect(post).toHaveBeenCalledTimes(1);
      const [path, body, config] = post.mock.calls[0];
      expect(path).toBe("/api/images");
      expect(body).toBeInstanceOf(FormData);
      expect(config.params).toEqual({ purpose });
      expect(config.params).not.toHaveProperty("url");
    },
  );

  it("returns the server envelope", async () => {
    await expect(uploadImage(new Blob(["x"]), "POST")).resolves.toEqual({
      success: true,
      data: { url: "https://cdn/x" },
      error: null,
    });
  });
});

describe("storeFavicon", () => {
  it("sends purpose=FAVICON and the page URL as queries, with no body", async () => {
    await storeFavicon("https://example.com/post?id=1&ref=x");

    expect(post).toHaveBeenCalledTimes(1);
    const [path, body, config] = post.mock.calls[0];
    expect(path).toBe("/api/images");
    expect(body).toBeUndefined();
    // The query object is encoded by axios, so `&` in the page URL stays inside `url`.
    expect(config).toEqual({
      params: { purpose: "FAVICON", url: "https://example.com/post?id=1&ref=x" },
    });
  });
});
