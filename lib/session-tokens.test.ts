import { isSignOutTransition } from "./session-tokens";

describe("isSignOutTransition", () => {
  it("is true only when the last token goes away", () => {
    const signedIn = { accessToken: "a", refreshToken: "r" };
    const refreshOnly = { accessToken: null, refreshToken: "r" };
    const signedOut = { accessToken: null, refreshToken: null };

    expect(isSignOutTransition(signedOut, signedIn)).toBe(true);
    expect(isSignOutTransition(signedOut, refreshOnly)).toBe(true);
    expect(isSignOutTransition(refreshOnly, signedIn)).toBe(false);
    expect(isSignOutTransition(signedIn, signedOut)).toBe(false);
    expect(isSignOutTransition(signedOut, signedOut)).toBe(false);
  });
});
