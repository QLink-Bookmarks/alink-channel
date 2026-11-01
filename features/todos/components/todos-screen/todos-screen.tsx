import * as React from "react";
import { RefreshControl, ScrollView, View } from "react-native";

import { PageHeader } from "@/components/layout/page-header";
import { ActivityIndicator } from "@/components/ui/activity-indicator";
import { EmptyState } from "@/components/ui/empty-state";
import { SegmentedControl } from "@/components/ui/segmented-control";
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

import {
  type TodoFilter,
  countTodosByFilter,
  filterTodos,
  formatReminderLabel,
  getTodoBucket,
  isOverdue,
} from "../../lib/todo-list-helpers";
import { useToggleTodoCompletedMutation } from "../../mutations";
import { useTodosQuery } from "../../queries";
import type { TodoListItem } from "../../types";
import { TodoItem } from "../todo-item/todo-item";

import { type Href, useRouter } from "expo-router";
import { CheckSquare } from "lucide-react-native";

type TodosScreenMode = "mobile" | "wide";

const TODO_GRID_GAP = 12;
const TODO_MIN_CARD_WIDTH = 240;

const FILTER_OPTIONS: { value: TodoFilter; label: string }[] = [
  { value: "all", label: "전체" },
  { value: "incomplete", label: "미완료" },
  { value: "upcoming", label: "⏰ 알림예정" },
  { value: "overdue", label: "🔥 기간지남" },
  { value: "noReminder", label: "🕊 알림없음" },
  { value: "completed", label: "✓ 완료" },
];

