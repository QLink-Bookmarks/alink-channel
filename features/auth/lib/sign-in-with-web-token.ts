import { useAuthStore } from "@/stores/auth";

import { signIn } from "../api";
import { notifyLoginFailed } from "./notify-login-failed";
import type { SocialProvider } from "./provider-brand";

async function signInWithWebToken(provider: SocialProvider, token: string) {
  const result = await signIn({ provider, token, platform: "WEB" });
  if (result?.success && result.data) {
    useAuthStore.getState().authenticate({ accessToken: result.data.accessToken });
  } else {
    notifyLoginFailed();
  }
}

export { signInWithWebToken };
