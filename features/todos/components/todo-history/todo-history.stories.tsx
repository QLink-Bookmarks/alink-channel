import { View } from "react-native";

import type { Meta, StoryObj } from "@storybook/react-native";

import { TodoHistory } from "./todo-history";

import { useArgs } from "storybook/preview-api";

type TodoHistoryStoryArgs = {
  open: boolean;
  entries: {
    date: string;
    time?: string;
  }[];
};

function TodoHistoryStory({
  open,
  entries,
  onToggle,
}: TodoHistoryStoryArgs & { onToggle: () => void }) {
  return (
    <TodoHistory
      open={open}
      entries={entries}
      onToggle={onToggle}
    />
  );
}

const meta = {
  title: "기능/액션/액션 기록",
  args: {
    open: true,
    entries: [
      { date: "오늘", time: "09:00" },
      { date: "어제", time: "18:30" },
    ],
  },
  render: function Render(args) {
    const [, updateArgs] = useArgs();

    return (
      <TodoHistoryStory
        {...args}
        onToggle={() => updateArgs({ open: !args.open })}
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
} satisfies Meta<TodoHistoryStoryArgs>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Basic: Story = {
  name: "기본",
};

export const Empty: Story = {
  name: "비어 있음",
  args: {
    entries: [],
  },
};
