import type { SortDirection } from "@/lib/list-sort";

type RepeatDay = "MON" | "TUE" | "WED" | "THU" | "FRI" | "SAT" | "SUN";

type TodoRequest = {
  linkId: number;
  title: string;
  reminderAt?: string | null;
  repeatUntil?: string | null;
  repeatDays?: RepeatDay[] | null;
  repeatTime?: string | null;
  repeatTimezone?: string | null;
};

type TodoListItem = {
  id: number;
  title: string;
  reminderAt?: string | null;
  repeatUntil?: string | null;
  repeatDays?: RepeatDay[] | null;
  repeatTime?: string | null;
  completedAt?: string | null;
  // The server's state of the action; a repeat uses its next reminder.
  status: TodoStatus;
  createdAt: string;
  linkId: number;
  linkUrl: string;
  linkTitle: string;
  linkThumbnailUrl: string | null;
  linkFaviconUrl: string | null;
};

type TodoStatus = "ACTIVE" | "OVERDUE" | "COMPLETED";

type TodoOrderKey = "reminder_at" | "created_at" | "completed_at";

type TodoListSortParams = { orderKey?: TodoOrderKey; order?: SortDirection };

type GetTodosParams = TodoListSortParams & {
  // Never sent with `isCompleted` / `reminderAt`.
  status?: "active" | "overdue" | "completed";
  cursor?: string;
  size?: number;
  isCompleted?: boolean;
  reminderAt?: "overdue" | "upcoming";
};

type TodoCounts = {
  all: number;
  active: number;
  overdue: number;
  completed: number;
};

type GetTodoCountsResponse = {
  success: boolean;
  data: TodoCounts;
  error: {
    code: string;
    message: string;
    cause?: string | null;
    causeMessage?: string | null;
  } | null;
};

type GetTodosResponse = {
  success: boolean;
  data: {
    isEmpty: boolean;
    contents: TodoListItem[];
    nextCursor: string | null;
    hasNext: boolean;
  };
  error: {
    code: string;
    message: string;
    cause?: string | null;
    causeMessage?: string | null;
  } | null;
};

type CreateTodoRequest = TodoRequest;

type UpdateTodoRequest = TodoRequest;

type CompleteTodoRequest = {
  isCompleted: boolean;
};

type CreateTodoResponse = {
  success: boolean;
  data: {
    id: number;
  };
  error: {
    code: string;
    message: string;
    cause?: string | null;
    causeMessage?: string | null;
  } | null;
};

type UpdateTodoResponse = {
  success: boolean;
  data: {
    linkId: number;
    title: string;
    reminderAt?: string | null;
  };
  error: {
    code: string;
    message: string;
    cause?: string | null;
    causeMessage?: string | null;
  } | null;
};

type DeleteTodoResponse = {
  success: boolean;
  data: null;
  error: {
    code: string;
    message: string;
    cause?: string | null;
    causeMessage?: string | null;
  } | null;
};

type CompleteTodoResponse = {
  success: boolean;
  data: {
    completeAt?: string | null;
  } | null;
  error: {
    code: string;
    message: string;
    cause?: string | null;
    causeMessage?: string | null;
  } | null;
};

export type {
  CompleteTodoRequest,
  CompleteTodoResponse,
  CreateTodoRequest,
  CreateTodoResponse,
  DeleteTodoResponse,
  GetTodoCountsResponse,
  GetTodosParams,
  GetTodosResponse,
  TodoCounts,
  TodoListItem,
  TodoOrderKey,
  TodoRequest,
  TodoStatus,
  UpdateTodoRequest,
  UpdateTodoResponse,
};
