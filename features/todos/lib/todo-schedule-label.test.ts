import type { TodoDraftEditorItem } from "../components/todo-draft-list-editor";
import { formatDraftSchedule, formatTodoSchedule } from "./todo-schedule-label";

const NOW = new Date(2026, 10, 7, 12, 0).getTime();

function iso(year: number, month: number, day: number, hour = 0, minute = 0): string {
  return new Date(year, month - 1, day, hour, minute).toISOString();
}

function endOfDay(year: number, month: number, day: number): string {
  return new Date(year, month - 1, day, 23, 59, 59, 999).toISOString();
}

function draft(overrides: Partial<TodoDraftEditorItem>): TodoDraftEditorItem {
  return {
    id: "1",
    title: "액션",
    mode: "none",
    selectedWeekdays: ["mon", "tue", "wed", "thu", "fri", "sat", "sun"],
    date: null,
    time: null,
    ...overrides,
  };
}

describe("formatTodoSchedule", () => {
  it("shows a one-time reminder as MM/DD HH:mm", () => {
    expect(formatTodoSchedule({ reminderAt: iso(2026, 11, 20, 9, 0) }, NOW)).toEqual({
      kind: "once",
      label: "11/20 09:00",
      overdue: false,
    });
  });

  it("falls back to dueAt when there is no reminderAt", () => {
    expect(formatTodoSchedule({ dueAt: iso(2026, 12, 3, 18, 5) }, NOW).label).toBe("12/03 18:05");
  });

  it("marks a past one-time reminder with (지남)", () => {
    expect(formatTodoSchedule({ reminderAt: iso(2026, 11, 5, 9, 0) }, NOW)).toEqual({
      kind: "once",
      label: "11/05 09:00 (지남)",
      overdue: true,
    });
  });

  it("treats a reminder at this very moment as past, like the past-time check", () => {
    expect(formatTodoSchedule({ reminderAt: new Date(NOW).toISOString() }, NOW).overdue).toBe(true);
  });

  it("never marks a done action as overdue", () => {
    const past = iso(2026, 11, 5, 9, 0);
    expect(formatTodoSchedule({ reminderAt: past, completedAt: past }, NOW)).toEqual({
      kind: "once",
      label: "11/05 09:00",
      overdue: false,
    });
    expect(formatTodoSchedule({ reminderAt: past, done: true }, NOW).overdue).toBe(false);
  });

  it("summarizes a repeat with its weekdays, 12-hour time and end date", () => {
    expect(
      formatTodoSchedule(
        { repeatDays: ["THU", "MON"], repeatTime: "08:00", repeatUntil: endOfDay(2026, 12, 31) },
        NOW,
      ),
    ).toEqual({ kind: "repeat", label: "매주 월·목 오전 8:00 · 12월 31일까지", overdue: false });
  });

  it("orders weekdays from Monday to Sunday and drops duplicates", () => {
    expect(
      formatTodoSchedule({ repeatDays: ["SUN", "WED", "MON", "WED"], repeatTime: "21:30" }, NOW)
        .label,
    ).toBe("매주 월·수·일 오후 9:30");
  });

  it("shortens all seven days, weekdays and the weekend", () => {
    const until = endOfDay(2026, 12, 31);
    expect(
      formatTodoSchedule(
        {
          repeatDays: ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"],
          repeatTime: "08:00",
          repeatUntil: until,
        },
        NOW,
      ).label,
    ).toBe("매일 오전 8:00 · 12월 31일까지");
    expect(
      formatTodoSchedule(
        { repeatDays: ["MON", "TUE", "WED", "THU", "FRI"], repeatTime: "08:00" },
        NOW,
      ).label,
    ).toBe("평일 오전 8:00");
    expect(formatTodoSchedule({ repeatDays: ["SAT", "SUN"], repeatTime: "08:00" }, NOW).label).toBe(
      "주말 오전 8:00",
    );
    expect(
      formatTodoSchedule({ repeatDays: ["MON", "TUE", "WED", "THU"], repeatTime: "08:00" }, NOW)
        .label,
    ).toBe("매주 월·화·수·목 오전 8:00");
  });

  it("reads 12-hour boundaries as 오전 12 and 오후 12", () => {
    expect(formatTodoSchedule({ repeatDays: ["MON"], repeatTime: "00:05:00" }, NOW).label).toBe(
      "매주 월 오전 12:05",
    );
    expect(formatTodoSchedule({ repeatDays: ["MON"], repeatTime: "12:00" }, NOW).label).toBe(
      "매주 월 오후 12:00",
    );
  });

  it("marks a repeat overdue only once its end date has passed", () => {
    expect(
      formatTodoSchedule(
        { repeatDays: ["MON"], repeatTime: "08:00", repeatUntil: endOfDay(2026, 11, 6) },
        NOW,
      ),
    ).toEqual({ kind: "repeat", label: "매주 월 오전 8:00 · 11월 6일까지 (지남)", overdue: true });
    expect(
      formatTodoSchedule(
        { repeatDays: ["MON"], repeatTime: "08:00", repeatUntil: endOfDay(2026, 11, 7) },
        NOW,
      ).overdue,
    ).toBe(false);
    expect(
      formatTodoSchedule(
        {
          repeatDays: ["MON"],
          repeatTime: "08:00",
          repeatUntil: endOfDay(2026, 11, 6),
          completedAt: iso(2026, 11, 6),
        },
        NOW,
      ).overdue,
    ).toBe(false);
  });

  it("prefers the repeat over a leftover reminderAt", () => {
    expect(
      formatTodoSchedule(
        { reminderAt: iso(2026, 11, 5, 9, 0), repeatDays: ["MON"], repeatTime: "08:00" },
        NOW,
      ),
    ).toEqual({ kind: "repeat", label: "매주 월 오전 8:00", overdue: false });
  });

  it("has no label without a schedule or with unreadable values", () => {
    const none = { kind: "none", label: null, overdue: false };
    expect(formatTodoSchedule({}, NOW)).toEqual(none);
    expect(formatTodoSchedule({ reminderAt: "not a date" }, NOW)).toEqual(none);
    expect(formatTodoSchedule({ repeatDays: [], repeatTime: "08:00" }, NOW)).toEqual(none);
    expect(formatTodoSchedule({ repeatDays: ["MON"], repeatTime: null }, NOW)).toEqual(none);
  });
});

