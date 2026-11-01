import { fireEvent, render, screen } from "@testing-library/react-native";

import { IconButton } from "./icon-button";

import { Bell } from "lucide-react-native/icons";

describe("IconButton ghost", () => {
  it("is a button named by its accessible label and calls onPress", () => {
    const onPress = jest.fn();
    render(
      <IconButton
        accessibilityLabel="알림"
        icon={Bell}
        size="sm"
        variant="ghost"
        onPress={onPress}
      />,
    );
    fireEvent.press(screen.getByRole("button", { name: "알림" }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("does not respond while disabled", () => {
    const onPress = jest.fn();
    render(
      <IconButton
        accessibilityLabel="설정"
        disabled
        icon={Bell}
        variant="ghost"
        onPress={onPress}
      />,
    );
    const button = screen.getByRole("button", { name: "설정" });
    expect(button).toBeDisabled();
    fireEvent.press(button);
    expect(onPress).not.toHaveBeenCalled();
  });
});
