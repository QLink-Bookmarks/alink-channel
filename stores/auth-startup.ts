import type { AuthTokens, StartupRefresh } from "./auth-tokens";

async function resolveStartupTokens(
  stored: AuthTokens | null,
  _refresher: Promise<StartupRefresh>,
): Promise<AuthTokens | null> {
  return stored;
}

function shouldRewriteStartupRecord(_stored: AuthTokens | null, _tokens: AuthTokens | null) {
  return false;
}

function keptRefreshToken(refreshToken: string | null) {
  return refreshToken;
}

function toStoredRecord(tokens: AuthTokens): Partial<AuthTokens> {
  return { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken };
}

export { keptRefreshToken, resolveStartupTokens, shouldRewriteStartupRecord, toStoredRecord };
