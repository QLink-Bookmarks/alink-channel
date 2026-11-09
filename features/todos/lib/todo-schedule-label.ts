import type { TodoDraftEditorItem } from "../components/todo-draft-list-editor";
import { type RepeatDay, buildScheduleApiFields } from "./todo-schedule";

type TodoScheduleKind = "once" | "repeat" | "none";

type TodoSchedule = {
  kind: TodoScheduleKind;
  label: string | null;
  overdue: boolean;
};

type TodoScheduleSource = {
  reminderAt?: string | null;
  dueAt?: string | null;
  repeatUntil?: string | null;
  repeatDays?: readonly (RepeatDay | string)[] | null;
  repeatTime?: string | null;
  completedAt?: string | null;
  done?: boolean | null;
};

const REPEAT_DAY_ORDER: RepeatDay[] = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

const REPEAT_DAY_LABEL: Record<RepeatDay, string> = {
  MON: "월",
  TUE: "화",
  WED: "수",
  THU: "목",
  FRI: "금",
  SAT: "토",
  SUN: "일",
};

const WEEKDAY_DAYS: RepeatDay[] = ["MON", "TUE", "WED", "THU", "FRI"];

const WEEKEND_DAYS: RepeatDay[] = ["SAT", "SUN"];

const OVERDUE_SUFFIX = " (지남)";

const NO_SCHEDULE: TodoSchedule = { kind: "none", label: null, overdue: false };

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

function parseDate(value?: string | null): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function sortRepeatDays(days: readonly (RepeatDay | string)[]): RepeatDay[] {
  const unique = new Set(days.map((day) => day.toUpperCase()));
  return REPEAT_DAY_ORDER.filter((day) => unique.has(day));
}

function hasExactly(days: RepeatDay[], expected: RepeatDay[]): boolean {
  return days.length === expected.length && expected.every((day) => days.includes(day));
}

function formatRepeatDays(days: RepeatDay[]): string {
  if (days.length === REPEAT_DAY_ORDER.length) return "매일";
  if (hasExactly(days, WEEKDAY_DAYS)) return "평일";
  if (hasExactly(days, WEEKEND_DAYS)) return "주말";
  return `매주 ${days.map((day) => REPEAT_DAY_LABEL[day]).join("·")}`;
}

function formatRepeatTime(value: string): string | null {
  const match = /^(\d{1,2}):(\d{1,2})/.exec(value);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  const meridiem = hour < 12 ? "오전" : "오후";
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${meridiem} ${hour12}:${pad2(minute)}`;
}

function formatOnceLabel(date: Date): string {
  return `${pad2(date.getMonth() + 1)}/${pad2(date.getDate())} ${pad2(date.getHours())}:${pad2(
    date.getMinutes(),
  )}`;
}

function isDone(source: TodoScheduleSource): boolean {
  return Boolean(source.done ?? source.completedAt);
}

function withOverdue(kind: TodoScheduleKind, label: string, overdue: boolean): TodoSchedule {
  return { kind, label: overdue ? `${label}${OVERDUE_SUFFIX}` : label, overdue };
}

// One schedule line for an action, shared by the link detail, the editor chip and the
// actions tab: a one-time reminder reads "11/20 09:00", a repeat reads
// "매주 월·목 오전 8:00 · 12월 31일까지". A done action is never overdue.
function formatTodoSchedule(source: TodoScheduleSource, nowMs: number): TodoSchedule {
  const done = isDone(source);
  const repeatDays = source.repeatDays ? sortRepeatDays(source.repeatDays) : [];
  const repeatTime = source.repeatTime ? formatRepeatTime(source.repeatTime) : null;

  if (repeatDays.length > 0 && repeatTime) {
    const until = parseDate(source.repeatUntil);
    const untilLabel = until ? ` · ${until.getMonth() + 1}월 ${until.getDate()}일까지` : "";
    const overdue = !done && until !== null && until.getTime() < nowMs;
    return withOverdue(
      "repeat",
      `${formatRepeatDays(repeatDays)} ${repeatTime}${untilLabel}`,
      overdue,
    );
  }

  const reminder = parseDate(source.reminderAt ?? source.dueAt);
  if (reminder) {
    const overdue = !done && reminder.getTime() <= nowMs;
    return withOverdue("once", formatOnceLabel(reminder), overdue);
  }

  return NO_SCHEDULE;
}

// The same line for an action being edited. Returns null while the schedule is not
// filled in yet (a missing date or time, or a repeat without any weekday).
function formatDraftSchedule(draft: TodoDraftEditorItem, nowMs: number): TodoSchedule | null {
  if (draft.mode === "none") return NO_SCHEDULE;
  if (!draft.date || !draft.time) return null;
  if (draft.mode === "recurring" && draft.selectedWeekdays.length === 0) return null;
  return formatTodoSchedule(buildScheduleApiFields(draft), nowMs);
}

export { formatDraftSchedule, formatTodoSchedule };
export type { TodoSchedule, TodoScheduleKind, TodoScheduleSource };
