import * as React from "react";
import { RefreshControl, ScrollView, View } from "react-native";

import { PageHeader } from "@/components/layout/page-header";
import { ActivityIndicator } from "@/components/ui/activity-indicator";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadErrorState } from "@/components/ui/load-error-state";
import { Text } from "@/components/ui/text";
import { getLinkDetailQueryKey } from "@/features/links/queries";
import type { LinkDetail } from "@/features/links/types";
import { reportError } from "@/lib/error-reporting";
import { useGridColumns } from "@/lib/hooks/use-grid-columns";
import {
  useListMemoryKey,
  useListScrollMemory,
  useRememberedState,
} from "@/lib/hooks/use-list-scroll-memory";
import { usePullToRefresh } from "@/lib/hooks/use-pull-to-refresh";
import { useQueryClient } from "@tanstack/react-query";

import { formatTodoSchedule } from "../../lib/todo-schedule-label";
import {
  type TodoStatusFilter,
  type TodoStatusSection,
  applyToggleToCounts,
  deriveTodoStatus,
  getDefaultTodoSort,
  getTodoStatus,
  groupTodosByStatus,
  isInStatusFilter,
  readTodoSort,
  readTodoStatusFilter,
  resolveTodoSortOnStatusChange,
  toTodoListParams,
} from "../../lib/todo-status";
import { useToggleTodoCompletedMutation } from "../../mutations";
import { todoQueryKeys, useTodoCountsQuery, useTodosQuery } from "../../queries";
import type { TodoCounts, TodoListItem } from "../../types";
import { TodoItem } from "../todo-item/todo-item";
import { TodoFilterRow } from "./todo-filter-row";

import { type Href, useRouter } from "expo-router";
import { CheckSquare } from "lucide-react-native";

type TodosScreenMode = "mobile" | "wide";

const TODO_GRID_GAP = 12;
const TODO_MIN_CARD_WIDTH = 240;

function useTodosScreenState(mode: TodosScreenMode) {
  const memoryKey = useListMemoryKey(mode);
  const [storedStatus, setStoredStatus] = useRememberedState<unknown>(memoryKey, "status", "all");
  const status = readTodoStatusFilter(storedStatus);
  const [storedSort, setSort] = useRememberedState<unknown>(
    memoryKey,
    "sort",
    getDefaultTodoSort(status),
  );
  const sort = React.useMemo(() => readTodoSort(storedSort, status), [status, storedSort]);
  const todosQuery = useTodosQuery({ ...toTodoListParams(status, sort), size: 100 });
  const countsQuery = useTodoCountsQuery();
  const todos = React.useMemo(() => todosQuery.data?.contents ?? [], [todosQuery.data]);
  // Refresh "now" whenever the list changes, so the fallback status check stays consistent.
  const nowMs = React.useMemo(() => Date.now(), [todos]); // eslint-disable-line react-hooks/exhaustive-deps
  // A checked action leaves a status list at once, before the server list comes back.
  const visibleTodos = React.useMemo(
    () => todos.filter((todo) => isInStatusFilter(getTodoStatus(todo, nowMs), status)),
    [nowMs, status, todos],
  );
  const sections = React.useMemo(
    () => (status === "all" ? groupTodosByStatus(visibleTodos, nowMs) : null),
    [nowMs, status, visibleTodos],
  );

  const handleStatusChange = React.useCallback(
    (next: TodoStatusFilter) => {
      setStoredStatus(next);
      setSort(resolveTodoSortOnStatusChange(status, next, sort));
    },
    [setSort, setStoredStatus, sort, status],
  );

  const { isRefreshing, handleRefresh } = usePullToRefresh(() =>
    Promise.allSettled([todosQuery.refetch(), countsQuery.refetch()]),
  );
  const { scrollViewRef, scrollViewProps } = useListScrollMemory({
    memoryKey,
    contentKey: [status, sort.key, sort.direction].join("|"),
    isLoading: todosQuery.isLoading,
    hasContent: visibleTodos.length > 0,
  });

  return {
    counts: countsQuery.data ?? null,
    handleRefresh,
    handleRetry: () => {
      void todosQuery.refetch();
    },
    handleSortChange: setSort,
    handleStatusChange,
    isLoadError: todosQuery.isError && !todosQuery.data,
    isLoading: todosQuery.isLoading,
    isRefreshing,
    isRetrying: todosQuery.isFetching,
    nowMs,
    scrollViewProps,
    scrollViewRef,
    sections,
    sort,
    status,
    visibleTodos,
  };
}

