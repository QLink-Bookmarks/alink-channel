import * as React from "react";
import { Pressable, View } from "react-native";

import { type DateValue } from "@/components/ui/date-picker";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { type TimeValue } from "@/components/ui/time-picker";
import {
  TodoEditor,
  type TodoEditorId,
  type TodoEditorMode,
  type WeekdayValue,
} from "@/features/todos/components/todo-editor/todo-editor";
import type { TodoScheduleHost } from "@/features/todos/components/todo-editor/todo-schedule-panel";

import { Plus } from "lucide-react-native/icons";

type TodoDraftEditorItem = {
  id: TodoEditorId;
  title: string;
  mode: TodoEditorMode;
  selectedWeekdays: WeekdayValue[];
  date: DateValue | null;
  time: TimeValue | null;
  /** Done state, edited only where the list shows its checkboxes (`check`). */
  done?: boolean;
  /** Inline schedule error rendered by the editor when the user attempts save. */
  validationError?: string | null;
  /** Inline title error rendered by the editor when the user attempts save. */
  titleError?: string | null;
  /** A saved action may keep a past reminder; only new or changed ones are refused. */
  allowPast?: boolean;
};

// The open row and the focused row follow the props when the parent passes them,
// and otherwise live here: a row added after the first render gets the focus.
function useOpenAndFocusedTodo(
  todos: TodoDraftEditorItem[],
  openTodoId: TodoEditorId | null | undefined,
  focusTodoId: TodoEditorId | null | undefined,
  onOpenTodoChange: ((todoId: TodoEditorId | null) => void) | undefined,
) {
  const [localOpenTodoId, setLocalOpenTodoId] = React.useState<TodoEditorId | null>(null);
  const [localFocusTodoId, setLocalFocusTodoId] = React.useState<TodoEditorId | null>(null);
  const knownIdsRef = React.useRef<Set<TodoEditorId>>(new Set(todos.map((todo) => todo.id)));

  React.useEffect(() => {
    const knownIds = knownIdsRef.current;
    const addedTodo = todos.findLast((todo) => !knownIds.has(todo.id));
    knownIdsRef.current = new Set(todos.map((todo) => todo.id));
    if (addedTodo && focusTodoId === undefined) {
      setLocalFocusTodoId(addedTodo.id);
    }
  }, [focusTodoId, todos]);

  const isOpenControlled = openTodoId !== undefined;
  const currentOpenTodoId = isOpenControlled ? openTodoId : localOpenTodoId;
  // Read through a ref so the handler stays the same and opening one row does not
  // re-render the others.
  const toggleStateRef = React.useRef({ currentOpenTodoId, isOpenControlled, onOpenTodoChange });
  React.useLayoutEffect(() => {
    toggleStateRef.current = { currentOpenTodoId, isOpenControlled, onOpenTodoChange };
  });

  const handleToggleOpen = React.useCallback((todoId: TodoEditorId) => {
    const state = toggleStateRef.current;
    const next = state.currentOpenTodoId === todoId ? null : todoId;
    if (!state.isOpenControlled) setLocalOpenTodoId(next);
    state.onOpenTodoChange?.(next);
  }, []);

  return {
    openTodoId: currentOpenTodoId,
    focusTodoId: focusTodoId === undefined ? localFocusTodoId : focusTodoId,
    handleToggleOpen,
  };
}

function TodoDraftListEditor({
  addLabel = "액션 추가",
  pickerMode = "wide",
  host,
  todos,
  check = false,
  showAddButton = true,
  disabled = false,
  openTodoId,
  focusTodoId,
  onOpenTodoChange,
  onAddTodo,
  onChangeTodoMode,
  onChangeTodoTitle,
  onChangeTodoWeekdays,
  onChangeTodoDate,
  onChangeTodoTime,
  onChangeTodoDone,
  onRemoveTodo,
}: {
  addLabel?: string;
  /** Layout mode for date/time pickers — wide=Popover, mobile=Sheet. */
  pickerMode?: "wide" | "mobile";
  /** The colour right behind the list: the create dialog and sheets use `background`. */
  host?: TodoScheduleHost;
  todos: TodoDraftEditorItem[];
  /** Shows a done checkbox in front of each row (link detail only). */
  check?: boolean;
  /** Shows the `+ 액션 추가` text button under the list (create form only). */
  showAddButton?: boolean;
  /** Locks every row while the list is being saved. */
  disabled?: boolean;
  /** The row whose schedule panel is open. Leave it out to let the list keep it. */
  openTodoId?: TodoEditorId | null;
  /** The row whose title gets the focus. Leave it out to focus each added row. */
  focusTodoId?: TodoEditorId | null;
  onOpenTodoChange?: (todoId: TodoEditorId | null) => void;
  onAddTodo?: () => void;
  onChangeTodoMode: (todoId: TodoEditorId, nextMode: TodoEditorMode) => void;
  onChangeTodoTitle: (todoId: TodoEditorId, nextTitle: string) => void;
  onChangeTodoWeekdays: (todoId: TodoEditorId, nextWeekdays: WeekdayValue[]) => void;
  onChangeTodoDate: (todoId: TodoEditorId, next: DateValue) => void;
  onChangeTodoTime: (todoId: TodoEditorId, next: TimeValue) => void;
  onChangeTodoDone?: (todoId: TodoEditorId, next: boolean) => void;
  onRemoveTodo: (todoId: TodoEditorId) => void;
}) {
  const open = useOpenAndFocusedTodo(todos, openTodoId, focusTodoId, onOpenTodoChange);
  const listHost = host ?? "background";

  return (
    <View className="gap-2">
      {todos.map((todo) => (
        <TodoEditor
          key={todo.id}
          id={todo.id}
          value={todo.title}
          mode={todo.mode}
          selectedWeekdays={todo.selectedWeekdays}
          date={todo.date}
          time={todo.time}
          validationError={todo.validationError ?? null}
          titleError={todo.titleError ?? null}
          allowPast={todo.allowPast}
          check={check}
          done={check && todo.done === true}
          open={open.openTodoId === todo.id}
          focusRequested={open.focusTodoId === todo.id}
          disabled={disabled}
          pickerMode={pickerMode}
          host={listHost}
          onChangeTitle={onChangeTodoTitle}
          onChangeMode={onChangeTodoMode}
          onChangeWeekdays={onChangeTodoWeekdays}
          onChangeDate={onChangeTodoDate}
          onChangeTime={onChangeTodoTime}
          onChangeDone={onChangeTodoDone}
          onToggleOpen={open.handleToggleOpen}
          onRemove={onRemoveTodo}
        />
      ))}
      {showAddButton && onAddTodo ? (
        <Pressable
          accessibilityRole="button"
          className="h-9 flex-row items-center gap-1.5 self-start rounded-lg px-1 web:hover:bg-accent"
          disabled={disabled}
          onPress={onAddTodo}
        >
          <Icon
            as={Plus}
            size={14}
            className="text-muted-foreground"
          />
          <Text className="text-[13px] font-semibold text-muted-foreground">{addLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export { TodoDraftListEditor };
export type { TodoDraftEditorItem };
