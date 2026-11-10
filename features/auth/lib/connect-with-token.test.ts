import { connectAuthProvider } from "../api";
import { connectFailed, connectWithToken } from "./connect-with-token";

import { AxiosError, type AxiosResponse } from "axios";

jest.mock("../api", () => ({ connectAuthProvider: jest.fn() }));

const mockedConnect = connectAuthProvider as jest.MockedFunction<typeof connectAuthProvider>;

function axiosErrorWith(status: number, code?: string) {
  const response = {
    status,
    data: code ? { success: false, data: null, error: { code, message: code } } : undefined,
  } as AxiosResponse;
  return new AxiosError("request failed", String(status), undefined, undefined, response);
}

beforeEach(() => {
  mockedConnect.mockReset();
});

describe("connectWithToken", () => {
  it("sends the provider token and maps 201 to connected", async () => {
    mockedConnect.mockResolvedValue({ success: true, data: { id: 3 }, error: null });

    await expect(connectWithToken("GOOGLE", "id-token", "NATIVE")).resolves.toEqual({
      kind: "connected",
      provider: "GOOGLE",
    });
    expect(mockedConnect).toHaveBeenCalledWith({
      provider: "GOOGLE",
      token: "id-token",
      platform: "NATIVE",
    });
  });

  it.each([
    ["AUTH_409_0001", "already-connected"],
    ["AUTH_409_0002", "linked-to-other-user"],
  ])("maps a 409 %s to %s", async (code, reason) => {
    mockedConnect.mockRejectedValue(axiosErrorWith(409, code));

    await expect(connectWithToken("KAKAO", "t", "NATIVE")).resolves.toEqual({
      kind: "error",
      provider: "KAKAO",
      reason,
    });
  });

  it.each([
    ["a 5xx", axiosErrorWith(500, "COMMON_500_0001")],
    ["a 401 the refresh could not recover", axiosErrorWith(401, "AUTH_401_0001")],
    ["a network error", new AxiosError("Network Error", "ERR_NETWORK")],
    ["a non-axios error", new Error("boom")],
  ])("maps %s to an unknown failure", async (_label, error) => {
    mockedConnect.mockRejectedValue(error);

    await expect(connectWithToken("NAVER", "t", "NATIVE")).resolves.toEqual(connectFailed("NAVER"));
  });

  it("maps an unsuccessful envelope to an unknown failure", async () => {
    mockedConnect.mockResolvedValue({ success: false, data: null, error: null });

    await expect(connectWithToken("APPLE", "t", "WEB")).resolves.toEqual(connectFailed("APPLE"));
  });
});
