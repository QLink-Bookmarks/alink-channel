import { render, screen } from "@testing-library/react-native";

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
