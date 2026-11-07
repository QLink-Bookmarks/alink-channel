import * as React from "react";
import { View } from "react-native";

import {
  type TodoDraftEditorItem,
  TodoDraftListEditor,
} from "@/features/todos/components/todo-draft-list-editor";
import { TodoErrorSummary } from "@/features/todos/components/todo-error-summary";
import {
  PAST_REMINDER_ERROR,
  TITLE_REQUIRED_ERROR,
  countTodoDraftErrors,
} from "@/features/todos/lib/todo-schedule";
import type { Meta, StoryObj } from "@storybook/react-native";

const ALL_WEEKDAYS: TodoDraftEditorItem["selectedWeekdays"] = [
  "mon",
  "tue",
  "wed",
  "thu",
  "fri",
  "sat",
  "sun",
];

function nextYearDate(month: number, day: number) {
  return { year: new Date().getFullYear() + 1, month, day };
}

function pastDate() {
  const date = new Date();
  date.setDate(date.getDate() - 2);
  return { year: date.getFullYear(), month: date.getMonth() + 1, day: date.getDate() };
}

function draft(overrides: Partial<TodoDraftEditorItem>): TodoDraftEditorItem {
  return {
    id: "1",
    title: "",
    mode: "none",
    selectedWeekdays: ALL_WEEKDAYS,
    date: null,
    time: null,
    ...overrides,
  };
}

type TodoEditorStoryArgs = {
  initialTodos: TodoDraftEditorItem[];
  initialOpenTodoId?: TodoDraftEditorItem["id"] | null;
  check?: boolean;
  pickerMode?: "wide" | "mobile";
};

function updateTodo(
  todos: TodoDraftEditorItem[],
  todoId: TodoDraftEditorItem["id"],
  patch: Partial<TodoDraftEditorItem>,
) {
  return todos.map((todo) => (todo.id === todoId ? { ...todo, ...patch } : todo));
}

function TodoEditorStory({
  initialTodos,
  initialOpenTodoId = null,
  check = false,
  pickerMode = "wide",
}: TodoEditorStoryArgs) {
  const [todos, setTodos] = React.useState(initialTodos);
  const [openTodoId, setOpenTodoId] = React.useState(initialOpenTodoId);

  return (
    <View className="gap-3">
      <TodoDraftListEditor
        check={check}
        showAddButton={!check}
        pickerMode={pickerMode}
        todos={todos}
        openTodoId={openTodoId}
        onOpenTodoChange={setOpenTodoId}
        onAddTodo={() =>
          setTodos((current) => [...current, draft({ id: `new-${current.length + 1}` })])
        }
        onChangeTodoTitle={(id, title) =>
          setTodos((current) => updateTodo(current, id, { title, titleError: null }))
        }
        onChangeTodoMode={(id, mode) =>
          setTodos((current) =>
            updateTodo(current, id, { mode, validationError: null, titleError: null }),
          )
        }
        onChangeTodoWeekdays={(id, selectedWeekdays) =>
          setTodos((current) =>
            updateTodo(current, id, { selectedWeekdays, validationError: null }),
          )
        }
        onChangeTodoDate={(id, date) =>
          setTodos((current) => updateTodo(current, id, { date, validationError: null }))
        }
        onChangeTodoTime={(id, time) =>
          setTodos((current) => updateTodo(current, id, { time, validationError: null }))
        }
        onChangeTodoDone={(id, done) => setTodos((current) => updateTodo(current, id, { done }))}
        onRemoveTodo={(id) => setTodos((current) => current.filter((todo) => todo.id !== id))}
      />
      <TodoErrorSummary count={countTodoDraftErrors(todos)} />
    </View>
  );
}

const meta = {
  title: "기능/액션/액션 편집기",
  component: TodoEditorStory,
  args: {
    initialTodos: [
      draft({ id: "a", title: "렌터카 예약 확인" }),
      draft({ id: "b", title: "숙소 2박 결제" }),
    ],
  },
  decorators: [
    (Story) => (
      <View className="max-w-xl bg-background p-4">
        <Story />
      </View>
    ),
  ],
} satisfies Meta<typeof TodoEditorStory>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Basic: Story = {
  name: "기본",
};

export const Once: Story = {
  name: "한 번 알림",
  args: {
    initialTodos: [
      draft({
        id: "once",
        title: "렌터카 예약 확인",
        mode: "time",
        date: nextYearDate(11, 20),
        time: { hour: 9, minute: 0 },
      }),
    ],
    initialOpenTodoId: "once",
  },
};

export const Repeat: Story = {
  name: "반복",
  args: {
    initialTodos: [
      draft({
        id: "repeat",
        title: "항공권 가격 확인",
        mode: "recurring",
        selectedWeekdays: ["mon", "thu"],
        date: nextYearDate(12, 31),
        time: { hour: 8, minute: 0 },
      }),
    ],
    initialOpenTodoId: "repeat",
  },
};

export const PastError: Story = {
  name: "지난 시각 오류",
  args: {
    initialTodos: [
      draft({
        id: "past",
        title: "렌터카 예약 확인",
        mode: "time",
        date: pastDate(),
        time: { hour: 9, minute: 0 },
        validationError: PAST_REMINDER_ERROR,
      }),
    ],
    initialOpenTodoId: "past",
  },
};

export const MissingTimeAndTitle: Story = {
  name: "제목 오류 + 시간 빠짐",
  args: {
    initialTodos: [
      draft({
        id: "untitled",
        mode: "time",
        date: nextYearDate(11, 22),
        time: { hour: 10, minute: 0 },
        titleError: TITLE_REQUIRED_ERROR,
      }),
      draft({
        id: "missing",
        title: "숙소 2박 결제",
        mode: "time",
        date: nextYearDate(11, 21),
        validationError: "시간을 선택해주세요.",
      }),
    ],
    initialOpenTodoId: "missing",
  },
};

export const FullTitle: Story = {
  name: "50자",
  args: {
    initialTodos: [
      draft({
        id: "full",
        title:
          "공항 셔틀 첫차 시간과 렌터카 반납 장소, 주차 요금, 유류비까지 모두 한 번에 확인하기.",
      }),
      draft({
        id: "near",
        title: "공항 셔틀 첫차 시간과 렌터카 반납 장소, 주차 요금까지 미리 꼭 확인해 두기",
      }),
    ],
  },
};

export const DetailCheck: Story = {
  name: "완료 체크 (상세)",
  args: {
    check: true,
    initialTodos: [
      draft({
        id: "open",
        title: "렌터카 예약 확인",
        mode: "time",
        date: nextYearDate(11, 20),
        time: { hour: 9, minute: 0 },
      }),
      draft({
        id: "repeat",
        title: "항공권 가격 확인",
        mode: "recurring",
        selectedWeekdays: ["mon", "thu"],
        date: nextYearDate(12, 31),
        time: { hour: 8, minute: 0 },
      }),
      draft({ id: "done", title: "숙소 2박 결제", done: true }),
    ],
    initialOpenTodoId: "open",
  },
};
