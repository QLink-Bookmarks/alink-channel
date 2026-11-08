import { fireEvent, render, screen, within } from "@testing-library/react-native";

import { PAST_REMINDER_ERROR, TITLE_REQUIRED_ERROR } from "../lib/todo-schedule";
import { type TodoDraftEditorItem, TodoDraftListEditor } from "./todo-draft-list-editor";
import { TodoErrorSummary } from "./todo-error-summary";

/* eslint-disable @typescript-eslint/no-require-imports -- jest.mock factories must require */
jest.mock("react-native-worklets", () => require("react-native-worklets/src/mock"));
jest.mock("react-native-reanimated", () => require("react-native-reanimated/mock"));

const NEXT_YEAR = new Date().getFullYear() + 1;
const ALL_WEEKDAYS: TodoDraftEditorItem["selectedWeekdays"] = [
  "mon",
  "tue",
  "wed",
  "thu",
  "fri",
  "sat",
  "sun",
];

function draft(overrides: Partial<TodoDraftEditorItem>): TodoDraftEditorItem {
  return {
    id: "1",
    title: "렌터카 예약 확인",
    mode: "none",
    selectedWeekdays: ALL_WEEKDAYS,
    date: null,
    time: null,
    ...overrides,
  };
}

const handlers = {
  onAddTodo: jest.fn(),
  onChangeTodoMode: jest.fn(),
  onChangeTodoTitle: jest.fn(),
  onChangeTodoWeekdays: jest.fn(),
  onChangeTodoDate: jest.fn(),
  onChangeTodoTime: jest.fn(),
  onChangeTodoDone: jest.fn(),
  onRemoveTodo: jest.fn(),
};

function renderList(
  todos: TodoDraftEditorItem[],
  props: Partial<React.ComponentProps<typeof TodoDraftListEditor>> = {},
) {
  return render(
    <TodoDraftListEditor
      todos={todos}
      {...handlers}
      {...props}
    />,
  );
}

function chipTexts() {
  return screen
    .getAllByTestId("todo-schedule-chip")
    .map((chip) => within(chip).getByText(/./).props.children as string);
}

afterEach(() => jest.clearAllMocks());

describe("TodoDraftListEditor schedule chip", () => {
  it("reads 알림 없음, a missing field, or the shared schedule label", () => {
    renderList([
      draft({ id: "none" }),
      draft({ id: "no-time", mode: "time", date: { year: NEXT_YEAR, month: 11, day: 20 } }),
      draft({ id: "no-date", mode: "time", time: { hour: 9, minute: 0 } }),
      draft({
        id: "once",
        mode: "time",
        date: { year: NEXT_YEAR, month: 11, day: 20 },
        time: { hour: 9, minute: 0 },
      }),
      draft({
        id: "repeat",
        mode: "recurring",
        selectedWeekdays: ["thu", "mon"],
        date: { year: NEXT_YEAR, month: 12, day: 31 },
        time: { hour: 8, minute: 0 },
      }),
    ]);

    expect(chipTexts()).toEqual([
      "알림 없음",
      "시간 미정",
      "날짜 미정",
      "11/20 09:00",
      "매주 월·목 오전 8:00 · 12월 31일까지",
    ]);
  });

  it("opens the panel under a pressed chip and closes it on the next press", () => {
    renderList([draft({ id: "a" }), draft({ id: "b" })]);

    expect(screen.queryByTestId("todo-schedule-panel")).toBeNull();
    fireEvent.press(screen.getAllByTestId("todo-schedule-chip")[1]!);
    const panel = screen.getByTestId("todo-schedule-panel");
    expect(within(panel).getByText("알림 없음")).toBeOnTheScreen();
    expect(within(panel).getByText("한 번")).toBeOnTheScreen();
    expect(within(panel).getByText("반복")).toBeOnTheScreen();

    fireEvent.press(screen.getAllByTestId("todo-schedule-chip")[1]!);
    expect(screen.queryByTestId("todo-schedule-panel")).toBeNull();
  });

  it("follows openTodoId when the parent keeps it", () => {
    const onOpenTodoChange = jest.fn();
    renderList([draft({ id: "a" }), draft({ id: "b" })], { openTodoId: "b", onOpenTodoChange });

    expect(screen.getAllByTestId("todo-schedule-panel")).toHaveLength(1);
    fireEvent.press(screen.getAllByTestId("todo-schedule-chip")[0]!);
    expect(onOpenTodoChange).toHaveBeenCalledWith("a");
  });
});

