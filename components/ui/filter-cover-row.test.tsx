import * as React from "react";
import { Pressable } from "react-native";

import { Text } from "@/components/ui/text";
import { fireEvent, render, screen } from "@testing-library/react-native";

import { FilterChip } from "./filter-chip";
import { FilterCoverRow, type FilterPill, getFilterCoverButtonLabel } from "./filter-cover-row";

const PILL: FilterPill = {
  parts: [
    { id: "star", text: <Text>★</Text>, mark: <Text>★</Text> },
    { id: "sort", text: <Text>제목 ↑</Text>, mark: <Text>⇡</Text> },
  ],
};

function renderRow(overrides: Partial<React.ComponentProps<typeof FilterCoverRow>> = {}) {
  return render(
    <FilterCoverRow
      appliedLabel={null}
      coverLabel="정렬·필터"
      coverMode="fill"
      pill={null}
      primaryLabel="폴더"
      primary={
        <FilterChip
          label="전체"
          selected
          onPress={() => {}}
        />
      }
      cover={
        <Pressable
          accessibilityLabel="바로가기만 보기"
          accessibilityRole="switch"
        />
      }
      {...overrides}
    />,
  );
}

describe("getFilterCoverButtonLabel", () => {
  it("names the button by what pressing it does", () => {
    expect(getFilterCoverButtonLabel("정렬·필터", false, null)).toBe("정렬·필터 열기");
    expect(getFilterCoverButtonLabel("정렬·필터", true, null)).toBe("정렬·필터 닫기");
  });

  it("adds the applied values", () => {
    expect(getFilterCoverButtonLabel("정렬·필터", false, "제목 오름차순, 바로가기만")).toBe(
      "정렬·필터 열기, 적용 중: 제목 오름차순, 바로가기만",
    );
  });
});

describe("FilterCoverRow", () => {
  it("starts collapsed with the cover hidden", () => {
    renderRow();
    const button = screen.getByRole("button", { name: "정렬·필터 열기" });
    expect(button).toBeCollapsed();
    expect(screen.queryByRole("switch", { name: "바로가기만 보기" })).toBeNull();
  });

  it("opens the cover and turns the button into a close button", () => {
    renderRow();
    fireEvent.press(screen.getByRole("button", { name: "정렬·필터 열기" }));
    const button = screen.getByRole("button", { name: "정렬·필터 닫기" });
    expect(button).toBeExpanded();
    expect(screen.getByRole("switch", { name: "바로가기만 보기" })).toBeTruthy();
  });

  it("closes again from the button", () => {
    renderRow();
    fireEvent.press(screen.getByRole("button", { name: "정렬·필터 열기" }));
    fireEvent.press(screen.getByRole("button", { name: "정렬·필터 닫기" }));
    expect(screen.getByRole("button", { name: "정렬·필터 열기" })).toBeTruthy();
    expect(screen.queryByRole("switch", { name: "바로가기만 보기" })).toBeNull();
  });

  it("shows the applied values on the collapsed button and says them in its name", () => {
    renderRow({ pill: PILL, appliedLabel: "제목 오름차순, 바로가기만" });
    expect(
      screen.getByRole("button", { name: "정렬·필터 열기, 적용 중: 제목 오름차순, 바로가기만" }),
    ).toBeTruthy();
    // Shown once on the button; the measuring copy is hidden from assistive technology.
    expect(screen.getAllByText("제목 ↑", { includeHiddenElements: true })).toHaveLength(2);
    expect(screen.getAllByText("제목 ↑")).toHaveLength(1);
  });

  it("drops the pill while open", () => {
    renderRow({ pill: PILL, appliedLabel: "제목 오름차순, 바로가기만" });
    fireEvent.press(
      screen.getByRole("button", { name: "정렬·필터 열기, 적용 중: 제목 오름차순, 바로가기만" }),
    );
    expect(screen.queryAllByText("제목 ↑")).toHaveLength(0);
  });

  it("names the 1st chips as one group and hides them from assistive technology while covered", () => {
    renderRow();
    expect(screen.getByLabelText("폴더")).toHaveProp("accessibilityRole", "radiogroup");
    expect(screen.getByRole("radio", { name: "전체" })).toBeTruthy();
    fireEvent.press(screen.getByRole("button", { name: "정렬·필터 열기" }));
    expect(screen.queryByRole("radio", { name: "전체" })).toBeNull();
  });

  it("takes a plain label instead of chips", () => {
    renderRow({ primary: <Text>12개 링크</Text>, primaryLabel: undefined });
    expect(screen.getByText("12개 링크")).toBeTruthy();
    expect(screen.queryByLabelText("폴더")).toBeNull();
  });
});