function useTodosScreenState(mode: TodosScreenMode) {
  const memoryKey = useListMemoryKey(mode);
  const [filter, setFilter] = useRememberedState<TodoFilter>(memoryKey, "filter", "all");
  const todosQuery = useTodosQuery({ size: 100 });
  const allTodos = React.useMemo(() => todosQuery.data?.contents ?? [], [todosQuery.data]);
  // Refresh "now" whenever the underlying todo list changes so that overdue/upcoming buckets stay consistent.
  const nowMs = React.useMemo(() => Date.now(), [allTodos]); // eslint-disable-line react-hooks/exhaustive-deps
  const counts = React.useMemo(() => countTodosByFilter(allTodos, nowMs), [allTodos, nowMs]);
  const filteredTodos = React.useMemo(
    () => filterTodos(allTodos, filter, nowMs),
    [allTodos, filter, nowMs],
  );

  const filterChips = FILTER_OPTIONS.map((option) => ({
    label: `${option.label} ${counts[option.value]}`,
    value: option.value,
  }));

  const { isRefreshing, handleRefresh } = usePullToRefresh(todosQuery.refetch);
  const { scrollViewRef, scrollViewProps } = useListScrollMemory({
    memoryKey,
    contentKey: filter,
    isLoading: todosQuery.isLoading,
    hasContent: filteredTodos.length > 0,
  });

  return {
    counts,
    filter,
    filterChips,
    filteredTodos,
    handleRefresh,
    isLoading: todosQuery.isLoading,
    isRefreshing,
    nowMs,
    scrollViewProps,
    scrollViewRef,
    setFilter,
    totalCount: counts.all,
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

        const completedAt = nextChecked
          ? (response.data?.completeAt ?? new Date().toISOString())
          : null;

        queryClient.setQueriesData<{
          contents: TodoListItem[];
          [key: string]: unknown;
        }>({ queryKey: ["todos", "list"] }, (data) => {
          if (!data) return data;
          return {
            ...data,
            contents: data.contents.map((t) => (t.id === todo.id ? { ...t, completedAt } : t)),
          };
        });

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
  const overdue = isOverdue(todo, nowMs);
  const reminderLabel = formatReminderLabel(todo.reminderAt, { withOverdueSuffix: overdue });

  return (
    <TodoItem
      className={className}
      variant="display"
      text={todo.title}
      done={done}
      overdue={overdue}
      reminderLabel={reminderLabel}
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

type WideSection = { key: string; emoji: string; label: string; todos: TodoListItem[] };

function WideTodoGrid({
  todos,
  nowMs,
  onToggle,
  onPress,
}: {
  todos: TodoListItem[];
  nowMs: number;
  onToggle: (todo: TodoListItem, nextChecked: boolean) => void;
  onPress: (todo: TodoListItem) => void;
}) {
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
            className="h-full"
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

function WideTodosScreen() {
  const router = useRouter();
  const {
    filter,
    filterChips,
    filteredTodos,
    isLoading,
    nowMs,
    scrollViewProps,
    scrollViewRef,
    setFilter,
    totalCount,
  } = useTodosScreenState("wide");
  const handleToggle = useToggleHandler();
  const handleTodoPress = React.useCallback(
    (todo: TodoListItem) => {
      router.replace(`/todos?linkId=${todo.linkId}` as Href);
    },
    [router],
  );

  const sections = React.useMemo<WideSection[]>(() => {
    const overdue = filteredTodos.filter((t) => getTodoBucket(t, nowMs) === "overdue");
    const upcoming = filteredTodos.filter((t) => getTodoBucket(t, nowMs) === "upcoming");
    const noReminder = filteredTodos.filter((t) => getTodoBucket(t, nowMs) === "noReminder");
    const completed = filteredTodos.filter((t) => getTodoBucket(t, nowMs) === "completed");
    return [
      { key: "overdue", emoji: "🔥", label: "기간지남", todos: overdue },
      { key: "upcoming", emoji: "⏰", label: "알림예정", todos: upcoming },
      { key: "noReminder", emoji: "🕊", label: "알림없음", todos: noReminder },
      { key: "completed", emoji: "✓", label: "완료", todos: completed },
    ].filter((section) => section.todos.length > 0);
  }, [filteredTodos, nowMs]);

  return (
    <ScrollView
      ref={scrollViewRef}
      {...scrollViewProps}
      className="flex-1"
      contentInsetAdjustmentBehavior="automatic"
      showsVerticalScrollIndicator={false}
    >
      <PageHeader
        title="할일"
        icon={CheckSquare}
        meta={`${totalCount}개`}
      />
      <View className="gap-5 px-6 pb-10 pt-4 md:pt-0">
        <SegmentedControl
          options={filterChips}
          selectionMode="single"
          value={filter}
          variant="chipsBadge"
          onValueChange={(next) => {
            if (typeof next === "string") {
              setFilter(next as TodoFilter);
            }
          }}
        />
        {isLoading ? (
          <ActivityIndicator
            size="large"
            className="py-16"
          />
        ) : filteredTodos.length === 0 ? (
          <EmptyState
            emoji="✅"
            title="해당하는 할 일이 없어요"
            description="다른 필터를 선택해보세요."
          />
        ) : (
          <View className="gap-6">
            {sections.map((section) => (
              <View
                key={section.key}
                className="gap-3"
              >
                <SectionHeader
                  emoji={section.emoji}
                  label={section.label}
                  count={section.todos.length}
                />
                <WideTodoGrid
                  nowMs={nowMs}
                  todos={section.todos}
                  onPress={handleTodoPress}
                  onToggle={handleToggle}
                />
              </View>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

function MobileTodosScreen() {
  const router = useRouter();
  const {
    filter,
    filterChips,
    filteredTodos,
    handleRefresh,
    isLoading,
    isRefreshing,
    nowMs,
    scrollViewProps,
    scrollViewRef,
    setFilter,
  } = useTodosScreenState("mobile");
  const handleToggle = useToggleHandler();
  const handleTodoPress = React.useCallback(
    (todo: TodoListItem) => {
      router.push(`/links/${todo.linkId}` as Href);
    },
    [router],
  );

  const sections = React.useMemo<WideSection[]>(() => {
    const overdue = filteredTodos.filter((t) => getTodoBucket(t, nowMs) === "overdue");
    const upcoming = filteredTodos.filter((t) => getTodoBucket(t, nowMs) === "upcoming");
    const noReminder = filteredTodos.filter((t) => getTodoBucket(t, nowMs) === "noReminder");
    const completed = filteredTodos.filter((t) => getTodoBucket(t, nowMs) === "completed");
    return [
      { key: "overdue", emoji: "🔥", label: "기간지남", todos: overdue },
      { key: "upcoming", emoji: "⏰", label: "알림예정", todos: upcoming },
      { key: "noReminder", emoji: "🕊", label: "알림없음", todos: noReminder },
      { key: "completed", emoji: "✓", label: "완료", todos: completed },
    ].filter((section) => section.todos.length > 0);
  }, [filteredTodos, nowMs]);

  return (
    <ScrollView
      ref={scrollViewRef}
      {...scrollViewProps}
      className="flex-1"
      contentInsetAdjustmentBehavior="automatic"
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={handleRefresh}
        />
      }
    >
      <View className="gap-5 px-4 pb-24 pt-4">
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
        >
          <SegmentedControl
            options={filterChips}
            selectionMode="single"
            value={filter}
            variant="chipsBadge"
            onValueChange={(next) => {
              if (typeof next === "string") {
                setFilter(next as TodoFilter);
              }
            }}
          />
        </ScrollView>
        {isLoading ? (
          <ActivityIndicator
            size="large"
            className="py-16"
          />
        ) : sections.length === 0 ? (
          <EmptyState
            emoji="✅"
            title="해당하는 할 일이 없어요"
            description="다른 필터를 선택해보세요."
          />
        ) : (
          <View className="gap-6">
            {sections.map((section) => (
              <View
                key={section.key}
                className="gap-3"
              >
                <SectionHeader
                  emoji={section.emoji}
                  label={section.label}
                  count={section.todos.length}
                />
                <View className="gap-3">
                  {section.todos.map((todo) => (
                    <TodoDisplayItem
                      key={todo.id}
                      nowMs={nowMs}
                      onPress={handleTodoPress}
                      onToggle={handleToggle}
                      todo={todo}
                    />
                  ))}
                </View>
              </View>
            ))}
          </View>
        )}
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
