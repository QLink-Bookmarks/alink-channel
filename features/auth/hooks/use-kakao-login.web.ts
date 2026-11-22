import * as React from "react";

import { reportError } from "@/lib/error-reporting";
import { useAuthStore } from "@/stores/auth";
import {
  issueAccessTokenWithCodeWeb,
  login as kakaoLogin,
  setAccessTokenWeb,
} from "@react-native-kakao/user";

import { signIn } from "../api";
import { type ConnectOutcome, connectWithToken } from "../lib/connect-with-token";
import { type OauthMode, beginOauthAttempt } from "../lib/oauth-state";

import { createURL } from "expo-linking";

function getRedirectUri(): string {
  return createURL("");
}

// Called by the shared web redirect dispatcher once it confirms the returning
// `?code=` belongs to Kakao (via `state`). Returns a connect outcome when this
// round-trip was a "connect" flow, or null when it was a login (handled here).
async function exchangeKakaoCode(code: string, mode: OauthMode): Promise<ConnectOutcome | null> {
  const socialToken = await issueAccessTokenWithCodeWeb({
    code,
    redirectUri: getRedirectUri(),
  });
  if (!socialToken) {
    return null;
  }
  setAccessTokenWeb(socialToken.accessToken);

  if (mode === "connect") {
    return connectWithToken("KAKAO", socialToken.accessToken, "WEB");
  }

  const result = await signIn({
    provider: "KAKAO",
    token: socialToken.accessToken,
    platform: "WEB",
  });
  if (result?.success && result.data) {
    useAuthStore.getState().authenticate({ accessToken: result.data.accessToken });
  }
  return null;
}

async function startKakaoOauth(mode: OauthMode): Promise<void> {
  await kakaoLogin({
    web: {
      redirectUri: getRedirectUri(),
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
