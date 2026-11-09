import type { TodoDraftEditorItem } from "@/features/todos/components/todo-draft-list-editor";
import type { WeekdayValue } from "@/features/todos/components/todo-editor/todo-editor";
import {
  DEFAULT_WEEKDAYS,
  buildScheduleApiFields,
  isReminderAtPast,
  readScheduleFromTodo,
} from "@/features/todos/lib/todo-schedule";
import type { CreateTodoRequest, UpdateTodoRequest } from "@/features/todos/types";

import type { LinkTodo } from "../types";

type TodoId = TodoDraftEditorItem["id"];

type LinkTodoSaveStep =
  | { kind: "delete"; todoId: TodoId }
  | { kind: "update"; todoId: TodoId; payload: UpdateTodoRequest }
  | { kind: "complete"; todoId: TodoId; isCompleted: boolean }
  | { kind: "create"; draftId: TodoId; payload: CreateTodoRequest; isCompleted: boolean };

function getLinkTodoTitle(todo: LinkTodo): string {
  return todo.title ?? todo.content ?? "액션";
}

function isLinkTodoDone(todo: LinkTodo): boolean {
  return todo.done ?? todo.completed ?? Boolean(todo.completedAt);
}

// A saved action as an editor row. It may keep a past reminder until it is changed.
function buildSavedTodoDrafts(todos: LinkTodo[]): TodoDraftEditorItem[] {
  return todos.map((todo) => {
    const schedule = readScheduleFromTodo({
      reminderAt: todo.reminderAt,
      dueAt: todo.dueAt,
      repeatUntil: todo.repeatUntil,
      repeatDays: todo.repeatDays ?? null,
      repeatTime: todo.repeatTime,
    });
    return {
      id: todo.id,
      title: getLinkTodoTitle(todo),
      mode: schedule.mode,
      date: schedule.date,
      time: schedule.time,
      selectedWeekdays: schedule.selectedWeekdays.length
        ? schedule.selectedWeekdays
        : DEFAULT_WEEKDAYS,
      done: isLinkTodoDone(todo),
      allowPast: true,
    };
  });
}

