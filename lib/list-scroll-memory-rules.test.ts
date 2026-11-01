import {
  type RestoreFrame,
  ScrollRestorer,
  clampScrollOffset,
  getListFilterKey,
  getListMemoryKey,
  getMaxScrollOffset,
} from "./list-scroll-memory-rules";

function frame(overrides: Partial<RestoreFrame> = {}): RestoreFrame {
  return {
    contentKey: "all",
    isLoading: false,
    hasContent: true,
    contentHeight: 3000,
    viewportHeight: 800,
    bottomInset: 0,
    ...overrides,
  };
}

describe("getListMemoryKey", () => {
  it("separates paths and wide/mobile views", () => {
    expect(getListMemoryKey("/home", "mobile")).not.toBe(getListMemoryKey("/home", "wide"));
    expect(getListMemoryKey("/folders/3", "mobile")).not.toBe(
      getListMemoryKey("/folders/0", "mobile"),
    );
  });

  it("ignores query strings, hashes and trailing slashes", () => {
    const key = getListMemoryKey("/links", "wide");
    expect(getListMemoryKey("/links?linkId=12", "wide")).toBe(key);
    expect(getListMemoryKey("/links/#top", "wide")).toBe(key);
    expect(getListMemoryKey("/links/", "wide")).toBe(key);
  });

  it("keeps filters under the screen key", () => {
    const key = getListMemoryKey("/todos", "mobile");
    expect(getListFilterKey(key, "filter")).not.toBe(getListFilterKey(key, "order"));
    expect(getListFilterKey(key, "filter")).toContain(key);
  });
});

describe("clampScrollOffset", () => {
  it("keeps a reachable offset", () => {
    expect(clampScrollOffset(500, 3000, 800)).toBe(500);
  });

  it("stops at the bottom when the list got shorter", () => {
    expect(getMaxScrollOffset(1500, 800)).toBe(700);
    expect(clampScrollOffset(2000, 1500, 800)).toBe(700);
    expect(clampScrollOffset(2000, 1500, 800, 90)).toBe(790);
  });

  it("never goes above the top", () => {
    expect(clampScrollOffset(400, 500, 800)).toBe(0);
  });
});

describe("ScrollRestorer", () => {
  it("does nothing without a saved position below the top", () => {
    expect(new ScrollRestorer(undefined, "all").next(frame())).toBeNull();
    expect(new ScrollRestorer(0, "all").status).toBe("idle");
    expect(new ScrollRestorer(-47, "all").next(frame())).toBeNull();
  });

  it("waits for the list to load, then restores once", () => {
    const restorer = new ScrollRestorer(1200, "all");
    expect(restorer.next(frame({ isLoading: true }))).toBeNull();
    expect(restorer.next(frame({ contentHeight: 0 }))).toBeNull();
    expect(restorer.status).toBe("pending");

    expect(restorer.next(frame())).toBe(1200);
    expect(restorer.status).toBe("done");
    expect(restorer.next(frame({ contentHeight: 5000 }))).toBeNull();
  });

  it("goes as deep as the list allows and follows the list while it settles", () => {
    const restorer = new ScrollRestorer(2500, "all");
    expect(restorer.next(frame({ contentHeight: 2000 }))).toBe(1200);
    expect(restorer.status).toBe("settling");
    expect(restorer.next(frame({ contentHeight: 2000 }))).toBeNull();
    expect(restorer.next(frame({ contentHeight: 4000 }))).toBe(2500);
    expect(restorer.status).toBe("done");
  });

  it("stops following after the settle time", () => {
    const restorer = new ScrollRestorer(2500, "all");
    restorer.next(frame({ contentHeight: 2000 }));
    restorer.finish();
    expect(restorer.status).toBe("done");
    expect(restorer.next(frame({ contentHeight: 4000 }))).toBeNull();
  });

  it("is cancelled when the user scrolls or pulls first", () => {
    const restorer = new ScrollRestorer(1200, "all");
    restorer.cancel();
    expect(restorer.status).toBe("cancelled");
    expect(restorer.next(frame())).toBeNull();
  });

  it("stays at the top when the list is empty or failed", () => {
    const restorer = new ScrollRestorer(1200, "all");
    expect(restorer.next(frame({ hasContent: false }))).toBeNull();
    expect(restorer.status).toBe("cancelled");
    expect(restorer.next(frame())).toBeNull();
  });

  it("is cancelled when the filter changes before restoring", () => {
    const restorer = new ScrollRestorer(1200, "all");
    expect(restorer.next(frame({ contentKey: "completed" }))).toBeNull();
    expect(restorer.status).toBe("cancelled");
  });

  it("tells its own scroll apart from a user scroll", () => {
    const restorer = new ScrollRestorer(1200, "all");
    expect(restorer.isOwnScroll(0)).toBe(false);
    restorer.next(frame());
    expect(restorer.isOwnScroll(1200)).toBe(true);
    expect(restorer.isOwnScroll(1200.5)).toBe(true);
    expect(restorer.isOwnScroll(900)).toBe(false);
  });
});
