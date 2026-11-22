import { acquireGoogleWebToken } from "../lib/web-popup-token";
import { useWebPopupLogin } from "./use-web-popup-login";

function useGoogleLogin() {
  const { handleLogin, isLoading } = useWebPopupLogin("GOOGLE", acquireGoogleWebToken);
  return { handleGoogleLogin: handleLogin, isLoading };
}

export { useGoogleLogin };
