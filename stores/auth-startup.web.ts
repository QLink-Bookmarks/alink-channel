import { hasOauthCallback } from "@/features/auth/lib/oauth-callback";

import type { AuthTokens, StartupRefresh } from "./auth-tokens";

const STARTUP_REFRESH_WAIT_MS = 4000;

function waitAtMost<T>(promise: Promise<T>, fallback: T, ms: number): Promise<T> {
  return new Promise<T>((resolve) => {
    const timer = setTimeout(() => resolve(fallback), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      () => {
        clearTimeout(timer);
        resolve(fallback);
      },
    );
  });
}

async function resolveStartupTokens(
  stored: AuthTokens | null,
  refresher: Promise<StartupRefresh>,
): Promise<AuthTokens | null> {
  if (stored?.accessToken) {
    return { accessToken: stored.accessToken, refreshToken: null };
  }
  if (
    typeof window === "undefined" ||
    (window.location.pathname === "/" && hasOauthCallback(window.location))
  ) {
    return null;
  }
  const accessToken = await waitAtMost(
    refresher.then((refresh) => refresh()),
    null,
    STARTUP_REFRESH_WAIT_MS,
  );
  return accessToken ? { accessToken, refreshToken: null } : null;
}

function shouldRewriteStartupRecord(stored: AuthTokens | null, tokens: AuthTokens | null) {
  if (!tokens) {
    return stored !== null;
  }
  return stored?.accessToken !== tokens.accessToken || stored.refreshToken !== null;
}

function keptRefreshToken(_refreshToken: string | null) {
  return null;
}

function toStoredRecord(tokens: AuthTokens): Partial<AuthTokens> {
  return { accessToken: tokens.accessToken };
}

export {
  STARTUP_REFRESH_WAIT_MS,
  keptRefreshToken,
  resolveStartupTokens,
  shouldRewriteStartupRecord,
  toStoredRecord,
};
