import { fireEvent, render, screen } from "@testing-library/react-native";

import { DetailPanel } from "./detail-panel";

/* eslint-disable @typescript-eslint/no-require-imports -- jest.mock factories must require */
jest.mock("react-native-worklets", () => require("react-native-worklets/src/mock"));
jest.mock("react-native-reanimated", () => require("react-native-reanimated/mock"));
/* eslint-enable @typescript-eslint/no-require-imports */
jest.mock("../link-detail-view", () => ({ LinkDetailView: () => null }));

describe("DetailPanel", () => {
  it("closes from the not-found overlay", () => {
    const onOpenChange = jest.fn();
    render(
      <DetailPanel
        mode="overlay"
        notFound
        open
        onOpenChange={onOpenChange}
      />,
    );

    expect(screen.getByText("찾으시는 링크가 없어요")).toBeTruthy();
    fireEvent.press(screen.getByRole("button", { name: "닫기" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
