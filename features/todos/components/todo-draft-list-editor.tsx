import { Pressable, View } from "react-native";

import { type DateValue } from "@/components/ui/date-picker";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { type TimeValue } from "@/components/ui/time-picker";
import {
  TodoEditor,
  type TodoEditorMode,
  type WeekdayValue,
} from "@/features/todos/components/todo-editor/todo-editor";

import { Plus } from "lucide-react-native/icons";

type TodoDraftEditorItem = {
  id: number | string;
  title: string;
  mode: TodoEditorMode;
  selectedWeekdays: WeekdayValue[];
  date: DateValue | null;
  time: TimeValue | null;
  /** Inline error rendered by the editor when the user attempts save with missing values. */
  validationError?: string | null;
};

function TodoDraftListEditor({
  addLabel = "액션 추가",
  pickerMode = "wide",
  todos,
  onAddTodo,
  onChangeTodoMode,
  onChangeTodoTitle,
  onChangeTodoWeekdays,
  onChangeTodoDate,
  onChangeTodoTime,
  onRemoveTodo,
}: {
  addLabel?: string;
  /** Layout mode for date/time pickers — wide=Popover, mobile=Sheet. */
  pickerMode?: "wide" | "mobile";
  todos: TodoDraftEditorItem[];
  onAddTodo: () => void;
  onChangeTodoMode: (todoId: number | string, nextMode: TodoEditorMode) => void;
  onChangeTodoTitle: (todoId: number | string, nextTitle: string) => void;
  onChangeTodoWeekdays: (todoId: number | string, nextWeekdays: WeekdayValue[]) => void;
  onChangeTodoDate: (todoId: number | string, next: DateValue) => void;
  onChangeTodoTime: (todoId: number | string, next: TimeValue) => void;
  onRemoveTodo: (todoId: number | string) => void;
}) {
  return (
    <View className="gap-3">
      {todos.map((todo, index) => (
        <TodoEditor
          key={todo.id}
          index={index + 1}
          value={todo.title}
          mode={todo.mode}
          selectedWeekdays={todo.selectedWeekdays}
          date={todo.date}
          time={todo.time}
          validationError={todo.validationError ?? null}
          pickerMode={pickerMode}
          onChangeText={(nextTitle) => onChangeTodoTitle(todo.id, nextTitle)}
          onModeChange={(nextMode) => onChangeTodoMode(todo.id, nextMode)}
          onSelectedWeekdaysChange={(nextWeekdays) => onChangeTodoWeekdays(todo.id, nextWeekdays)}
          onDateChange={(next) => onChangeTodoDate(todo.id, next)}
          onTimeChange={(next) => onChangeTodoTime(todo.id, next)}
          onRemove={() => onRemoveTodo(todo.id)}
        />
      ))}
      <Pressable
        className="h-10 flex-row items-center justify-center gap-2 rounded-xl border border-dashed border-border"
        onPress={onAddTodo}
      >
        <Icon
          as={Plus}
          size={18}
          className="text-muted-foreground"
        />
        <Text className="font-semibold text-muted-foreground">{addLabel}</Text>
      </Pressable>
    </View>
  );
}

export { TodoDraftListEditor };
export type { TodoDraftEditorItem };
