import { fireEvent, render, screen } from "@testing-library/react-native";

import { FilterChip } from "./filter-chip";

describe("FilterChip", () => {
  it("is a radio named by its label, checked when selected", () => {
    render(
      <FilterChip
        label="전체"
        selected
        onPress={() => {}}
      />,
    );
    expect(screen.getByRole("radio", { name: "전체" })).toBeChecked();
  });

  it("is unchecked when not selected and reports a press", () => {
    const onPress = jest.fn();
    render(
      <FilterChip
        label="완료"
        selected={false}
        onPress={onPress}
      />,
    );
    const chip = screen.getByRole("radio", { name: "완료" });
    expect(chip).not.toBeChecked();
    fireEvent.press(chip);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("shows and says the count after the label", () => {
    render(
      <FilterChip
        count={3}
        label="진행 중"
        selected={false}
        onPress={() => {}}
      />,
    );
    expect(screen.getByRole("radio", { name: "진행 중 3" })).toBeTruthy();
    expect(screen.getByText("3")).toBeTruthy();
  });

  it("shows only the label while the count is unknown", () => {
    render(
      <FilterChip
        count={null}
        label="진행 중"
        selected={false}
        onPress={() => {}}
      />,
    );
    expect(screen.getByRole("radio", { name: "진행 중" })).toBeTruthy();
  });
});
