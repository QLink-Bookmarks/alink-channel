import { acquireAppleWebToken } from "../lib/web-popup-token";
import { useWebPopupLogin } from "./use-web-popup-login";

function useAppleLogin() {
  const { handleLogin, isLoading } = useWebPopupLogin("APPLE", acquireAppleWebToken);
  return { handleAppleLogin: handleLogin, isLoading };
}

export { useAppleLogin };
