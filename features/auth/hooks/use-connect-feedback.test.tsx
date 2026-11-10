import * as React from "react";

import { accountQueryKeys } from "@/features/account/queries";
import { useToastStore } from "@/stores/toast-store";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react-native";

import type { ConnectOutcome } from "../lib/connect-with-token";
import { useConnectFeedback } from "./use-connect-feedback";

jest.mock("@/features/account/queries", () => ({
  accountQueryKeys: { mySettings: () => ["account", "settings"] },
}));

function renderFeedback() {
  const client = new QueryClient();
  const invalidate = jest
    .spyOn(client, "invalidateQueries")
    .mockImplementation(() => new Promise<void>(() => {}));
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const { result } = renderHook(() => useConnectFeedback(), { wrapper });
  return { apply: result.current, invalidate };
}

function shownToasts() {
  return useToastStore
    .getState()
    .items.map(({ title, description, variant }) => ({ title, description, variant }));
}

beforeEach(() => {
  act(() => useToastStore.getState().dismissAllToasts());
});

describe("useConnectFeedback", () => {
  it("shows the success toast without waiting for the settings refresh", () => {
    const { apply, invalidate } = renderFeedback();

    act(() => apply({ kind: "connected", provider: "GOOGLE" }));

    expect(shownToasts()).toEqual([
      { title: "계정을 연결했어요.", description: undefined, variant: "success" },
    ]);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: accountQueryKeys.mySettings() });
  });

  it.each<[ConnectOutcome, ReturnType<typeof shownToasts>[number]]>([
    [
      { kind: "error", provider: "KAKAO", reason: "already-connected" },
      { title: "이미 연결된 계정이에요.", description: undefined, variant: "warning" },
    ],
    [
      { kind: "error", provider: "KAKAO", reason: "linked-to-other-user" },
      {
        title: "이미 다른 사용자에 연결된 계정이에요.",
        description: undefined,
        variant: "warning",
      },
    ],
    [
      { kind: "error", provider: "KAKAO", reason: "unknown" },
      { title: "연결에 실패했어요.", description: "잠시 후 다시 시도해주세요.", variant: "error" },
    ],
  ])("shows the toast for %j without refreshing", (outcome, toast) => {
    const { apply, invalidate } = renderFeedback();

    act(() => apply(outcome));

    expect(shownToasts()).toEqual([toast]);
    expect(invalidate).not.toHaveBeenCalled();
  });
});
