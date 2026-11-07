import type { TodoDraftEditorItem } from "../components/todo-draft-list-editor";
import { PAST_REMINDER_ERROR, validateTodoDrafts } from "./todo-schedule";

// A fixed "now" so the schedules below stay ahead of it whenever the tests run.
const NOW = new Date(2026, 10, 1, 12, 0).getTime();

function draft(overrides: Partial<TodoDraftEditorItem>): TodoDraftEditorItem {
  return {
    id: "1",
    title: "액션",
    mode: "none",
    selectedWeekdays: ["mon"],
    date: null,
    time: null,
    ...overrides,
  };
}

describe("validateTodoDrafts", () => {
  it("passes actions without a schedule and untitled drafts", () => {
    const result = validateTodoDrafts(
      [draft({ id: "a", mode: "none" }), draft({ id: "b", title: "  ", mode: "time" })],
      NOW,
    );
    expect(result.hasError).toBe(false);
    expect(result.todos.map((todo) => todo.validationError)).toEqual([null, null]);
  });

  it("marks a titled scheduled action that misses its date or time", () => {
    const result = validateTodoDrafts(
      [
        draft({ id: "a", mode: "time", date: { year: 2026, month: 11, day: 20 }, time: null }),
        draft({ id: "b", mode: "none" }),
        draft({ id: "c", mode: "recurring", date: null, time: { hour: 9, minute: 0 } }),
      ],
      NOW,
    );
    expect(result.hasError).toBe(true);
    expect(result.todos.map((todo) => todo.validationError)).toEqual([
      "시간을 선택해주세요.",
      null,
      "날짜를 선택해주세요.",
    ]);
  });

  it("clears an earlier error once the schedule is complete", () => {
    const result = validateTodoDrafts(
      [
        draft({
          mode: "time",
          date: { year: 2026, month: 11, day: 20 },
          time: { hour: 9, minute: 30 },
          validationError: "시간을 선택해주세요.",
        }),
      ],
      NOW,
    );
    expect(result.hasError).toBe(false);
    expect(result.todos[0]?.validationError).toBeNull();
  });
});

describe("validateTodoDrafts with a past reminder", () => {
  const today = { year: 2026, month: 11, day: 1 };

  it("refuses a one-time reminder at or before now, like the server", () => {
    const result = validateTodoDrafts(
      [
        draft({ id: "past", mode: "time", date: today, time: { hour: 11, minute: 59 } }),
        draft({ id: "now", mode: "time", date: today, time: { hour: 12, minute: 0 } }),
        draft({ id: "ahead", mode: "time", date: today, time: { hour: 12, minute: 1 } }),
      ],
      NOW,
    );
    expect(result.hasError).toBe(true);
    expect(result.todos.map((todo) => todo.validationError)).toEqual([
      PAST_REMINDER_ERROR,
      PAST_REMINDER_ERROR,
      null,
    ]);
  });

  it("leaves recurring actions, actions without a time and untitled drafts alone", () => {
    const yesterday = { year: 2026, month: 10, day: 31 };
    const result = validateTodoDrafts(
      [
        draft({ id: "a", mode: "recurring", date: yesterday, time: { hour: 9, minute: 0 } }),
        draft({ id: "b", mode: "none", date: yesterday, time: { hour: 9, minute: 0 } }),
        draft({ id: "c", title: " ", mode: "time", date: yesterday, time: { hour: 9, minute: 0 } }),
      ],
      NOW,
    );
    expect(result.hasError).toBe(false);
  });

  it("shows a missing date or time before the past check", () => {
    const result = validateTodoDrafts([draft({ mode: "time", date: today, time: null })], NOW);
    expect(result.todos[0]?.validationError).toBe("시간을 선택해주세요.");
  });
});
