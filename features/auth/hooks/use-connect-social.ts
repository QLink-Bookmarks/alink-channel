import * as React from "react";

import { reportError } from "@/lib/error-reporting";
import {
  GoogleSignin,
  isCancelledResponse,
  isErrorWithCode,
  statusCodes,
} from "@react-native-google-signin/google-signin";
import { login as kakaoLogin } from "@react-native-kakao/user";
import NaverLogin from "@react-native-seoul/naver-login";

import {
  type ConnectOutcome,
  type ConnectToken,
  connectFailed,
  connectWithToken,
} from "../lib/connect-with-token";
import type { SocialProvider } from "../lib/provider-brand";

import * as AppleAuthentication from "expo-apple-authentication";

let googleConfigured = false;
function ensureGoogleConfigured() {
  if (googleConfigured) return;
  GoogleSignin.configure({
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    offlineAccess: true,
  });
  googleConfigured = true;
}

let naverInitialized = false;
function ensureNaverInitialized() {
  if (naverInitialized) return;
  NaverLogin.initialize({
    appName: "ALink",
    consumerKey: process.env.EXPO_PUBLIC_NAVER_CLIENT_ID ?? "",
    consumerSecret: process.env.EXPO_PUBLIC_NAVER_CLIENT_SECRET ?? "",
    serviceUrlSchemeIOS: process.env.EXPO_PUBLIC_NAVER_URL_SCHEME ?? "",
  });
  naverInitialized = true;
}

// Bound a native Naver call so a stalled SDK promise can't hang the connect
// flow. Resolves (never rejects) after the cap or on settle.
function withNaverTimeout(promise: Promise<unknown>, ms = 4000): Promise<void> {
  return new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, ms);
    promise.then(
      () => {
        clearTimeout(timer);
        resolve();
      },
      () => {
        clearTimeout(timer);
        resolve();
      },
    );
  });
}

// Error codes the SDKs reject with when the user backs out of their sign-in UI:
// Apple (expo-apple-authentication), Google, and Kakao (`Cancelled` from the
// client, `AccessDenied` from the consent screen).
const CANCEL_ERROR_CODES = new Set<string>([
  "ERR_REQUEST_CANCELED",
  statusCodes.SIGN_IN_CANCELLED,
  "Cancelled",
  "AccessDenied",
]);

function isCancelError(error: unknown): boolean {
  return isErrorWithCode(error) && CANCEL_ERROR_CODES.has(String(error.code));
}

function tokenOrThrow(provider: SocialProvider, token: string | null | undefined): ConnectToken {
  if (!token) {
    throw new Error(`${provider} sign-in returned no token`);
  }
  return { kind: "token", token };
}

async function acquireNativeToken(provider: SocialProvider): Promise<ConnectToken> {
  switch (provider) {
    case "GOOGLE": {
      ensureGoogleConfigured();
      await GoogleSignin.hasPlayServices();
      const response = await GoogleSignin.signIn();
      if (isCancelledResponse(response)) return { kind: "cancelled" };
      return tokenOrThrow(provider, response.data?.idToken);
    }
    case "APPLE": {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      return tokenOrThrow(provider, credential.identityToken);
    }
    case "KAKAO": {
      const token = await kakaoLogin();
      return tokenOrThrow(provider, token?.accessToken);
    }
    case "NAVER": {
      ensureNaverInitialized();
      // Naver reuses its cached session and silently re-links the previous
      // account. Clear the local token so the user gets to pick an account.
      // Bounded so a stalled native call can't hang the connect button — and we
      // skip deleteToken() (a server revoke that can hang and isn't needed to
      // re-prompt).
      await withNaverTimeout(NaverLogin.logout());
      const response = await NaverLogin.login();
      if (!response.isSuccess && response.failureResponse?.isCancel) {
        return { kind: "cancelled" };
      }
      if (!response.isSuccess) {
        throw new Error(`NAVER sign-in failed: ${response.failureResponse?.message ?? "unknown"}`);
      }
      return tokenOrThrow(provider, response.successResponse?.accessToken);
    }
  }
}

// Connect an additional social provider to the signed-in account using the
// native SDKs (no browser redirect — tokens resolve inline). Resolves to the
// outcome to show, or null when the user cancelled the provider's sign-in.
function useConnectSocial() {
  const [pendingProvider, setPendingProvider] = React.useState<SocialProvider | null>(null);

  const connect = React.useCallback(
    async (provider: SocialProvider): Promise<ConnectOutcome | null> => {
      setPendingProvider(provider);
      try {
        const result = await acquireNativeToken(provider);
        if (result.kind === "cancelled") return null;
        return await connectWithToken(provider, result.token, "NATIVE");
      } catch (error) {
        if (isCancelError(error)) return null;
        reportError(error, { area: "auth:connect-native", extra: { provider } });
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
