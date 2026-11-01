// Imported by its full name: Jest runs the native platform, so `./open-link-url` would
// resolve to the native file. Keep this in its own test file so lint does not merge the
// two imports into one.
import { openLinkUrl } from "./open-link-url.web";

import * as Linking from "expo-linking";

jest.mock("expo-linking", () => ({ openURL: jest.fn(() => Promise.resolve(true)) }));

const URL_TO_OPEN = "https://velog.io/@devkim/tanstack-query-v5";

describe("openLinkUrl (web)", () => {
  const originalOpen = globalThis.open;

  afterEach(() => {
    globalThis.open = originalOpen;
    jest.clearAllMocks();
  });

  it("opens a new tab without opener access", () => {
    const open = jest.fn();
    globalThis.open = open as unknown as typeof globalThis.open;

    openLinkUrl(URL_TO_OPEN);

    expect(open).toHaveBeenCalledWith(URL_TO_OPEN, "_blank", "noopener,noreferrer");
    expect(Linking.openURL).not.toHaveBeenCalled();
  });
});
