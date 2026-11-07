import * as React from "react";
import { Pressable, View } from "react-native";

import { type DateValue } from "@/components/ui/date-picker";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { Textarea } from "@/components/ui/textarea";
import { type TimeValue } from "@/components/ui/time-picker";
import {
  type TodoDraftEditorItem,
  TodoDraftListEditor,
} from "@/features/todos/components/todo-draft-list-editor";
import {
  type TodoEditorId,
  type TodoEditorMode,
  type WeekdayValue,
} from "@/features/todos/components/todo-editor/todo-editor";
import { cn } from "@/lib/utils";

import { ChevronDown, ChevronUp } from "lucide-react-native/icons";

const MEMO_ACTIONS_LABEL = "메모·액션";
const EMPTY_SUMMARY = "선택";

type LinkCreateMemoActionsProps = {
  mode: "wide" | "mobile";
  open: boolean;
  memo: string;
  todos: TodoDraftEditorItem[];
  disabled?: boolean;
  /** Wraps the action list, so the form can bring an action row into view. */
  actionListRef?: React.Ref<View>;
  onOpenChange: (open: boolean) => void;
  onMemoChange: (memo: string) => void;
  onAddTodo: () => void;
  onChangeTodoMode: (todoId: TodoEditorId, nextMode: TodoEditorMode) => void;
  onChangeTodoTitle: (todoId: TodoEditorId, nextTitle: string) => void;
  onChangeTodoWeekdays: (todoId: TodoEditorId, nextWeekdays: WeekdayValue[]) => void;
  onChangeTodoDate: (todoId: TodoEditorId, next: DateValue) => void;
  onChangeTodoTime: (todoId: TodoEditorId, next: TimeValue) => void;
  onRemoveTodo: (todoId: TodoEditorId) => void;
};

// An action counts once it holds a title or a picked date or time, the same rule the
// save uses to skip a blank row.
function isFilledTodo(todo: TodoDraftEditorItem): boolean {
  const hasSchedule = todo.mode !== "none" && (todo.date != null || todo.time != null);
  return todo.title.trim().length > 0 || hasSchedule;
}

// What the folded group holds, shown next to its name: `메모 · 액션 1개`, `메모`, or `선택`.
function getMemoActionsSummary(memo: string, todos: TodoDraftEditorItem[]): string {
  const todoCount = todos.filter(isFilledTodo).length;
  const parts = [memo.trim() ? "메모" : null, todoCount > 0 ? `액션 ${todoCount}개` : null].filter(
    (part): part is string => part != null,
  );
  return parts.length > 0 ? parts.join(" · ") : EMPTY_SUMMARY;
}

// The memo and the actions of a new link, folded under one toggle. The form opens it
// from outside too, to show an action error on save.
function LinkCreateMemoActions({
  mode,
  open,
  memo,
  todos,
  disabled = false,
  actionListRef,
  onOpenChange,
  onMemoChange,
  onAddTodo,
  onChangeTodoMode,
  onChangeTodoTitle,
  onChangeTodoWeekdays,
  onChangeTodoDate,
  onChangeTodoTime,
  onRemoveTodo,
}: LinkCreateMemoActionsProps) {
  const isMobile = mode === "mobile";
  const summary = open ? null : getMemoActionsSummary(memo, todos);

  return (
    <View
      className="gap-3.5"
      testID="link-create-memo-actions"
    >
      <Pressable
        accessibilityLabel={summary ? `${MEMO_ACTIONS_LABEL}, ${summary}` : MEMO_ACTIONS_LABEL}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        aria-expanded={open}
        className="-mx-2 -my-1 min-h-10 flex-row items-center gap-2.5 rounded-xl px-2 active:bg-accent web:hover:bg-accent"
        testID="link-create-memo-actions-toggle"
        onPress={() => onOpenChange(!open)}
      >
        <Text className="text-sm font-bold text-foreground">{MEMO_ACTIONS_LABEL}</Text>
        {summary ? (
          <Text
            className="min-w-0 shrink text-xs text-muted-foreground"
            numberOfLines={1}
            testID="link-create-memo-actions-summary"
          >
            {summary}
          </Text>
        ) : null}
        <View className="flex-1" />
        <Icon
          as={open ? ChevronUp : ChevronDown}
          size={16}
          className="text-muted-foreground"
        />
      </Pressable>

      {open ? (
        <>
          <View className="gap-1.5">
            <FieldLabel>메모</FieldLabel>
            <Textarea
              accessibilityLabel="메모"
              className={cn(
                "scrollbar-none min-h-10 rounded-xl border-input bg-card px-3.5 py-2.5 web:resize-none",
                isMobile ? "h-11 min-h-11 text-base" : "h-10 text-sm",
              )}
              editable={!disabled}
              numberOfLines={1}
              placeholder="간단한 메모"
              scrollEnabled={false}
              value={memo}
              onChangeText={onMemoChange}
            />
          </View>
          <View className="gap-1.5">
            <FieldLabel>액션</FieldLabel>
            <View
              ref={actionListRef}
              className="min-w-0"
            >
              <TodoDraftListEditor
                addLabel="액션 추가"
                disabled={disabled}
                pickerMode={mode}
                todos={todos}
                onAddTodo={onAddTodo}
                onChangeTodoTitle={onChangeTodoTitle}
                onChangeTodoMode={onChangeTodoMode}
                onChangeTodoWeekdays={onChangeTodoWeekdays}
                onChangeTodoDate={onChangeTodoDate}
                onChangeTodoTime={onChangeTodoTime}
                onRemoveTodo={onRemoveTodo}
              />
            </View>
          </View>
        </>
      ) : null}
    </View>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <Text className="text-xs font-semibold text-muted-foreground">{children}</Text>;
}

export { LinkCreateMemoActions, getMemoActionsSummary };
export type { LinkCreateMemoActionsProps };
