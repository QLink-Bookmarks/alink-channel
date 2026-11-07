import {
  type ListSort,
  SORT_DIRECTION_WORDS,
  type SortCriterion,
  type SortDirection,
  isSameListSort,
} from "@/lib/list-sort";

import type { GetTodosParams, TodoCounts, TodoListItem, TodoOrderKey, TodoStatus } from "../types";

type TodoStatusFilter = "all" | "active" | "overdue" | "completed";

type TodoSort = ListSort<TodoOrderKey>;

type TodoStatusSection = {
  status: TodoStatus;
  emoji: string;
  label: string;
  todos: TodoListItem[];
};

const TODO_STATUS_FILTERS: { value: TodoStatusFilter; label: string }[] = [
  { value: "all", label: "전체" },
  { value: "active", label: "진행 중" },
  { value: "overdue", label: "기간지남" },
  { value: "completed", label: "완료" },
];

const TODO_SORT_CRITERIA: SortCriterion<TodoOrderKey>[] = [
  { key: "reminder_at", label: "알림일", firstDirection: "asc" },
  { key: "created_at", label: "만든 날", firstDirection: "desc" },
  { key: "completed_at", label: "완료일", firstDirection: "desc" },
];

const STATUS_SECTIONS: Omit<TodoStatusSection, "todos">[] = [
  { status: "OVERDUE", emoji: "🔥", label: "기간지남" },
  { status: "ACTIVE", emoji: "⏳", label: "진행 중" },
  { status: "COMPLETED", emoji: "✓", label: "완료" },
];

const STATUS_FILTER_OF: Record<TodoStatus, Exclude<TodoStatusFilter, "all">> = {
  ACTIVE: "active",
  OVERDUE: "overdue",
  COMPLETED: "completed",
};

function isTodoStatusFilter(value: unknown): value is TodoStatusFilter {
  return TODO_STATUS_FILTERS.some((filter) => filter.value === value);
}

/** The criteria the cover shows: 완료일 only under 완료. */
function getTodoSortCriteria(status: TodoStatusFilter) {
  return status === "completed"
    ? TODO_SORT_CRITERIA
    : TODO_SORT_CRITERIA.filter((criterion) => criterion.key !== "completed_at");
}

function getDefaultTodoSort(status: TodoStatusFilter): TodoSort {
  return status === "completed"
    ? { key: "completed_at", direction: "desc" }
    : { key: "reminder_at", direction: "asc" };
}

function isDefaultTodoSort(status: TodoStatusFilter, sort: TodoSort) {
  return isSameListSort(sort, getDefaultTodoSort(status));
}

/**
 * Changing the 1st chip: a sort left at the old status's default moves to the new status's default
 * (전체 알림일 ↑ → 완료 완료일 ↓). A chosen sort stays when the new status has its criterion, and
 * otherwise falls back to the new default.
 */
function resolveTodoSortOnStatusChange(
  previousStatus: TodoStatusFilter,
  nextStatus: TodoStatusFilter,
  sort: TodoSort,
): TodoSort {
  if (isDefaultTodoSort(previousStatus, sort)) {
    return getDefaultTodoSort(nextStatus);
  }
  const hasCriterion = getTodoSortCriteria(nextStatus).some(
    (criterion) => criterion.key === sort.key,
  );
  return hasCriterion ? sort : getDefaultTodoSort(nextStatus);
}

function toTodoListParams(status: TodoStatusFilter, sort: TodoSort): GetTodosParams {
  return {
    ...(status === "all" ? {} : { status }),
    orderKey: sort.key,
    order: sort.direction,
  };
}

/**
 * The state the screen shows for an action: the server's `status`, or the same rule worked out here
 * when the field is missing (a server that has not shipped it yet).
 */
function getTodoStatus(
  todo: Pick<TodoListItem, "status" | "completedAt" | "reminderAt">,
  nowMs: number,
) {
  return todo.status ?? deriveTodoStatus(todo, nowMs);
}

