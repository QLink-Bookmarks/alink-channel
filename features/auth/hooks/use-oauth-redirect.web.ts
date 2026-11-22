import * as React from "react";

import { reportError } from "@/lib/error-reporting";
import { useAuthStore } from "@/stores/auth";

import { type ConnectOutcome, connectFailed } from "../lib/connect-with-token";
import { notifyLoginFailed } from "../lib/notify-login-failed";
import { readOauthCallback } from "../lib/oauth-callback";
import { consumeOauthAttempt } from "../lib/oauth-state";
import { stageRedirectConnectOutcome } from "./use-connect-feedback";
import { exchangeKakaoCode } from "./use-kakao-login.web";
import { processNaverRedirect } from "./use-naver-login.web";

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

    const isAuthenticated = Boolean(useAuthStore.getState().accessToken);
    if (isAuthenticated !== (attempt.mode === "connect")) {
      setResult("login");
      return;
    }

    const { credential, error } = callback;
    const provider = callback.provider === "naver" ? "NAVER" : "KAKAO";
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
          stageRedirectConnectOutcome(outcome ?? connectFailed(provider));
        }
        setResult(attempt.mode);
      }
    })();
  }, []);

  return result;
}

export { useOauthRedirect };
