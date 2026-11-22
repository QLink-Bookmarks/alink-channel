import * as React from "react";

import { reportError } from "@/lib/error-reporting";

import type { ConnectToken } from "../lib/connect-with-token";
import { notifyLoginFailed } from "../lib/notify-login-failed";
import { signInWithWebToken } from "../lib/sign-in-with-web-token";

function useWebPopupLogin(provider: "APPLE" | "GOOGLE", acquireToken: () => Promise<ConnectToken>) {
  const [isLoading, setIsLoading] = React.useState(false);

  const handleLogin = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await acquireToken();
      if (result.kind === "token") await signInWithWebToken(provider, result.token);
    } catch (error) {
      reportError(error, { area: "auth:popup-login", extra: { provider } });
      notifyLoginFailed();
    } finally {
      setIsLoading(false);
    }
  }, [acquireToken, provider]);

  return { handleLogin, isLoading };
}

export { useWebPopupLogin };
