import * as React from "react";

import { reportError } from "@/lib/error-reporting";

import { type ConnectOutcome, connectFailed } from "../lib/connect-with-token";
import { hasNaverCallbackHash, hasOauthCallbackHash } from "../lib/oauth-callback";
import {
  clearOauthMode,
  clearOauthState,
  getOauthMode,
  hasOauthMode,
  resolveOauthState,
} from "../lib/oauth-state";
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
      const code = url.searchParams.get("code");
      const isNaver = hasNaverCallbackHash(url.hash);
      const isKakao = resolveOauthState(url.searchParams.get("state")) === "kakao";
      const startedHere = hasOauthMode() || isKakao;
      const isConnect = getOauthMode() === "connect";
      let attempted: SocialProvider | null = null;
      let outcome: ConnectOutcome | null = null;

      clearOauthState();
      try {
        if (isNaver && startedHere) {
          attempted = "NAVER";
          outcome = await processNaverRedirect();
        } else if (code && isKakao) {
          attempted = "KAKAO";
          outcome = await exchangeKakaoCode(code);
        }
      } catch (error) {
        reportError(error, { area: "auth:oauth-exchange" });
      } finally {
        clearOauthMode();
        if (isConnect && attempted) {
          applyConnectOutcome(outcome ?? connectFailed(attempted));
        }
        // Expo Router can still be committing the initial URL on hydration.
        setTimeout(() => {
          if (window.location.pathname === "/") clearCallbackUrl();
          setShouldEnterApp(startedHere);
          setIsProcessing(false);
        }, 0);
      }
    })();
  }, [applyConnectOutcome]);

  return { isProcessing, shouldEnterApp };
}

export { useOauthRedirect };
