import * as React from "react";

import { reportError } from "@/lib/error-reporting";
import { useAuthStore } from "@/stores/auth";

import { type ConnectOutcome, connectFailed } from "../lib/connect-with-token";
import { notifyLoginFailed } from "../lib/notify-login-failed";
import { readOauthCallback } from "../lib/oauth-callback";
import { consumeOauthAttempt } from "../lib/oauth-state";
import { exchangeKakaoCode } from "./use-kakao-login.web";
import { processNaverRedirect } from "./use-naver-login.web";
import {
  stageExpiredConnectOutcome,
  stageRedirectConnectOutcome,
} from "./use-redirect-connect-feedback.web";

function useOauthRedirect() {
  const [result, setResult] = React.useState<"login" | "connect" | "invalid" | null>(null);
  const handledRef = React.useRef(false);

  React.useEffect(() => {
    if (handledRef.current) return;
    handledRef.current = true;

    const url = new URL(window.location.href);
    const callback = readOauthCallback(url);
    window.history.replaceState(window.history.state, "", url.pathname);
    const attempt = callback && consumeOauthAttempt(callback.provider, callback.state);
    if (!callback || !attempt) {
      setResult("invalid");
      return;
    }

    const { credential, error } = callback;
    const provider = callback.provider === "naver" ? "NAVER" : "KAKAO";
    const isAuthenticated = Boolean(useAuthStore.getState().accessToken);
    if (attempt.mode === "connect" && !isAuthenticated) {
      if (error !== "access_denied") stageExpiredConnectOutcome(provider);
      setResult("connect");
      return;
    }
    if (attempt.mode === "login" && isAuthenticated) {
      setResult("login");
      return;
    }

    void (async () => {
      let outcome: ConnectOutcome | null = null;
      try {
        if (!error && credential) {
          outcome = await (provider === "NAVER"
            ? processNaverRedirect(credential, attempt.mode)
            : exchangeKakaoCode(credential, attempt.mode));
        } else if (error !== "access_denied" && attempt.mode === "login") {
          notifyLoginFailed();
        }
      } catch (error) {
        reportError(error, { area: "auth:oauth-exchange" });
        if (attempt.mode === "login") notifyLoginFailed();
      } finally {
        if (attempt.mode === "connect" && error !== "access_denied") {
          const feedback = outcome ?? connectFailed(provider);
          if (feedback.kind === "error" && !useAuthStore.getState().accessToken) {
            stageExpiredConnectOutcome(provider);
          } else {
            stageRedirectConnectOutcome(feedback);
          }
        }
        setResult(attempt.mode);
      }
    })();
  }, []);

  return result;
}

export { useOauthRedirect };
