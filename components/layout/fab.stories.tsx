import { View } from "react-native";

import type { Meta, StoryObj } from "@storybook/react-native";

import { Fab } from "./fab";

import { Plus } from "lucide-react-native/icons";

const meta = {
  title: "레이아웃/FAB",
  component: Fab,
  parameters: {
    docs: {
      description: {
        component: "모바일 전용 주요 액션 버튼이다. md 이상에서는 사용하지 않는다.",
      },
    },
  },
  args: {
    icon: Plus,
    label: "추가",
  },
  decorators: [
    (Story) => (
      <View className="h-[400px] p-4">
        <Story />
      </View>
    ),
  ],
} satisfies Meta<typeof Fab>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Basic: Story = {
  name: "기본",
};

export const Inline: Story = {
  name: "줄 안에 놓기",
  args: { placement: "inline", label: "새 링크" },
  render: (args) => (
    <View className="h-[72px] flex-row items-center border-t border-border bg-background">
      <View className="flex-1 px-5" />
      <View className="w-[88px] items-center justify-center">
        <Fab {...args} />
      </View>
    </View>
  ),
};