function useToggleHandler() {
  const queryClient = useQueryClient();
  const toggleMutation = useToggleTodoCompletedMutation();

  const handleToggle = React.useCallback(
    async (todo: TodoListItem, nextChecked: boolean) => {
      try {
        const response = await toggleMutation.mutateAsync({
          payload: { isCompleted: nextChecked },
          todoId: todo.id,
        });

        const nowMs = Date.now();
        const completedAt = nextChecked
          ? (response.data?.completeAt ?? new Date(nowMs).toISOString())
          : null;
        const fromStatus = getTodoStatus(todo, nowMs);
        const nextStatus = deriveTodoStatus({ ...todo, completedAt }, nowMs);

        queryClient.setQueriesData<{
          contents?: TodoListItem[];
          [key: string]: unknown;
        }>({ queryKey: todoQueryKeys.lists() }, (data) => {
          if (!data?.contents) return data;
          return {
            ...data,
            contents: data.contents.map((t) =>
              t.id === todo.id ? { ...t, completedAt, status: nextStatus } : t,
            ),
          };
        });
        queryClient.setQueryData<TodoCounts>(todoQueryKeys.counts(), (current) =>
          current ? applyToggleToCounts(current, fromStatus, nextStatus) : current,
        );

        queryClient.setQueryData<LinkDetail>(getLinkDetailQueryKey(todo.linkId), (current) => {
          if (!current) return current;
          return {
            ...current,
            todos: (current.todos ?? []).map((t) =>
              String(t.id) === String(todo.id)
                ? { ...t, completed: nextChecked, completedAt, done: nextChecked }
                : t,
            ),
          };
        });
        // The writes above also mark the lists of the other statuses fresh, which would keep e.g. the
        // 완료 list without the action just completed. Invalidate after them: the list on screen
        // (and the counts) refetch, the others refetch when their status is opened.
        void queryClient.invalidateQueries({ queryKey: todoQueryKeys.lists() });
        // Link cards show todo counts, so the link lists change with the todo.
        void queryClient.invalidateQueries({ queryKey: ["links", "list"] });
      } catch (error: unknown) {
        reportError(error, {
          area: "todos-screen:toggle",
          extra: { isCompleted: nextChecked, todoId: todo.id },
        });
      }
    },
    [queryClient, toggleMutation],
  );

  return handleToggle;
}

function TodoDisplayItem({
  className,
  todo,
  nowMs,
  onToggle,
  onPress,
}: {
  className?: string;
  todo: TodoListItem;
  nowMs: number;
  onToggle: (todo: TodoListItem, nextChecked: boolean) => void;
  onPress: (todo: TodoListItem) => void;
}) {
  const done = Boolean(todo.completedAt);
  // The card's 지남 is the same as on the link detail: a past reminder, or a repeat past its
  // end date. The section and the status chips still follow the server's status.
  const schedule = formatTodoSchedule(todo, nowMs);

  return (
    <TodoItem
      className={className}
      variant="display"
      text={todo.title}
      done={done}
      overdue={schedule.overdue}
      reminderLabel={schedule.label}
      scheduleKind={schedule.kind}
      linkUrl={todo.linkUrl}
      linkTitle={todo.linkTitle}
      linkThumbnailUrl={todo.linkThumbnailUrl}
      linkFaviconUrl={todo.linkFaviconUrl}
      onToggle={(nextChecked) => onToggle(todo, nextChecked)}
      onPress={() => onPress(todo)}
    />
  );
}

function SectionHeader({ emoji, label, count }: { emoji: string; label: string; count: number }) {
  return (
    <View className="flex-row items-center gap-2">
      <Text className="text-base font-bold text-foreground">{`${emoji} ${label}`}</Text>
      <View className="rounded-full bg-muted px-2 py-0.5">
        <Text className="text-xs font-semibold text-muted-foreground">{count}</Text>
      </View>
    </View>
  );
}

type TodoListProps = {
  todos: TodoListItem[];
  nowMs: number;
  onToggle: (todo: TodoListItem, nextChecked: boolean) => void;
  onPress: (todo: TodoListItem) => void;
};

function WideTodoGrid({ todos, nowMs, onToggle, onPress }: TodoListProps) {
  const { itemStyle, onLayout } = useGridColumns({
    gap: TODO_GRID_GAP,
    minItemWidth: TODO_MIN_CARD_WIDTH,
  });

  return (
    <View
      className="w-full flex-row flex-wrap"
      style={{ gap: TODO_GRID_GAP }}
      testID="todo-grid"
      onLayout={onLayout}
    >
      {todos.map((todo) => (
        <View
          key={todo.id}
          style={itemStyle}
        >
          <TodoDisplayItem
            className="grow"
            nowMs={nowMs}
            onPress={onPress}
            onToggle={onToggle}
            todo={todo}
          />
        </View>
      ))}
    </View>
  );
}

