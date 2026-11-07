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
  linkId: number;
  linkUrl: string;
  linkTitle: string;
  linkThumbnailUrl: string | null;
  linkFaviconUrl: string | null;
};

type GetTodosParams = {
  order?: string;
  cursor?: string;
  size?: number;
  isCompleted?: boolean;
  reminderAt?: "overdue" | "upcoming";
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
  GetTodosParams,
  GetTodosResponse,
  TodoListItem,
  TodoRequest,
  UpdateTodoRequest,
  UpdateTodoResponse,
};
