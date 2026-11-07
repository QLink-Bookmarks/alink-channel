import { RefreshControl } from "react-native";

import { useListMemoryStore } from "@/stores/list-memory";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen } from "@testing-library/react-native";

import type { GetTodosParams, TodoCounts, TodoListItem } from "../../types";
import { TodosScreen } from "./todos-screen";

/* eslint-disable @typescript-eslint/no-require-imports -- jest.mock factories must require */
jest.mock("react-native-worklets", () => require("react-native-worklets/src/mock"));
jest.mock("react-native-reanimated", () => require("react-native-reanimated/mock"));
/* eslint-enable @typescript-eslint/no-require-imports */

jest.mock("expo-router", () => ({
  usePathname: () => "/todos",
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
}));

type TodosQueryState = {
  data: { contents: TodoListItem[] } | undefined;
  isError: boolean;
  isFetching: boolean;
  isLoading: boolean;
  refetch: jest.Mock;
};

type CountsQueryState = {
  data: TodoCounts | undefined;
  refetch: jest.Mock;
};

const mockTodosQuery: TodosQueryState = {
  data: undefined,
  isError: false,
  isFetching: false,
  isLoading: false,
  refetch: jest.fn(),
};

const mockCountsQuery: CountsQueryState = {
  data: undefined,
  refetch: jest.fn(),
};

const mockUseTodosQuery = jest.fn((_params: GetTodosParams) => mockTodosQuery);

jest.mock("../../queries", () => ({
  todoQueryKeys: {
    lists: () => ["todos", "list"],
    list: (params: unknown) => ["todos", "list", params],
    counts: () => ["todos", "list", "counts"],
  },
  useTodosQuery: (params: GetTodosParams) => mockUseTodosQuery(params),
  useTodoCountsQuery: () => mockCountsQuery,
}));

const mockToggleCompleted = jest.fn();

jest.mock("../../mutations", () => ({
  useToggleTodoCompletedMutation: () => ({ mutateAsync: mockToggleCompleted }),
}));

const TODO: TodoListItem = {
  id: 1,
  title: "지원서 작성",
  reminderAt: null,
  completedAt: null,
  status: "ACTIVE",
  createdAt: "2026-11-01T00:00:00Z",
  linkId: 10,
  linkUrl: "https://example.com/a",
  linkTitle: "채용 공고",
  linkThumbnailUrl: null,
  linkFaviconUrl: null,
};

function renderTodos(mode: "mobile" | "wide" = "mobile", queryClient = new QueryClient()) {
  return render(
    <QueryClientProvider client={queryClient}>
      <TodosScreen mode={mode} />
    </QueryClientProvider>,
  );
}

function renderMobileTodos() {
  return renderTodos("mobile");
}

function resetQueries() {
  useListMemoryStore.getState().clear();
  mockTodosQuery.data = undefined;
  mockTodosQuery.isError = false;
  mockTodosQuery.isLoading = false;
  mockTodosQuery.isFetching = false;
  mockTodosQuery.refetch = jest.fn();
  mockCountsQuery.data = undefined;
  mockCountsQuery.refetch = jest.fn();
  mockUseTodosQuery.mockClear();
}

function refreshControl() {
  return screen.UNSAFE_getByType(RefreshControl);
}

describe("TodosScreen pull to refresh", () => {
  beforeEach(() => {
    resetQueries();
    mockTodosQuery.data = { contents: [TODO] };
  });

  it("shows no spinner while the list is refetched in the background", () => {
    mockTodosQuery.isFetching = true;
    renderMobileTodos();

    expect(screen.getByText("지원서 작성")).toBeTruthy();
    expect(refreshControl().props.refreshing).toBe(false);
  });

  it("shows the spinner only while a pulled refresh runs", async () => {
    let finishRefetch!: () => void;
    mockTodosQuery.refetch = jest.fn(
      () =>
        new Promise<void>((resolve) => {
          finishRefetch = resolve;
        }),
    );
    renderMobileTodos();
    expect(refreshControl().props.refreshing).toBe(false);

    act(() => {
      refreshControl().props.onRefresh();
    });
    expect(mockTodosQuery.refetch).toHaveBeenCalledTimes(1);
    expect(mockCountsQuery.refetch).toHaveBeenCalledTimes(1);
    expect(refreshControl().props.refreshing).toBe(true);

    await act(async () => {
      finishRefetch();
    });
    expect(refreshControl().props.refreshing).toBe(false);
  });
});

