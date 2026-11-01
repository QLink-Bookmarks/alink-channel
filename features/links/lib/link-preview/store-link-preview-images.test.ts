import {
  LINK_PREVIEW_TIME_LIMIT_MS,
  detectImageFormat,
  runBeforeDeadline,
  storeLinkPreviewImages,
} from "./store-link-preview-images";

// A fake `expo-file-system`: downloads come from `mockDownloads` (keyed by URL), and
// the cache is a map of file URIs. `size` can be set separately so the 10MB check
// can be tested without allocating 10MB.
type MockDownload = { header?: number[]; size?: number } | Error | Promise<never>;

const mockDownloads = new Map<string, MockDownload>();
const mockCache = new Map<string, { header: Uint8Array; size: number }>();

jest.mock("expo-file-system", () => {
  class MockFile {
    uri: string;

    constructor(directory: { uri: string }, name: string) {
      this.uri = `${directory.uri}/${name}`;
    }

    get exists() {
      return mockCache.has(this.uri);
    }

    get size() {
      return mockCache.get(this.uri)?.size ?? 0;
    }

    open() {
      const entry = mockCache.get(this.uri);
      return {
        readBytes: (length: number) => (entry?.header ?? new Uint8Array()).slice(0, length),
        close: () => {},
      };
    }

    delete() {
      mockCache.delete(this.uri);
    }

    static downloadFileAsync = jest.fn(async (url: string, destination: MockFile) => {
      const download = mockDownloads.get(url);
      if (!download) throw new Error(`UnableToDownload: 404 ${url}`);
      if (download instanceof Error) throw download;
      if (download instanceof Promise) return download;
      const header = new Uint8Array(download.header ?? []);
      mockCache.set(destination.uri, { header, size: download.size ?? header.length });
      return destination;
    });
  }
  return { File: MockFile, Paths: { cache: { uri: "file:///cache" } } };
});

const JPEG = [0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1];
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d];
const GIF = [0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 1, 0, 1, 0, 0, 0];
const WEBP = [0x52, 0x49, 0x46, 0x46, 0x24, 0, 0, 0, 0x57, 0x45, 0x42, 0x50];
const ICO = [0, 0, 1, 0, 1, 0, 0x10, 0x10, 0, 0, 1, 0];
const SVG = Array.from(Buffer.from("<svg xmlns='"));

const PAGE_URL = "https://example.com/post";
const STORED_THUMBNAIL = "https://images.archivelink.app/dev-preview-1.jpg";
const STORED_FAVICON = "https://images.archivelink.app/dev-favicon-1.png";

function setUp({
  candidates,
  uploadThumbnail = jest.fn(async () => STORED_THUMBNAIL),
  storeFavicon = jest.fn(async () => STORED_FAVICON),
  withFavicon = true,
  deadlineAt = Date.now() + LINK_PREVIEW_TIME_LIMIT_MS,
}: {
  candidates: string[];
  uploadThumbnail?: jest.Mock;
  storeFavicon?: jest.Mock;
  withFavicon?: boolean;
  deadlineAt?: number;
}) {
  const run = () =>
    storeLinkPreviewImages({
      pageUrl: PAGE_URL,
      thumbnailCandidates: candidates,
      uploadThumbnail,
      storeFavicon: withFavicon ? storeFavicon : undefined,
      deadlineAt,
    });
  return { run, uploadThumbnail, storeFavicon };
}

beforeEach(() => {
  mockDownloads.clear();
  mockCache.clear();
  jest.useRealTimers();
});

