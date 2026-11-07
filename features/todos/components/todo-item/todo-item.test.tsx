import { fireEvent, render, screen } from "@testing-library/react-native";

import { TodoItem } from "./todo-item";

/* eslint-disable @typescript-eslint/no-require-imports -- jest.mock factories must require */
jest.mock("react-native-worklets", () => require("react-native-worklets/src/mock"));
jest.mock("react-native-reanimated", () => require("react-native-reanimated/mock"));

describe("TodoItem display card", () => {
  it("marks a shared action with 공유 액션", () => {
    render(
      <TodoItem
        isShared
        reminderLabel="11/05 09:00"
        text="자기소개서 초안 작성"
        variant="display"
      />,
    );

    expect(screen.getByText("자기소개서 초안 작성")).toBeOnTheScreen();
    expect(screen.getByText(/공유 액션/)).toBeOnTheScreen();
  });

  it("has no shared badge for a personal action", () => {
    render(
      <TodoItem
        reminderLabel="11/05 09:00"
        text="자기소개서 초안 작성"
        variant="display"
      />,
    );

    expect(screen.queryByText(/공유 액션/)).toBeNull();
  });

  it("shows a one-time reminder with the alarm clock", () => {
    render(
      <TodoItem
        reminderLabel="11/20 09:00"
        text="자기소개서 초안 작성"
        variant="display"
      />,
    );

    expect(screen.getByText("11/20 09:00")).toBeOnTheScreen();
    expect(screen.getByTestId("todo-item-reminder-once")).toBeOnTheScreen();
    expect(screen.queryByTestId("todo-item-reminder-repeat")).toBeNull();
  });

  it("shows a repeat with the repeat icon", () => {
    render(
      <TodoItem
        reminderLabel="매주 월·목 오전 8:00 · 12월 31일까지"
        scheduleKind="repeat"
        text="회고 정리"
        variant="display"
      />,
    );

    expect(screen.getByText("매주 월·목 오전 8:00 · 12월 31일까지")).toBeOnTheScreen();
    expect(screen.getByTestId("todo-item-reminder-repeat")).toBeOnTheScreen();
    expect(screen.queryByTestId("todo-item-reminder-once")).toBeNull();
  });

  it("hides the schedule of a done action", () => {
    render(
      <TodoItem
        done
        reminderLabel="11/05 09:00"
        text="자기소개서 초안 작성"
        variant="display"
      />,
    );

    expect(screen.getByText("자기소개서 초안 작성")).toBeOnTheScreen();
    expect(screen.queryByTestId("todo-item-reminder")).toBeNull();
    expect(screen.queryByText("11/05 09:00")).toBeNull();
  });

  it("marks an overdue action that is not done", () => {
    const { rerender } = render(
      <TodoItem
        overdue
        reminderLabel="11/05 09:00 (지남)"
        text="자기소개서 초안 작성"
        variant="display"
      />,
    );
    expect(screen.getByTestId("todo-item-overdue")).toBeOnTheScreen();

    rerender(
      <TodoItem
        done
        overdue
        reminderLabel="11/05 09:00 (지남)"
        text="자기소개서 초안 작성"
        variant="display"
      />,
    );
    expect(screen.queryByTestId("todo-item-overdue")).toBeNull();
    expect(screen.getByTestId("todo-item")).toBeOnTheScreen();
  });
});

describe("TodoItem display card names", () => {
  it("names the checkbox with the action's title", () => {
    const { rerender } = render(
      <TodoItem
        text="렌터카 예약 확인"
        variant="display"
      />,
    );
    expect(screen.getByRole("checkbox", { name: "완료 표시, 렌터카 예약 확인" })).toBeOnTheScreen();

    rerender(
      <TodoItem
        done
        text="렌터카 예약 확인"
        variant="display"
      />,
    );
    expect(screen.getByRole("checkbox", { name: "완료 취소, 렌터카 예약 확인" })).toBeOnTheScreen();

    rerender(
      <TodoItem
        text="  "
        variant="display"
      />,
    );
    expect(screen.getByRole("checkbox", { name: "완료 표시, 제목 없는 액션" })).toBeOnTheScreen();
  });

  it("is a button named by its title, schedule and press hint, beside the checkbox", () => {
    const handlePress = jest.fn();
    const handleToggle = jest.fn();
    render(
      <TodoItem
        pressHint="고치기"
        reminderLabel="11/20 22:45"
        text="렌터카 예약 확인"
        variant="display"
        onPress={handlePress}
        onToggle={handleToggle}
      />,
    );

    fireEvent.press(screen.getByRole("button", { name: "렌터카 예약 확인, 11/20 22:45, 고치기" }));
    expect(handlePress).toHaveBeenCalledTimes(1);

    fireEvent.press(screen.getByRole("checkbox", { name: "완료 표시, 렌터카 예약 확인" }));
    expect(handleToggle).toHaveBeenCalledWith(true);
    expect(handlePress).toHaveBeenCalledTimes(1);
  });

  it("leaves the schedule out of the name when there is none or the action is done", () => {
    const { rerender } = render(
      <TodoItem
        pressHint="고치기"
        text="숙소 2박 결제"
        variant="display"
        onPress={jest.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: "숙소 2박 결제, 고치기" })).toBeOnTheScreen();

    rerender(
      <TodoItem
        done
        pressHint="고치기"
        reminderLabel="11/20 22:45"
        text="숙소 2박 결제"
        variant="display"
        onPress={jest.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: "숙소 2박 결제, 고치기" })).toBeOnTheScreen();
  });

  it("reads the link row and the shared badge in the card's name", () => {
    render(
      <TodoItem
        isShared
        linkTitle="제주 여행 준비"
        linkUrl="https://brunch.co.kr/@a/1"
        reminderLabel="11/20 22:45"
        text="렌터카 예약 확인"
        variant="display"
        onPress={jest.fn()}
      />,
    );
    expect(
      screen.getByRole("button", {
        name: "렌터카 예약 확인, 11/20 22:45, 공유 액션, brunch.co.kr · 제주 여행 준비",
      }),
    ).toBeOnTheScreen();
  });
});
