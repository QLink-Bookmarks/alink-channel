import * as React from "react";

import { reportError } from "@/lib/error-reporting";

import { type ConnectOutcome, connectWithToken } from "../lib/connect-with-token";
import { notifyLoginFailed } from "../lib/notify-login-failed";
import { getOauthCallbackUrl } from "../lib/oauth-callback";
import { type OauthMode, beginOauthAttempt } from "../lib/oauth-state";
import { signInWithWebToken } from "../lib/sign-in-with-web-token";

async function processNaverRedirect(
  token: string,
  mode: OauthMode,
): Promise<ConnectOutcome | null> {
  if (mode === "connect") return connectWithToken("NAVER", token, "WEB");

  await signInWithWebToken("NAVER", token);
  return null;
}

function startNaverOauth(mode: OauthMode) {
  const url = new URL("https://nid.naver.com/oauth2.0/authorize");
  url.search = new URLSearchParams({
    response_type: "token",
    client_id: process.env.EXPO_PUBLIC_NAVER_CLIENT_ID ?? "",
    redirect_uri: getOauthCallbackUrl(),
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
      notifyLoginFailed();
    }
  }, []);

  return { handleNaverLogin };
}

async function beginNaverConnect(): Promise<void> {
  startNaverOauth("connect");
}

export { beginNaverConnect, processNaverRedirect, useNaverLogin };
