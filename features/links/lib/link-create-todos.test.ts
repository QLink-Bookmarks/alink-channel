import type { TodoDraftEditorItem } from "@/features/todos/components/todo-draft-list-editor";

import { buildAiMemoAndTodoFields, buildLinkTodoRequests } from "./link-create-todos";

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

describe("buildLinkTodoRequests", () => {
  it("drops untitled drafts and trims titles", () => {
    expect(
      buildLinkTodoRequests([draft({ title: "  읽기  " }), draft({ id: "2", title: " " })]),
    ).toEqual([
      {
        title: "읽기",
        reminderAt: null,
        repeatUntil: null,
        repeatDays: null,
        repeatTime: null,
        repeatTimezone: null,
      },
    ]);
  });

  it("sends a timed action's date and time as reminderAt", () => {
    const [request] = buildLinkTodoRequests([
      draft({
        mode: "time",
        date: { year: 2026, month: 11, day: 20 },
        time: { hour: 14, minute: 30 },
      }),
    ]);
    expect(request?.reminderAt).toBe(new Date(2026, 10, 20, 14, 30).toISOString());
    expect(request?.repeatDays).toBeNull();
  });

  it("sends a recurring action's weekdays, time and end date", () => {
    const [request] = buildLinkTodoRequests([
      draft({
        mode: "recurring",
        selectedWeekdays: ["mon", "fri"],
        date: { year: 2026, month: 12, day: 31 },
        time: { hour: 8, minute: 0 },
      }),
    ]);
    expect(request?.reminderAt).toBeNull();
    expect(request?.repeatDays).toEqual(["MON", "FRI"]);
    expect(request?.repeatTime).toBe("08:00");
    expect(request?.repeatTimezone).toBe(Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC");
    expect(request?.repeatUntil).toBe(new Date(2026, 11, 31, 23, 59, 59, 999).toISOString());
  });
});

describe("buildAiMemoAndTodoFields", () => {
  it("sends the trimmed memo and the titled actions", () => {
    expect(
      buildAiMemoAndTodoFields("  메모  ", [
        draft({ title: " 읽기 " }),
        draft({ id: "2", title: "" }),
      ]),
    ).toEqual({
      memo: "메모",
      todos: [
        {
          title: "읽기",
          reminderAt: null,
          repeatUntil: null,
          repeatDays: null,
          repeatTime: null,
          repeatTimezone: null,
        },
      ],
    });
  });

  it("leaves out a blank memo and an empty action list", () => {
    expect(buildAiMemoAndTodoFields("   ", [draft({ title: " " })])).toEqual({});
  });

  it("sends only the part that was typed", () => {
    expect(buildAiMemoAndTodoFields("메모", [])).toEqual({ memo: "메모" });
    expect(Object.keys(buildAiMemoAndTodoFields("", [draft({})]))).toEqual(["todos"]);
  });
});
