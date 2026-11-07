import * as React from "react";

import type { ListSort, SortCriterion } from "@/lib/list-sort";
import { fireEvent, render, screen } from "@testing-library/react-native";

import { SortCriterionChips } from "./sort-criterion-chips";

/* eslint-disable @typescript-eslint/no-require-imports -- jest.mock factories must require */
jest.mock("react-native-worklets", () => require("react-native-worklets/src/mock"));
jest.mock("react-native-reanimated", () => require("react-native-reanimated/mock"));
/* eslint-enable @typescript-eslint/no-require-imports */

type Key = "created_at" | "title";

const CRITERIA: SortCriterion<Key>[] = [
  { key: "created_at", label: "저장일", firstDirection: "desc" },
  { key: "title", label: "제목", firstDirection: "asc" },
];

function Harness({
  initial,
  onChange,
}: {
  initial: ListSort<Key>;
  onChange?: (next: ListSort<Key>) => void;
}) {
  const [value, setValue] = React.useState(initial);
  return (
    <SortCriterionChips
      criteria={CRITERIA}
      value={value}
      onValueChange={(next) => {
        setValue(next);
        onChange?.(next);
      }}
    />
  );
}

describe("SortCriterionChips", () => {
  it("is one radio group with only the chosen criterion checked, read with its direction", () => {
    render(<Harness initial={{ key: "created_at", direction: "desc" }} />);
    expect(screen.getByLabelText("정렬 기준")).toHaveProp("accessibilityRole", "radiogroup");
    expect(screen.getByRole("radio", { name: "저장일, 내림차순" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "제목" })).not.toBeChecked();
  });

  it("turns an off criterion on in its first direction", () => {
    const onChange = jest.fn();
    render(
      <Harness
        initial={{ key: "created_at", direction: "desc" }}
        onChange={onChange}
      />,
    );
    fireEvent.press(screen.getByRole("radio", { name: "제목" }));
    expect(onChange).toHaveBeenLastCalledWith({ key: "title", direction: "asc" });
    expect(screen.getByRole("radio", { name: "제목, 오름차순" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "저장일" })).not.toBeChecked();
  });

  it("reverses the criterion that is on", () => {
    render(<Harness initial={{ key: "title", direction: "asc" }} />);
    fireEvent.press(screen.getByRole("radio", { name: "제목, 오름차순" }));
    expect(screen.getByRole("radio", { name: "제목, 내림차순" })).toBeTruthy();
    fireEvent.press(screen.getByRole("radio", { name: "제목, 내림차순" }));
    expect(screen.getByRole("radio", { name: "제목, 오름차순" })).toBeTruthy();
  });
});
