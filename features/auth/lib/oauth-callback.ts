const OAUTH_CALLBACK_PATH = "/auth/callback";

function getOauthCallbackUrl(): string {
  return new URL(OAUTH_CALLBACK_PATH, window.location.origin).href;
}

function readOauthCallback(url: URL) {
  const hash = new URLSearchParams(url.hash.slice(1));
  const isFragment = hash.has("access_token") || hash.has("error");
  const params = isFragment ? hash : url.searchParams;
  const state = params.get("state");
  const error = params.get("error");
  if (!state) return null;

  if (state.startsWith("naver:")) {
    const credential = isFragment ? params.get("access_token") : null;
    if (credential || error) return { provider: "naver" as const, state, credential, error };
  }
  if (state.startsWith("kakao:") && !isFragment) {
    const credential = params.get("code");
    if (credential || error) return { provider: "kakao" as const, state, credential, error };
  }
  return null;
}

export { OAUTH_CALLBACK_PATH, getOauthCallbackUrl, readOauthCallback };
