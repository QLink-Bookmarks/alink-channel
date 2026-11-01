import { renderHook } from "@testing-library/react-native";

import { useWideView } from "./use-wide-view";

const mockWindow = { width: 1280, height: 800, scale: 2, fontScale: 1 };

jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({
  __esModule: true,
  default: () => mockWindow,
}));

describe("useWideView", () => {
  it.each([
    [767, false],
    [768, false],
    [769, true],
    [820, true],
    [1280, true],
  ])("at %ipx wide is %s", (width, expected) => {
    mockWindow.width = width;
    const { result } = renderHook(() => useWideView());
    expect(result.current).toBe(expected);
  });
});
