import { useAuthStore } from "@/stores/auth";
import { renderHook } from "@testing-library/react-native";

import { useSignOutEffect } from "./use-sign-out-effect";

describe("useSignOutEffect", () => {
  beforeEach(() => {
    useAuthStore.setState({ accessToken: "a", refreshToken: "r" });
  });

  it("runs on sign out, not on a token refresh", () => {
    const onSignOut = jest.fn();
    renderHook(() => useSignOutEffect(onSignOut));

    useAuthStore.getState().setAccessToken("next");
    expect(onSignOut).not.toHaveBeenCalled();

    useAuthStore.getState().signOut();
    expect(onSignOut).toHaveBeenCalledTimes(1);
  });

  it("stops listening after unmount", () => {
    const onSignOut = jest.fn();
    const { unmount } = renderHook(() => useSignOutEffect(onSignOut));
    unmount();

    useAuthStore.getState().signOut();
    expect(onSignOut).not.toHaveBeenCalled();
  });
});