describe("storeLinkPreviewImages", () => {
  it("stores the first main image and never asks for the favicon", async () => {
    mockDownloads.set("https://cdn.example.com/a.jpg", { header: JPEG });
    mockDownloads.set("https://cdn.example.com/b.png", { header: PNG });
    const { run, uploadThumbnail, storeFavicon } = setUp({
      candidates: ["https://cdn.example.com/a.jpg", "https://cdn.example.com/b.png"],
    });

    await expect(run()).resolves.toEqual({ thumbnailUrl: STORED_THUMBNAIL, faviconUrl: null });
    expect(uploadThumbnail).toHaveBeenCalledTimes(1);
    expect(uploadThumbnail).toHaveBeenCalledWith({
      uri: expect.stringMatching(/^file:\/\/\/cache\/link-preview-/),
      name: "preview.jpg",
      type: "image/jpeg",
    });
    expect(storeFavicon).not.toHaveBeenCalled();
  });

  it("asks for the favicon with the link URL only when there are no candidates", async () => {
    const { run, uploadThumbnail, storeFavicon } = setUp({ candidates: [] });

    await expect(run()).resolves.toEqual({ thumbnailUrl: null, faviconUrl: STORED_FAVICON });
    expect(uploadThumbnail).not.toHaveBeenCalled();
    expect(storeFavicon).toHaveBeenCalledWith(PAGE_URL);
  });

  it("asks for the favicon when every candidate failed", async () => {
    mockDownloads.set("https://cdn.example.com/broken.jpg", new Error("UnableToDownload: 500"));
    mockDownloads.set("https://cdn.example.com/icon.ico", { header: ICO });
    const { run, uploadThumbnail, storeFavicon } = setUp({
      candidates: ["https://cdn.example.com/broken.jpg", "https://cdn.example.com/icon.ico"],
    });

    await expect(run()).resolves.toEqual({ thumbnailUrl: null, faviconUrl: STORED_FAVICON });
    expect(uploadThumbnail).not.toHaveBeenCalled();
    expect(storeFavicon).toHaveBeenCalledTimes(1);
  });

  it("moves to the next candidate when the server rejects the format", async () => {
    mockDownloads.set("https://cdn.example.com/a.jpg", { header: JPEG });
    mockDownloads.set("https://cdn.example.com/b.webp", { header: WEBP });
    const uploadThumbnail = jest
      .fn()
      .mockRejectedValueOnce(new Error("400 IMAGE_INVALID_FORMAT"))
      .mockResolvedValueOnce(STORED_THUMBNAIL);
    const { run, storeFavicon } = setUp({
      candidates: ["https://cdn.example.com/a.jpg", "https://cdn.example.com/b.webp"],
      uploadThumbnail,
    });

    await expect(run()).resolves.toEqual({ thumbnailUrl: STORED_THUMBNAIL, faviconUrl: null });
    expect(uploadThumbnail).toHaveBeenCalledTimes(2);
    expect(uploadThumbnail.mock.calls[1][0]).toMatchObject({
      name: "preview.webp",
      type: "image/webp",
    });
    expect(storeFavicon).not.toHaveBeenCalled();
  });

  it("skips files over 10MB and empty files without uploading them", async () => {
    mockDownloads.set("https://cdn.example.com/huge.jpg", {
      header: JPEG,
      size: 10 * 1024 * 1024 + 1,
    });
    mockDownloads.set("https://cdn.example.com/empty.jpg", { header: [], size: 0 });
    mockDownloads.set("https://cdn.example.com/limit.png", {
      header: PNG,
      size: 10 * 1024 * 1024,
    });
    const { run, uploadThumbnail } = setUp({
      candidates: [
        "https://cdn.example.com/huge.jpg",
        "https://cdn.example.com/empty.jpg",
        "https://cdn.example.com/limit.png",
      ],
    });

    await expect(run()).resolves.toEqual({ thumbnailUrl: STORED_THUMBNAIL, faviconUrl: null });
    expect(uploadThumbnail).toHaveBeenCalledTimes(1);
    expect(uploadThumbnail.mock.calls[0][0]).toMatchObject({ type: "image/png" });
  });

  it("skips files whose bytes are not JPEG, PNG, GIF or WEBP, whatever their name", async () => {
    mockDownloads.set("https://cdn.example.com/fake.jpg", { header: SVG });
    mockDownloads.set("https://cdn.example.com/icon.png", { header: ICO });
    mockDownloads.set("https://cdn.example.com/real", { header: GIF });
    const { run, uploadThumbnail } = setUp({
      candidates: [
        "https://cdn.example.com/fake.jpg",
        "https://cdn.example.com/icon.png",
        "https://cdn.example.com/real",
      ],
    });

    await expect(run()).resolves.toEqual({ thumbnailUrl: STORED_THUMBNAIL, faviconUrl: null });
    expect(uploadThumbnail).toHaveBeenCalledTimes(1);
    expect(uploadThumbnail.mock.calls[0][0]).toMatchObject({
      name: "preview.gif",
      type: "image/gif",
    });
  });

  it("deletes every downloaded cache file, uploaded or skipped", async () => {
    mockDownloads.set("https://cdn.example.com/icon.ico", { header: ICO });
    mockDownloads.set("https://cdn.example.com/a.jpg", { header: JPEG });
    const uploadThumbnail = jest.fn(async () => {
      expect(mockCache.size).toBe(1);
      return STORED_THUMBNAIL;
    });
    const { run } = setUp({
      candidates: ["https://cdn.example.com/icon.ico", "https://cdn.example.com/a.jpg"],
      uploadThumbnail,
    });

    await run();
    expect(uploadThumbnail).toHaveBeenCalledTimes(1);
    expect(mockCache.size).toBe(0);
  });

  it("deletes the cache file when the upload fails", async () => {
    mockDownloads.set("https://cdn.example.com/a.jpg", { header: JPEG });
    const { run } = setUp({
      candidates: ["https://cdn.example.com/a.jpg"],
      uploadThumbnail: jest.fn(async () => {
        throw new Error("network");
      }),
      withFavicon: false,
    });

    await expect(run()).resolves.toEqual({ thumbnailUrl: null, faviconUrl: null });
    expect(mockCache.size).toBe(0);
  });

  it("returns no images when the favicon request fails or returns nothing", async () => {
    await expect(
      setUp({ candidates: [], storeFavicon: jest.fn().mockRejectedValue(new Error("500")) }).run(),
    ).resolves.toEqual({ thumbnailUrl: null, faviconUrl: null });
    await expect(
      setUp({ candidates: [], storeFavicon: jest.fn().mockResolvedValue("") }).run(),
    ).resolves.toEqual({ thumbnailUrl: null, faviconUrl: null });
  });

  it("does not ask for the favicon without a favicon function (share sheet)", async () => {
    await expect(setUp({ candidates: [], withFavicon: false }).run()).resolves.toEqual({
      thumbnailUrl: null,
      faviconUrl: null,
    });
  });

  describe("deadline", () => {
    beforeEach(() => {
      jest.useFakeTimers({ now: new Date("2026-11-01T00:00:00Z") });
    });

    it("gives up on a stalled upload at the deadline and skips the favicon", async () => {
      mockDownloads.set("https://cdn.example.com/a.jpg", { header: JPEG });
      let finishUpload: (url: string) => void = () => {};
      const uploadThumbnail = jest.fn(
        () =>
          new Promise<string>((resolve) => {
            finishUpload = resolve;
          }),
      );
      const { run, storeFavicon } = setUp({
        candidates: ["https://cdn.example.com/a.jpg", "https://cdn.example.com/b.jpg"],
        uploadThumbnail,
      });

      const result = run();
      await jest.advanceTimersByTimeAsync(LINK_PREVIEW_TIME_LIMIT_MS);
      await expect(result).resolves.toEqual({ thumbnailUrl: null, faviconUrl: null });
      expect(uploadThumbnail).toHaveBeenCalledTimes(1);
      expect(storeFavicon).not.toHaveBeenCalled();

      // The abandoned upload still cleans up its cache file once it settles.
      expect(mockCache.size).toBe(1);
      finishUpload(STORED_THUMBNAIL);
      await jest.advanceTimersByTimeAsync(0);
      expect(mockCache.size).toBe(0);
    });

    it("gives up on a stalled download at the deadline", async () => {
      mockDownloads.set("https://cdn.example.com/slow.jpg", new Promise<never>(() => {}));
      const { run, storeFavicon } = setUp({ candidates: ["https://cdn.example.com/slow.jpg"] });

      const result = run();
      await jest.advanceTimersByTimeAsync(LINK_PREVIEW_TIME_LIMIT_MS);
      await expect(result).resolves.toEqual({ thumbnailUrl: null, faviconUrl: null });
      expect(storeFavicon).not.toHaveBeenCalled();
    });

    it("keeps the favicon request within the same deadline", async () => {
      const storeFavicon = jest.fn(() => new Promise<string>(() => {}));
      const { run } = setUp({ candidates: [], storeFavicon });

      const result = run();
      await jest.advanceTimersByTimeAsync(LINK_PREVIEW_TIME_LIMIT_MS - 1);
      expect(storeFavicon).toHaveBeenCalledTimes(1);
      await jest.advanceTimersByTimeAsync(1);
      await expect(result).resolves.toEqual({ thumbnailUrl: null, faviconUrl: null });
    });

    it("starts nothing when the deadline has already passed", async () => {
      mockDownloads.set("https://cdn.example.com/a.jpg", { header: JPEG });
      const { run, uploadThumbnail, storeFavicon } = setUp({
        candidates: ["https://cdn.example.com/a.jpg"],
        deadlineAt: Date.now(),
      });

      await expect(run()).resolves.toEqual({ thumbnailUrl: null, faviconUrl: null });
      expect(uploadThumbnail).not.toHaveBeenCalled();
      expect(storeFavicon).not.toHaveBeenCalled();
    });
  });
});

