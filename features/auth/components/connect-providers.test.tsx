import * as React from "react";

import { useToastStore } from "@/stores/toast-store";
import { PortalHost } from "@rn-primitives/portal";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen } from "@testing-library/react-native";

import type { ConnectOutcome } from "../lib/connect-with-token";
import { ConnectedProvidersRow } from "./connect-providers";

/* eslint-disable @typescript-eslint/no-require-imports -- jest.mock factories must require */
jest.mock("react-native-worklets", () => require("react-native-worklets/src/mock"));
jest.mock("react-native-reanimated", () => require("react-native-reanimated/mock"));

const mockConnect = jest.fn<Promise<ConnectOutcome | null>, [string]>();

jest.mock("../hooks/use-connect-social", () => ({
  useConnectSocial: () => ({ connect: mockConnect, pendingProvider: null }),
}));
jest.mock("@/features/account/queries", () => ({
  accountQueryKeys: { mySettings: () => ["account", "settings"] },
}));
jest.mock("@/stores/auth", () => ({ useAuthStore: jest.fn() }));
jest.mock("../hooks/use-apple-login", () => ({ useAppleLogin: jest.fn() }));
jest.mock("../hooks/use-google-login", () => ({ useGoogleLogin: jest.fn() }));
jest.mock("../hooks/use-kakao-login", () => ({ useKakaoLogin: jest.fn() }));
jest.mock("../hooks/use-naver-login", () => ({ useNaverLogin: jest.fn() }));

function renderRow() {
  const client = new QueryClient();
  jest.spyOn(client, "invalidateQueries").mockResolvedValue();
  render(
    <QueryClientProvider client={client}>
      <ConnectedProvidersRow
        mode="wide"
        connectedProviders={[{ type: "KAKAO" } as never]}
      />
      <PortalHost />
    </QueryClientProvider>,
  );
}

async function connectGoogle(outcome: ConnectOutcome | null) {
  mockConnect.mockResolvedValue(outcome);
  fireEvent.press(screen.getByLabelText("계정 연결 추가"));
  expect(screen.getByText("계정 연결")).toBeTruthy();
  await act(async () => {
    fireEvent.press(screen.getByText("Google로 계속하기"));
  });
}

function toastTitles() {
  return useToastStore.getState().items.map((item) => item.title);
}

beforeEach(() => {
  mockConnect.mockReset();
  act(() => useToastStore.getState().dismissAllToasts());
});

describe("ConnectedProvidersRow connect dialog", () => {
  it.each<[string, ConnectOutcome, string]>([
    ["success", { kind: "connected", provider: "GOOGLE" }, "계정을 연결했어요."],
    [
      "409 already connected",
      { kind: "error", provider: "GOOGLE", reason: "already-connected" },
      "이미 연결된 계정이에요.",
    ],
    [
      "409 linked to another user",
      { kind: "error", provider: "GOOGLE", reason: "linked-to-other-user" },
      "이미 다른 사용자에 연결된 계정이에요.",
    ],
    [
      "any other failure",
      { kind: "error", provider: "GOOGLE", reason: "unknown" },
      "연결에 실패했어요.",
    ],
  ])("closes and shows the toast on %s", async (_label, outcome, title) => {
    renderRow();

    await connectGoogle(outcome);

    expect(mockConnect).toHaveBeenCalledWith("GOOGLE");
    expect(screen.queryByText("계정 연결")).toBeNull();
    expect(toastTitles()).toEqual([title]);
  });

  it("stays open without a toast when the user cancels", async () => {
    renderRow();

    await connectGoogle(null);

    expect(screen.getByText("계정 연결")).toBeTruthy();
    expect(screen.getByText("Google로 계속하기")).toBeTruthy();
    expect(toastTitles()).toEqual([]);
  });
});
