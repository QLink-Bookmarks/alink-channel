import * as React from "react";

import { reportError } from "@/lib/error-reporting";

import { type ConnectOutcome, connectFailed } from "../lib/connect-with-token";
import { hasOauthCallbackHash } from "../lib/oauth-callback";
import { consumeOauthAttempt } from "../lib/oauth-state";
import type { SocialProvider } from "../lib/provider-brand";
import { useConnectFeedback } from "./use-connect-feedback";
import { exchangeKakaoCode } from "./use-kakao-login.web";
import { processNaverRedirect } from "./use-naver-login.web";

function clearCallbackUrl() {
  const url = new URL(window.location.href);
  for (const key of ["code", "state", "error", "error_description", "error_uri"]) {
    url.searchParams.delete(key);
  }
  if (hasOauthCallbackHash(url.hash)) url.hash = "";
  window.history.replaceState(window.history.state, "", url);
}

function useOauthRedirect() {
  const [isProcessing, setIsProcessing] = React.useState(true);
  const [shouldEnterApp, setShouldEnterApp] = React.useState(false);
  const handledRef = React.useRef(false);
  const applyConnectOutcome = useConnectFeedback();

  React.useEffect(() => {
    if (handledRef.current) return;
    handledRef.current = true;

    void (async () => {
      const url = new URL(window.location.href);
      const hash = new URLSearchParams(url.hash.slice(1));
      const hashCallback = hasOauthCallbackHash(url.hash);
      const params = hashCallback ? hash : url.searchParams;
      const state = params.get("state");
      const provider =
        hashCallback || (params.has("error") && state?.startsWith("naver:")) ? "naver" : "kakao";
      const credential = params.get(provider === "naver" ? "access_token" : "code");
      const attempt = consumeOauthAttempt(provider, state);
      let attempted: SocialProvider | null = null;
      let outcome: ConnectOutcome | null = null;

      try {
        if (attempt && credential) {
          attempted = provider === "naver" ? "NAVER" : "KAKAO";
          outcome = await (provider === "naver"
            ? processNaverRedirect(credential, attempt.mode)
            : exchangeKakaoCode(credential, attempt.mode));
        }
      } catch (error) {
        reportError(error, { area: "auth:oauth-exchange" });
      } finally {
        if (attempt?.mode === "connect" && attempted) {
          applyConnectOutcome(outcome ?? connectFailed(attempted));
        }
        // Expo Router can still be committing the initial URL on hydration.
        setTimeout(() => {
          if (window.location.pathname === "/") clearCallbackUrl();
          setShouldEnterApp(attempt !== null);
          setIsProcessing(false);
        }, 0);
      }
    })();
  }, [applyConnectOutcome]);

  return { isProcessing, shouldEnterApp };
}

export { useOauthRedirect };