function MobileTodoList({ todos, nowMs, onToggle, onPress }: TodoListProps) {
  return (
    <View className="gap-3">
      {todos.map((todo) => (
        <TodoDisplayItem
          key={todo.id}
          nowMs={nowMs}
          onPress={onPress}
          onToggle={onToggle}
          todo={todo}
        />
      ))}
    </View>
  );
}

/** The list area: loading, error, empty, 전체's status sections, or one list for a status. */
function TodosListBody({
  isLoading,
  isLoadError,
  isRetrying,
  onRetry,
  sections,
  todos,
  List,
  ...listProps
}: Omit<TodoListProps, "todos"> & {
  isLoading: boolean;
  isLoadError: boolean;
  isRetrying: boolean;
  onRetry: () => void;
  sections: TodoStatusSection[] | null;
  todos: TodoListItem[];
  List: React.ComponentType<TodoListProps>;
}) {
  if (isLoading) {
    return (
      <ActivityIndicator
        size="large"
        className="py-16"
      />
    );
  }
  if (isLoadError) {
    return (
      <LoadErrorState
        title="액션을 불러오지 못했어요"
        isRetrying={isRetrying}
        onRetry={onRetry}
      />
    );
  }
  if (todos.length === 0) {
    return (
      <EmptyState
        emoji="✅"
        title="해당하는 액션이 없어요"
        description="다른 필터를 선택해보세요."
      />
    );
  }
  if (!sections) {
    return (
      <List
        todos={todos}
        {...listProps}
      />
    );
  }
  return (
    <View className="gap-6">
      {sections.map((section) => (
        <View
          key={section.status}
          className="gap-3"
        >
          <SectionHeader
            emoji={section.emoji}
            label={section.label}
            count={section.todos.length}
          />
          <List
            todos={section.todos}
            {...listProps}
          />
        </View>
      ))}
    </View>
  );
}

function WideTodosScreen() {
  const router = useRouter();
  const state = useTodosScreenState("wide");
  const handleToggle = useToggleHandler();
  const handleTodoPress = React.useCallback(
    (todo: TodoListItem) => {
      router.replace(`/todos?linkId=${todo.linkId}` as Href);
    },
    [router],
  );

  return (
    <ScrollView
      ref={state.scrollViewRef}
      {...state.scrollViewProps}
      className="flex-1"
      contentInsetAdjustmentBehavior="automatic"
      showsVerticalScrollIndicator={false}
    >
      <PageHeader
        title="액션"
        icon={CheckSquare}
        meta={state.counts ? `${state.counts.all}개` : undefined}
      />
      <View className="gap-5 px-6 pb-10 pt-4 md:pt-0">
        <TodoFilterRow
          counts={state.counts}
          coverMode="content"
          sort={state.sort}
          status={state.status}
          testID="todo-filter-row"
          onSortChange={state.handleSortChange}
          onStatusChange={state.handleStatusChange}
        />
        <TodosListBody
          List={WideTodoGrid}
          isLoadError={state.isLoadError}
          isLoading={state.isLoading}
          isRetrying={state.isRetrying}
          nowMs={state.nowMs}
          sections={state.sections}
          todos={state.visibleTodos}
          onPress={handleTodoPress}
          onRetry={state.handleRetry}
          onToggle={handleToggle}
        />
      </View>
    </ScrollView>
  );
}

function MobileTodosScreen() {
  const router = useRouter();
  const state = useTodosScreenState("mobile");
  const handleToggle = useToggleHandler();
  const handleTodoPress = React.useCallback(
    (todo: TodoListItem) => {
      router.push(`/links/${todo.linkId}` as Href);
    },
    [router],
  );

  return (
    <ScrollView
      ref={state.scrollViewRef}
      {...state.scrollViewProps}
      className="flex-1"
      contentInsetAdjustmentBehavior="automatic"
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={state.isRefreshing}
          onRefresh={state.handleRefresh}
        />
      }
    >
      <View className="gap-5 px-4 pb-24 pt-4">
        <TodoFilterRow
          counts={state.counts}
          coverMode="fill"
          sort={state.sort}
          status={state.status}
          testID="todo-filter-row"
          onSortChange={state.handleSortChange}
          onStatusChange={state.handleStatusChange}
        />
        <TodosListBody
          List={MobileTodoList}
          isLoadError={state.isLoadError}
          isLoading={state.isLoading}
          isRetrying={state.isRetrying}
          nowMs={state.nowMs}
          sections={state.sections}
          todos={state.visibleTodos}
          onPress={handleTodoPress}
          onRetry={state.handleRetry}
          onToggle={handleToggle}
        />
      </View>
    </ScrollView>
  );
}

function TodosScreen({ mode }: { mode: TodosScreenMode }) {
  if (mode === "wide") {
    return <WideTodosScreen />;
  }
  return <MobileTodosScreen />;
}

export { TodosScreen };
export type { TodosScreenMode };
