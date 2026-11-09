import { fireEvent, render, screen } from "@testing-library/react-native";

import { Toast } from "./toast";

/* eslint-disable @typescript-eslint/no-require-imports -- jest.mock factories must require */
jest.mock("react-native-worklets", () => require("react-native-worklets/src/mock"));
jest.mock("react-native-reanimated", () => require("react-native-reanimated/mock"));
/* eslint-enable @typescript-eslint/no-require-imports */

describe("Toast", () => {
  it("shows the title and description of a default toast", () => {
    render(
      <Toast
        description="잠시 후 다시 시도해주세요"
        title="저장에 실패했어요"
      />,
    );

    expect(screen.getByText("저장에 실패했어요")).toBeOnTheScreen();
    expect(screen.getByText("잠시 후 다시 시도해주세요")).toBeOnTheScreen();
  });

  it("exposes dismiss as a button that calls onDismiss", () => {
    const handleDismiss = jest.fn();
    render(
      <Toast
        title="저장에 실패했어요"
        onDismiss={handleDismiss}
      />,
    );

    fireEvent.press(screen.getByRole("button", { name: "닫기" }));
    expect(handleDismiss).toHaveBeenCalledTimes(1);
  });

  it("hides dismiss when the toast is not dismissible", () => {
    render(
      <Toast
        dismissible={false}
        title="저장에 실패했어요"
        onDismiss={jest.fn()}
      />,
    );

    expect(screen.queryByRole("button", { name: "닫기" })).toBeNull();
  });

  it("exposes the action as a button that calls onAction", () => {
    const handleAction = jest.fn();
    render(
      <Toast
        actionLabel="다시 시도"
        title="저장에 실패했어요"
        onAction={handleAction}
      />,
    );

    fireEvent.press(screen.getByRole("button", { name: "다시 시도" }));
    expect(handleAction).toHaveBeenCalledTimes(1);
  });

  it.each(["success", "error", "warning", "gradient"] as const)(
    "renders the %s variant title (smoke)",
    (variant) => {
      render(
        <Toast
          title="알림"
          variant={variant}
        />,
      );

      expect(screen.getByText("알림")).toBeOnTheScreen();
    },
  );
});
