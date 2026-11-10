import * as React from "react";

import { reportError } from "@/lib/error-reporting";
import { useAuthStore } from "@/stores/auth";

import { signIn } from "../api";

type GoogleTokenResponse = { access_token?: string; error?: string };
type GoogleTokenClient = { requestAccessToken: () => void };
type GoogleIdentityServices = {
  accounts: {
    oauth2: {
      initTokenClient: (config: {
        client_id: string;
        scope: string;
        callback: (response: GoogleTokenResponse) => void;
      }) => GoogleTokenClient;
    };
  };
};

function getGoogleIdentityServices(): GoogleIdentityServices | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as unknown as { google?: GoogleIdentityServices }).google;
}

function useGoogleLogin() {
  const authenticate = useAuthStore((state) => state.authenticate);
  const [isLoading, setIsLoading] = React.useState(false);

  const handleGoogleLogin = React.useCallback(() => {
    const google = getGoogleIdentityServices();
    if (!google?.accounts?.oauth2) {
      reportError(new Error("Google Identity Services script not loaded"), {
        area: "auth:google-login",
      });
      return;
    }
    setIsLoading(true);
    const client = google.accounts.oauth2.initTokenClient({
      client_id: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? "",
      scope: "openid email profile",
      callback: (response) => {
        void (async () => {
          try {
            if (!response.access_token) {
              return;
            }
            const result = await signIn({
              provider: "GOOGLE",
              token: response.access_token,
              platform: "WEB",
            });
            if (result?.success && result.data) {
              authenticate({ accessToken: result.data.accessToken });
            }
          } catch (error) {
            reportError(error, { area: "auth:google-login-exchange" });
          } finally {
            setIsLoading(false);
          }
        })();
      },
    });
    client.requestAccessToken();
  }, [authenticate]);

  return { handleGoogleLogin, isLoading };
}

export { useGoogleLogin };
