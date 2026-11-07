import type { TodoDraftEditorItem } from "@/features/todos/components/todo-draft-list-editor";

import type { LinkTodo } from "../types";
import {
  applySavedStep,
  buildSavedTodoDrafts,
  createEmptyTodoDraft,
  hasUnsavedTodoChanges,
  isTodoDraftChanged,
  planTodoSave,
} from "./link-todo-save-plan";

const LINK_ID = 7;

const savedTodos: LinkTodo[] = [
  { id: 1, title: "렌터카 예약 확인", reminderAt: "2020-11-20T00:00:00.000Z", completed: false },
  {
    id: 2,
    title: "항공권 가격 확인",
    repeatDays: ["MON", "THU"],
    repeatTime: "08:00",
    repeatUntil: "2099-12-31T14:59:59.999Z",
    completed: false,
  },
  { id: 3, title: "숙소 2박 결제", completedAt: "2026-11-01T00:00:00.000Z" },
];

function editTitle(draft: TodoDraftEditorItem, title: string): TodoDraftEditorItem {
  return { ...draft, title };
}

describe("buildSavedTodoDrafts", () => {
  it("reads each saved action as a row that may keep its past reminder", () => {
    const drafts = buildSavedTodoDrafts(savedTodos);

    expect(drafts.map((draft) => [draft.id, draft.mode, draft.done, draft.allowPast])).toEqual([
      [1, "time", false, true],
      [2, "recurring", false, true],
      [3, "none", true, true],
    ]);
    expect(drafts[1].selectedWeekdays).toEqual(["mon", "thu"]);
  });
});

describe("isTodoDraftChanged", () => {
  const [once, repeat] = buildSavedTodoDrafts(savedTodos);

  it("ignores spaces around the title and the done state", () => {
    expect(isTodoDraftChanged(once, { ...once, title: " 렌터카 예약 확인 ", done: true })).toBe(
      false,
    );
  });

  it("sees a new title, mode, time or weekday", () => {
    expect(isTodoDraftChanged(once, editTitle(once, "렌터카 반납"))).toBe(true);
    expect(isTodoDraftChanged(once, { ...once, mode: "none" })).toBe(true);
    expect(isTodoDraftChanged(once, { ...once, time: { hour: 10, minute: 0 } })).toBe(true);
    expect(isTodoDraftChanged(repeat, { ...repeat, selectedWeekdays: ["mon"] })).toBe(true);
  });

  it("does not look at the weekdays of a one-time reminder", () => {
    expect(isTodoDraftChanged(once, { ...once, selectedWeekdays: ["sun"] })).toBe(false);
  });
});

describe("hasUnsavedTodoChanges", () => {
  const saved = buildSavedTodoDrafts(savedTodos);

  it("is false for the saved rows as they are and for a blank new row", () => {
    expect(hasUnsavedTodoChanges(saved, saved)).toBe(false);
    expect(hasUnsavedTodoChanges(saved, [...saved, createEmptyTodoDraft()])).toBe(false);
  });

  it("sees a changed title, a done change and a removed row", () => {
    expect(
      hasUnsavedTodoChanges(saved, [editTitle(saved[0], "렌터카 반납"), ...saved.slice(1)]),
    ).toBe(true);
    expect(hasUnsavedTodoChanges(saved, [{ ...saved[0], done: true }, ...saved.slice(1)])).toBe(
      true,
    );
    expect(hasUnsavedTodoChanges(saved, saved.slice(1))).toBe(true);
  });

  it("sees a new row with a title or with only a schedule", () => {
    const empty = createEmptyTodoDraft();
    expect(hasUnsavedTodoChanges(saved, [...saved, { ...empty, title: "새 액션" }])).toBe(true);
    expect(hasUnsavedTodoChanges(saved, [...saved, { ...empty, mode: "time" }])).toBe(true);
  });
});

