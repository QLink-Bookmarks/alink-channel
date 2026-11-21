function hasNaverCallbackHash(hash: string) {
  return new URLSearchParams(hash.slice(1)).has("access_token");
}

function hasOauthCallback(location: Pick<Location, "search" | "hash">) {
  const params = new URLSearchParams(location.search);
  return (
    params.has("code") ||
    (params.has("error") && params.has("state")) ||
    hasNaverCallbackHash(location.hash)
  );
}

export { hasNaverCallbackHash, hasOauthCallback };
