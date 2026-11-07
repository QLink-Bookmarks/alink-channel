import { render, screen } from "@testing-library/react-native";

import { SheetVariant, pickPopoverSide } from "./date-time-picker-button-internals";

/* eslint-disable @typescript-eslint/no-require-imports -- jest.mock factories must require */
jest.mock("react-native-worklets", () => require("react-native-worklets/src/mock"));
jest.mock("react-native-reanimated", () => require("react-native-reanimated/mock"));
/* eslint-enable @typescript-eslint/no-require-imports */

jest.mock("./date-time-picker-overlay", () => ({
  DatePickerOverlay: () => null,
  TimePickerOverlay: () => null,
}));

describe("DateTimePickerButton label", () => {
  it("shows a picked date as month, day and weekday", () => {
    render(
      <SheetVariant
        kind="date"
        mode="mobile"
        value={{ year: 2026, month: 11, day: 20 }}
        onChange={jest.fn()}
      />,
    );

    expect(screen.getByText("11월 20일 (금)")).toBeOnTheScreen();
  });

  it("keeps the placeholder while nothing is picked", () => {
    render(
      <SheetVariant
        kind="date"
        mode="mobile"
        placeholder="날짜 선택"
        value={null}
        onChange={jest.fn()}
      />,
    );

    expect(screen.getByText("날짜 선택")).toBeOnTheScreen();
  });

  it("keeps the time label as it was", () => {
    render(
      <SheetVariant
        kind="time"
        mode="mobile"
        value={{ hour: 9, minute: 0 }}
        onChange={jest.fn()}
      />,
    );

    expect(screen.getByText("오전 09:00")).toBeOnTheScreen();
  });
});

describe("pickPopoverSide", () => {
  it("opens below when there is room under the button", () => {
    expect(pickPopoverSide(200, 40, 1180)).toBe("bottom");
  });

  it("opens above a button near the bottom of the window", () => {
    expect(pickPopoverSide(1000, 40, 1180)).toBe("top");
  });

  it("stays below when the space above is even smaller", () => {
    expect(pickPopoverSide(120, 40, 400)).toBe("bottom");
  });
});
