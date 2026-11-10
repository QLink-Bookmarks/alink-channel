import {
  STARTUP_REFRESH_WAIT_MS,
  keptRefreshToken,
  resolveStartupTokens,
  shouldRewriteStartupRecord,
  toStoredRecord,
} from "./auth-startup.web";

const originalLocation = Object.getOwnPropertyDescriptor(window, "location");

function openAt(href: string) {
  Object.defineProperty(window, "location", {
    configurable: true,
    value: new URL(href),
  });
}

function refresherReturning(result: () => Promise<string | null>) {
  const refresh = jest.fn(result);
  return { refresh, refresher: Promise.resolve(refresh) };
}

afterEach(() => {
  jest.useRealTimers();
  if (originalLocation) {
    Object.defineProperty(window, "location", originalLocation);
  }
});

describe("resolveStartupTokens on web", () => {
  it("starts from the stored access token without refreshing", async () => {
    openAt("https://app.test/home");
    const { refresh, refresher } = refresherReturning(() => Promise.resolve("fresh"));

    const tokens = await resolveStartupTokens(
      { accessToken: "stored", refreshToken: "legacy" },
      refresher,
    );

    expect(tokens).toEqual({ accessToken: "stored", refreshToken: null });
    expect(refresh).not.toHaveBeenCalled();
  });

  it("refreshes once through the cookie when no access token is stored", async () => {
    openAt("https://app.test/links/7");
    const { refresh, refresher } = refresherReturning(() => Promise.resolve("fresh"));

    const tokens = await resolveStartupTokens(null, refresher);

    expect(tokens).toEqual({ accessToken: "fresh", refreshToken: null });
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("starts signed out when the refresh fails", async () => {
    openAt("https://app.test/");
    const failed = refresherReturning(() => Promise.resolve(null));
    const rejected = refresherReturning(() => Promise.reject(new Error("offline")));

    await expect(resolveStartupTokens(null, failed.refresher)).resolves.toBeNull();
    await expect(resolveStartupTokens(null, rejected.refresher)).resolves.toBeNull();
  });

  it.each(["https://app.test/?code=abc&state=kakao:1", "https://app.test/#access_token=naver"])(
    "does not refresh on a social login return (%s)",
    async (href) => {
      openAt(href);
      const { refresh, refresher } = refresherReturning(() => Promise.resolve("fresh"));

      await expect(resolveStartupTokens(null, refresher)).resolves.toBeNull();
      expect(refresh).not.toHaveBeenCalled();
    },
  );

  it("stops waiting after the cap and ignores a late success", async () => {
    jest.useFakeTimers();
    openAt("https://app.test/");
    let succeed: (token: string) => void = () => {};
    const { refresher } = refresherReturning(
      () =>
        new Promise<string | null>((resolve) => {
          succeed = resolve;
        }),
    );

    const pending = resolveStartupTokens(null, refresher);
    await jest.advanceTimersByTimeAsync(STARTUP_REFRESH_WAIT_MS);
    await expect(pending).resolves.toBeNull();

    succeed("late");
    await expect(pending).resolves.toBeNull();
  });

  it("waits within the cap for the refresher to be registered", async () => {
    jest.useFakeTimers();
    openAt("https://app.test/");
    let register: (refresh: () => Promise<string | null>) => void = () => {};
    const refresher = new Promise<() => Promise<string | null>>((resolve) => {
      register = resolve;
    });

    const pending = resolveStartupTokens(null, refresher);
    await jest.advanceTimersByTimeAsync(10);
    register(() => Promise.resolve("fresh"));

    await expect(pending).resolves.toEqual({ accessToken: "fresh", refreshToken: null });
  });
});

describe("web token record", () => {
  it("never keeps a refresh token", () => {
    expect(keptRefreshToken("from-body")).toBeNull();
    expect(toStoredRecord({ accessToken: "a", refreshToken: "r" })).toEqual({ accessToken: "a" });
  });

  it("rewrites a legacy record, a refreshed token and a stale refresh-only record", () => {
    const legacy = { accessToken: "a", refreshToken: "r" };
    const clean = { accessToken: "a", refreshToken: null };

    expect(shouldRewriteStartupRecord(legacy, clean)).toBe(true);
    expect(shouldRewriteStartupRecord(null, { accessToken: "fresh", refreshToken: null })).toBe(
      true,
    );
    expect(shouldRewriteStartupRecord({ accessToken: null, refreshToken: "r" }, null)).toBe(true);
    expect(shouldRewriteStartupRecord(clean, clean)).toBe(false);
    expect(shouldRewriteStartupRecord(null, null)).toBe(false);
  });
});
