import { renderHook } from "@testing-library/react-native";

import { useWideView, useWideViewState } from "./use-wide-view";

const mockWindow = { width: 1280, height: 800, scale: 2, fontScale: 1 };

jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({
  __esModule: true,
  default: () => mockWindow,
}));

const { renderToString } = jest.requireActual<{
  renderToString: (element: React.ReactElement) => string;
}>("react-dom/server");

function WideViewStateProbe() {
  const { isResolved, isWideView } = useWideViewState();
  return `resolved=${isResolved} wide=${isWideView}`;
}

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

describe("useWideViewState", () => {
  it.each([
    [768, false],
    [769, true],
  ])("is resolved on the first client render at %ipx (wide=%s)", (width, expected) => {
    mockWindow.width = width;
    const { result } = renderHook(() => useWideViewState());
    expect(result.current).toEqual({ isResolved: true, isWideView: expected });
  });

  it("is unresolved and not wide while rendering on the server", () => {
    mockWindow.width = 1280;
    expect(renderToString(<WideViewStateProbe />)).toBe("resolved=false wide=false");
  });
});