describe("formatDraftSchedule", () => {
  it("gives the same line as the saved action", () => {
    expect(
      formatDraftSchedule(
        draft({
          mode: "time",
          date: { year: 2026, month: 11, day: 20 },
          time: { hour: 9, minute: 0 },
        }),
        NOW,
      ),
    ).toEqual({ kind: "once", label: "11/20 09:00", overdue: false });
    expect(
      formatDraftSchedule(
        draft({
          mode: "recurring",
          selectedWeekdays: ["thu", "mon"],
          date: { year: 2026, month: 12, day: 31 },
          time: { hour: 8, minute: 0 },
        }),
        NOW,
      ),
    ).toEqual({ kind: "repeat", label: "매주 월·목 오전 8:00 · 12월 31일까지", overdue: false });
  });

  it("marks a past one-time draft with (지남)", () => {
    expect(
      formatDraftSchedule(
        draft({
          mode: "time",
          date: { year: 2026, month: 11, day: 5 },
          time: { hour: 9, minute: 0 },
        }),
        NOW,
      ),
    ).toEqual({ kind: "once", label: "11/05 09:00 (지남)", overdue: true });
  });

  it("returns no schedule for 알림 없음", () => {
    expect(formatDraftSchedule(draft({ mode: "none" }), NOW)).toEqual({
      kind: "none",
      label: null,
      overdue: false,
    });
  });

  it("returns null while the schedule is not filled in", () => {
    expect(
      formatDraftSchedule(draft({ mode: "time", date: { year: 2026, month: 11, day: 20 } }), NOW),
    ).toBeNull();
    expect(
      formatDraftSchedule(draft({ mode: "time", time: { hour: 9, minute: 0 } }), NOW),
    ).toBeNull();
    expect(
      formatDraftSchedule(
        draft({
          mode: "recurring",
          selectedWeekdays: [],
          date: { year: 2026, month: 12, day: 31 },
          time: { hour: 8, minute: 0 },
        }),
        NOW,
      ),
    ).toBeNull();
  });
});
