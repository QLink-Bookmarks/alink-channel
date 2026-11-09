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

const WEEKDAYS_REQUIRED_ERROR = "반복 요일을 하나 이상 선택해주세요.";
const DATE_AND_TIME_REQUIRED_ERROR = "날짜와 시간을 선택해주세요.";
const DATE_REQUIRED_ERROR = "날짜를 선택해주세요.";
const TIME_REQUIRED_ERROR = "시간을 선택해주세요.";

// Errors follow the panel's order, so a repeat names its weekdays before its time.
function validateDraft(draft: TodoDraftEditorItem): string | null {
  if (draft.mode === "none") return null;
  if (draft.mode === "recurring" && draft.selectedWeekdays.length === 0) {
    return WEEKDAYS_REQUIRED_ERROR;
  }
  if (!draft.date && !draft.time) return DATE_AND_TIME_REQUIRED_ERROR;
  if (!draft.date) return DATE_REQUIRED_ERROR;
  if (!draft.time) return TIME_REQUIRED_ERROR;
  return null;
}

type DraftScheduleGap = "date" | "time" | "weekdays";

// The first field still empty in the schedule panel's order: a one-time reminder
// reads date then time, a repeat reads weekdays, time, then its end date.
function getDraftScheduleGap(draft: TodoDraftEditorItem): DraftScheduleGap | null {
  if (draft.mode === "none") return null;
  if (draft.mode === "recurring") {
    if (draft.selectedWeekdays.length === 0) return "weekdays";
    if (!draft.time) return "time";
    if (!draft.date) return "date";
    return null;
  }
  if (!draft.date) return "date";
  if (!draft.time) return "time";
  return null;
}

// Shown under an action whose one-time reminder is not ahead of now.
const PAST_REMINDER_ERROR = "이미 지난 시간이에요";

// Shown under the title of an action that has a schedule but no title.
const TITLE_REQUIRED_ERROR = "액션 제목을 입력해 주세요";

// Same rule as the server: an action sent with a reminderAt (no repeat) is refused
// unless that time is still ahead, both when it is created and when it is updated.
function isReminderAtPast(draft: TodoDraftEditorItem, nowMs: number = Date.now()): boolean {
  const { reminderAt } = buildScheduleApiFields(draft);
  return reminderAt != null && Date.parse(reminderAt) <= nowMs;
}

// The past-time error the editor shows as soon as a one-time reminder is picked. A
// done action and one allowed to keep its past reminder (a saved, unchanged one)
// have none.
function getLivePastError(draft: TodoDraftEditorItem, nowMs: number = Date.now()): string | null {
  if (draft.done || draft.allowPast || draft.mode !== "time") return null;
  return isReminderAtPast(draft, nowMs) ? PAST_REMINDER_ERROR : null;
}

// A schedule counts as entered once a mode is picked and a date or a time is filled.
function hasScheduleInput(draft: TodoDraftEditorItem): boolean {
  return draft.mode !== "none" && (draft.date != null || draft.time != null);
}

// An action with neither a title nor a schedule is skipped without an error. An
// action with a schedule but no title gets a title error. Scheduled actions need
// their date and time, and a one-time reminder must be ahead of now. Each draft
// gets its errors (or null), so the editor can show them inline; errorCount counts
// actions, not errors, and firstErrorId is the first action to scroll to.
function validateTodoDrafts(
  todos: TodoDraftEditorItem[],
  nowMs: number = Date.now(),
): {
  todos: TodoDraftEditorItem[];
  hasError: boolean;
  errorCount: number;
  firstErrorId: TodoDraftEditorItem["id"] | null;
} {
  let errorCount = 0;
  let firstErrorId: TodoDraftEditorItem["id"] | null = null;
  const checkedTodos = todos.map((todo) => {
    const hasTitle = todo.title.trim().length > 0;
    const titleError = !hasTitle && hasScheduleInput(todo) ? TITLE_REQUIRED_ERROR : null;
    const validationError =
      (hasTitle || titleError) && !todo.done
        ? (validateDraft(todo) ?? getLivePastError(todo, nowMs))
        : null;
    if (titleError || validationError) {
      errorCount += 1;
      firstErrorId ??= todo.id;
    }
    return { ...todo, titleError, validationError };
  });
  return { todos: checkedTodos, hasError: errorCount > 0, errorCount, firstErrorId };
}

// The number of actions that still show an error, for the summary line: the errors
// from the last save attempt plus a past time picked since.
function countTodoDraftErrors(todos: TodoDraftEditorItem[], nowMs: number = Date.now()): number {
  return todos.filter(
    (todo) => todo.titleError || todo.validationError || getLivePastError(todo, nowMs),
  ).length;
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

export type { DraftScheduleGap, RepeatDay, ScheduleSourceFields, TodoScheduleApiFields };
export {
  DATE_AND_TIME_REQUIRED_ERROR,
  DATE_REQUIRED_ERROR,
  DEFAULT_WEEKDAYS,
  PAST_REMINDER_ERROR,
  TIME_REQUIRED_ERROR,
  WEEKDAYS_REQUIRED_ERROR,
  TITLE_REQUIRED_ERROR,
  buildScheduleApiFields,
  combineDateAndTime,
  combineDateEndOfDay,
  countTodoDraftErrors,
  defaultTimeValue,
  deviceTimezone,
  formatDateLabel,
  formatTimeLabel,
  getDraftScheduleGap,
  getLivePastError,
  isReminderAtPast,
  readScheduleFromTodo,
  todayDateValue,
  validateDraft,
  validateTodoDrafts,
};
