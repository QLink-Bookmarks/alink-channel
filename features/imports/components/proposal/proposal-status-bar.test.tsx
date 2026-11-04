import { fireEvent, render, screen } from "@testing-library/react-native";

import { ProposalStatusBar } from "./proposal-status-bar";

const REMOVED = {
  kind: "change" as const,
  change: { type: "remove" as const, linkTitle: "팀 캘린더", excludedFolder: null },
  isAfterUndo: false,
  depth: 3,
};

describe("ProposalStatusBar", () => {
  it("announces politely without the alert role", () => {
    render(
      <ProposalStatusBar
        isWide
        line={REMOVED}
        onDismiss={jest.fn()}
        onUndo={jest.fn()}
      />,
    );
    const bar = screen.getByTestId("import-status-bar");

    expect(bar.props.accessibilityLiveRegion).toBe("polite");
    expect(bar.props.accessibilityRole).toBeUndefined();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByText("‘팀 캘린더’를 가져오지 않아요.")).toBeTruthy();
  });

  it("names the undo action with the steps left and undoes on press", () => {
    const onUndo = jest.fn();
    const onDismiss = jest.fn();
    render(
      <ProposalStatusBar
        isWide={false}
        line={{ ...REMOVED, isAfterUndo: true }}
        onDismiss={onDismiss}
        onUndo={onUndo}
      />,
    );

    expect(screen.getByText("되돌렸어요. 이전 변경: ‘팀 캘린더’를 가져오지 않아요.")).toBeTruthy();
    fireEvent.press(screen.getByLabelText("다시 넣기, 되돌릴 수 있는 변경 3개"));
    expect(onUndo).toHaveBeenCalledTimes(1);
    fireEvent.press(screen.getByLabelText("알림 닫기"));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("shows a notice without an undo action", () => {
    render(
      <ProposalStatusBar
        isWide
        line={{ kind: "notice", notice: { type: "rename-blocked", name: "자바" } }}
        onDismiss={jest.fn()}
        onUndo={jest.fn()}
      />,
    );

    expect(
      screen.getByText("공유 폴더와 같은 이름은 쓸 수 없어서 ‘자바’로 그대로 뒀어요."),
    ).toBeTruthy();
    expect(screen.queryByLabelText(/되돌릴 수 있는 변경/)).toBeNull();
  });
});
