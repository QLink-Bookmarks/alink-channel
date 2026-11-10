import { GoogleSignin } from "@react-native-google-signin/google-signin";
import { login as kakaoLogin } from "@react-native-kakao/user";
import NaverLogin from "@react-native-seoul/naver-login";
import { act, renderHook } from "@testing-library/react-native";

import { connectWithToken } from "../lib/connect-with-token";
import type { SocialProvider } from "../lib/provider-brand";
import { useConnectSocial } from "./use-connect-social";

import * as AppleAuthentication from "expo-apple-authentication";

jest.mock("@react-native-google-signin/google-signin", () => ({
  GoogleSignin: { configure: jest.fn(), hasPlayServices: jest.fn(), signIn: jest.fn() },
  isCancelledResponse: (response: { type: string }) => response.type === "cancelled",
  isErrorWithCode: (error: unknown) =>
    typeof error === "object" && error !== null && "code" in error,
  statusCodes: { SIGN_IN_CANCELLED: "SIGN_IN_CANCELLED" },
}));
jest.mock("@react-native-kakao/user", () => ({ login: jest.fn() }));
jest.mock("@react-native-seoul/naver-login", () => ({
  __esModule: true,
  default: { initialize: jest.fn(), logout: jest.fn(), login: jest.fn() },
}));
jest.mock("expo-apple-authentication", () => ({
  signInAsync: jest.fn(),
  AppleAuthenticationScope: { FULL_NAME: 0, EMAIL: 1 },
}));
jest.mock("@/lib/error-reporting", () => ({ reportError: jest.fn() }));
jest.mock("../lib/connect-with-token", () => {
  const actual = jest.requireActual("../lib/connect-with-token");
  return { ...actual, connectWithToken: jest.fn() };
});

const mockedConnectWithToken = connectWithToken as jest.MockedFunction<typeof connectWithToken>;
const mockedGoogleSignIn = GoogleSignin.signIn as jest.Mock;
const mockedAppleSignIn = AppleAuthentication.signInAsync as jest.Mock;
const mockedKakaoLogin = kakaoLogin as jest.Mock;
const mockedNaverLogin = NaverLogin.login as jest.Mock;
const mockedNaverLogout = NaverLogin.logout as jest.Mock;

function codedError(code: string) {
  return Object.assign(new Error(code), { code });
}

async function runConnect(provider: SocialProvider) {
  const { result } = renderHook(() => useConnectSocial());
  let outcome: Awaited<ReturnType<typeof result.current.connect>> | undefined;
  await act(async () => {
    outcome = await result.current.connect(provider);
  });
  return { outcome, pendingProvider: result.current.pendingProvider };
}

const failed = (provider: SocialProvider) => ({ kind: "error", provider, reason: "unknown" });

beforeEach(() => {
  jest.clearAllMocks();
  mockedNaverLogout.mockResolvedValue(42);
  mockedConnectWithToken.mockImplementation(async (provider) => ({
    kind: "connected",
    provider,
  }));
});

describe("useConnectSocial (native)", () => {
  it.each<[SocialProvider, () => void, string]>([
    [
      "GOOGLE",
      () => mockedGoogleSignIn.mockResolvedValue({ type: "success", data: { idToken: "g-token" } }),
      "g-token",
    ],
    ["APPLE", () => mockedAppleSignIn.mockResolvedValue({ identityToken: "a-token" }), "a-token"],
    ["KAKAO", () => mockedKakaoLogin.mockResolvedValue({ accessToken: "k-token" }), "k-token"],
    [
      "NAVER",
      () =>
        mockedNaverLogin.mockResolvedValue({
          isSuccess: true,
          successResponse: { accessToken: "n-token" },
        }),
      "n-token",
    ],
  ])(
    "sends the %s token to the server and returns its outcome",
    async (provider, arrange, token) => {
      arrange();

      const { outcome, pendingProvider } = await runConnect(provider);

      expect(mockedConnectWithToken).toHaveBeenCalledWith(provider, token, "NATIVE");
      expect(outcome).toEqual({ kind: "connected", provider });
      expect(pendingProvider).toBeNull();
    },
  );

  it.each<[SocialProvider, () => void]>([
    ["GOOGLE", () => mockedGoogleSignIn.mockResolvedValue({ type: "cancelled", data: null })],
    ["GOOGLE", () => mockedGoogleSignIn.mockRejectedValue(codedError("SIGN_IN_CANCELLED"))],
    ["APPLE", () => mockedAppleSignIn.mockRejectedValue(codedError("ERR_REQUEST_CANCELED"))],
    ["KAKAO", () => mockedKakaoLogin.mockRejectedValue(codedError("Cancelled"))],
    ["KAKAO", () => mockedKakaoLogin.mockRejectedValue(codedError("AccessDenied"))],
    [
      "NAVER",
      () =>
        mockedNaverLogin.mockResolvedValue({
          isSuccess: false,
          failureResponse: { isCancel: true, message: "CANCELBYUSER" },
        }),
    ],
  ])("returns null without a request when the user cancels %s", async (provider, arrange) => {
    arrange();

    const { outcome, pendingProvider } = await runConnect(provider);

    expect(outcome).toBeNull();
    expect(mockedConnectWithToken).not.toHaveBeenCalled();
    expect(pendingProvider).toBeNull();
  });

  it.each<[string, SocialProvider, () => void]>([
    [
      "Google returns no id token",
      "GOOGLE",
      () => mockedGoogleSignIn.mockResolvedValue({ type: "success", data: { idToken: null } }),
    ],
    [
      "Google throws",
      "GOOGLE",
      () => mockedGoogleSignIn.mockRejectedValue(codedError("PLAY_SERVICES_NOT_AVAILABLE")),
    ],
    [
      "Apple returns no identity token",
      "APPLE",
      () => mockedAppleSignIn.mockResolvedValue({ identityToken: null }),
    ],
    [
      "Apple throws a non-cancel error",
      "APPLE",
      () => mockedAppleSignIn.mockRejectedValue(codedError("ERR_REQUEST_UNKNOWN")),
    ],
    ["Kakao returns no token", "KAKAO", () => mockedKakaoLogin.mockResolvedValue(null)],
    [
      "Kakao throws a non-cancel error",
      "KAKAO",
      () => mockedKakaoLogin.mockRejectedValue(codedError("NotSupported")),
    ],
    [
      "Naver fails without cancel",
      "NAVER",
      () =>
        mockedNaverLogin.mockResolvedValue({
          isSuccess: false,
          failureResponse: { isCancel: false, message: "NETWORKERROR" },
        }),
    ],
    [
      "Naver succeeds without a token",
      "NAVER",
      () => mockedNaverLogin.mockResolvedValue({ isSuccess: true, successResponse: null }),
    ],
  ])("returns a failure when %s", async (_label, provider, arrange) => {
    arrange();

    const { outcome, pendingProvider } = await runConnect(provider);

    expect(outcome).toEqual(failed(provider));
    expect(mockedConnectWithToken).not.toHaveBeenCalled();
    expect(pendingProvider).toBeNull();
  });

  it("passes a server failure through", async () => {
    mockedAppleSignIn.mockResolvedValue({ identityToken: "a-token" });
    mockedConnectWithToken.mockResolvedValue(failed("APPLE") as never);

    const { outcome } = await runConnect("APPLE");

    expect(outcome).toEqual(failed("APPLE"));
  });
});
