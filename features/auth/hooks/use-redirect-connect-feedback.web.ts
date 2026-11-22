import * as React from "react";

import { type ConnectOutcome, connectFailed } from "../lib/connect-with-token";
import { useConnectFeedback } from "./use-connect-feedback";

const EXPIRED_CONNECT_KEY = "qlink.oauth.expired-connect";
let redirectOutcome: ConnectOutcome | null = null;

function stageRedirectConnectOutcome(outcome: ConnectOutcome) {
  redirectOutcome = outcome;
}

function stageExpiredConnectOutcome(provider: "KAKAO" | "NAVER") {
  try {
    sessionStorage.setItem(EXPIRED_CONNECT_KEY, provider);
  } catch {
    stageRedirectConnectOutcome(connectFailed(provider));
  }
}

function takeRedirectConnectOutcome() {
  const outcome = redirectOutcome;
  redirectOutcome = null;
  try {
    const provider = sessionStorage.getItem(EXPIRED_CONNECT_KEY);
    sessionStorage.removeItem(EXPIRED_CONNECT_KEY);
    if (!outcome && (provider === "KAKAO" || provider === "NAVER")) {
      return connectFailed(provider);
    }
  } catch {
    return outcome;
  }
  return outcome;
}

function useRedirectConnectFeedback() {
  const applyOutcome = useConnectFeedback();
  React.useEffect(() => {
    const outcome = takeRedirectConnectOutcome();
    if (outcome) applyOutcome(outcome);
  }, [applyOutcome]);
}

export { stageExpiredConnectOutcome, stageRedirectConnectOutcome, useRedirectConnectFeedback };