function createEmptyTodoDraft(): TodoDraftEditorItem {
  return {
    id: `draft-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title: "",
    mode: "none",
    date: null,
    time: null,
    selectedWeekdays: DEFAULT_WEEKDAYS,
    done: false,
  };
}

function sameWeekdays(left: WeekdayValue[], right: WeekdayValue[]): boolean {
  return left.length === right.length && left.every((day) => right.includes(day));
}

function sameValue<T extends object>(left: T | null, right: T | null): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

// True when the title or the schedule differs from the saved action; done is separate.
function isTodoDraftChanged(saved: TodoDraftEditorItem, draft: TodoDraftEditorItem): boolean {
  if (saved.title.trim() !== draft.title.trim() || saved.mode !== draft.mode) return true;
  if (draft.mode === "none") return false;
  if (!sameValue(saved.date, draft.date) || !sameValue(saved.time, draft.time)) return true;
  return (
    draft.mode === "recurring" && !sameWeekdays(saved.selectedWeekdays, draft.selectedWeekdays)
  );
}

function hasTodoDraftContent(draft: TodoDraftEditorItem): boolean {
  return draft.title.trim().length > 0;
}

// True when leaving the editor would lose something: a saved action changed, checked or
// removed, or a new row that has a title or a schedule.
function hasUnsavedTodoChanges(
  saved: TodoDraftEditorItem[],
  drafts: TodoDraftEditorItem[],
): boolean {
  const draftIds = new Set(drafts.map((draft) => String(draft.id)));
  if (saved.some((todo) => !draftIds.has(String(todo.id)))) return true;
  const savedById = new Map(saved.map((todo) => [String(todo.id), todo]));
  return drafts.some((draft) => {
    const savedTodo = savedById.get(String(draft.id));
    if (!savedTodo) return hasTodoDraftContent(draft) || draft.mode !== "none";
    return (
      isTodoDraftChanged(savedTodo, draft) || (savedTodo.done === true) !== (draft.done === true)
    );
  });
}

// The server refuses a past one-time reminder on every create and update, done or not. A
// done action is never reminded and hides its schedule, so its past reminder is dropped
// instead of blocking the save; a pending one is checked by the editor before this.
function buildSendableSchedule(draft: TodoDraftEditorItem, nowMs: number) {
  const schedule = buildScheduleApiFields(draft);
  if (draft.done === true && isReminderAtPast(draft, nowMs)) {
    return { ...schedule, reminderAt: null };
  }
  return schedule;
}

// The requests that turn the saved actions into the drafts, in the order they are sent:
// deletes, then changed titles or schedules, then done changes, then new actions. A new
// action checked as done is created and then completed. Rows without a title are not sent.
function planTodoSave(
  saved: TodoDraftEditorItem[],
  drafts: TodoDraftEditorItem[],
  linkId: number,
  nowMs: number = Date.now(),
): LinkTodoSaveStep[] {
  const savedById = new Map(saved.map((todo) => [String(todo.id), todo]));
  const draftIds = new Set(drafts.map((draft) => String(draft.id)));
  const deletes: LinkTodoSaveStep[] = saved
    .filter((todo) => !draftIds.has(String(todo.id)))
    .map((todo) => ({ kind: "delete", todoId: todo.id }));
  const updates: LinkTodoSaveStep[] = [];
  const completes: LinkTodoSaveStep[] = [];
  const creates: LinkTodoSaveStep[] = [];

  for (const draft of drafts) {
    const payload = { linkId, title: draft.title.trim(), ...buildSendableSchedule(draft, nowMs) };
    const savedTodo = savedById.get(String(draft.id));
    if (!savedTodo) {
      if (hasTodoDraftContent(draft)) {
        creates.push({
          kind: "create",
          draftId: draft.id,
          payload,
          isCompleted: draft.done === true,
        });
      }
      continue;
    }
    if (isTodoDraftChanged(savedTodo, draft)) {
      updates.push({ kind: "update", todoId: draft.id, payload });
    }
    if ((savedTodo.done === true) !== (draft.done === true)) {
      completes.push({ kind: "complete", todoId: draft.id, isCompleted: draft.done === true });
    }
  }

  return [...deletes, ...updates, ...completes, ...creates];
}

// The saved actions after one request of the plan succeeded, so a retry after a failure
// sends only what is still missing.
function applySavedStep(
  saved: TodoDraftEditorItem[],
  drafts: TodoDraftEditorItem[],
  step: LinkTodoSaveStep,
  createdId?: TodoId,
): TodoDraftEditorItem[] {
  switch (step.kind) {
    case "delete":
      return saved.filter((todo) => String(todo.id) !== String(step.todoId));
    case "update": {
      const draft = drafts.find((item) => String(item.id) === String(step.todoId));
      return saved.map((todo) =>
        String(todo.id) === String(step.todoId) && draft
          ? { ...draft, done: todo.done, allowPast: true, titleError: null, validationError: null }
          : todo,
      );
    }
    case "complete":
      return saved.map((todo) =>
        String(todo.id) === String(step.todoId) ? { ...todo, done: step.isCompleted } : todo,
      );
    case "create": {
      const draft = drafts.find((item) => String(item.id) === String(step.draftId));
      if (!draft || createdId == null) return saved;
      return [
        ...saved,
        {
          ...draft,
          id: createdId,
          done: false,
          allowPast: true,
          titleError: null,
          validationError: null,
        },
      ];
    }
  }
}

export {
  applySavedStep,
  buildSavedTodoDrafts,
  createEmptyTodoDraft,
  getLinkTodoTitle,
  hasUnsavedTodoChanges,
  isLinkTodoDone,
  isTodoDraftChanged,
  planTodoSave,
};
export type { LinkTodoSaveStep };