describe("TodosScreen schedule line", () => {
  beforeEach(() => {
    resetQueries();
  });

  it("shows a one-time reminder as MM/DD HH:mm and a repeat as its summary", () => {
    mockTodosQuery.data = {
      contents: [
        {
          ...TODO,
          id: 1,
          title: "한 번 알림",
          reminderAt: new Date(2099, 10, 20, 9, 0).toISOString(),
        },
        {
          ...TODO,
          id: 2,
          title: "반복 알림",
          repeatDays: ["THU", "MON"],
          repeatTime: "08:00",
          repeatUntil: new Date(2099, 11, 31, 23, 59, 59, 999).toISOString(),
        },
      ],
    };
    renderMobileTodos();

    expect(screen.getByText("11/20 09:00")).toBeOnTheScreen();
    expect(screen.getByText("매주 월·목 오전 8:00 · 12월 31일까지")).toBeOnTheScreen();
    expect(screen.getByTestId("todo-item-reminder-repeat")).toBeOnTheScreen();
  });

  it("adds (지남) to a past reminder and hides the schedule once done", () => {
    mockTodosQuery.data = {
      contents: [
        {
          ...TODO,
          id: 1,
          title: "지난 알림",
          status: "OVERDUE",
          reminderAt: new Date(2020, 0, 5, 9, 0).toISOString(),
        },
        {
          ...TODO,
          id: 2,
          title: "끝낸 알림",
          status: "COMPLETED",
          reminderAt: new Date(2020, 0, 6, 9, 0).toISOString(),
          completedAt: new Date(2020, 0, 6, 10, 0).toISOString(),
        },
      ],
    };
    renderMobileTodos();

    expect(screen.getByText("01/05 09:00 (지남)")).toBeOnTheScreen();
    expect(screen.queryByText(/01\/06 09:00/)).toBeNull();
  });

  it("marks a one-time reminder past its time as 지남 even when the server still says ACTIVE", () => {
    mockTodosQuery.data = {
      contents: [
        {
          ...TODO,
          title: "막 지난 알림",
          status: "ACTIVE",
          reminderAt: new Date(2020, 0, 5, 9, 0).toISOString(),
        },
      ],
    };
    renderMobileTodos();

    expect(screen.getByText("01/05 09:00 (지남)")).toBeOnTheScreen();
  });

  it("marks a repeat past its end date as 지남 like the detail, while the server says ACTIVE", () => {
    mockTodosQuery.data = {
      contents: [
        {
          ...TODO,
          id: 1,
          title: "끝난 반복",
          status: "ACTIVE",
          repeatDays: ["MON"],
          repeatTime: "08:00",
          repeatUntil: new Date(2020, 0, 6, 23, 59, 59).toISOString(),
        },
        {
          ...TODO,
          id: 2,
          title: "이어지는 반복",
          status: "ACTIVE",
          repeatDays: ["TUE"],
          repeatTime: "08:00",
          repeatUntil: new Date(2099, 11, 31, 23, 59, 59).toISOString(),
        },
        {
          ...TODO,
          id: 3,
          title: "끝낸 반복",
          status: "COMPLETED",
          repeatDays: ["WED"],
          repeatTime: "08:00",
          repeatUntil: new Date(2020, 0, 6, 23, 59, 59).toISOString(),
          completedAt: new Date(2020, 0, 6, 10, 0).toISOString(),
        },
      ],
    };
    renderMobileTodos();

    expect(screen.getByText("매주 월 오전 8:00 · 1월 6일까지 (지남)")).toBeOnTheScreen();
    expect(screen.getByText("매주 화 오전 8:00 · 12월 31일까지")).toBeOnTheScreen();
    expect(screen.queryByText(/매주 수.*지남/)).toBeNull();
  });
});

