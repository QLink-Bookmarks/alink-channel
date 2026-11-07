import { type DateValue, dateValueFromDate, formatDateLabel } from "@/components/ui/date-picker";
import {
  type TimeValue,
  formatTimeApi,
  formatTimeLabel,
  parseTimeApi,
  timeValueFromDate,
} from "@/components/ui/time-picker";
import type { WeekdayValue } from "@/features/todos/components/todo-editor/todo-editor";

import type { TodoDraftEditorItem } from "../components/todo-draft-list-editor";

type RepeatDay = "MON" | "TUE" | "WED" | "THU" | "FRI" | "SAT" | "SUN";

const weekdayToServer: Record<WeekdayValue, RepeatDay> = {
  mon: "MON",
  tue: "TUE",
  wed: "WED",
  thu: "THU",
  fri: "FRI",
  sat: "SAT",
  sun: "SUN",
};

const serverToWeekday: Record<RepeatDay, WeekdayValue> = {
  MON: "mon",
  TUE: "tue",
  WED: "wed",
  THU: "thu",
  FRI: "fri",
  SAT: "sat",
  SUN: "sun",
};

const DEFAULT_WEEKDAYS: WeekdayValue[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

/** Schedule fields shared by CreateLinkTodoRequest, CreateTodoRequest, UpdateTodoRequest. */
type TodoScheduleApiFields = {
  reminderAt?: string | null;
  repeatUntil?: string | null;
  repeatDays?: RepeatDay[] | null;
  repeatTime?: string | null;
  repeatTimezone?: string | null;
};

function combineDateAndTime(date: DateValue, time: TimeValue): Date {
  return new Date(date.year, date.month - 1, date.day, time.hour, time.minute, 0, 0);
}

function combineDateEndOfDay(date: DateValue): Date {
  return new Date(date.year, date.month - 1, date.day, 23, 59, 59, 999);
}

function deviceTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

function todayDateValue(): DateValue {
  return dateValueFromDate(new Date());
}

function defaultTimeValue(): TimeValue {
  return { hour: 9, minute: 0 };
}

function validateDraft(draft: TodoDraftEditorItem): string | null {
  if (draft.mode === "none") return null;
  if (!draft.date && !draft.time) return "날짜와 시간을 선택해주세요.";
  if (!draft.date) return "날짜를 선택해주세요.";
  if (!draft.time) return "시간을 선택해주세요.";
  if (draft.mode === "recurring" && draft.selectedWeekdays.length === 0) {
    return "반복 요일을 하나 이상 선택해주세요.";
  }
  return null;
}

// Shown under an action whose one-time reminder is not ahead of now.
const PAST_REMINDER_ERROR = "이미 지난 시간이에요";

// Same rule as the server: an action sent with a reminderAt (no repeat) is refused
// unless that time is still ahead, both when it is created and when it is updated.
function isReminderAtPast(draft: TodoDraftEditorItem, nowMs: number = Date.now()): boolean {
  const { reminderAt } = buildScheduleApiFields(draft);
  return reminderAt != null && Date.parse(reminderAt) <= nowMs;
}

// Titled actions whose mode is "time" or "recurring" need both a date and a time,
// and a one-time reminder must be ahead of now. Each draft gets its schedule error
// (or null), so the editor can show them inline.
function validateTodoDrafts(
  todos: TodoDraftEditorItem[],
  nowMs: number = Date.now(),
): {
  todos: TodoDraftEditorItem[];
  hasError: boolean;
} {
  let hasError = false;
  const checkedTodos = todos.map((todo) => {
    const validationError =
      todo.title.trim().length > 0
        ? (validateDraft(todo) ?? (isReminderAtPast(todo, nowMs) ? PAST_REMINDER_ERROR : null))
        : null;
    if (validationError) hasError = true;
    return { ...todo, validationError };
  });
  return { todos: checkedTodos, hasError };
}

function buildScheduleApiFields(draft: TodoDraftEditorItem): TodoScheduleApiFields {
  if (draft.mode === "none" || !draft.date || !draft.time) {
    return {
      reminderAt: null,
      repeatUntil: null,
      repeatDays: null,
      repeatTime: null,
      repeatTimezone: null,
    };
  }

  if (draft.mode === "time") {
    return {
      reminderAt: combineDateAndTime(draft.date, draft.time).toISOString(),
      repeatUntil: null,
      repeatDays: null,
      repeatTime: null,
      repeatTimezone: null,
    };
  }

  // recurring
  return {
    reminderAt: null,
    repeatUntil: combineDateEndOfDay(draft.date).toISOString(),
    repeatDays: draft.selectedWeekdays.map((day) => weekdayToServer[day]),
    repeatTime: formatTimeApi(draft.time),
    repeatTimezone: deviceTimezone(),
  };
}

type ScheduleSourceFields = {
  reminderAt?: string | null;
  dueAt?: string | null;
  repeatUntil?: string | null;
  repeatDays?: RepeatDay[] | string[] | null;
  repeatTime?: string | null;
};

function dateAndTimeFromIso(value?: string | null): { date: DateValue; time: TimeValue } | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return { date: dateValueFromDate(parsed), time: timeValueFromDate(parsed) };
}

/**
 * Reconstructs a draft schedule from server-side todo fields. Used when loading
 * an existing todo into the editor.
 */
function readScheduleFromTodo(source: ScheduleSourceFields): {
  mode: "none" | "time" | "recurring";
  date: DateValue | null;
  time: TimeValue | null;
  selectedWeekdays: WeekdayValue[];
} {
  if (source.repeatDays && source.repeatDays.length > 0 && source.repeatTime) {
    const time = parseTimeApi(source.repeatTime);
    const untilParts = dateAndTimeFromIso(source.repeatUntil);
    return {
      mode: "recurring",
      date: untilParts ? untilParts.date : null,
      time: time ?? defaultTimeValue(),
      selectedWeekdays: (source.repeatDays as RepeatDay[]).map((day) => serverToWeekday[day]),
    };
  }

  const reminderParts = dateAndTimeFromIso(source.reminderAt ?? source.dueAt);
  if (reminderParts) {
    return {
      mode: "time",
      date: reminderParts.date,
      time: reminderParts.time,
      selectedWeekdays: DEFAULT_WEEKDAYS,
    };
  }

  return {
    mode: "none",
    date: null,
    time: null,
    selectedWeekdays: DEFAULT_WEEKDAYS,
  };
}

export type { RepeatDay, ScheduleSourceFields, TodoScheduleApiFields };
export {
  DEFAULT_WEEKDAYS,
  PAST_REMINDER_ERROR,
  buildScheduleApiFields,
  combineDateAndTime,
  combineDateEndOfDay,
  defaultTimeValue,
  deviceTimezone,
  formatDateLabel,
  formatTimeLabel,
  isReminderAtPast,
  readScheduleFromTodo,
  todayDateValue,
  validateDraft,
  validateTodoDrafts,
};
