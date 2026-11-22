import * as React from "react";

import { reportError } from "@/lib/error-reporting";
import { useAuthStore } from "@/stores/auth";

import { signIn } from "../api";
import { type ConnectOutcome, connectWithToken } from "../lib/connect-with-token";
import { type OauthMode, beginOauthAttempt } from "../lib/oauth-state";

async function processNaverRedirect(
  token: string,
  mode: OauthMode,
): Promise<ConnectOutcome | null> {
  if (mode === "connect") return connectWithToken("NAVER", token, "WEB");

  const result = await signIn({ provider: "NAVER", token, platform: "WEB" });
  if (result?.success && result.data) {
    useAuthStore.getState().authenticate({ accessToken: result.data.accessToken });
  }
  return null;
}

function startNaverOauth(mode: OauthMode) {
  const url = new URL("https://nid.naver.com/oauth2.0/authorize");
  url.search = new URLSearchParams({
    response_type: "token",
    client_id: process.env.EXPO_PUBLIC_NAVER_CLIENT_ID ?? "",
    redirect_uri: window.location.origin,
    state: beginOauthAttempt("naver", mode),
    version: "js-2.0.1",
    svctype: "1",
  }).toString();
  window.location.assign(url);
}

function useNaverLogin() {
  const handleNaverLogin = React.useCallback(async () => {
    try {
      startNaverOauth("login");
    } catch (error) {
      reportError(error, { area: "auth:naver-login" });
    }
  }, []);

  return { handleNaverLogin };
}

async function beginNaverConnect(): Promise<void> {
  startNaverOauth("connect");
}

export { beginNaverConnect, processNaverRedirect, useNaverLogin };
