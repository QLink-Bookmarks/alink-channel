function hasNaverCallbackHash(hash: string) {
  return new URLSearchParams(hash.slice(1)).has("access_token");
}

function hasOauthError(params: URLSearchParams) {
  return params.has("error") && params.has("state");
}

function hasOauthCallbackHash(hash: string) {
  return hasNaverCallbackHash(hash) || hasOauthError(new URLSearchParams(hash.slice(1)));
}

function hasOauthCallback(location: Pick<Location, "search" | "hash">) {
  const params = new URLSearchParams(location.search);
  return params.has("code") || hasOauthError(params) || hasOauthCallbackHash(location.hash);
}

export { hasNaverCallbackHash, hasOauthCallback, hasOauthCallbackHash };
