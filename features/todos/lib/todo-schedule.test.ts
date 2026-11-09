import type { TodoDraftEditorItem } from "../components/todo-draft-list-editor";
import {
  PAST_REMINDER_ERROR,
  TITLE_REQUIRED_ERROR,
  countTodoDraftErrors,
  getDraftScheduleGap,
  validateTodoDrafts,
} from "./todo-schedule";

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

  it("leaves recurring actions and actions without a time alone", () => {
    const yesterday = { year: 2026, month: 10, day: 31 };
    const result = validateTodoDrafts(
      [
        draft({ id: "a", mode: "recurring", date: yesterday, time: { hour: 9, minute: 0 } }),
        draft({ id: "b", mode: "none", date: yesterday, time: { hour: 9, minute: 0 } }),
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

describe("validateTodoDrafts with an untitled action", () => {
  const ahead = { year: 2026, month: 11, day: 20 };

  it("keeps a scheduled action without a title and marks its title", () => {
    const result = validateTodoDrafts(
      [draft({ id: "a", title: "  ", mode: "time", date: ahead, time: { hour: 9, minute: 0 } })],
      NOW,
    );
    expect(result.hasError).toBe(true);
    expect(result.todos[0]).toMatchObject({
      id: "a",
      titleError: TITLE_REQUIRED_ERROR,
      validationError: null,
    });
  });

  it("skips an action with neither a title nor a schedule", () => {
    const result = validateTodoDrafts(
      [
        draft({ id: "empty", title: "", mode: "none" }),
        draft({ id: "mode-only", title: "", mode: "time" }),
        draft({ id: "repeat-only", title: "", mode: "recurring" }),
      ],
      NOW,
    );
    expect(result).toMatchObject({ hasError: false, errorCount: 0, firstErrorId: null });
    expect(result.todos.map((todo) => [todo.titleError, todo.validationError])).toEqual([
      [null, null],
      [null, null],
      [null, null],
    ]);
  });

  it("checks the schedule of an untitled action too, counting the action once", () => {
    const result = validateTodoDrafts(
      [draft({ id: "a", title: "", mode: "time", date: ahead, time: null })],
      NOW,
    );
    expect(result.todos[0]).toMatchObject({
      titleError: TITLE_REQUIRED_ERROR,
      validationError: "시간을 선택해주세요.",
    });
    expect(result.errorCount).toBe(1);
  });

  it("counts the actions with an error and returns the first one", () => {
    const result = validateTodoDrafts(
      [
        draft({ id: "fine", title: "읽기" }),
        draft({
          id: "untitled",
          title: "",
          mode: "time",
          date: ahead,
          time: { hour: 10, minute: 0 },
        }),
        draft({ id: "missing", title: "결제", mode: "time", date: ahead, time: null }),
      ],
      NOW,
    );
    expect(result).toMatchObject({ hasError: true, errorCount: 2, firstErrorId: "untitled" });
    expect(countTodoDraftErrors(result.todos)).toBe(2);
  });

  it("drops the count as errors are fixed", () => {
    const result = validateTodoDrafts(
      [
        draft({ id: "a", title: "", mode: "time", date: ahead, time: { hour: 10, minute: 0 } }),
        draft({ id: "b", title: "결제", mode: "time", date: ahead, time: null }),
      ],
      NOW,
    );
    const fixedTitle = result.todos.map((todo) =>
      todo.id === "a" ? { ...todo, title: "예약", titleError: null } : todo,
    );
    expect(countTodoDraftErrors(fixedTitle)).toBe(1);
    expect(validateTodoDrafts(fixedTitle, NOW).errorCount).toBe(1);
  });
});

describe("getDraftScheduleGap", () => {
  const date = { year: 2026, month: 11, day: 20 };
  const time = { hour: 9, minute: 0 };

  it("has no gap without a schedule or with a full one", () => {
    expect(getDraftScheduleGap(draft({ mode: "none" }))).toBeNull();
    expect(getDraftScheduleGap(draft({ mode: "time", date, time }))).toBeNull();
    expect(getDraftScheduleGap(draft({ mode: "recurring", date, time }))).toBeNull();
  });

  it("names the first empty field of a one-time reminder: date, then time", () => {
    expect(getDraftScheduleGap(draft({ mode: "time" }))).toBe("date");
    expect(getDraftScheduleGap(draft({ mode: "time", time }))).toBe("date");
    expect(getDraftScheduleGap(draft({ mode: "time", date }))).toBe("time");
  });

  it("names the first empty field of a repeat: weekdays, time, then the end date", () => {
    expect(
      getDraftScheduleGap(draft({ mode: "recurring", selectedWeekdays: [], date, time })),
    ).toBe("weekdays");
    expect(getDraftScheduleGap(draft({ mode: "recurring" }))).toBe("time");
    expect(getDraftScheduleGap(draft({ mode: "recurring", time }))).toBe("date");
  });
});

describe("past reminders that are not refused", () => {
  const today = { year: 2026, month: 11, day: 1 };
  const past = { mode: "time" as const, date: today, time: { hour: 9, minute: 0 } };

  it("counts a past time picked since the last save", () => {
    expect(countTodoDraftErrors([draft({ id: "a", ...past })], NOW)).toBe(1);
    expect(countTodoDraftErrors([draft({ id: "a", ...past, allowPast: true })], NOW)).toBe(0);
  });

  it("lets a saved action keep its past reminder", () => {
    const result = validateTodoDrafts([draft({ id: "a", ...past, allowPast: true })], NOW);
    expect(result.hasError).toBe(false);
  });

  it("does not check the schedule of a done action", () => {
    const result = validateTodoDrafts(
      [
        draft({ id: "a", ...past, done: true }),
        draft({ id: "b", mode: "time", date: null, time: null, done: true }),
      ],
      NOW,
    );
    expect(result.hasError).toBe(false);
    expect(countTodoDraftErrors(result.todos, NOW)).toBe(0);
  });
});
