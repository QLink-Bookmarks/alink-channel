import { renderHook, waitFor } from "@testing-library/react-native";

import { useConnectFeedback } from "./use-connect-feedback";
import { exchangeKakaoCode } from "./use-kakao-login.web";
import { processNaverRedirect } from "./use-naver-login.web";
import { useOauthRedirect } from "./use-oauth-redirect.web";

const mockApply = jest.fn();

jest.mock("./use-connect-feedback", () => ({ useConnectFeedback: jest.fn() }));
jest.mock("./use-kakao-login.web", () => ({ exchangeKakaoCode: jest.fn() }));
jest.mock("./use-naver-login.web", () => ({ processNaverRedirect: jest.fn() }));
jest.mock("@/lib/error-reporting", () => ({ reportError: jest.fn() }));

const mockedExchangeKakao = exchangeKakaoCode as jest.MockedFunction<typeof exchangeKakaoCode>;
const mockedProcessNaver = processNaverRedirect as jest.MockedFunction<typeof processNaverRedirect>;

const KAKAO_STATE = "kakao:abc";

function stubLocation(href: string) {
  const url = new URL(href);
  const storage = new Map<string, string>();
  Object.assign(globalThis, {
    window: {
      location: { href: url.toString(), hash: url.hash },
      history: { replaceState: jest.fn() },
    },
    sessionStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key),
    },
  });
  return storage;
}

function startRedirect(href: string, mode: "login" | "connect") {
  const storage = stubLocation(href);
  storage.set("qlink.oauth.state", KAKAO_STATE);
  storage.set("qlink.oauth.mode", mode);
  return renderHook(() => useOauthRedirect());
}

const failed = (provider: string) => ({ kind: "error", provider, reason: "unknown" });

const originalWindow = globalThis.window;
const originalSessionStorage = globalThis.sessionStorage;

beforeEach(() => {
  jest.clearAllMocks();
  (useConnectFeedback as jest.Mock).mockReturnValue(mockApply);
});

afterEach(() => {
  Object.assign(globalThis, { window: originalWindow, sessionStorage: originalSessionStorage });
});

describe("useOauthRedirect (web)", () => {
  it("shows the Kakao connect outcome on return", async () => {
    mockedExchangeKakao.mockResolvedValue({ kind: "connected", provider: "KAKAO" });

    startRedirect(`https://app.test/?code=c1&state=${KAKAO_STATE}`, "connect");

    await waitFor(() =>
      expect(mockApply).toHaveBeenCalledWith({ kind: "connected", provider: "KAKAO" }),
    );
  });

  it.each([
    ["the Kakao exchange throws", () => mockedExchangeKakao.mockRejectedValue(new Error("x"))],
    ["Kakao returns no token", () => mockedExchangeKakao.mockResolvedValue(null)],
  ])("shows a failure when %s during connect", async (_label, arrange) => {
    arrange();

    startRedirect(`https://app.test/?code=c1&state=${KAKAO_STATE}`, "connect");

    await waitFor(() => expect(mockApply).toHaveBeenCalledWith(failed("KAKAO")));
  });

  it("shows a failure when the Naver connect return cannot be processed", async () => {
    mockedProcessNaver.mockRejectedValue(new Error("sdk"));

    startRedirect("https://app.test/#access_token=n1", "connect");

    await waitFor(() => expect(mockApply).toHaveBeenCalledWith(failed("NAVER")));
  });

  it("shows nothing for a login return that fails", async () => {
    mockedExchangeKakao.mockRejectedValue(new Error("x"));

    const { result } = startRedirect(`https://app.test/?code=c1&state=${KAKAO_STATE}`, "login");

    await waitFor(() => expect(result.current.isProcessing).toBe(false));
    expect(mockedExchangeKakao).toHaveBeenCalled();
    expect(mockApply).not.toHaveBeenCalled();
  });

  it("shows nothing when the user cancelled at the provider (no code returned)", async () => {
    const { result } = startRedirect(
      `https://app.test/?error=access_denied&state=${KAKAO_STATE}`,
      "connect",
    );

    await waitFor(() => expect(result.current.isProcessing).toBe(false));
    expect(mockedExchangeKakao).not.toHaveBeenCalled();
    expect(mockApply).not.toHaveBeenCalled();
  });
});