describe("TodosScreen status filter", () => {
  beforeEach(() => {
    resetQueries();
  });

  it("shows the four status chips with counts and asks for 전체 sorted by 알림일 ↑", () => {
    mockTodosQuery.data = { contents: [TODO] };
    mockCountsQuery.data = { all: 6, active: 3, overdue: 1, completed: 2 };
    renderMobileTodos();

    for (const name of ["전체 6", "진행 중 3", "기간지남 1", "완료 2"]) {
      expect(screen.getByRole("radio", { name })).toBeOnTheScreen();
    }
    expect(screen.getByRole("radio", { name: "전체 6" })).toBeChecked();
    expect(mockUseTodosQuery).toHaveBeenLastCalledWith({
      orderKey: "reminder_at",
      order: "asc",
      size: 100,
    });
  });

  it("shows names only while the counts are missing", () => {
    mockTodosQuery.data = { contents: [TODO] };
    renderMobileTodos();

    expect(screen.getByRole("radio", { name: "진행 중" })).toBeOnTheScreen();
  });

  it("asks for 완료 sorted by 완료일 ↓ and shows one list without sections", () => {
    mockTodosQuery.data = {
      contents: [{ ...TODO, status: "COMPLETED", completedAt: "2026-11-02T00:00:00Z" }],
    };
    renderMobileTodos();

    fireEvent.press(screen.getByRole("radio", { name: "완료" }));

    expect(mockUseTodosQuery).toHaveBeenLastCalledWith({
      status: "completed",
      orderKey: "completed_at",
      order: "desc",
      size: 100,
    });
    expect(screen.getByText("지원서 작성")).toBeOnTheScreen();
    expect(screen.queryByText("✓ 완료")).toBeNull();
  });

  it("splits 전체 into 기간지남 → 진행 중 → 완료 by the server status", () => {
    mockTodosQuery.data = {
      contents: [
        { ...TODO, id: 1, title: "A", status: "COMPLETED", completedAt: "2026-11-02T00:00:00Z" },
        { ...TODO, id: 2, title: "B", status: "ACTIVE" },
        { ...TODO, id: 3, title: "C", status: "OVERDUE" },
      ],
    };
    renderMobileTodos();

    const headers = screen
      .getAllByText(/^(🔥 기간지남|⏳ 진행 중|✓ 완료)$/)
      .map((node) => node.props.children);
    expect(headers).toEqual(["🔥 기간지남", "⏳ 진행 중", "✓ 완료"]);
  });

  it("keeps the 2nd sort the new status has, and resets one it does not", () => {
    mockTodosQuery.data = { contents: [] };
    renderMobileTodos();

    fireEvent.press(screen.getByRole("radio", { name: "완료" }));
    fireEvent.press(screen.getByRole("radio", { name: "진행 중" }));
    expect(mockUseTodosQuery).toHaveBeenLastCalledWith({
      status: "active",
      orderKey: "reminder_at",
      order: "asc",
      size: 100,
    });
  });

  it("shows the load error instead of the empty message", () => {
    mockTodosQuery.isError = true;
    renderMobileTodos();

    expect(screen.getByText("액션을 불러오지 못했어요")).toBeOnTheScreen();
    expect(screen.queryByText("해당하는 액션이 없어요")).toBeNull();
    fireEvent.press(screen.getByText("다시 시도"));
    expect(mockTodosQuery.refetch).toHaveBeenCalledTimes(1);
  });

  it("shows the 전체 count next to the wide title only once it is known", () => {
    mockTodosQuery.data = { contents: [TODO] };
    const { rerender } = renderTodos("wide");
    expect(screen.queryByText(/^\d+개$/)).toBeNull();

    mockCountsQuery.data = { all: 6, active: 3, overdue: 1, completed: 2 };
    rerender(
      <QueryClientProvider client={new QueryClient()}>
        <TodosScreen mode="wide" />
      </QueryClientProvider>,
    );
    expect(screen.getByText("6개")).toBeOnTheScreen();
  });
});

