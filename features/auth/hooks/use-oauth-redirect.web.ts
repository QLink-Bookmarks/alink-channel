import * as React from "react";

import { reportError } from "@/lib/error-reporting";

import { type ConnectOutcome, connectFailed } from "../lib/connect-with-token";
import {
  clearOauthMode,
  clearOauthState,
  getOauthMode,
  resolveOauthState,
} from "../lib/oauth-state";
import type { SocialProvider } from "../lib/provider-brand";
import { useConnectFeedback } from "./use-connect-feedback";
import { exchangeKakaoCode } from "./use-kakao-login.web";
import { processNaverRedirect } from "./use-naver-login.web";

type OauthRedirect = { code: string; state: string | null };

function readRedirect(): OauthRedirect | null {
  if (typeof window === "undefined") return null;
  const url = new URL(window.location.href);
  const code = url.searchParams.get("code");
  if (!code) return null;
  return { code, state: url.searchParams.get("state") };
}

function clearRedirectParams() {
  if (typeof window === "undefined") return;
  // Defer so it runs after expo-router finishes asserting the initial URL on
  // hydration, otherwise the router re-adds the stale params.
  setTimeout(() => {
    const url = new URL(window.location.href);
    url.searchParams.delete("code");
    url.searchParams.delete("state");
    window.history.replaceState(null, "", url.toString());
  }, 0);
}

function hasNaverHash(): boolean {
  return typeof window !== "undefined" && window.location.hash.includes("access_token");
}

// Single web callback handler. Kakao returns to the app root with `?code=&state=`
// (resolved via `state`); Naver uses its SDK's implicit flow and returns the
// token in the URL hash, handled by processNaverRedirect.
function useOauthRedirect() {
  const [isProcessing, setIsProcessing] = React.useState(
    () => Boolean(readRedirect()) || hasNaverHash(),
  );
  const handledRef = React.useRef(false);
  const applyConnectOutcome = useConnectFeedback();

  React.useEffect(() => {
    if (handledRef.current) return;
    handledRef.current = true;

    void (async () => {
      const isConnect = getOauthMode() === "connect";
      let attempted: SocialProvider | null = null;
      let outcome: ConnectOutcome | null = null;
      try {
        if (hasNaverHash()) {
          attempted = "NAVER";
          setIsProcessing(true);
          outcome = await processNaverRedirect();
          return;
        }

        const redirect = readRedirect();
        if (!redirect) {
          return;
        }

        attempted = "KAKAO";
        const provider = resolveOauthState(redirect.state);
        if (provider === "kakao") {
          setIsProcessing(true);
          outcome = await exchangeKakaoCode(redirect.code);
        }
        clearRedirectParams();
        clearOauthState();
      } catch (error) {
        reportError(error, { area: "auth:oauth-exchange" });
      } finally {
        clearOauthMode();
        setIsProcessing(false);
        // A connect round-trip always ends in a toast: its outcome, or a
        // failure when the token exchange threw or returned nothing.
        if (!outcome && isConnect && attempted) {
          outcome = connectFailed(attempted);
        }
        if (outcome) {
          applyConnectOutcome(outcome);
        }
      }
    })();
  }, [applyConnectOutcome]);

  return { isProcessing };
}

export { useOauthRedirect };