/** The server's rule: done → COMPLETED, not done with a reminder already past → OVERDUE. */
function deriveTodoStatus(
  todo: Pick<TodoListItem, "completedAt" | "reminderAt">,
  nowMs: number,
): TodoStatus {
  if (todo.completedAt) {
    return "COMPLETED";
  }
  const reminderMs = todo.reminderAt ? new Date(todo.reminderAt).getTime() : Number.NaN;
  return !Number.isNaN(reminderMs) && reminderMs < nowMs ? "OVERDUE" : "ACTIVE";
}

function isInStatusFilter(status: TodoStatus, filter: TodoStatusFilter) {
  return filter === "all" || STATUS_FILTER_OF[status] === filter;
}

/** 전체's sections in order (기간지남 → 진행 중 → 완료), empty ones left out; list order is kept. */
function groupTodosByStatus(todos: TodoListItem[], nowMs: number): TodoStatusSection[] {
  return STATUS_SECTIONS.map((section) => ({
    ...section,
    todos: todos.filter((todo) => getTodoStatus(todo, nowMs) === section.status),
  })).filter((section) => section.todos.length > 0);
}

/** The counts after one action moved from `from` to `to`; 전체 stays the same. */
function applyToggleToCounts(counts: TodoCounts, from: TodoStatus, to: TodoStatus): TodoCounts {
  if (from === to) {
    return counts;
  }
  const fromKey = STATUS_FILTER_OF[from];
  const toKey = STATUS_FILTER_OF[to];
  return {
    ...counts,
    [fromKey]: Math.max(0, counts[fromKey] - 1),
    [toKey]: counts[toKey] + 1,
  };
}

function getTodoSortLabel(key: TodoOrderKey) {
  return TODO_SORT_CRITERIA.find((criterion) => criterion.key === key)?.label ?? "";
}

/** The collapsed button's sort piece; null at the status's default (icon only). */
function getTodoPill(
  status: TodoStatusFilter,
  sort: TodoSort,
): { label: string; direction: SortDirection } | null {
  if (isDefaultTodoSort(status, sort)) {
    return null;
  }
  return { label: getTodoSortLabel(sort.key), direction: sort.direction };
}

/** The applied sort in words for the button's name, e.g. "만든 날 내림차순". */
function getTodoAppliedLabel(status: TodoStatusFilter, sort: TodoSort) {
  if (isDefaultTodoSort(status, sort)) {
    return null;
  }
  return `${getTodoSortLabel(sort.key)} ${SORT_DIRECTION_WORDS[sort.direction]}`;
}

function readTodoStatusFilter(stored: unknown): TodoStatusFilter {
  return isTodoStatusFilter(stored) ? stored : "all";
}

/** A remembered sort that the status can show, or the status's default. */
function readTodoSort(stored: unknown, status: TodoStatusFilter): TodoSort {
  if (typeof stored !== "object" || stored === null) {
    return getDefaultTodoSort(status);
  }
  const { key, direction } = stored as { key?: unknown; direction?: unknown };
  const criterion = getTodoSortCriteria(status).find((item) => item.key === key);
  if (!criterion || (direction !== "asc" && direction !== "desc")) {
    return getDefaultTodoSort(status);
  }
  return { key: criterion.key, direction };
}

export {
  TODO_SORT_CRITERIA,
  TODO_STATUS_FILTERS,
  applyToggleToCounts,
  deriveTodoStatus,
  getDefaultTodoSort,
  getTodoAppliedLabel,
  getTodoPill,
  getTodoSortCriteria,
  getTodoStatus,
  groupTodosByStatus,
  isDefaultTodoSort,
  isInStatusFilter,
  readTodoSort,
  readTodoStatusFilter,
  resolveTodoSortOnStatusChange,
  toTodoListParams,
};
export type { TodoSort, TodoStatusFilter, TodoStatusSection };