describe("planTodoSave", () => {
  const saved = buildSavedTodoDrafts(savedTodos);

  it("sends nothing when nothing changed", () => {
    expect(planTodoSave(saved, saved, LINK_ID)).toEqual([]);
  });

  it("sends only the changed actions, in delete → update → done → create order", () => {
    const fresh = { ...createEmptyTodoDraft(), title: "새 액션", done: true };
    const drafts = [
      { ...saved[1], done: true },
      editTitle(saved[2], "숙소 3박 결제"),
      fresh,
      { ...createEmptyTodoDraft(), title: "   " },
    ];

    const steps = planTodoSave(saved, drafts, LINK_ID);

    expect(steps.map((step) => step.kind)).toEqual(["delete", "update", "complete", "create"]);
    expect(steps[0]).toEqual({ kind: "delete", todoId: 1 });
    expect(steps[1]).toMatchObject({
      kind: "update",
      todoId: 3,
      payload: { linkId: LINK_ID, title: "숙소 3박 결제", reminderAt: null },
    });
    expect(steps[2]).toEqual({ kind: "complete", todoId: 2, isCompleted: true });
    expect(steps[3]).toMatchObject({
      kind: "create",
      draftId: fresh.id,
      isCompleted: true,
      payload: { linkId: LINK_ID, title: "새 액션" },
    });
  });

  it("keeps the past reminder of an unchanged action out of the requests", () => {
    const drafts = [saved[0], { ...saved[1], title: "항공권 최저가 확인" }, saved[2]];

    const steps = planTodoSave(saved, drafts, LINK_ID);

    expect(steps).toHaveLength(1);
    expect(steps[0]).toMatchObject({ kind: "update", todoId: 2 });
  });
});

describe("planTodoSave with a done action whose reminder has passed", () => {
  const saved = buildSavedTodoDrafts(savedTodos);
  const NOW = Date.parse("2026-11-07T00:00:00.000Z");

  it("drops the past reminder of a done action it has to send, as the server refuses it", () => {
    const pastDone = { ...saved[0], done: true, title: "렌터카 예약 확인함" };

    const [update] = planTodoSave(saved, [pastDone, saved[1], saved[2]], LINK_ID, NOW);

    expect(update).toMatchObject({ kind: "update", todoId: 1, payload: { reminderAt: null } });
  });

  it("drops it from a new done action too, and keeps a future reminder", () => {
    const fresh = { ...saved[0], id: "draft-1", done: true, allowPast: false };
    const future = {
      ...saved[0],
      id: "draft-2",
      title: "앞으로",
      date: { year: 2027, month: 1, day: 5 },
    };

    const steps = planTodoSave(saved, [...saved, fresh, future], LINK_ID, NOW);

    expect(steps[0]).toMatchObject({ kind: "create", payload: { reminderAt: null } });
    expect(steps[1]).toMatchObject({ kind: "create", payload: { reminderAt: expect.any(String) } });
  });
});

describe("applySavedStep", () => {
  const saved = buildSavedTodoDrafts(savedTodos);

  it("does not send a done step twice after it succeeded", () => {
    const drafts = [saved[0], { ...saved[1], done: true }, saved[2]];
    const [step] = planTodoSave(saved, drafts, LINK_ID);

    const next = applySavedStep(saved, drafts, step);

    expect(planTodoSave(next, drafts, LINK_ID)).toEqual([]);
  });

  it("turns a created row into a saved one under its server id", () => {
    const fresh = { ...createEmptyTodoDraft(), title: "새 액션" };
    const drafts = [...saved, fresh];
    const [step] = planTodoSave(saved, drafts, LINK_ID);

    const next = applySavedStep(saved, drafts, step, 99);
    const renamed = drafts.map((draft) => (draft.id === fresh.id ? { ...draft, id: 99 } : draft));

    expect(next.at(-1)).toMatchObject({ id: 99, title: "새 액션", done: false });
    expect(planTodoSave(next, renamed, LINK_ID)).toEqual([]);
  });

  it("forgets a deleted action and keeps an updated one", () => {
    const drafts = [editTitle(saved[0], "렌터카 반납"), saved[2]];
    const steps = planTodoSave(saved, drafts, LINK_ID);

    const next = steps.reduce((current, step) => applySavedStep(current, drafts, step), saved);

    expect(next.map((todo) => todo.id)).toEqual([1, 3]);
    expect(planTodoSave(next, drafts, LINK_ID)).toEqual([]);
  });
});
