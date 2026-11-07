import { SegmentedControl } from "@/components/ui/segmented-control";
import { fireEvent, render, screen } from "@testing-library/react-native";

const SIZE_OPTIONS = [
  { label: "작게", value: "small" },
  { label: "크게", value: "large" },
];

describe("SegmentedControl", () => {
  it("exposes each item as a button that says whether it is selected (iOS)", () => {
    render(
      <SegmentedControl
        options={SIZE_OPTIONS}
        value="large"
        variant="track"
      />,
    );

    expect(screen.getByRole("button", { name: "크게", selected: true })).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "작게", selected: false })).toBeOnTheScreen();
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

    const item = screen.getByRole("button", { name: "작게" });
    expect(item).toHaveProp("hitSlop", { top: 6, bottom: 6 });
    expect(item).toHaveStyle({ minHeight: 32 });
    // 32pt item + 3px padding + 1px border = 40pt track; it reaches 44pt with 2pt more each side.
    expect(screen.getByTestId("size-control")).toHaveProp("hitSlop", { top: 2, bottom: 2 });
  });

  it("reports the pressed item and marks every selected item in multiple selection", () => {
    const handleValueChange = jest.fn();
    render(
      <SegmentedControl
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

    expect(screen.getByRole("button", { name: "월", selected: true })).toBeOnTheScreen();
    fireEvent.press(screen.getByRole("button", { name: "화", selected: false }));
    expect(handleValueChange).toHaveBeenCalledWith(["mon", "tue"]);
  });
});
