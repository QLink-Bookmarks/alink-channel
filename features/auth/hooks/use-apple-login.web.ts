import * as React from "react";

import { reportError } from "@/lib/error-reporting";
import { useAuthStore } from "@/stores/auth";

import { signIn } from "../api";

type AppleSignInResponse = {
  authorization?: { id_token?: string; code?: string; state?: string };
  user?: unknown;
};

type AppleID = {
  auth: {
    init: (config: {
      clientId: string;
      scope?: string;
      redirectURI: string;
      state?: string;
      usePopup?: boolean;
    }) => void;
    signIn: () => Promise<AppleSignInResponse>;
  };
};

declare global {
  interface Window {
    AppleID?: AppleID;
  }
}

const CANCEL_ERROR_CODES = new Set([
  "popup_closed_by_user",
  "user_cancelled_authorize",
  "user_trigger_new_signin_flow",
]);

let initialized = false;

function ensureInit(): AppleID | null {
  if (typeof window === "undefined" || !window.AppleID) {
    return null;
  }
  if (!initialized) {
    window.AppleID.auth.init({
      clientId: process.env.EXPO_PUBLIC_APPLE_WEB_CLIENT_ID ?? "",
      scope: "name email",
      redirectURI: window.location.origin,
      usePopup: true,
    });
    initialized = true;
  }
  return window.AppleID;
}

function useAppleLogin() {
  const authenticate = useAuthStore((state) => state.authenticate);
  const [isLoading, setIsLoading] = React.useState(false);

  const handleAppleLogin = React.useCallback(async () => {
    const appleId = ensureInit();
    if (!appleId) {
      reportError(new Error("Apple JS SDK not loaded"), { area: "auth:apple-login" });
      return;
    }
    setIsLoading(true);
    try {
      const data = await appleId.auth.signIn();
      const idToken = data.authorization?.id_token;
      if (!idToken) {
        return;
      }
      const result = await signIn({ provider: "APPLE", token: idToken, platform: "WEB" });
      if (result?.success && result.data) {
        authenticate({ accessToken: result.data.accessToken });
      }
    } catch (error) {
      const code = (error as { error?: string })?.error;
      if (code && CANCEL_ERROR_CODES.has(code)) {
        return;
      }
      reportError(error, { area: "auth:apple-login" });
    } finally {
      setIsLoading(false);
    }
  }, [authenticate]);

  return { handleAppleLogin, isLoading };
}

export { useAppleLogin };
