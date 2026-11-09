import { openLinkUrl } from "./open-link-url";

import * as Linking from "expo-linking";

jest.mock("expo-linking", () => ({ openURL: jest.fn(() => Promise.resolve(true)) }));

const URL_TO_OPEN = "https://velog.io/@devkim/tanstack-query-v5";

describe("openLinkUrl (native)", () => {
  const originalOpen = globalThis.open;

  afterEach(() => {
    globalThis.open = originalOpen;
    jest.clearAllMocks();
  });

  it("hands the URL to the system, not to window.open", () => {
    const open = jest.fn();
    globalThis.open = open as unknown as typeof globalThis.open;

    openLinkUrl(URL_TO_OPEN);

    expect(Linking.openURL).toHaveBeenCalledWith(URL_TO_OPEN);
    expect(open).not.toHaveBeenCalled();
  });
});