describe("runBeforeDeadline", () => {
  beforeEach(() => {
    jest.useFakeTimers({ now: new Date("2026-11-01T00:00:00Z") });
  });

  it("resolves with the work when it finishes in time", async () => {
    const result = runBeforeDeadline(Promise.resolve("done"), Date.now() + 100);
    await expect(result).resolves.toBe("done");
  });

  it("passes the work's own error through", async () => {
    const result = runBeforeDeadline(Promise.reject(new Error("boom")), Date.now() + 100);
    await expect(result).rejects.toThrow("boom");
  });

  it("rejects at the deadline", async () => {
    const result = runBeforeDeadline(new Promise(() => {}), Date.now() + 100);
    const assertion = expect(result).rejects.toThrow("deadline");
    await jest.advanceTimersByTimeAsync(100);
    await assertion;
  });

  it("rejects right away once the deadline has passed", async () => {
    await expect(runBeforeDeadline(Promise.resolve("late"), Date.now())).rejects.toThrow(
      "deadline",
    );
  });
});

describe("detectImageFormat", () => {
  it.each([
    [JPEG, "jpg", "image/jpeg"],
    [PNG, "png", "image/png"],
    [GIF, "gif", "image/gif"],
    [WEBP, "webp", "image/webp"],
  ])("detects %#", (bytes, extension, mimeType) => {
    expect(detectImageFormat(new Uint8Array(bytes))).toEqual({ extension, mimeType });
  });

  it.each([
    ["ICO", ICO],
    ["SVG", SVG],
    ["RIFF that is not WEBP", [0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x41, 0x56, 0x45]],
    ["truncated WEBP", [0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57]],
    ["empty", []],
  ])("rejects %s", (_name, bytes) => {
    expect(detectImageFormat(new Uint8Array(bytes))).toBeNull();
  });
});
