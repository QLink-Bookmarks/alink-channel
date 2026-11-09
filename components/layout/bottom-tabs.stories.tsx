import { View } from "react-native";

import type { Meta, StoryObj } from "@storybook/react-native";

import { BottomTabs } from "./bottom-tabs";

import { House, Link, ListTodo } from "lucide-react-native/icons";

const meta = {
  title: "레이아웃/하단 탭",
  component: BottomTabs,
  parameters: {
    docs: {
      description: {
        component: "모바일 전용 하단 내비게이션이다. md 이상에서는 사용하지 않는다.",
      },
    },
  },
  args: {
    value: "home",
    items: [
      { key: "home", label: "홈", icon: House },
      { key: "links", label: "링크", icon: Link },
      { key: "todos", label: "액션", icon: ListTodo },
    ],
  },
  decorators: [
    (Story) => (
      <View className="h-[300px] p-4">
        <Story />
      </View>
    ),
  ],
} satisfies Meta<typeof BottomTabs>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Basic: Story = {
  name: "기본",
};
