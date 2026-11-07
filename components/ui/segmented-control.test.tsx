import { SegmentedControl } from "@/components/ui/segmented-control";
import { fireEvent, render, screen } from "@testing-library/react-native";

const SIZE_OPTIONS = [
  { label: "작게", value: "small" },
  { label: "크게", value: "large" },
];

const MODE_OPTIONS = [
  { label: "알림 없음", value: "none" },
  { label: "한 번", value: "time" },
  { label: "반복", value: "recurring" },
];

describe("SegmentedControl", () => {
  it("reads a single choice as a radio group with the checked radio", () => {
    render(
      <SegmentedControl
        accessibilityLabel="알림"
        options={MODE_OPTIONS}
        value="time"
      />,
    );

    expect(screen.getByLabelText("알림")).toHaveProp("role", "radiogroup");
    expect(screen.getByRole("radio", { name: "한 번" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "알림 없음" })).not.toBeChecked();
    expect(screen.getByRole("radio", { name: "반복" })).not.toBeChecked();
  });

  it("gives track items a 44pt touch height without changing their size", () => {
    render(
      <SegmentedControl
        options={SIZE_OPTIONS}
        testID="size-control"
        value="large"
        variant="track"
      />,
    );

    const item = screen.getByRole("radio", { name: "작게" });
    expect(item).toHaveProp("hitSlop", { top: 6, bottom: 6 });
    expect(item).toHaveStyle({ minHeight: 32 });
    // 32pt item + 3px padding + 1px border = 40pt track; it reaches 44pt with 2pt more each side.
    expect(screen.getByTestId("size-control")).toHaveProp("hitSlop", { top: 2, bottom: 2 });
  });

  it("reads a multiple choice as checkboxes and reports the pressed item", () => {
    const handleValueChange = jest.fn();
    render(
      <SegmentedControl
        accessibilityLabel="요일"
        options={[
          { label: "월", value: "mon" },
          { label: "화", value: "tue" },
        ]}
        selectionMode="multiple"
        value={["mon"]}
        variant="chips"
        onValueChange={handleValueChange}
      />,
    );

    expect(screen.queryByRole("radio")).toBeNull();
    expect(screen.getByRole("checkbox", { name: "월" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "화" })).not.toBeChecked();
    fireEvent.press(screen.getByRole("checkbox", { name: "화" }));
    expect(handleValueChange).toHaveBeenCalledWith(["mon", "tue"]);
  });

  it("locks every option while disabled", () => {
    const handleValueChange = jest.fn();
    render(
      <SegmentedControl
        disabled
        accessibilityLabel="알림"
        options={MODE_OPTIONS}
        value="time"
        onValueChange={handleValueChange}
      />,
    );

    for (const name of ["알림 없음", "한 번", "반복"]) {
      expect(screen.getByRole("radio", { name })).toBeDisabled();
    }
    fireEvent.press(screen.getByRole("radio", { name: "반복" }));
    expect(handleValueChange).not.toHaveBeenCalled();
  });
});