describe("TodoDraftListEditor schedule panel", () => {
  it("puts the date before the time for a one-time reminder, with empty-field labels", () => {
    renderList([draft({ id: "a", mode: "time" })], { openTodoId: "a" });
    const panel = screen.getByTestId("todo-schedule-panel");
    const labels = within(panel)
      .getAllByText(/^(날짜|시간|요일|종료일)$/)
      .map((node) => node.props.children);
    expect(labels).toEqual(["날짜", "시간"]);
    expect(within(panel).getByText("날짜 선택")).toBeOnTheScreen();
    expect(within(panel).getByText("시간 선택")).toBeOnTheScreen();
  });

  it("reads weekdays, time, then the end date for a repeat, with every weekday on", () => {
    renderList([draft({ id: "a", mode: "recurring" })], { openTodoId: "a" });
    const panel = screen.getByTestId("todo-schedule-panel");
    const labels = within(panel)
      .getAllByText(/^(날짜|시간|요일|종료일)$/)
      .map((node) => node.props.children);
    expect(labels).toEqual(["요일", "시간", "종료일"]);
    expect(within(panel).getByText("이 날까지 알려요")).toBeOnTheScreen();
    for (const day of ["월", "화", "수", "목", "금", "토", "일"]) {
      expect(within(panel).getByText(day)).toBeOnTheScreen();
    }
    expect(within(panel).queryByText(/📌/)).toBeNull();
    expect(within(panel).queryByText("반복 요일")).toBeNull();
  });

  it("refuses a one-time reminder that already passed, as soon as it is picked", () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    renderList(
      [
        draft({
          id: "a",
          mode: "time",
          date: {
            year: yesterday.getFullYear(),
            month: yesterday.getMonth() + 1,
            day: yesterday.getDate(),
          },
          time: { hour: 9, minute: 0 },
        }),
      ],
      { openTodoId: "a" },
    );

    expect(chipTexts()[0]).toMatch(/ \(지남\)$/);
    expect(screen.getByText(PAST_REMINDER_ERROR)).toBeOnTheScreen();
  });

  it("lets a saved action keep its past reminder", () => {
    renderList(
      [
        draft({
          id: "a",
          mode: "time",
          date: { year: 2020, month: 1, day: 1 },
          time: { hour: 9, minute: 0 },
          allowPast: true,
        }),
      ],
      { openTodoId: "a" },
    );

    expect(screen.queryByText(PAST_REMINDER_ERROR)).toBeNull();
  });
});

describe("TodoDraftListEditor title", () => {
  it("cuts a title longer than 50 characters at 50", () => {
    renderList([draft({ id: "a" })]);
    fireEvent.changeText(screen.getByLabelText("액션 제목"), "가".repeat(60));
    expect(handlers.onChangeTodoTitle).toHaveBeenCalledWith("a", "가".repeat(50));
  });

  it("shows n/50 from 40 characters on", () => {
    const { rerender } = renderList([draft({ id: "a", title: "가".repeat(39) })]);
    expect(screen.queryByTestId("todo-editor-title-counter")).toBeNull();

    rerender(
      <TodoDraftListEditor
        todos={[draft({ id: "a", title: "가".repeat(40) })]}
        {...handlers}
      />,
    );
    expect(screen.getByTestId("todo-editor-title-counter")).toHaveTextContent("40/50");

    rerender(
      <TodoDraftListEditor
        todos={[draft({ id: "a", title: "가".repeat(50) })]}
        {...handlers}
      />,
    );
    expect(screen.getByTestId("todo-editor-title-counter")).toHaveTextContent("50/50");
  });

  it("shows the title error under the title", () => {
    renderList([
      draft({
        id: "a",
        title: "",
        mode: "time",
        date: { year: NEXT_YEAR, month: 11, day: 22 },
        time: { hour: 10, minute: 0 },
        titleError: TITLE_REQUIRED_ERROR,
      }),
    ]);
    expect(screen.getByText(TITLE_REQUIRED_ERROR)).toBeOnTheScreen();
  });

  it("passes the row id with each change", () => {
    renderList([draft({ id: "a" })]);
    fireEvent.changeText(screen.getByLabelText("액션 제목"), "예약");
    expect(handlers.onChangeTodoTitle).toHaveBeenCalledWith("a", "예약");
    fireEvent.press(screen.getByLabelText("액션 삭제, 렌터카 예약 확인"));
    expect(handlers.onRemoveTodo).toHaveBeenCalledWith("a");
  });
});

describe("TodoDraftListEditor add button and done checkbox", () => {
  it("shows + 액션 추가 only when asked", () => {
    const { rerender } = renderList([], { addLabel: "액션 추가" });
    fireEvent.press(screen.getByText("액션 추가"));
    expect(handlers.onAddTodo).toHaveBeenCalledTimes(1);

    rerender(
      <TodoDraftListEditor
        todos={[]}
        showAddButton={false}
        {...handlers}
      />,
    );
    expect(screen.queryByText("액션 추가")).toBeNull();
  });

  it("has no checkbox in the create form", () => {
    renderList([draft({ id: "a", done: true })]);
    expect(screen.queryByLabelText(/^완료 (표시|취소)/)).toBeNull();
    expect(screen.getByTestId("todo-schedule-chip")).toBeOnTheScreen();
  });

  it("hides the chip, panel and counter of a done row in check mode", () => {
    renderList(
      [
        draft({ id: "open", title: "가".repeat(45) }),
        draft({ id: "done", title: "가".repeat(45), done: true }),
      ],
      { check: true, openTodoId: "done" },
    );

    expect(screen.getByLabelText(`완료 표시, ${"가".repeat(45)}`)).toBeOnTheScreen();
    expect(screen.getByLabelText(`완료 취소, ${"가".repeat(45)}`)).toBeOnTheScreen();
    expect(screen.getAllByTestId("todo-schedule-chip")).toHaveLength(1);
    expect(screen.queryByTestId("todo-schedule-panel")).toBeNull();
    expect(screen.getAllByTestId("todo-editor-title-counter")).toHaveLength(1);

    fireEvent.press(screen.getByLabelText(`완료 취소, ${"가".repeat(45)}`));
    expect(handlers.onChangeTodoDone).toHaveBeenCalledWith("done", false);
  });
});

describe("TodoErrorSummary", () => {
  it("counts the actions to check and hides at zero", () => {
    const { rerender } = render(<TodoErrorSummary count={2} />);
    expect(screen.getByText("확인할 액션이 2개 있어요")).toBeOnTheScreen();
    rerender(<TodoErrorSummary count={0} />);
    expect(screen.queryByTestId("todo-error-summary")).toBeNull();
  });
});
