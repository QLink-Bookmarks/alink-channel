type OauthMode = "login" | "connect";
type OauthProvider = "kakao" | "naver";
type OauthAttempt = { provider: OauthProvider; mode: OauthMode; state: string };

const ATTEMPT_STORAGE_KEY = "qlink.oauth.attempt";

function beginOauthAttempt(provider: OauthProvider, mode: OauthMode): string {
  const nonce = Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  const state = `${provider}:${nonce}`;
  sessionStorage.setItem(ATTEMPT_STORAGE_KEY, JSON.stringify({ provider, mode, state }));
  return state;
}

function consumeOauthAttempt(
  provider: OauthProvider,
  returnedState: string | null,
): OauthAttempt | null {
  if (!returnedState) return null;
  try {
    const raw = sessionStorage.getItem(ATTEMPT_STORAGE_KEY);
    if (!raw) return null;
    const attempt = JSON.parse(raw) as Partial<OauthAttempt>;
    if (
      attempt.provider !== provider ||
      attempt.state !== returnedState ||
      (attempt.mode !== "login" && attempt.mode !== "connect")
    )
      return null;

    sessionStorage.removeItem(ATTEMPT_STORAGE_KEY);
    return { provider, mode: attempt.mode, state: returnedState };
  } catch {
    return null;
  }
}

export { beginOauthAttempt, consumeOauthAttempt };
export type { OauthMode };
