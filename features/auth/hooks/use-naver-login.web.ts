import * as React from "react";

import { reportError } from "@/lib/error-reporting";
import { useAuthStore } from "@/stores/auth";

import { signIn } from "../api";
import { type ConnectOutcome, connectWithToken } from "../lib/connect-with-token";
import { getOauthMode, setOauthMode } from "../lib/oauth-state";

const NAVER_SDK_SRC = "https://static.nid.naver.com/js/naveridlogin_js_sdk_2.0.2.js";
const NAVER_BUTTON_HOST_ID = "naverIdLogin";

type NaverLoginInstance = {
  init: () => void;
  getLoginStatus: (callback: (status: boolean) => void) => void;
  accessToken?: { accessToken?: string };
};

type NaverLoginConstructor = new (options: {
  clientId: string;
  callbackUrl: string;
  isPopup: boolean;
  loginButton?: { color: string; type: number; height: number };
  callbackHandle?: boolean;
}) => NaverLoginInstance;

declare global {
  interface Window {
    naver?: { LoginWithNaverId?: NaverLoginConstructor };
  }
}

let scriptPromise: Promise<void> | null = null;
let naverLoginInstance: NaverLoginInstance | null = null;

function getCallbackUrl(): string {
  return typeof window !== "undefined" ? window.location.origin : "";
}

function loadNaverSdk(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Naver SDK is web-only"));
  }
  if (window.naver?.LoginWithNaverId) {
    return Promise.resolve();
  }
  if (!scriptPromise) {
    scriptPromise = new Promise<void>((resolve, reject) => {
      const script = document.createElement("script");
      script.src = NAVER_SDK_SRC;
      script.async = true;
      script.addEventListener("load", () => resolve());
      script.addEventListener("error", () => reject(new Error("Failed to load Naver SDK")));
      document.body.appendChild(script);
    });
  }
  return scriptPromise;
}

function ensureNaverLogin(): NaverLoginInstance | null {
  const Ctor = window.naver?.LoginWithNaverId;
  if (!Ctor) {
    return null;
  }
  if (naverLoginInstance) {
    return naverLoginInstance;
  }
  // The SDK renders its login anchor into an element with this id; keep a
  // hidden host so we can drive the SDK from our own button.
  if (!document.getElementById(NAVER_BUTTON_HOST_ID)) {
    const host = document.createElement("div");
    host.id = NAVER_BUTTON_HOST_ID;
    host.style.display = "none";
    document.body.appendChild(host);
  }
  naverLoginInstance = new Ctor({
    clientId: process.env.EXPO_PUBLIC_NAVER_CLIENT_ID ?? "",
    callbackUrl: getCallbackUrl(),
    isPopup: false,
    loginButton: { color: "green", type: 3, height: 48 },
    callbackHandle: true,
  });
  naverLoginInstance.init();
  return naverLoginInstance;
}

function hasNaverCallbackHash(): boolean {
  return typeof window !== "undefined" && window.location.hash.includes("access_token");
}

function clearCallbackHash(): void {
  window.history.replaceState(null, "", window.location.pathname + window.location.search);
}

// Implicit-flow callback: the SDK returns the access token in the URL hash.
// Read it via getLoginStatus, then hand the token to the backend. Returns a
// connect outcome when this was a "connect" flow, or null otherwise (login or
// no callback present).
async function processNaverRedirect(): Promise<ConnectOutcome | null> {
  if (!hasNaverCallbackHash()) {
    return null;
  }
  await loadNaverSdk();
  const naverLogin = ensureNaverLogin();
  if (!naverLogin) {
    clearCallbackHash();
    return null;
  }
  const accessToken = await new Promise<string | null>((resolve) => {
    naverLogin.getLoginStatus((status) => {
      resolve(status ? (naverLogin.accessToken?.accessToken ?? null) : null);
    });
  });
  clearCallbackHash();
  if (!accessToken) {
    return null;
  }

  if (getOauthMode() === "connect") {
    return connectWithToken("NAVER", accessToken, "WEB");
  }

  const result = await signIn({ provider: "NAVER", token: accessToken, platform: "WEB" });
  if (result?.success && result.data) {
    useAuthStore.getState().authenticate({ accessToken: result.data.accessToken });
  }
  return null;
}

async function startNaverOauth(): Promise<void> {
  await loadNaverSdk();
  ensureNaverLogin();
  const anchor = document.querySelector<HTMLAnchorElement>(`#${NAVER_BUTTON_HOST_ID} a`);
  anchor?.click();
}

function useNaverLogin() {
  const handleNaverLogin = React.useCallback(async () => {
    try {
      setOauthMode("login");
      await startNaverOauth();
    } catch (error) {
      reportError(error, { area: "auth:naver-login" });
    }
  }, []);

  return { handleNaverLogin };
}

// Kick off the Naver redirect in "connect" mode. Completion happens on return
// via processNaverRedirect.
async function beginNaverConnect(): Promise<void> {
  setOauthMode("connect");
  await startNaverOauth();
}

export { beginNaverConnect, processNaverRedirect, useNaverLogin };
