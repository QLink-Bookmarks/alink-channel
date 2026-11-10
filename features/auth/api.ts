import { api } from "@/lib/api-client";

import type {
  AuthTokenResponse,
  ConnectAuthProviderRequest,
  ConnectAuthProviderResponse,
  NativeRefreshTokenRequest,
  SignInRequest,
  SignInResponse,
  SignOutRequest,
  SignOutResponse,
  WebAuthTokenResponse,
} from "./types";

async function signIn(payload: SignInRequest) {
  return api.post<SignInResponse, SignInRequest>("/api/auth/sign", payload);
}

async function connectAuthProvider(payload: ConnectAuthProviderRequest) {
  return api.post<ConnectAuthProviderResponse, ConnectAuthProviderRequest>(
    "/api/auth/connection",
    payload,
  );
}

async function refreshTokenWeb() {
  return api.post<WebAuthTokenResponse>("/api/auth/token/refresh/web");
}

async function refreshTokenNative(payload: NativeRefreshTokenRequest) {
  return api.post<AuthTokenResponse, NativeRefreshTokenRequest>(
    "/api/auth/token/refresh/native",
    payload,
  );
}

async function signOut({ refreshToken }: SignOutRequest = {}) {
  return api.delete<SignOutResponse>("/api/auth/signout", {
    data: refreshToken ? { refreshToken } : {},
  });
}

export { connectAuthProvider, refreshTokenNative, refreshTokenWeb, signIn, signOut };
