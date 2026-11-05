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
});
