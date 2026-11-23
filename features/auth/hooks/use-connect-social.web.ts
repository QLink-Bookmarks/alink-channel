import * as React from "react";

import { reportError } from "@/lib/error-reporting";

import { type ConnectOutcome, connectFailed, connectWithToken } from "../lib/connect-with-token";
import type { SocialProvider } from "../lib/provider-brand";
import { acquireAppleWebToken, acquireGoogleWebToken } from "../lib/web-popup-token";
import { beginKakaoConnect } from "./use-kakao-login.web";
import { beginNaverConnect } from "./use-naver-login.web";

// Connect an additional social provider on web. Google/Apple use popups and
// resolve inline; Kakao/Naver do a full-page redirect, with completion handled
// on return by the OAuth redirect dispatcher. Resolves to the outcome to show,
// or null when the user cancelled or the page is leaving for a redirect.
function useConnectSocial() {
  const [pendingProvider, setPendingProvider] = React.useState<SocialProvider | null>(null);

  const connect = React.useCallback(
    async (provider: SocialProvider): Promise<ConnectOutcome | null> => {
      setPendingProvider(provider);
      try {
        if (provider === "KAKAO") {
          await beginKakaoConnect();
          return null;
        }
        if (provider === "NAVER") {
          await beginNaverConnect();
          return null;
        }
        const result =
          provider === "GOOGLE" ? await acquireGoogleWebToken() : await acquireAppleWebToken();
        if (result.kind === "cancelled") return null;
        return await connectWithToken(provider, result.token, "WEB");
      } catch (error) {
        reportError(error, { area: "auth:connect-web", extra: { provider } });
        return connectFailed(provider);
      } finally {
        setPendingProvider(null);
      }
    },
    [],
  );

  return { connect, pendingProvider };
}

export { useConnectSocial };
