type SessionTokens = {
  accessToken: string | null;
  refreshToken: string | null;
};

function hasSessionTokens(tokens: SessionTokens) {
  return Boolean(tokens.accessToken || tokens.refreshToken);
}

function isSignOutTransition(next: SessionTokens, previous: SessionTokens) {
  return hasSessionTokens(previous) && !hasSessionTokens(next);
}

export { isSignOutTransition };
