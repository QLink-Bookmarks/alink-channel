import { SafeAreaProvider } from "react-native-safe-area-context";

import type { LinkDetail } from "@/features/links/types";
import { fireEvent, render, screen } from "@testing-library/react-native";

import { DetailPanel } from "./detail-panel";

/* eslint-disable @typescript-eslint/no-require-imports -- jest.mock factories must require */
jest.mock("react-native-worklets", () => require("react-native-worklets/src/mock"));
jest.mock("react-native-reanimated", () => require("react-native-reanimated/mock"));
/* eslint-enable @typescript-eslint/no-require-imports */
jest.mock("../link-detail-view", () => ({ LinkDetailView: () => null }));

const mockWindowWidth = { current: 820 };
jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({
  __esModule: true,
  default: () => ({ width: mockWindowWidth.current, height: 1024, scale: 2, fontScale: 1 }),
}));

const metrics = {
  frame: { x: 0, y: 0, width: 820, height: 1180 },
  insets: { top: 24, bottom: 20, left: 0, right: 0 },
};

function withSafeArea(children: React.ReactNode) {
  return <SafeAreaProvider initialMetrics={metrics}>{children}</SafeAreaProvider>;
}

describe("DetailPanel", () => {
  beforeEach(() => {
    mockWindowWidth.current = 820;
  });

  it("follows 34% of a wide window on native", () => {
    mockWindowWidth.current = 1366;
    render(
      withSafeArea(
        <DetailPanel
          mode="overlay"
          isLoading
          open
        />,
      ),
    );
    expect(screen.getByTestId("detail-panel")).toHaveStyle({ width: 464 });
  });

  it("keeps one native width while the detail replaces the loading state", () => {
    const { rerender } = render(
      withSafeArea(
        <DetailPanel
          mode="overlay"
          isLoading
          open
        />,
      ),
    );
    expect(screen.getByTestId("detail-panel")).toHaveStyle({
      width: 420,
      paddingTop: 24,
      paddingBottom: 20,
    });

    rerender(
      withSafeArea(
        <DetailPanel
          mode="overlay"
          detail={{ id: 1 } as LinkDetail}
          open
        />,
      ),
    );
    expect(screen.getByTestId("detail-panel")).toHaveStyle({ width: 420 });
  });

  it("closes from the not-found overlay", () => {
    const onOpenChange = jest.fn();
    render(
      withSafeArea(
        <DetailPanel
          mode="overlay"
          notFound
          open
          onOpenChange={onOpenChange}
        />,
      ),
    );

    expect(screen.getByText("찾으시는 링크가 없어요")).toBeTruthy();
    fireEvent.press(screen.getByRole("button", { name: "닫기" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
