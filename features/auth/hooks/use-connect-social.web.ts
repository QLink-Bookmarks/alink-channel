import * as React from "react";

import { reportError } from "@/lib/error-reporting";

import {
  type ConnectOutcome,
  type ConnectToken,
  connectFailed,
  connectWithToken,
} from "../lib/connect-with-token";
import type { SocialProvider } from "../lib/provider-brand";
import { beginKakaoConnect } from "./use-kakao-login.web";
import { beginNaverConnect } from "./use-naver-login.web";

type GoogleTokenResponse = { access_token?: string; error?: string };
type GoogleTokenClientError = { type?: string; message?: string };
type GoogleTokenClient = { requestAccessToken: () => void };
type GoogleIdentityServices = {
  accounts: {
    oauth2: {
      initTokenClient: (config: {
        client_id: string;
        scope: string;
        callback: (response: GoogleTokenResponse) => void;
        error_callback?: (error: GoogleTokenClientError) => void;
      }) => GoogleTokenClient;
    };
  };
};

function acquireGoogleWebToken(): Promise<ConnectToken> {
  const google = (window as unknown as { google?: GoogleIdentityServices }).google;
  if (!google?.accounts?.oauth2) {
    return Promise.reject(new Error("Google Identity Services script not loaded"));
  }
  return new Promise<ConnectToken>((resolve, reject) => {
    const client = google.accounts.oauth2.initTokenClient({
      client_id: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? "",
      scope: "openid email profile",
      callback: (response) => {
        if (response.access_token) {
          resolve({ kind: "token", token: response.access_token });
        } else if (response.error === "access_denied") {
          resolve({ kind: "cancelled" });
        } else {
          reject(new Error(`Google token error: ${response.error ?? "no token"}`));
        }
      },
      error_callback: (error) => {
        if (error.type === "popup_closed") {
          resolve({ kind: "cancelled" });
        } else {
          reject(new Error(`Google popup error: ${error.type ?? "unknown"}`));
        }
      },
    });
    client.requestAccessToken();
  });
}

type AppleSignInResponse = { authorization?: { id_token?: string } };
type AppleID = {
  auth: {
    init: (config: {
      clientId: string;
      scope?: string;
      redirectURI: string;
      usePopup?: boolean;
    }) => void;
    signIn: () => Promise<AppleSignInResponse>;
  };
};

const APPLE_CANCEL_ERROR_CODES = new Set([
  "popup_closed_by_user",
  "user_cancelled_authorize",
  "user_trigger_new_signin_flow",
]);

let appleInitialized = false;
async function acquireAppleWebToken(): Promise<ConnectToken> {
  const appleId = (window as unknown as { AppleID?: AppleID }).AppleID;
  if (!appleId) {
    throw new Error("Apple JS SDK not loaded");
  }
  if (!appleInitialized) {
    appleId.auth.init({
      clientId: process.env.EXPO_PUBLIC_APPLE_WEB_CLIENT_ID ?? "",
      scope: "name email",
      redirectURI: window.location.origin,
      usePopup: true,
    });
    appleInitialized = true;
  }
  try {
    const data = await appleId.auth.signIn();
    const token = data.authorization?.id_token;
    if (!token) {
      throw new Error("Apple sign-in returned no token");
    }
    return { kind: "token", token };
  } catch (error) {
    const code = (error as { error?: string })?.error;
    if (code && APPLE_CANCEL_ERROR_CODES.has(code)) {
      return { kind: "cancelled" };
    }
    throw error;
  }
}

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
