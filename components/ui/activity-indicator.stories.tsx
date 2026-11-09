import { View } from "react-native";

import type { Meta, StoryObj } from "@storybook/react-native";

import { ActivityIndicator } from "./activity-indicator";
import { Button } from "./button";
import { Text } from "./text";

const meta = {
  title: "공통 UI/로딩 표시",
  component: ActivityIndicator,
  args: { size: "small", tone: "primary" },
  argTypes: {
    size: { control: "select", options: ["small", "large"] },
    tone: { control: "select", options: ["primary", "onPrimary"] },
  },
  decorators: [
    (Story) => (
      <View className="items-start p-4">
        <Story />
      </View>
    ),
  ],
} satisfies Meta<typeof ActivityIndicator>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Basic: Story = {
  name: "기본",
};

export const OnPrimaryButton: Story = {
  name: "주 버튼 안",
  render: () => (
    <Button
      disabled
      className="flex-row gap-2"
    >
      <ActivityIndicator tone="onPrimary" />
      <Text>옮기는 중</Text>
    </Button>
  ),
};