describe("TodosScreen checking an action", () => {
  const LIST_KEY = ["todos", "list", { orderKey: "reminder_at", order: "asc", size: 100 }];
  const COUNTS_KEY = ["todos", "list", "counts"];
  const COUNTS: TodoCounts = { all: 3, active: 2, overdue: 0, completed: 1 };

  beforeEach(() => {
    resetQueries();
    mockToggleCompleted.mockReset();
  });

  function renderWithCache() {
    const queryClient = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } });
    queryClient.setQueryData(LIST_KEY, { contents: [TODO] });
    queryClient.setQueryData(COUNTS_KEY, COUNTS);
    mockTodosQuery.data = { contents: [TODO] };
    mockCountsQuery.data = COUNTS;
    renderTodos("mobile", queryClient);
    return queryClient;
  }

  it("marks the action done in the list caches and moves one from 진행 중 to 완료", async () => {
    mockToggleCompleted.mockResolvedValue({ data: { completeAt: "2026-11-07T03:00:00.000Z" } });
    const queryClient = renderWithCache();

    await act(async () => {
      fireEvent.press(screen.getByRole("checkbox"));
    });

    expect(mockToggleCompleted).toHaveBeenCalledWith({
      payload: { isCompleted: true },
      todoId: TODO.id,
    });
    expect(
      queryClient.getQueryData<{ contents: TodoListItem[] }>(LIST_KEY)?.contents[0],
    ).toMatchObject({ completedAt: "2026-11-07T03:00:00.000Z", status: "COMPLETED" });
    expect(queryClient.getQueryData(COUNTS_KEY)).toEqual({
      all: 3,
      active: 1,
      overdue: 0,
      completed: 2,
    });
  });

  it("leaves the other statuses' lists to refetch, so 완료 shows the action just completed", async () => {
    mockToggleCompleted.mockResolvedValue({ data: { completeAt: "2026-11-07T03:00:00.000Z" } });
    const queryClient = renderWithCache();
    // A 완료 list seen earlier, still cached without the action.
    const doneListKey = [
      "todos",
      "list",
      { status: "completed", orderKey: "completed_at", order: "desc", size: 100 },
    ];
    queryClient.setQueryData(doneListKey, { contents: [] });

    await act(async () => {
      fireEvent.press(screen.getByRole("checkbox"));
    });

    expect(queryClient.getQueryState(doneListKey)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(LIST_KEY)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(COUNTS_KEY)?.isInvalidated).toBe(true);
  });

  it("moves a done action with a past reminder back to 기간지남 when unchecked", async () => {
    const done: TodoListItem = {
      ...TODO,
      status: "COMPLETED",
      completedAt: "2026-11-01T00:00:00.000Z",
      reminderAt: "2020-01-05T09:00:00.000Z",
    };
    mockToggleCompleted.mockResolvedValue({ data: { completeAt: null } });
    const queryClient = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } });
    queryClient.setQueryData(LIST_KEY, { contents: [done] });
    queryClient.setQueryData(COUNTS_KEY, COUNTS);
    mockTodosQuery.data = { contents: [done] };
    renderTodos("mobile", queryClient);

    await act(async () => {
      fireEvent.press(screen.getByRole("checkbox"));
    });

    expect(
      queryClient.getQueryData<{ contents: TodoListItem[] }>(LIST_KEY)?.contents[0],
    ).toMatchObject({ completedAt: null, status: "OVERDUE" });
    expect(queryClient.getQueryData(COUNTS_KEY)).toEqual({
      all: 3,
      active: 2,
      overdue: 1,
      completed: 0,
    });
  });

  it("leaves the caches as they were when the request fails", async () => {
    mockToggleCompleted.mockRejectedValue(new Error("network"));
    const queryClient = renderWithCache();

    await act(async () => {
      fireEvent.press(screen.getByRole("checkbox"));
    });

    expect(queryClient.getQueryData<{ contents: TodoListItem[] }>(LIST_KEY)?.contents[0]).toEqual(
      TODO,
    );
    expect(queryClient.getQueryData(COUNTS_KEY)).toEqual(COUNTS);
  });
});
