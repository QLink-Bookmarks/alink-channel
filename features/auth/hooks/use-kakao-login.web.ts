import * as React from "react";

import { reportError } from "@/lib/error-reporting";
import {
  issueAccessTokenWithCodeWeb,
  login as kakaoLogin,
  setAccessTokenWeb,
} from "@react-native-kakao/user";

import { type ConnectOutcome, connectWithToken } from "../lib/connect-with-token";
import { notifyLoginFailed } from "../lib/notify-login-failed";
import { getOauthCallbackUrl } from "../lib/oauth-callback";
import { type OauthMode, beginOauthAttempt } from "../lib/oauth-state";
import { signInWithWebToken } from "../lib/sign-in-with-web-token";

// Called by the shared web redirect dispatcher once it confirms the returning
// `?code=` belongs to Kakao (via `state`). Returns a connect outcome when this
// round-trip was a "connect" flow, or null when it was a login (handled here).
async function exchangeKakaoCode(code: string, mode: OauthMode): Promise<ConnectOutcome | null> {
  const socialToken = await issueAccessTokenWithCodeWeb({
    code,
    redirectUri: getOauthCallbackUrl(),
  });
  if (!socialToken?.accessToken) {
    throw new Error("Kakao code exchange returned no token");
  }
  setAccessTokenWeb(socialToken.accessToken);

  if (mode === "connect") {
    return connectWithToken("KAKAO", socialToken.accessToken, "WEB");
  }

  await signInWithWebToken("KAKAO", socialToken.accessToken);
  return null;
}

async function startKakaoOauth(mode: OauthMode): Promise<void> {
  await kakaoLogin({
    web: {
      redirectUri: getOauthCallbackUrl(),
      prompt: ["select_account"],
      state: beginOauthAttempt("kakao", mode),
    },
  });
}

function useKakaoLogin() {
  const handleKakaoLogin = React.useCallback(async () => {
    try {
      await startKakaoOauth("login");
    } catch (error) {
      reportError(error, { area: "auth:kakao-login" });
      notifyLoginFailed();
    }
  }, []);

  return { handleKakaoLogin };
}

// Kick off the Kakao redirect in "connect" mode. Completion happens on return
// via exchangeKakaoCode.
async function beginKakaoConnect(): Promise<void> {
  await startKakaoOauth("connect");
}

export { beginKakaoConnect, exchangeKakaoCode, useKakaoLogin };
