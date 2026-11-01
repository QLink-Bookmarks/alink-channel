import { RefreshControl } from "react-native";

import { useListMemoryStore } from "@/stores/list-memory";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen } from "@testing-library/react-native";

import type { TodoListItem } from "../../types";
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
  isFetching: boolean;
  isLoading: boolean;
  refetch: jest.Mock;
};

const mockTodosQuery: TodosQueryState = {
  data: undefined,
  isFetching: false,
  isLoading: false,
  refetch: jest.fn(),
};

jest.mock("../../queries", () => ({
  todoQueryKeys: {
    lists: () => ["todos", "list"],
    list: (params: unknown) => ["todos", "list", params],
  },
  useTodosQuery: () => mockTodosQuery,
}));

const TODO: TodoListItem = {
  id: 1,
  title: "지원서 작성",
  reminderAt: null,
  completedAt: null,
  linkId: 10,
  linkUrl: "https://example.com/a",
  linkTitle: "채용 공고",
  linkThumbnailUrl: null,
  linkFaviconUrl: null,
} as TodoListItem;

function renderMobileTodos() {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <TodosScreen mode="mobile" />
    </QueryClientProvider>,
  );
}

function refreshControl() {
  return screen.UNSAFE_getByType(RefreshControl);
}

describe("TodosScreen pull to refresh", () => {
  beforeEach(() => {
    useListMemoryStore.getState().clear();
    mockTodosQuery.data = { contents: [TODO] };
    mockTodosQuery.isLoading = false;
    mockTodosQuery.isFetching = false;
    mockTodosQuery.refetch = jest.fn();
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
    expect(refreshControl().props.refreshing).toBe(true);

    await act(async () => {
      finishRefetch();
    });
    expect(refreshControl().props.refreshing).toBe(false);
  });
});
