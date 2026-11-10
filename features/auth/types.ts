import type { ApiEnvelope } from "@/features/links/types";

type AuthPlatform = "WEB" | "NATIVE";

type SignInRequest = {
  provider: string;
  token: string;
  platform: AuthPlatform;
};

type SignInResponseData = {
  accessToken: string;
  refreshToken: string | null;
};

type SignInResponse = ApiEnvelope<SignInResponseData>;

type AuthTokenResponseData = {
  accessToken: string;
  refreshToken: string;
};

type AuthTokenResponse = ApiEnvelope<AuthTokenResponseData>;

type WebAuthTokenResponseData = {
  accessToken: string;
};

type WebAuthTokenResponse = ApiEnvelope<WebAuthTokenResponseData>;

type ConnectAuthProviderRequest = {
  provider: string;
  token: string;
  platform: AuthPlatform;
};

type ConnectAuthProviderResponse = ApiEnvelope<{ id: number } | null>;

type NativeRefreshTokenRequest = {
  refreshToken?: string | null;
};

type SignOutRequest = {
  refreshToken?: string | null;
};

type SignOutResponse = ApiEnvelope<null>;

export type {
  AuthPlatform,
  AuthTokenResponse,
  AuthTokenResponseData,
  ConnectAuthProviderRequest,
  ConnectAuthProviderResponse,
  NativeRefreshTokenRequest,
  SignInRequest,
  SignInResponse,
  SignInResponseData,
  SignOutRequest,
  SignOutResponse,
  WebAuthTokenResponse,
  WebAuthTokenResponseData,
};
