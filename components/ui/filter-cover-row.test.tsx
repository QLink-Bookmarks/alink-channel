import * as React from "react";
import { AccessibilityInfo, Pressable } from "react-native";

import { Text } from "@/components/ui/text";
import { NavigationContext } from "@react-navigation/native";
import { act, fireEvent, render, screen } from "@testing-library/react-native";

import { FilterChip } from "./filter-chip";
import { FilterCoverRow, type FilterPill, getFilterCoverButtonLabel } from "./filter-cover-row";
import { FILTER_COVER_IDLE_MS } from "./use-filter-cover-auto-close";

/* eslint-disable @typescript-eslint/no-require-imports -- jest.mock factories must require */
jest.mock("react-native-worklets", () => require("react-native-worklets/src/mock"));
jest.mock("react-native-reanimated", () => require("react-native-reanimated/mock"));
/* eslint-enable @typescript-eslint/no-require-imports */

const PILL: FilterPill = {
  parts: [
    { id: "star", text: <Text>★</Text>, mark: <Text>★</Text> },
    { id: "sort", text: <Text>제목 ↑</Text>, mark: <Text>⇡</Text> },
  ],
};

async function renderRow(overrides: Partial<React.ComponentProps<typeof FilterCoverRow>> = {}) {
  const view = render(
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
  // Let the screen reader check settle.
  await act(async () => {});
  return view;
}

function openRow() {
  fireEvent.press(screen.getByRole("button", { name: /^정렬·필터 열기/ }));
}

function expectClosed() {
  expect(screen.getByRole("button", { name: /^정렬·필터 열기/ })).toBeCollapsed();
  expect(screen.queryByRole("switch", { name: "바로가기만 보기" })).toBeNull();
}

// A pointer press inside the cover: touch down, then up (what arms the auto close on a device).
function pressInsideCover() {
  const cover = screen.getByLabelText("정렬·필터");
  fireEvent(cover, "touchStart");
  fireEvent(cover, "touchEnd");
}

beforeEach(() => {
  jest.spyOn(AccessibilityInfo, "isScreenReaderEnabled").mockResolvedValue(false);
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(false);
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe("getFilterCoverButtonLabel", () => {
  it("names the button by what pressing it does", async () => {
    expect(getFilterCoverButtonLabel("정렬·필터", false, null)).toBe("정렬·필터 열기");
    expect(getFilterCoverButtonLabel("정렬·필터", true, null)).toBe("정렬·필터 닫기");
  });

  it("adds the applied values", async () => {
    expect(getFilterCoverButtonLabel("정렬·필터", false, "제목 오름차순, 바로가기만")).toBe(
      "정렬·필터 열기, 적용 중: 제목 오름차순, 바로가기만",
    );
  });
});

describe("FilterCoverRow", () => {
  it("starts collapsed with the cover hidden", async () => {
    await renderRow();
    expectClosed();
  });

  it("opens the cover and turns the button into a close button", async () => {
    await renderRow();
    openRow();
    expect(screen.getByRole("button", { name: "정렬·필터 닫기" })).toBeExpanded();
    expect(screen.getByRole("switch", { name: "바로가기만 보기" })).toBeTruthy();
  });

  it("closes again from the button", async () => {
    await renderRow();
    openRow();
    fireEvent.press(screen.getByRole("button", { name: "정렬·필터 닫기" }));
    expectClosed();
  });

  it("shows the applied values on the collapsed button and says them in its name", async () => {
    await renderRow({ pill: PILL, appliedLabel: "제목 오름차순, 바로가기만" });
    expect(
      screen.getByRole("button", { name: "정렬·필터 열기, 적용 중: 제목 오름차순, 바로가기만" }),
    ).toBeTruthy();
    // The pill itself is drawn for the eye only (the button name says it); so are its measuring copies.
    expect(screen.getAllByText("제목 ↑", { includeHiddenElements: true }).length).toBeGreaterThan(
      1,
    );
    expect(screen.queryAllByText("제목 ↑")).toHaveLength(0);
  });

  it("keeps the applied values in the button name while open", async () => {
    await renderRow({ pill: PILL, appliedLabel: "제목 오름차순, 바로가기만" });
    openRow();
    expect(
      screen.getByRole("button", { name: "정렬·필터 닫기, 적용 중: 제목 오름차순, 바로가기만" }),
    ).toBeTruthy();
  });

  it("names the 1st chips as one group and hides them from assistive technology while covered", async () => {
    await renderRow();
    expect(screen.getByLabelText("폴더")).toHaveProp("accessibilityRole", "radiogroup");
    expect(screen.getByRole("radio", { name: "전체" })).toBeTruthy();
    openRow();
    expect(screen.queryByRole("radio", { name: "전체" })).toBeNull();
  });

  it("takes a plain label instead of chips", async () => {
    await renderRow({ primary: <Text>12개 링크</Text>, primaryLabel: undefined });
    expect(screen.getByText("12개 링크")).toBeTruthy();
    expect(screen.queryByLabelText("폴더")).toBeNull();
  });

  describe("auto close", () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    it("closes the idle time after a press inside the cover", async () => {
      await renderRow();
      openRow();
      pressInsideCover();
      act(() => jest.advanceTimersByTime(FILTER_COVER_IDLE_MS - 1));
      expect(screen.getByRole("button", { name: "정렬·필터 닫기" })).toBeTruthy();
      act(() => jest.advanceTimersByTime(1));
      expectClosed();
    });

    it("stays open when only opened", async () => {
      await renderRow();
      openRow();
      act(() => jest.advanceTimersByTime(FILTER_COVER_IDLE_MS * 3));
      expect(screen.getByRole("button", { name: "정렬·필터 닫기" })).toBeTruthy();
    });

    it("waits again after each press", async () => {
      await renderRow();
      openRow();
      pressInsideCover();
      act(() => jest.advanceTimersByTime(1000));
      pressInsideCover();
      act(() => jest.advanceTimersByTime(1000));
      expect(screen.getByRole("button", { name: "정렬·필터 닫기" })).toBeTruthy();
      act(() => jest.advanceTimersByTime(FILTER_COVER_IDLE_MS - 1000));
      expectClosed();
    });

    it("stays open with a screen reader on", async () => {
      jest.spyOn(AccessibilityInfo, "isScreenReaderEnabled").mockResolvedValue(true);
      await renderRow();
      openRow();
      pressInsideCover();
      act(() => jest.advanceTimersByTime(FILTER_COVER_IDLE_MS * 3));
      expect(screen.getByRole("button", { name: "정렬·필터 닫기" })).toBeTruthy();
    });
  });

  it("closes when the screen loses focus", async () => {
    let handleBlur: (() => void) | null = null;
    const navigation = {
      addListener: (event: string, listener: () => void) => {
        if (event === "blur") {
          handleBlur = listener;
        }
        return () => {};
      },
    } as unknown as React.ComponentProps<typeof NavigationContext.Provider>["value"];
    render(
      <NavigationContext.Provider value={navigation}>
        <FilterCoverRow
          appliedLabel={null}
          cover={<Text>2차</Text>}
          coverLabel="정렬·필터"
          coverMode="fill"
          pill={null}
          primary={<Text>12개 링크</Text>}
        />
      </NavigationContext.Provider>,
    );
    await act(async () => {});
    openRow();
    act(() => handleBlur?.());
    expect(screen.getByRole("button", { name: "정렬·필터 열기" })).toBeCollapsed();
  });

  it("opens and closes the same way with reduced motion", async () => {
    jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true);
    await renderRow({ pill: PILL, appliedLabel: "제목 오름차순, 바로가기만" });
    openRow();
    expect(screen.getByRole("switch", { name: "바로가기만 보기" })).toBeTruthy();
    fireEvent.press(screen.getByRole("button", { name: /^정렬·필터 닫기/ }));
    expectClosed();
  });
});
