import { View } from "react-native";

import type { Meta, StoryObj } from "@storybook/react-native";

import { TodoEditor } from "./todo-editor";

import { useArgs } from "storybook/preview-api";

type TodoEditorStoryArgs = {
  value: string;
  mode: "none" | "time" | "recurring";
};

function TodoEditorStory({
  value,
  mode,
  onChangeText,
  onModeChange,
}: TodoEditorStoryArgs & {
  onChangeText: (value: string) => void;
  onModeChange: (mode: TodoEditorStoryArgs["mode"]) => void;
}) {
  return (
    <TodoEditor
      value={value}
      mode={mode}
      onChangeText={onChangeText}
      onModeChange={onModeChange}
      onDateChange={() => console.log("storybook:todo-date")}
      onTimeChange={() => console.log("storybook:todo-time")}
      onRemove={() => console.log("storybook:todo-remove")}
    />
  );
}

const meta = {
  title: "기능/액션/액션 편집기",
  args: {
    value: "링크 확인하기",
    mode: "recurring",
  },
  render: function Render(args) {
    const [, updateArgs] = useArgs();

    return (
      <TodoEditorStory
        {...args}
        onChangeText={(value) => updateArgs({ value })}
        onModeChange={(mode) => updateArgs({ mode })}
      />
    );
  },
  decorators: [
    (Story) => (
      <View className="max-w-md p-4">
        <Story />
      </View>
    ),
  ],
} satisfies Meta<TodoEditorStoryArgs>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Basic: Story = {
  name: "기본",
};
