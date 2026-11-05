import { fireEvent, render, screen } from "@testing-library/react-native";

import { IconButton, getHitSlopAreaStyle } from "./icon-button";

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

  // Regression guard: native keeps using Pressable's own hitSlop and renders no web stand-in area.
  it("passes hitSlop to the native pressable without adding a stand-in area", () => {
    render(
      <IconButton
        accessibilityLabel="뒤로"
        hitSlop={4}
        icon={Bell}
        size="sm"
        variant="ghost"
      />,
    );
    const button = screen.getByRole("button", { name: "뒤로" });
    expect(button).toHaveProp("hitSlop", 4);
    // Native applies hitSlop itself; the web stand-in area renders nothing here.
    expect(screen.UNSAFE_queryAllByProps({ "aria-hidden": true })).toHaveLength(0);
  });
});

describe("getHitSlopAreaStyle", () => {
  it("widens every side by a number", () => {
    expect(getHitSlopAreaStyle(4)).toEqual({ top: -4, right: -4, bottom: -4, left: -4 });
  });

  it("uses each side of full insets", () => {
    expect(getHitSlopAreaStyle({ top: 1, right: 2, bottom: 3, left: 4 })).toEqual({
      top: -1,
      right: -2,
      bottom: -3,
      left: -4,
    });
  });

  it("leaves sides that partial insets do not name at the button edge", () => {
    expect(getHitSlopAreaStyle({ top: 2 })).toEqual({ top: -2, right: 0, bottom: 0, left: 0 });
  });

  it("gives no area without a slop", () => {
    expect(getHitSlopAreaStyle(null)).toBeNull();
    expect(getHitSlopAreaStyle(undefined)).toBeNull();
  });
});
